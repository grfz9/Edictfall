import { describe, it, expect } from 'vitest';
import { makeWorld } from './helpers';
import { R } from '../src/core/registry';
import { PAL } from '../src/render/palette';
import { emptyInput, type World } from '../src/sim/world';
import type { EnemyDef, Enemy, AttackSpec } from '../src/core/types';

const mine = (d: EnemyDef) => d.id.startsWith('w3_') || (d.world === 3 && !!d.boss);
const defs = () => [...R.enemies.values()].filter(mine);
const w3 = () => [...R.enemies.values()].filter((d) => d.world === 3 && !d.boss);
const allAttacks = (d: EnemyDef): AttackSpec[] => [...(d.attacks ?? []), ...(d.boss?.phases.flatMap((p) => p.attacks) ?? [])];

function arena(seed: string): World {
  const w = makeWorld(seed);
  (w as any).choice = null; // pas d'édit : environnement neutre
  (w as any).choiceQueue = [];
  return w;
}
function spawnNear(w: World, id: string): Enemy {
  const p = w.players[0];
  const offs = [[60, 0], [-60, 0], [0, 60], [0, -60], [40, 40], [-40, -40]];
  let pos = { x: p.x, y: p.y };
  const o = offs.find(([dx, dy]) => w.ctx.isFree(p.x + dx, p.y + dy, 9));
  pos = o ? { x: p.x + o[0], y: p.y + o[1] } : w.ctx.freeSpot(w.curRoom, 40);
  const e = w.ctx.spawnEnemy(id, pos.x, pos.y, { delay: 0 });
  expect(e, id).toBeTruthy();
  return e!;
}
function tick(w: World, onTick?: () => void): void {
  const p = w.players[0];
  p.hp = w.maxHp(p);
  p.downed = false;
  p.input = emptyInput();
  w.update(1 / 60);
  w.fx.length = 0;
  for (const e of w.enemies) {
    expect(Number.isFinite(e.x) && Number.isFinite(e.y), `${e.def.id} position NaN`).toBe(true);
  }
  for (const b of w.bullets) expect(Number.isFinite(b.x) && Number.isFinite(b.y), `balle NaN (${(b.owner as Enemy)?.def?.id})`).toBe(true);
  onTick?.();
}

describe('Monde 3 — Forge Abyssale', () => {
  it('contenu : effectifs, sprites, palette, patterns', () => {
    expect(w3().length).toBeGreaterThanOrEqual(20);
    const bosses = [...R.enemies.values()].filter((d) => d.world === 3 && d.boss);
    expect(bosses.length).toBe(1);
    const sprites = new Set<string>(['eb_w3_ember', 'eb_w3_slag']);
    for (const d of defs()) sprites.add(d.sprite);
    for (const id of sprites) {
      const s = R.sprites.get(id);
      expect(s, `sprite ${id}`).toBeTruthy();
      const pal = { ...PAL, ...(s!.pal ?? {}) };
      const frames = [s!.px, ...(s!.frames ?? [])];
      expect(frames.length, `${id} : 2 frames`).toBeGreaterThanOrEqual(id.startsWith('eb_') ? 1 : 2);
      const w = s!.px[0].length;
      for (const f of frames) {
        expect(f.length, `${id} hauteur`).toBe(s!.px.length);
        for (const row of f) {
          expect(row.length, `${id} largeur « ${row} »`).toBe(w);
          for (const c of row) if (c !== '.' && c !== ' ') expect(pal[c], `${id} caractère « ${c} »`).toBeTruthy();
        }
      }
    }
    for (const d of defs()) for (const a of allAttacks(d)) expect(R.patterns.has(a.pattern), `${d.id} → ${a.pattern}`).toBe(true);
    // couverture des déplacements et répartition
    const kinds = new Set(w3().map((d) => d.move.kind));
    for (const k of ['chase', 'keepDistance', 'wander', 'charge', 'stationary', 'teleport', 'orbit', 'flee', 'hop', 'zigzag']) expect(kinds.has(k as any), k).toBe(true);
    expect(w3().filter((d) => (d.minFloor ?? 1) === 1).length).toBeGreaterThanOrEqual(7);
    for (const d of w3()) {
      expect(d.hp).toBeGreaterThanOrEqual(26);
      expect(d.hp).toBeLessThanOrEqual(220);
      expect(d.cost ?? 1).toBeLessThanOrEqual(4);
    }
  });

  for (const d of w3().concat([...R.enemies.values()].filter((x) => x.world === 0 && x.id.startsWith('w3_')))) {
    it(`simulation 12 s : ${d.id}`, () => {
      const w = arena('W3-' + d.id);
      const e = spawnNear(w, d.id);
      let fired = false;
      for (let i = 0; i < 60 * 12; i++) {
        if (i === 60 * 6 && !e.dead) w.ctx.damageEnemy(e, e.hp * 0.55); // déclenche onHurt (rage…)
        tick(w, () => { if (!fired) fired = w.bullets.some((b) => b.owner === e); });
        expect(w.mode).toBe('run');
      }
      if ((d.attacks?.length ?? 0) > 0) expect(fired, `${d.id} n'a jamais tiré`).toBe(true);
      if (!e.dead) w.ctx.killEnemy(e); // onDeath
      for (let i = 0; i < 60; i++) tick(w);
      expect(w.rules.errors).toEqual([]);
    });
  }

  it('boss final : chaque phase 12 s, balles ≤ 700', () => {
    const boss = [...R.enemies.values()].find((d) => d.world === 3 && d.boss)!;
    const phases = boss.boss!.phases;
    expect(phases.length).toBeGreaterThanOrEqual(3);
    expect(boss.hp).toBeGreaterThanOrEqual(1300);
    const w = arena('W3-BOSS');
    const e = spawnNear(w, boss.id);
    let maxB = 0;
    for (let k = 0; k < phases.length; k++) {
      const hp = k === 0 ? e.maxHp : e.maxHp * phases[k].hp - 1;
      let fired = false;
      for (let i = 0; i < 60 * 12; i++) {
        e.hp = hp;
        tick(w, () => {
          maxB = Math.max(maxB, w.bullets.length);
          if (!fired) fired = w.bullets.some((b) => b.owner === e);
        });
        expect(e.dead).toBe(false);
      }
      expect(e.phase, `phase ${k}`).toBe(k);
      expect(fired, `phase ${k} sans tir`).toBe(true);
    }
    console.log(`boss : max balles simultanées = ${maxB}`);
    expect(maxB).toBeLessThanOrEqual(700);
    w.ctx.killEnemy(e);
    for (let i = 0; i < 120; i++) tick(w);
  });
});
