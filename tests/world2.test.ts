import { describe, it, expect } from 'vitest';
import { makeWorld } from './helpers';
import { R } from '../src/core/registry';
import { PAL } from '../src/render/palette';
import type { World } from '../src/sim/world';
import type { EnemyDef, AttackSpec, PlayerInput, Enemy } from '../src/core/types';

const IDLE: PlayerInput = { mx: 0, my: 0, ax: 0, ay: 0, aimManual: false, fire: false, firePressed: false, swap: false, interact: false, skill: false };

const w2 = (): EnemyDef[] => [...R.enemies.values()].filter((d) => d.world === 2);
const w2Normal = () => w2().filter((d) => !d.boss);
const w2Boss = () => w2().filter((d) => d.boss);
const mine = (): EnemyDef[] => [...R.enemies.values()].filter((d) => d.world === 2 || d.id.startsWith('w2_'));
const allAttacks = (d: EnemyDef): AttackSpec[] => [...(d.attacks ?? []), ...(d.boss?.phases.flatMap((p) => p.attacks) ?? [])];

function prep(seed: string): World {
  const w = makeWorld(seed);
  while (w.choice) w.pick(0);
  w.worldNum = 2;
  w.enemies.length = 0;
  w.bullets.length = 0;
  w.timers.length = 0;
  return w;
}

function spawnNear(w: World, id: string): Enemy {
  const p = w.players[0];
  let pos: { x: number; y: number } | null = null;
  for (const r of [70, 55, 90, 40]) {
    for (let k = 0; k < 16 && !pos; k++) {
      const a = (k / 16) * Math.PI * 2;
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (w.ctx.isFree(x, y, 9) && w.ctx.los(p.x, p.y, x, y) && w.inRoom(w.curRoom!, x, y)) pos = { x, y };
    }
    if (pos) break;
  }
  pos ??= w.ctx.freeSpot(w.curRoom, 30);
  const e = w.ctx.spawnEnemy(id, pos.x, pos.y, { delay: 0 });
  expect(e, id).toBeTruthy();
  return e!;
}

/** Simule secs secondes ; retourne true si une balle ennemie a existé. */
function simulate(w: World, secs: number, label: string): boolean {
  const p = w.players[0];
  let fired = false;
  for (let i = 0; i < secs * 60; i++) {
    while (w.choice) w.pick(0);
    p.hp = w.maxHp(p);
    p.input = IDLE;
    w.update(1 / 60);
    w.fx.length = 0;
    if (!fired && w.bullets.some((b) => b.team === 'enemy')) fired = true;
    for (const e of w.enemies) {
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) throw new Error(`${label}: NaN position (${e.def.id})`);
    }
    for (const b of w.bullets) if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) throw new Error(`${label}: NaN balle`);
  }
  expect(w.mode, label).toBe('run');
  expect(w.rules.errors, label).toEqual([]);
  return fired;
}

