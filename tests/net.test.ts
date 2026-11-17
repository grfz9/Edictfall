// Multijoueur en ligne : un hôte + 2 invités reliés par un transport factice en mémoire.
// Vérifie l'accueil au hall, les entrées des invités appliquées par l'hôte, les instantanés appliqués sur les
// mondes miroirs pendant 60 s simulées, les votes d'édit et les déconnexions (invité, puis hôte).
import { describe, it, expect } from 'vitest';
import { defaultSave } from '../src/core/save';
import { World, emptyInput } from '../src/sim/world';
import { botInput } from '../src/sim/bot';
import { MemoryNet } from '../src/net/transport';
import { NetHost } from '../src/net/host';
import { NetClient } from '../src/net/client';
import { encodeFloor, decodeFloor } from '../src/net/codec';
import { normalizeCode, packInput, unpackInput, cleanName } from '../src/net/protocol';
import type { PlayerInput } from '../src/core/types';

import.meta.glob('../src/content/**/*.ts', { eager: true });

const DT = 1 / 60;

/** Laisse passer les promesses et délivre les messages en file. */
async function settle(net: MemoryNet): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 0));
    net.pump();
  }
}

async function setup() {
  const net = new MemoryNet();
  const hw = new World(defaultSave());
  hw.startHub();
  const host = new NetHost(hw, net.transport(), 'Hôte');
  const code = await host.open('NETAB');
  let simT = 0;
  const guests = [] as { w: World; c: NetClient }[];
  for (const name of ['Alice', 'Bob']) {
    const w = new World(defaultSave());
    w.startHub();
    const c = new NetClient(w, net.transport(), name);
    c.clock = () => simT * 1000;
    const p = c.join(code);
    await settle(net);
    await p;
    guests.push({ w, c });
  }
  /** Une image : entrées des invités → réseau → simulation de l'hôte → instantanés → réseau → interpolation. */
  const frame = (inputs: (PlayerInput | null)[], hostInput?: PlayerInput) => {
    simT += DT;
    guests.forEach((g, i) => { const inp = inputs[i]; if (inp && g.c.connected) g.c.pushInput(inp, DT); });
    net.pump();
    if (hostInput && hw.players[0]) hw.players[0].input = hostInput;
    hw.update(DT);
    for (const p of hw.players) p.input.swap = p.input.interact = p.input.skill = p.input.firePressed = false;
    host.update(DT);
    hw.fx.length = 0;
    net.pump();
    for (const g of guests) { g.c.frame(DT); g.w.fx.length = 0; }
  };
  return { net, hw, host, code, guests, frame, time: () => simT };
}

const move = (mx: number, my: number, fire = false): PlayerInput => ({ ...emptyInput(), mx, my, fire });

