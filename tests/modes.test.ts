// Modes de jeu (Histoire / Infini / Défi quotidien), Wassim Hadmi, salles spéciales, hall vivant.
import { describe, it, expect } from 'vitest';
import { defaultSave } from '../src/core/save';
import { World, dailySeedFor } from '../src/sim/world';
import { botInput } from '../src/sim/bot';
import { floorIsConnected, roomCenter } from '../src/sim/dungeon';
import { R } from '../src/core/registry';
import { PAL } from '../src/render/palette';
import { WASSIM_DEALS } from '../src/content/story/wassim';
import { SPECIAL_ROOMS } from '../src/content/rooms/_kit';
import { INTRO, ENDING, INTERLUDES } from '../src/content/story/lore';
import type { RunMode } from '../src/core/types';

import.meta.glob('../src/content/**/*.ts', { eager: true });

function newRun(seed: string, mode: RunMode = 'story', hero?: string): World {
  const w = new World(defaultSave());
  w.startHub();
  w.startRun(seed, [hero ?? w.players[0].hero.id], mode);
  return w;
}
/** Bot invincible : choisit la première carte, ferme les dialogues, téléporte au portail si l'étage traîne. */
function play(w: World, ticks: number, until?: (w: World) => boolean): void {
  for (let i = 0; i < ticks; i++) {
    if (w.mode !== 'run' || until?.(w)) break;
    if (w.choice) { w.pick(0); continue; }
    if (w.dialog) { w.dialogChoose(-1); continue; }
    const p = w.players[0];
    p.hp = w.maxHp(p); p.energy = Math.max(p.energy, 80);
    p.input = botInput(w, p);
    w.update(1 / 60);
    w.fx.length = 0;
  }
}
/** Accélère : tue tout ce qui est actif et prend le portail dès qu'il apparaît. */
function rushFloor(w: World): void {
  const start = w.depth();
  for (let i = 0; i < 20000 && w.mode === 'run' && w.depth() === start; i++) {
    if (w.choice) { w.pick(0); continue; }
    if (w.dialog) { w.dialogChoose(-1); continue; }
    const portal = w.items.find((it) => !it.dead && it.kind === 'portal');
    if (portal && i % 30 === 0) { portal.use!(w.ctx, w.players[0], portal); continue; }
    if (i % 20 === 0) for (const e of w.enemies) if (!e.dead && e.spawnT <= 0 && e.def.id !== 'dummy') w.ctx.damageEnemy(e, 1e6);
    const p = w.players[0];
    // le bot peut frôler une salle sans la déclencher : on l'y dépose
    if (i % 900 === 899) { const r = w.floor.rooms.find((q) => q.state === 'fresh' && !q.hidden); if (r) { const c = roomCenter(r); p.x = c.x; p.y = c.y; } }
    p.hp = w.maxHp(p); p.energy = Math.max(p.energy, 80);
    p.input = botInput(w, p);
    w.update(1 / 60);
    w.fx.length = 0;
  }
}

