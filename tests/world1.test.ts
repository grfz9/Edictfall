import { describe, it, expect } from 'vitest';
import { makeWorld } from './helpers';
import { R } from '../src/core/registry';
import { PAL } from '../src/render/palette';
import type { AttackSpec, Enemy, EnemyDef } from '../src/core/types';
import type { World } from '../src/sim/world';

const w1 = () => [...R.enemies.values()].filter((d) => d.world === 1);
const w1Summons = () => [...R.enemies.values()].filter((d) => d.world === 0 && d.id.startsWith('w1_'));
const allAttacks = (d: EnemyDef): AttackSpec[] => [...(d.attacks ?? []), ...(d.boss?.phases.flatMap((p) => p.attacks) ?? [])];

/** Fait apparaître `id` près du joueur et simule `sec` secondes (joueur immobile, invulnérable). */
function trial(id: string, sec = 12, setup?: (e: Enemy, w: World) => void) {
  const w = makeWorld('W1-' + id);
  const p = w.players[0];
  const ctx = w.ctx;
  for (const o of w.enemies) o.dead = true;
  let pos = { x: p.x + 70, y: p.y };
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2, r = k < 16 ? 70 : 45;
    const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
    if (ctx.isFree(x, y, 9) && ctx.los(p.x, p.y, x, y)) { pos = { x, y }; break; }
  }
  const e = ctx.spawnEnemy(id, pos.x, pos.y, { delay: 0 })!;
  expect(e).toBeTruthy();
  setup?.(e, w);
  const fired = new Set<number>();
  let nan = false;
  let guard = 0;
  for (let i = 0; i < sec * 60 && w.mode === 'run'; i++) {
    if (w.choice) { w.pick(0); i--; if (++guard > 50) break; continue; }
    p.hp = w.maxHp(p);
    p.invuln = 1;
    p.input = { ...p.input, mx: 0, my: 0, fire: false, firePressed: false, swap: false, interact: false, skill: false };
    w.update(1 / 60);
    w.fx.length = 0;
    // pas d'autres vagues parasites : seuls notre ennemi et ses invocations restent
    for (const o of w.enemies) if (o !== e && !o.summoned) o.dead = true;
    for (const b of w.bullets) if (b.team === 'enemy' && b.owner === e) fired.add(b.id);
    for (const o of w.enemies) if (!Number.isFinite(o.x) || !Number.isFinite(o.y) || Number.isNaN(o.hp)) nan = true;
  }
  return { w, e, fired: fired.size, nan };
}