describe('multijoueur en ligne (transport en mémoire)', () => {
  it('protocole : codes, pseudos et entrées compactes', () => {
    expect(normalizeCode(' ab-cd e ')).toBe('ABCDE');
    expect(normalizeCode('https://x.io/?salon=QWERT&net=local')).toBe('QWERT');
    expect(cleanName('  <b>Zoé</b>  ')).toBe('bZoé/b');
    expect(cleanName('')).toBe('Joueur');
    const i = { ...emptyInput(), mx: 0.5, my: -1, ax: 12.345, ay: -3, fire: true, skill: true };
    expect(unpackInput(packInput(i))).toMatchObject({ mx: 0.5, my: -1, ax: 12.35, ay: -3, fire: true, skill: true, swap: false });
    expect(unpackInput('n\'importe quoi')).toBeNull();
  });

  it('la carte survit à l\'encodage', () => {
    const w = new World(defaultSave());
    w.startHub();
    w.startRun('CARTE', [w.players[0].hero.id]);
    const f = decodeFloor(JSON.parse(JSON.stringify(encodeFloor(w.floor))));
    expect(f.w).toBe(w.floor.w);
    expect([...f.tiles]).toEqual([...w.floor.tiles]);
    expect(f.rooms.length).toBe(w.floor.rooms.length);
    expect(f.start.id).toBe(w.floor.start.id);
  });

  it('un hôte + 2 invités : hall, partie de 60 s, votes, déconnexions', async () => {
    const { net, hw, host, guests, frame } = await setup();
    const [A, B] = guests;

    // --- accueil au hall
    expect(host.members.length).toBe(3);
    expect(hw.players.length).toBe(3);
    expect(A.c.index).toBe(1);
    expect(B.c.index).toBe(2);
    for (let i = 0; i < 10; i++) frame([null, null]);
    expect(A.w.players.length).toBe(3);
    expect(A.w.mode).toBe('hub');
    expect(A.c.lobby.map((e) => e.name)).toEqual(['Hôte', 'Alice', 'Bob']);
    // chacun a un héros (débloqué chez l'hôte) ; les invités ne dépensent pas les gemmes de l'hôte
    expect(hw.players.every((p) => hw.heroUnlocked(p.hero))).toBe(true);
    expect(hw.canSpend(hw.players[1])).toBe(false);

    // --- l'entrée d'Alice déplace SON joueur chez l'hôte, et le miroir de Bob le voit bouger
    const ax0 = hw.players[1].x, bx0 = hw.players[2].x;
    for (let i = 0; i < 40; i++) frame([move(1, 0), null]);
    expect(hw.players[1].x).toBeGreaterThan(ax0 + 20);
    expect(Math.abs(hw.players[2].x - bx0)).toBeLessThan(1);
    expect(B.w.players[1].x).toBeGreaterThan(ax0 + 15);
    expect(Math.abs(B.w.players[1].x - hw.players[1].x)).toBeLessThan(12);

    // --- l'hôte lance la partie (un héros par membre)
    hw.startRun('NETRUN', host.heroIds(), 'story');
    expect(hw.players.length).toBe(3);
    expect(hw.players.map((p) => p.hero.id)).toEqual(host.heroIds());
    let maxEnemies = 0, matched = 0, choiceSeen = 0, voted = false, votesSeen = 0, aMoved = 0;
    let errors: unknown = null;
    const start = { x: 0, y: 0 };
    try {
      for (let f = 0; f < 60 * 60; f++) {
        // l'hôte joue avec le bot ; tout le monde est invulnérable pour tenir 60 s
        for (const p of hw.players) { p.hp = hw.maxHp(p); p.energy = Math.max(p.energy, 60); p.downed = false; }
        if (hw.choice) {
          choiceSeen++;
          if (!voted && A.w.choice) { A.c.vote(A.w.choice.options.length - 1); voted = true; }
          if (host.votes().length) votesSeen++;
          if (choiceSeen % 40 === 0) hw.pick(0);
        }
        if (hw.dialog) hw.dialogChoose(-1);
        const t = f * DT;
        const ai = A.w.players[A.c.index];
        const near = ai ? A.w.enemies.find((e) => !e.dead) : undefined;
        const aIn = move(Math.cos(t * 1.3), Math.sin(t * 0.9), true);
        if (ai && near) { aIn.ax = near.x - ai.x; aIn.ay = near.y - ai.y; aIn.aimManual = true; }
        if (f % 90 === 0) aIn.swap = true;
        if (f === 120) { start.x = hw.players[1].x; start.y = hw.players[1].y; }
        frame([aIn, move(-Math.sin(t), Math.cos(t * 1.1), true)], hw.mode === 'run' ? botInput(hw, hw.players[0]) : undefined);
        if (f > 120) aMoved = Math.max(aMoved, Math.hypot(hw.players[1].x - start.x, hw.players[1].y - start.y));
        const alive = hw.enemies.filter((e) => !e.dead).length;
        maxEnemies = Math.max(maxEnemies, B.w.enemies.length);
        if (alive > 0 && B.w.enemies.length > 0) matched++;
        if (hw.mode !== 'run') break;
      }
    } catch (e) { errors = e; }
    expect(errors).toBeNull();
    expect(hw.mode).toBe('run');
    // les instantanés arrivent à ~20 Hz et sont appliqués
    expect(A.c.mirror.applied).toBeGreaterThan(1000);
    expect(B.c.mirror.applied).toBeGreaterThan(1000);
    // les invités voient la même carte, les mêmes joueurs, les ennemis
    expect(A.w.floor.w).toBe(hw.floor.w);
    expect([...A.w.floor.tiles]).toEqual([...hw.floor.tiles]);
    expect(A.w.players.map((p) => p.hero.id)).toEqual(hw.players.map((p) => p.hero.id));
    expect(maxEnemies).toBeGreaterThan(0);
    expect(matched).toBeGreaterThan(60);
    expect(A.w.worldNum).toBe(hw.worldNum);
    expect(A.w.coins).toBe(hw.coins);
    expect(A.w.rules.list.map((i) => i.def.id).sort()).toEqual(hw.rules.list.map((i) => i.def.id).sort());
    // les entrées des invités déplacent leurs joueurs pendant la partie
    expect(aMoved).toBeGreaterThan(30);
    // choix d'édit visible chez les invités, vote reçu par l'hôte
    expect(choiceSeen).toBeGreaterThan(0);
    expect(voted).toBe(true);
    expect(votesSeen).toBeGreaterThan(0);
    // bande passante raisonnable (deux invités, entrées + instantanés)
    const kbps = net.bytes / 1024 / 62;
    expect(kbps).toBeLessThan(400);

    // --- Bob se déconnecte : son joueur est retiré proprement, Alice garde son index
    B.c.close();
    await settle(net);
    expect(host.members.length).toBe(2);
    expect(hw.players.length).toBe(2);
    expect(hw.players.map((p) => p.index)).toEqual([0, 1]);
    for (let i = 0; i < 30; i++) frame([move(0, 1), null]);
    expect(A.w.players.length).toBe(2);
    expect(A.c.index).toBe(1);
    expect(A.c.lobby.map((e) => e.name)).toEqual(['Hôte', 'Alice']);
    expect(B.c.connected).toBe(false);

    // --- l'hôte ferme le salon : Alice est prévenue
    let reason = '';
    A.c.onClose = (r) => { reason = r; };
    host.close('L\'hôte est parti.');
    await settle(net);
    expect(reason).toBe('L\'hôte est parti.');
    expect(A.c.connected).toBe(false);
  });

  it('refuse un 5e joueur et une arrivée en pleine partie', async () => {
    const { net, hw, host, code } = await setup();
    const w4 = new World(defaultSave()); w4.startHub();
    const c4 = new NetClient(w4, net.transport(), 'Dana');
    const p4 = c4.join(code);
    await settle(net);
    await p4;
    expect(host.members.length).toBe(4);
    const w5 = new World(defaultSave()); w5.startHub();
    const c5 = new NetClient(w5, net.transport(), 'Eve');
    const p5 = c5.join(code).then(() => 'ok', (e: Error) => e.message);
    await settle(net);
    expect(await p5).toMatch(/complet/);
    // départ de Dana, puis la partie commence : un nouvel arrivant est refusé
    c4.close();
    await settle(net);
    hw.startRun('NETRUN2', host.heroIds());
    const w6 = new World(defaultSave()); w6.startHub();
    const c6 = new NetClient(w6, net.transport(), 'Fred');
    const p6 = c6.join(code).then(() => 'ok', (e: Error) => e.message);
    await settle(net);
    expect(await p6).toMatch(/en cours/);
    // salon inconnu
    const c7 = new NetClient(new World(defaultSave()), net.transport(), 'Gus');
    await expect(c7.join('ZZZZZ')).rejects.toThrow(/introuvable/);
  });
});