describe('modes de jeu', () => {
  it('Infini : 10 étages au bot sans erreur, boss tous les 5 étages, score et record', () => {
    const w = newRun('INFINI', 'endless');
    expect(w.runMode).toBe('endless');
    let bosses = 0;
    for (let f = 0; f < 10; f++) {
      const before = w.stats.bosses;
      rushFloor(w);
      bosses += w.stats.bosses - before;
      expect(w.mode).toBe('run');
    }
    expect(w.depth()).toBeGreaterThanOrEqual(10);
    expect(bosses).toBeGreaterThanOrEqual(2);
    expect(w.difficulty().hp).toBeGreaterThan(1.3);
    w.finish(false);
    expect(w.summary!.mode).toBe('endless');
    expect(w.summary!.stage).toBeGreaterThanOrEqual(11);
    expect(w.summary!.newRecord).toBe(true);
    expect(w.save.records!.endless!.score).toBe(w.summary!.score);
  });

  it('Infini : passe le monde 3 sans victoire (boucle continue)', () => {
    const w = newRun('INF2', 'endless');
    w.worldNum = 3; w.floorNum = 5;
    w.nextFloor();
    expect(w.mode).toBe('run');
    expect(w.loop).toBe(1);
    expect(w.worldNum).toBe(1);
  });

  it('Défi quotidien déterministe : même seed → mêmes édits, même étage', () => {
    const seed = dailySeedFor(2026, 11, 16);
    expect(seed).toBe('J20261116');
    const a = newRun(seed, 'daily'), b = newRun(seed, 'daily');
    expect(a.dailyRules.length).toBe(3);
    expect(a.dailyRules).toEqual(b.dailyRules);
    expect(a.choice).toBeNull();
    expect(Buffer.from(a.floor.tiles).equals(Buffer.from(b.floor.tiles))).toBe(true);
    for (const id of a.dailyRules) expect(a.rules.has(id)).toBe(true);
    expect(a.wassimDeals().map((d) => d.id)).toEqual(b.wassimDeals().map((d) => d.id));
    const c = newRun(dailySeedFor(2026, 11, 17), 'daily');
    expect(c.dailyRules.join() === a.dailyRules.join() && Buffer.from(c.floor.tiles).equals(Buffer.from(a.floor.tiles))).toBe(false);
    play(a, 1500);
    a.finish(false);
    expect(a.save.records!.daily!.seed).toBe(seed);
  });

  it('Histoire : scène entre les mondes et fin narrative', () => {
    const w = newRun('HIST', 'story');
    w.worldNum = 1; w.floorNum = 5;
    w.nextFloor();
    expect(w.request).toEqual({ type: 'scene', data: 1 });
    w.worldNum = 3; w.floorNum = 5;
    w.nextFloor();
    expect(w.mode).toBe('won');
    expect(w.summary!.ending).toBe(true);
    expect(INTRO.length).toBeGreaterThanOrEqual(5);
    expect(INTRO.length).toBeLessThanOrEqual(8);
    expect(ENDING.length).toBeGreaterThan(0);
    expect(Object.keys(INTERLUDES).length).toBe(2);
  });

  it('la difficulté grimpe avec la profondeur', () => {
    const w = newRun('DIFF');
    const d0 = w.difficulty();
    w.worldNum = 3; w.floorNum = 5;
    const d1 = w.difficulty();
    expect(d1.hp).toBeGreaterThan(d0.hp * 1.4);
    expect(d1.budget).toBeGreaterThan(d0.budget * 2);
    expect(d1.elite).toBeGreaterThan(0.2);
  });
});

describe('Wassim Hadmi', () => {
  it('apparaît dans la salle de départ avec 3 marchés', () => {
    const w = newRun('WASSIM');
    const it = w.items.find((i) => i.data?.wassim)!;
    expect(it).toBeTruthy();
    expect(it.data.deals.length).toBe(3);
    w.choice = null;
    it.use!(w.ctx, w.players[0], it);
    expect(w.dialog).toBeTruthy();
    expect(w.dialog!.options!.length).toBe(4);
    w.dialogChoose(3); // refuser
    expect(w.dialog).toBeTruthy(); // réplique vexée
    w.dialogChoose(-1);
    expect(w.dialog).toBeNull();
    expect(it.data.done).toBe(true);
  });

  for (const d of WASSIM_DEALS) {
    it(`marché « ${d.id} » appliqué sans exception`, () => {
      const w = newRun('DEAL-' + d.id);
      const p = w.players[0];
      expect(() => d.apply(w.ctx, p)).not.toThrow();
      play(w, 900);
      expect(w.mode === 'run' || w.mode === 'dead').toBe(true);
      for (const q of w.players) expect(Number.isFinite(q.hp)).toBe(true);
    });
  }
});

