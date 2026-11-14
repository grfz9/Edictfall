import { describe, it, expect } from 'vitest';
import { makeWorld, runBot } from './helpers';
import { R, allPassives } from '../src/core/registry';
import { PAL } from '../src/render/palette';
import { defaultSave } from '../src/core/save';
import { World, emptyInput } from '../src/sim/world';
import { botInput } from '../src/sim/bot';
import type { Player } from '../src/core/types';

const HEROES = ['brann', 'oriane', 'gribouille', 'vesna', 'tamsin', 'bouldre'];
const MY_PASSIVES = () => allPassives().filter((d) => d.id.startsWith('p_') && d.icon.startsWith('ip_'));

function checkSprite(id: string): void {
  const s = R.sprites.get(id);
  expect(s, `sprite ${id}`).toBeTruthy();
  const all = [s!.px, ...(s!.frames ?? [])];
  const w = s!.px[0].length, h = s!.px.length;
  for (const f of all) {
    expect(f.length, `${id} hauteur`).toBe(h);
    for (const row of f) {
      expect(row.length, `${id} largeur "${row}"`).toBe(w);
      for (const ch of row) if (ch !== '.' && ch !== ' ') expect(ch in PAL || ch in (s!.pal ?? {}), `${id} caractère "${ch}"`).toBe(true);
    }
  }
}

/** Fait jouer le bot (god) et force la compétence dès qu'elle est prête. Retourne le nombre d'utilisations. */
function playWithSkill(w: World, ticks: number): number {
  let uses = 0;
  for (let i = 0; i < ticks; i++) {
    if (w.mode !== 'run') break;
    if (w.choice) { w.pick(0); continue; }
    const p = w.players[0];
    p.hp = w.maxHp(p); p.energy = Math.max(p.energy, 50);
    p.input = botInput(w, p);
    const ready = p.skillCd <= 0;
    p.input.skill = ready;
    w.update(1 / 60);
    if (ready && w.players[0].skillCd > 0) uses++;
    w.fx.length = 0;
  }
  return uses;
}

/** Déclenche la compétence du joueur 0 maintenant (attend la fin des choix / hitstop). */
function triggerSkill(w: World, p: Player): void {
  p.skillCd = 0;
  for (let i = 0; i < 120; i++) {
    if (w.choice) { w.pick(0); continue; }
    p.input = { ...emptyInput(), skill: true };
    w.update(1 / 60);
    if (p.skillCd > 0) { p.input = emptyInput(); return; }
  }
  throw new Error('compétence jamais déclenchée');
}
function step(w: World, n = 1): void {
  for (let i = 0; i < n; i++) { if (w.choice) w.pick(0); w.players[0].input = emptyInput(); w.update(1 / 60); }
}