describe('Monde 1 — Sylve Murmurante', () => {
  it('compte : ≥ 20 ennemis world 1 non-boss, exactement 1 boss', () => {
    const list = w1();
    expect(list.filter((d) => !d.boss).length).toBeGreaterThanOrEqual(20);
    expect(list.filter((d) => d.boss).map((d) => d.id)).toEqual(['boss_souche']);
    for (const id of ['slime', 'lutin', 'bat']) expect(R.enemies.get(id)?.world).toBe(1);
    const floors = new Set(list.filter((d) => !d.boss).map((d) => d.minFloor ?? 1));
    expect([...floors].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(list.filter((d) => !d.boss && (d.minFloor ?? 1) === 1).length).toBeGreaterThanOrEqual(6);
    const moves = new Set(list.map((d) => d.move.kind));
    for (const k of ['chase', 'keepDistance', 'wander', 'charge', 'stationary', 'teleport', 'orbit', 'flee', 'hop', 'zigzag']) expect(moves, k).toContain(k);
    const pats = new Set(list.flatMap((d) => allAttacks(d).map((a) => a.pattern)));
    for (const k of ['aimed', 'spread', 'burst', 'ring', 'spiral', 'spray', 'wall', 'cross', 'homing', 'lob', 'rain', 'laser', 'summon', 'dash', 'melee', 'mines', 'blink']) expect(pats, k).toContain(k);
  });

  it('sprites valides (existants, largeurs égales, palette)', () => {
    for (const d of [...w1(), ...w1Summons()]) {
      const s = R.sprites.get(d.sprite);
      expect(s, d.sprite).toBeTruthy();
      const frames = [s!.px, ...(s!.frames ?? [])];
      expect(frames.length, d.sprite + ' frames').toBeGreaterThanOrEqual(2);
      const wd = s!.px[0].length, h = s!.px.length;
      for (const f of frames) {
        expect(f.length, d.sprite + ' hauteur').toBe(h);
        for (const row of f) {
          expect(row.length, `${d.sprite} : "${row}"`).toBe(wd);
          for (const ch of row) if (ch !== '.' && ch !== ' ') expect(ch in PAL || !!s!.pal?.[ch], `${d.sprite} : '${ch}'`).toBe(true);
        }
      }
    }
    // boss : grand sprite, une apparence par phase, 4 frames chacune
    const looks = ['boss_souche', ...R.enemies.get('boss_souche')!.boss!.phases.map((p) => p.sprite).filter(Boolean)] as string[];
    expect(new Set(looks).size).toBe(3);
    for (const id of looks) {
      const s = R.sprites.get(id)!;
      expect(s, id).toBeTruthy();
      expect(s.px[0].length, id).toBeGreaterThanOrEqual(32);
      expect(s.px.length, id).toBeGreaterThanOrEqual(32);
      expect(1 + (s.frames?.length ?? 0), id).toBeGreaterThanOrEqual(4);
      for (const f of [s.px, ...(s.frames ?? [])]) for (const row of f) {
        expect(row.length, `${id} : "${row}"`).toBe(s.px[0].length);
        for (const ch of row) if (ch !== '.') expect(ch in PAL || !!s.pal?.[ch], `${id} : '${ch}'`).toBe(true);
      }
    }
  });

  it('patterns référencés existants, invocations définies, dégâts du monde 1', () => {
    for (const d of [...w1(), ...w1Summons()]) {
      for (const a of allAttacks(d)) {
        expect(R.patterns.has(a.pattern), `${d.id} → ${a.pattern}`).toBe(true);
        if (a.pattern === 'summon') expect(R.enemies.has(a.params?.id), `${d.id} invoque ${a.params?.id}`).toBe(true);
        expect(a.params?.damage ?? 1, d.id).toBe(1);
        if (a.params?.speed && a.pattern !== 'dash') expect(a.params.speed, `${d.id} vitesse`).toBeLessThanOrEqual(120);
      }
      expect(d.contact ?? 1, d.id).toBeLessThanOrEqual(1);
    }
  });

  for (const d of [...R.enemies.values()].filter((x) => (x.world === 1 && !x.boss) || (x.world === 0 && x.id.startsWith('w1_')))) {
    it(`simulation 12 s : ${d.id}`, () => {
      const r = trial(d.id);
      expect(r.nan).toBe(false);
      if ((d.attacks?.length ?? 0) > 0) expect(r.fired, `${d.id} doit tirer`).toBeGreaterThan(0);
    });
  }

  const boss = R.enemies.get('boss_souche')!;
  boss.boss!.phases.forEach((ph, k) => {
    it(`boss phase ${k + 1} : simulation 12 s`, () => {
      const r = trial('boss_souche', 12, (e) => { if (k > 0) e.hp = e.maxHp * ph.hp - 1; });
      expect(r.nan).toBe(false);
      expect(r.e.phase).toBe(k);
      expect(r.fired).toBeGreaterThan(0);
      expect(r.w.rules.errors).toEqual([]);
    });
  });

  it('boss : télégraphes ≥ 0.4 s, PV +35-50 % (≈ 880), durée théorique à DPS 25', () => {
    expect(boss.hp).toBeGreaterThanOrEqual(840);
    expect(boss.hp).toBeLessThanOrEqual(930);
    for (const ph of boss.boss!.phases) for (const a of ph.attacks) expect(a.telegraph ?? 0.35).toBeGreaterThanOrEqual(0.4);
    // Tir continu à 25 DPS (100 % de présence) : l'écorce durcie rallonge le combat.
    const r = trial('boss_souche', 0);
    const w = r.w, e = r.e, ctx = w.ctx, p = w.players[0];
    let t = 0, guard = 0;
    while (!e.dead && t < 200) {
      if (w.choice) { w.pick(0); if (++guard > 50) break; continue; }
      p.hp = w.maxHp(p); p.invuln = 1;
      w.update(1 / 60); w.fx.length = 0;
      ctx.damageEnemy(e, 25 / 60, { cause: 'bullet' });
      t += 1 / 60;
    }
    console.log(`Souche-Roi : ${t.toFixed(1)} s de tir ininterrompu à 25 DPS (étage 1)`);
    expect(e.dead).toBe(true);
    expect(t).toBeGreaterThan(30);
  });
});
