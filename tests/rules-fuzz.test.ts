// Fuzz de combinaisons d'édits : des runs complètes jouées par le bot avec 6 à 10 règles tirées au hasard.
import { describe, it, expect, vi } from 'vitest';
import { makeWorld } from './helpers';
import { botInput } from '../src/sim/bot';
import { Rng } from '../src/core/rng';
import { MAX_BULLETS } from '../src/sim/combat';
import { MAX_ENEMIES } from '../src/sim/enemies';
import type { World } from '../src/sim/world';

const SEEDS = 60;
const fin = (v: unknown) => typeof v !== 'number' || Number.isFinite(v);

/** Vérifie l'absence de NaN dans l'état (joueurs, ennemis, balles, Mods). Retourne un message ou null. */
function corrupt(w: World): string | null {
  for (const p of w.players) if (![p.x, p.y, p.hp, p.armor, p.energy, p.vx, p.vy].every(fin)) return `joueur ${p.index} non fini`;
  for (const e of w.enemies) if (![e.x, e.y, e.hp, e.scale].every(fin)) return `ennemi ${e.def.id} non fini`;
  for (const b of w.bullets) if (![b.x, b.y, b.vx, b.vy, b.damage].every(fin)) return `balle non finie (${b.team})`;
  for (const [k, v] of Object.entries(w.mods)) if (!fin(v)) return `Mods.${k} non fini`;
  if (!Number.isFinite(w.coins)) return 'or non fini';
  return null;
}

/** Joue le bot (mode dieu) et contrôle l'état en continu. */
function play(w: World, seconds: number): { maxB: number; maxE: number; bad: string | null } {
  let maxB = 0, maxE = 0, bad: string | null = null;
  for (let i = 0; i < seconds * 60 && w.mode === 'run'; i++) {
    if (w.choice) { w.pick(0); continue; }
    for (const p of w.players) {
      p.hp = w.maxHp(p);
      p.energy = Math.max(p.energy, 50);
      p.input = botInput(w, p);
    }
    w.update(1 / 60);
    w.fx.length = 0;
    maxB = Math.max(maxB, w.bullets.length);
    maxE = Math.max(maxE, w.enemies.length);
    if (!bad && i % 30 === 0) bad = corrupt(w);
  }
  return { maxB, maxE, bad: bad ?? corrupt(w) };
}

describe('fuzz de combinaisons d\'édits', () => {
  it(`${SEEDS} seeds × 6-10 règles × 40 s de jeu`, () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let progressed = 0;
    const report: string[] = [];
    for (let s = 0; s < SEEDS; s++) {
      const seed = 'FUZZ' + s;
      const w = makeWorld(seed);
      w.choice = null; // l'édit fondateur est remplacé par notre tirage
      const rng = new Rng(seed + '-rules');
      const n = rng.int(6, 10);
      for (let k = 0; k < n; k++) {
        const pool = w.eligibleRules();
        if (!pool.length) break;
        w.rules.add(rng.pick(pool));
      }
      const ids = w.rules.list.map((i) => `${i.def.id}${i.stacks > 1 ? '×' + i.stacks : ''}`);
      const r = play(w, 40);
      const label = `[${seed}] ${ids.join(', ')}`;
      expect(w.rules.errors.map((e) => `${e.id}.${e.hook}: ${String(e.error)}`), label).toEqual([]);
      expect(r.bad, label).toBeNull();
      expect(r.maxB, label).toBeLessThanOrEqual(MAX_BULLETS);
      expect(r.maxE, label).toBeLessThanOrEqual(MAX_ENEMIES);
      if (w.stats.rooms >= 1) progressed++;
      else report.push(label);
    }
    if (report.length) console.log('Sans salle nettoyée :\n' + report.join('\n'));
    expect(progressed).toBeGreaterThan(SEEDS / 2);
  }, 600_000);

  it('runs longues (plusieurs étages) avec les règles d\'étage et les métas', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const sets = [
      ['mutation', 'labyrinth', 'endless_waves', 'twin_chests', 'trapped_doors', 'echo'],
      ['whispering_walls', 'labyrinth', 'mutation', 'dice_roll', 'toothy_chests', 'aristocracy'],
      ['amplifier', 'extremism', 'tiny_horde', 'volatile_dead', 'mitosis', 'copycats', 'abundance'],
      ['double_edict', 'golden_gravity', 'compound_interest', 'blood_market', 'golden_balm', 'hourglass_still', 'endless_energy'],
    ];
    sets.forEach((ids, k) => {
      const w = makeWorld('LONG' + k);
      w.choice = null;
      for (const id of ids) w.rules.add(id);
      const r = play(w, 240);
      const label = `[LONG${k}] ${w.rules.list.map((i) => i.def.id).join(', ')}`;
      expect(w.rules.errors.map((e) => `${e.id}.${e.hook}: ${String(e.error)}`), label).toEqual([]);
      expect(r.bad, label).toBeNull();
      expect(w.depth() + w.stats.rooms, label).toBeGreaterThan(3);
    });
  }, 300_000);

  it('toutes les règles compatibles à la fois pendant 30 s', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const seed of ['ALLIN1', 'ALLIN2']) {
      const w = makeWorld(seed);
      w.choice = null;
      // ajoute tout ce qui reste éligible (amnésie exclue : elle viderait la pile), en empilant au max
      for (let guard = 0; guard < 300; guard++) {
        const pool = w.eligibleRules().filter((d) => d.id !== 'amnesia');
        if (!pool.length) break;
        w.rules.add(pool[0]);
      }
      expect(w.rules.ofKind('rule').length).toBeGreaterThan(40);
      const r = play(w, 30);
      const label = `[${seed}] ${w.rules.list.length} modificateurs`;
      expect(w.rules.errors.map((e) => `${e.id}.${e.hook}: ${String(e.error)}`), label).toEqual([]);
      expect(r.bad, label).toBeNull();
      expect(r.maxB).toBeLessThanOrEqual(MAX_BULLETS);
      expect(r.maxE).toBeLessThanOrEqual(MAX_ENEMIES);
    }
  }, 300_000);
});