describe('contenu héros / passifs / familiers', () => {
  it('6 héros, sprites et textes valides', () => {
    expect([...R.heroes.keys()].sort()).toEqual([...HEROES].sort());
    const costs = HEROES.map((id) => R.heroes.get(id)!.cost);
    expect(costs[0]).toBe(0);
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    for (const id of HEROES) {
      const h = R.heroes.get(id)!;
      checkSprite(h.sprite);
      expect(R.weapons.has(h.weapon)).toBe(true);
      expect(h.skill.desc.length).toBeLessThanOrEqual(70);
      expect(h.skill.name.length).toBeLessThanOrEqual(70);
      expect(h.hp).toBeGreaterThanOrEqual(4); expect(h.hp).toBeLessThanOrEqual(8);
      expect(h.armor).toBeGreaterThanOrEqual(3); expect(h.armor).toBeLessThanOrEqual(7);
      expect(h.energy).toBeGreaterThanOrEqual(140); expect(h.energy).toBeLessThanOrEqual(220);
      expect(h.speed).toBeGreaterThanOrEqual(84); expect(h.speed).toBeLessThanOrEqual(104);
    }
    expect(R.heroes.get('brann')!.weapon).toBe('pistol_rusty');
  });

  it('≥ 18 passifs et ≥ 5 familiers avec sprites valides', () => {
    const ps = MY_PASSIVES();
    expect(ps.length).toBeGreaterThanOrEqual(18);
    for (const d of ps) checkSprite(d.icon);
    expect(R.pets.size).toBeGreaterThanOrEqual(5);
    for (const d of R.pets.values()) checkSprite(d.sprite);
    expect([...R.pets.values()].some((d) => d.cost === 0)).toBe(true);
  });

  for (const id of HEROES) {
    it(`héros ${id} : 30 s de bot avec compétence`, () => {
      const w = makeWorld('HERO-' + id, id);
      expect(w.players[0].hero.id).toBe(id);
      const uses = playWithSkill(w, 60 * 30);
      expect(uses).toBeGreaterThan(0);
      expect(w.rules.errors).toEqual([]);
    });
  }

  it('brann : double détente', () => {
    const w = makeWorld('FX-brann', 'brann'); const p = w.players[0];
    triggerSkill(w, p); step(w);
    expect(p.mods.bulletCount).toBeGreaterThanOrEqual(1);
  });

  it('oriane : la bulle annule les dégâts et détruit les balles', () => {
    const w = makeWorld('FX-oriane', 'oriane'); const p = w.players[0];
    triggerSkill(w, p);
    const b = w.ctx.spawnBullet({ damage: 1, speed: 1, sprite: 'eb_round' }, p.x + 20, p.y, 0, 'enemy', null)!;
    step(w);
    expect(b.dead).toBe(true);
    const hp = p.hp, armor = p.armor;
    expect(w.ctx.damagePlayer(p, 2, 'bullet')).toBe(false);
    expect(p.hp).toBe(hp); expect(p.armor).toBe(armor);
  });

  it('gribouille : tourelle alliée qui tire puis disparaît', () => {
    const w = makeWorld('FX-grib', 'gribouille'); const p = w.players[0];
    triggerSkill(w, p);
    const t = w.enemies.find((e) => e.def.id === 'gribouille_turret');
    expect(t && t.charmed && t.summoned).toBeTruthy();
    // une cible à portée
    const target = w.ctx.spawnEnemy('dummy', t!.x + 40, t!.y, { delay: 0 });
    expect(target).toBeTruthy();
    const before = w.stats.damage;
    step(w, 60);
    expect(w.stats.damage).toBeGreaterThan(before);
    step(w, 60 * 9);
    expect(w.enemies.some((e) => e.def.id === 'gribouille_turret')).toBe(false);
  });

  it('vesna : ruée invulnérable qui blesse', () => {
    const w = makeWorld('FX-vesna', 'vesna'); const p = w.players[0];
    while (w.choice) w.pick(0);
    p.aim = 0;
    const x0 = p.x;
    const e = w.ctx.spawnEnemy('dummy', p.x + 14, p.y, { delay: 0 })!;
    const before = w.stats.damage;
    triggerSkill(w, p);
    expect(p.invuln).toBeGreaterThan(0.2);
    step(w, 20);
    expect(Math.abs(p.x - x0) + Math.abs(p.kx)).toBeGreaterThan(5);
    expect(w.stats.damage).toBeGreaterThan(before);
    expect(e).toBeTruthy();
  });

  it('tamsin : le temps ralentit', () => {
    const w = makeWorld('FX-tamsin', 'tamsin'); const p = w.players[0];
    triggerSkill(w, p); step(w);
    expect(w.mods.timeScale).toBeLessThan(0.5);
    step(w, 60 * 6);
    expect(w.mods.timeScale).toBeCloseTo(1);
  });

  it('bouldre : soin de zone', () => {
    const w = makeWorld('FX-bouldre', 'bouldre'); const p = w.players[0];
    while (w.choice) w.pick(0);
    p.hp = 2; p.invuln = 5;
    triggerSkill(w, p);
    expect(p.hp).toBeGreaterThanOrEqual(4);
  });

  for (const d of MY_PASSIVES()) {
    it(`passif ${d.id} : 15 s sans erreur`, () => {
      const w = makeWorld('PAS-' + d.id);
      expect(w.rules.add(d.id)).toBeTruthy();
      runBot(w, 60 * 15, () => 0, true);
      expect(w.rules.errors.filter((e) => e.id === d.id)).toEqual([]);
      expect(w.rules.errors).toEqual([]);
    });
  }

  it('second souffle sauve une fois', () => {
    const w = makeWorld('PAS-sw');
    while (w.choice) w.pick(0);
    w.rules.add('p_second_wind');
    const p = w.players[0];
    p.hp = 0; w.playerDown(p);
    expect(p.downed).toBe(false);
    expect(p.hp).toBeGreaterThan(0);
    p.hp = 0; w.playerDown(p);
    expect(p.downed).toBe(true);
  });

  for (const pet of [...R.pets.keys()]) {
    it(`familier ${pet} : 20 s`, () => {
      const s = defaultSave(); s.pet = pet;
      const w = new World(s);
      w.startHub();
      w.startRun('PET-' + pet, [w.players[0].hero.id]);
      expect(w.pets.length).toBe(1);
      runBot(w, 60 * 20, () => 0, true);
      expect(w.rules.errors).toEqual([]);
    });
  }

  it('coop : 2 héros, 15 s', () => {
    const w = new World(defaultSave());
    w.startHub();
    w.startRun('COOP', ['oriane', 'gribouille']);
    expect(w.players.length).toBe(2);
    for (let i = 0; i < 60 * 15; i++) {
      if (w.mode !== 'run') break;
      if (w.choice) { w.pick(0); continue; }
      for (const p of w.players) { p.hp = w.maxHp(p); p.energy = Math.max(p.energy, 50); }
      w.players[0].input = botInput(w, w.players[0]);
      w.players[1].input = { ...emptyInput(), fire: true, skill: w.players[1].skillCd <= 0 };
      w.update(1 / 60);
      w.fx.length = 0;
    }
    expect(w.rules.errors).toEqual([]);
  });
});