describe('salles spéciales', () => {
  for (const def of SPECIAL_ROOMS.values()) {
    it(`« ${def.id} » générée, connectée et traversée`, () => {
      const w = newRun('ROOM-' + def.id);
      w.forceSpecial = def.id;
      w.nextFloor(); // 1-2 avec la salle forcée
      const room = w.floor.rooms.find((r) => r.type === 'special');
      expect(room).toBeTruthy();
      expect(room!.data.special).toBe(def.id);
      expect(floorIsConnected(w.floor)).toBe(true);
      // on entre dans la salle
      const p = w.players[0];
      const c = roomCenter(room!);
      w.choice = null;
      p.x = c.x - 40; p.y = c.y + 40;
      play(w, 120);
      expect(room!.visited).toBe(true);
      // on utilise chaque objet interactif de la salle (et on ferme les dialogues en choisissant chaque option)
      const inRoom = w.items.filter((i) => !i.dead && i.use && w.inRoom(room!, i.x, i.y));
      for (const it of inRoom) {
        for (let opt = 0; opt < 4; opt++) {
          w.coins = 50; w.gems = 3;
          expect(() => it.use!(w.ctx, p, it)).not.toThrow();
          let guard = 0;
          while (w.dialog && guard++ < 6) w.dialogChoose(guard === 1 ? opt : -1);
          while (w.choice) w.pick(0);
        }
      }
      play(w, 900);
      expect(w.mode === 'run' || w.mode === 'dead').toBe(true);
      // traversée complète de l'étage au bot
      rushFloor(w);
      expect(w.mode).toBe('run');
    });
  }

  it('au moins 5 types de salles, boss secret disponible', () => {
    expect(SPECIAL_ROOMS.size).toBeGreaterThanOrEqual(5);
    const w = newRun('SEAL');
    w.worldNum = 2; w.floorNum = 1;
    w.forceSpecial = 'seal';
    w.nextFloor();
    const room = w.floor.rooms.find((r) => r.type === 'special')!;
    w.lockSpecial(room, () => w.ctx.spawnEnemy([...R.enemies.values()].find((d) => d.id.startsWith('boss_secret'))?.id ?? 'dummy', 0, 0));
    expect(room.state).toBe('active');
  });
});

describe('hall', () => {
  it('hall vivant : PNJ, panneau des modes, mannequins, bulles', () => {
    const w = new World(defaultSave());
    w.startHub();
    expect(w.items.filter((i) => i.kind === 'npc' && i.use).length).toBeGreaterThanOrEqual(7);
    expect(w.enemies.filter((e) => e.def.id === 'dummy').length).toBe(3);
    const herald = w.items.find((i) => i.data?.npc === 'herald')!;
    herald.use!(w.ctx, w.players[0], herald);
    expect(w.request).toEqual({ type: 'modes' });
    const teller = w.items.find((i) => i.data?.npc === 'teller')!;
    w.request = null;
    teller.use!(w.ctx, w.players[0], teller);
    expect(w.dialog).toBeTruthy();
    w.dialogChoose(0);
    expect(w.request).toEqual({ type: 'intro' });
    const p = w.players[0];
    p.x = herald.x; p.y = herald.y + 20;
    for (let i = 0; i < 400; i++) { w.update(1 / 60); w.fx.length = 0; }
    expect(w.bubbles.length).toBeGreaterThan(0);
  });

  it('sprites des PNJ et salles : lignes de même largeur, couleurs connues', () => {
    for (const [id, s] of R.sprites) {
      if (!/^(npc_|deco_|room_)/.test(id)) continue;
      const wdt = s.px[0].length;
      for (const row of s.px) {
        expect(row.length, id).toBe(wdt);
        for (const ch of row) if (ch !== '.' && ch !== ' ') expect(PAL[ch] ?? s.pal?.[ch], `${id} '${ch}'`).toBeTruthy();
      }
    }
  });
});