describe('Monde 2 — Glacier Fendu', () => {
  it('contenu : nombre, boss unique, répartition', () => {
    expect(w2Normal().length).toBeGreaterThanOrEqual(20);
    expect(w2Boss().length).toBe(1);
    expect(w2Boss()[0].id.startsWith('boss_')).toBe(true);
    expect(w2Boss()[0].boss!.phases.length).toBe(3);
    const floor1 = w2Normal().filter((d) => (d.minFloor ?? 1) === 1).length;
    expect(floor1).toBeGreaterThanOrEqual(6);
    const kinds = new Set(w2Normal().map((d) => d.move.kind));
    for (const k of ['chase', 'keepDistance', 'wander', 'charge', 'stationary', 'teleport', 'orbit', 'flee', 'hop', 'zigzag']) expect(kinds.has(k as any), k).toBe(true);
    const pats = new Set(w2Normal().flatMap(allAttacks).map((a) => a.pattern));
    for (const k of ['aimed', 'spread', 'burst', 'ring', 'rings', 'spiral', 'spray', 'wall', 'cross', 'homing', 'lob', 'rain', 'laser', 'summon', 'dash', 'melee', 'mines', 'blink']) expect(pats.has(k), k).toBe(true);
    for (const d of w2Normal()) {
      expect(d.cost ?? 1).toBeGreaterThanOrEqual(1);
      expect(d.cost ?? 1).toBeLessThanOrEqual(4);
      expect(d.minFloor ?? 1).toBeLessThanOrEqual(5);
    }
  });

  it('sprites valides (largeurs, palette)', () => {
    const ids = new Set<string>(mine().map((d) => d.sprite));
    for (const s of R.sprites.keys()) if (s.startsWith('eb_w2_')) ids.add(s);
    for (const id of ids) {
      const s = R.sprites.get(id);
      expect(s, id).toBeTruthy();
      const frames = [s!.px, ...(s!.frames ?? [])];
      expect(frames.length, id).toBeGreaterThanOrEqual(id.startsWith('eb_') ? 1 : 2);
      const W = s!.px[0].length, H = s!.px.length;
      for (const f of frames) {
        expect(f.length, id).toBe(H);
        for (const row of f) {
          expect(row.length, `${id}: "${row}"`).toBe(W);
          for (const ch of row) if (ch !== '.' && ch !== ' ') expect(ch in PAL || (s!.pal && ch in s!.pal), `${id}: caractère "${ch}"`).toBe(true);
        }
      }
    }
    const boss = R.sprites.get(w2Boss()[0].sprite)!;
    expect(boss.px[0].length).toBeGreaterThanOrEqual(26);
    expect(boss.px.length).toBeGreaterThanOrEqual(26);
  });

  it('patterns et invocations référencés existent', () => {
    for (const d of mine()) {
      for (const a of allAttacks(d)) {
        expect(R.patterns.has(a.pattern), `${d.id}: ${a.pattern}`).toBe(true);
        if (a.pattern === 'summon') expect(R.enemies.has(a.params?.id), `${d.id}: summon ${a.params?.id}`).toBe(true);
        if (a.telegraph !== undefined) expect(a.telegraph, d.id).toBeGreaterThanOrEqual(0.3);
        if (d.boss) expect(a.telegraph ?? 0.35, d.id).toBeGreaterThanOrEqual(0.4);
        const st = a.params?.status ?? a.params?.bullet?.status;
        if (st) expect(st.dur, d.id).toBeLessThanOrEqual(1.5);
        if (a.params?.damage) expect(a.params.damage, d.id).toBeLessThanOrEqual(2);
      }
    }
  });

  for (const d of [...R.enemies.values()].filter((x) => (x.world === 2 || x.id.startsWith('w2_')) && !x.boss)) {
    it(`simulation 12 s : ${d.id}`, () => {
      const w = prep('W2-' + d.id);
      spawnNear(w, d.id);
      const fired = simulate(w, 12, d.id);
      if ((d.attacks?.length ?? 0) > 0) expect(fired, `${d.id} n'a jamais tiré`).toBe(true);
    });
  }

  it('boss : chaque phase 12 s', () => {
    const def = w2Boss()[0];
    def.boss!.phases.forEach((ph, k) => {
      const w = prep('W2-BOSS-' + k);
      const e = spawnNear(w, def.id);
      w.boss = e;
      e.hp = e.maxHp * (k === 0 ? 1 : ph.hp - 0.01);
      const fired = simulate(w, 12, `${def.id} phase ${k + 1}`);
      expect(fired, `phase ${k + 1}`).toBe(true);
      expect(e.phase).toBeGreaterThanOrEqual(k);
    });
  });

  it('palet fou : rebondit sans sortir de la salle', () => {
    const w = prep('W2-PALET');
    const e = spawnNear(w, 'w2_palet_fou');
    simulate(w, 12, 'palet');
    if (!e.dead) {
      expect(w.ctx.isSolid(e.x, e.y)).toBe(false);
      expect(w.inRoom(w.curRoom!, e.x, e.y)).toBe(true);
    }
  });

  it('cristal : éclate en échardes ; bonhomme : se scinde', () => {
    const w = prep('W2-DEATH');
    const c = spawnNear(w, 'w2_cristal_eclat');
    w.ctx.damageEnemy(c, 9999);
    expect(w.bullets.filter((b) => b.team === 'enemy').length).toBeGreaterThanOrEqual(8);
    const b = spawnNear(w, 'w2_bonhomme');
    w.ctx.damageEnemy(b, 9999);
    expect(w.enemies.filter((e) => e.def.id === 'w2_boule' && !e.dead).length).toBe(2);
  });

  it('golem : le pavois absorbe puis casse', () => {
    const w = prep('W2-GOLEM');
    const g = spawnNear(w, 'w2_golem_bouclier');
    const hp0 = g.hp;
    w.ctx.damageEnemy(g, 20);
    expect(g.hp).toBe(hp0);
    w.ctx.damageEnemy(g, 30);
    expect(g.hp).toBe(hp0 - 10);
    expect(g.attacks.some((a) => a.pattern === 'melee')).toBe(true);
  });
});
