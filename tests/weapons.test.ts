import { describe, it, expect } from 'vitest';
import { makeWorld } from './helpers';
import { R } from '../src/core/registry';
import { PAL } from '../src/render/palette';
import type { WeaponDef } from '../src/core/types';

// ---------------------------------------------------------------------------------------------------------------
// RÈGLE : plus une arme est forte, plus elle est rare.
// Bandes de DPS STRICTES par rareté (incluses dans les fourchettes du CONTENT_GUIDE, sans chevauchement) :
//   blanc 14–22 · vert 23–32 · bleu 33–44 · violet 46–62 · orange 64–100
const BANDS: [number, number][] = [[14, 22], [23, 32], [33, 44], [46, 62], [64, 100]];
// Fourchettes d'énergie par seconde de tir (guide).
const EPS: [number, number][] = [[0, 4], [3, 7], [5, 10], [8, 15], [12, 22]];
const TOL = 0.05; // tolérance d'énergie
/** Tolérance réservée aux armes à signature (DPS estimé, cf. EFFECTIVE_DPS) : ±8 %. Les autres n'en ont aucune. */
const SIG_TOL = 0.08;
/** Part des éclats (split) qui touchent en moyenne : comptés à 25 %. */
const SPLIT_HIT = 0.25;

/** DPS effectifs documentés pour les armes dont la signature (onFire/onTick/onEnd) ne se lit pas dans la formule :
 *  - pistol_echo : 55 de base + écho rejoué à 50 % → 82.5
 *  - launcher_requiem : la roquette (18 + souffle 18) se divise à 0,35 s en 3 têtes (≈ 10.8 + souffle 10.8) → ≈ 76
 *  - staff_void : orbe de 6, champ qui ronge 6 / 0,25 s pendant ~2-3 s puis implosion ×5 (30) → ≈ 85 par cible
 *  - sword_eclipse : 65 + croissant d'ombre 38 % → 89.7
 *  - spear_cloud : 37.5 + nuage (30 %) un coup sur trois → 41.3
 *  - weird_stormfan : 31.1 + lame de vent 35 % → 42
 *  - weird_yoyo / spear_return : touchent à l'aller ET au retour → ×2 (36 / 52)
 *  - sword_ronin : 37.5 + coupe différée 60 % à pleine charge → 60
 *  - sword_rift : 48 + fissure dimensionnelle 60 % → 76.8
 *  - launcher_mecha : (poing 22 + souffle 22 + 4 missiles × 5.5) / 0.9 → 73.3 */
const EFFECTIVE_DPS: Record<string, number> = {
  pistol_echo: 82.5, launcher_requiem: 76, staff_void: 85, sword_eclipse: 89.7,
  spear_cloud: 41.3, weird_stormfan: 42, weird_yoyo: 36, spear_return: 52, sword_ronin: 60, sword_rift: 76.8, launcher_mecha: 73.3,
};

const cycle = (d: WeaponDef) => d.cooldown + (d.charge?.time ?? 0);
/** DPS soutenu = (impact + souffle + éclats × 25 %) × projectiles × rafale / cycle (charge pleine). */
function formulaDps(d: WeaponDef): number {
  const b = d.bullet;
  let per = (b.kind === 'lob' ? 0 : d.damage) + (b.explode ? b.explode.damage ?? d.damage : 0);
  if (b.split) per += b.split.count * (b.split.spec.damage ?? d.damage * 0.5) * SPLIT_HIT;
  return (per * (d.count ?? 1) * (d.burst?.count ?? 1)) / cycle(d);
}
const dpsOf = (d: WeaponDef) => EFFECTIVE_DPS[d.id] ?? formulaDps(d);
const isSig = (d: WeaponDef) => d.id in EFFECTIVE_DPS;
const isMelee = (d: WeaponDef) => d.bullet.kind === 'slash';

const weapons = () => [...R.weapons.values()];
const ours = () => weapons().filter((d) => d.id !== 'pistol_rusty' && d.id !== 'sword_iron');

describe('armes : contenu', () => {
  it('au moins 85 armes (hors départ), ids uniques en snake_case', () => {
    const list = weapons();
    expect(ours().length).toBeGreaterThanOrEqual(85);
    expect(new Set(list.map((d) => d.id)).size).toBe(list.length);
    for (const d of list) expect(d.id).toMatch(/^[a-z0-9_]+$/);
  });

  it('chaque sprite référencé existe, lignes de même largeur, caractères de la palette', () => {
    const ids = new Set<string>();
    for (const d of weapons()) {
      ids.add(d.sprite);
      if (d.bullet.sprite) ids.add(d.bullet.sprite);
      if (d.bullet.split?.spec.sprite) ids.add(d.bullet.split.spec.sprite);
    }
    // sprites créés dynamiquement par les scripts
    for (const s of ['b_star', 'b_rocket', 'b_echo', 'b_crescent', 'b_note', 'b_nimbus', 'b_wind', 'b_card', 'b_fist']) ids.add(s);
    for (const id of ids) {
      const s = R.sprites.get(id);
      expect(s, `sprite manquant : ${id}`).toBeDefined();
      for (const frame of [s!.px, ...(s!.frames ?? [])]) {
        const w = s!.px[0].length;
        expect(frame.length, `${id} : hauteur de frame`).toBe(s!.px.length);
        for (const row of frame) {
          expect(row.length, `${id} : largeur`).toBe(w);
          for (const ch of row) if (ch !== '.' && ch !== ' ') expect(PAL[ch] ?? s!.pal?.[ch], `${id} : caractère « ${ch} » hors palette`).toBeDefined();
        }
      }
    }
    for (const d of ours()) {
      expect(d.sprite.startsWith('w_')).toBe(true);
      if (d.bullet.sprite) expect(d.bullet.sprite.startsWith('b_')).toBe(true);
    }
  });

  it('DPS dans la bande STRICTE de la rareté, énergie dans la fourchette', () => {
    const bad: string[] = [];
    for (const d of weapons()) {
      const [lo, hi] = BANDS[d.rarity];
      const dps = dpsOf(d), t = isSig(d) ? SIG_TOL : 0;
      if (dps < lo * (1 - t) || dps > hi * (1 + t)) bad.push(`${d.id} DPS ${dps.toFixed(1)} ∉ [${lo},${hi}] (rareté ${d.rarity})`);
      const eps = d.energy / cycle(d);
      const [elo, ehi] = EPS[d.rarity];
      if (isMelee(d)) {
        // mêlée : 0–1 par coup ; une « mêlée » à distance (klaxon) peut suivre la fourchette normale
        if (d.energy > 1 && (eps < elo || eps > ehi * (1 + TOL))) bad.push(`${d.id} énergie mêlée ${d.energy}`);
      } else if (eps < elo * (1 - TOL) || eps > ehi * (1 + TOL)) bad.push(`${d.id} énergie/s ${eps.toFixed(1)} ∉ [${elo},${ehi}]`);
      if (d.unlock !== undefined && (d.unlock < 15 || d.unlock > 120)) bad.push(`${d.id} unlock ${d.unlock}`);
      expect(d.desc && d.desc.length > 5, `${d.id} sans desc`).toBe(true);
    }
    expect(bad).toEqual([]);
  });

  it('monotonie : DPS min d\'une rareté > DPS max de la rareté inférieure', () => {
    // Les armes à signature profitent de SIG_TOL dans le sens qui les favorise (estimation), les autres sont prises telles quelles.
    const lo = [Infinity, Infinity, Infinity, Infinity, Infinity], hi = [0, 0, 0, 0, 0];
    const who: string[][] = [[], [], [], [], []];
    for (const d of weapons()) {
      const dps = dpsOf(d), t = isSig(d) ? SIG_TOL : 0;
      lo[d.rarity] = Math.min(lo[d.rarity], dps * (1 + t));
      hi[d.rarity] = Math.max(hi[d.rarity], dps * (1 - t));
      who[d.rarity].push(`${d.id}:${dps.toFixed(1)}`);
    }
    for (let r = 1; r < 5; r++) expect(lo[r], `rareté ${r} (min ${lo[r].toFixed(1)}) vs ${r - 1} (max ${hi[r - 1].toFixed(1)})`).toBeGreaterThan(hi[r - 1]);
  });

  it('répartition des raretés ≈ 25 / 25 / 22 / 16 / 12 %', () => {
    const all = weapons();
    const by = [0, 0, 0, 0, 0];
    for (const d of all) by[d.rarity]++;
    const pct = by.map((n) => (100 * n) / all.length);
    console.log('raretés', by.join(' / '), '=', pct.map((x) => x.toFixed(1) + ' %').join(' / '), '— à débloquer :', ours().filter((d) => d.unlock !== undefined).length);
    const target = [25, 25, 22, 16, 12];
    for (let r = 0; r < 5; r++) expect(Math.abs(pct[r] - target[r]), `rareté ${r} : ${pct[r].toFixed(1)} %`).toBeLessThanOrEqual(3);
    expect(ours().filter((d) => d.type === 'weird').length).toBeGreaterThanOrEqual(12);
    // les armes orange sont rares ET à débloquer (sauf aucune)
    for (const d of all) if (d.rarity === 4) expect(d.unlock, `${d.id} orange sans déblocage`).toBeDefined();
  });
});

describe('armes : simulation', () => {
  it('chaque arme tire 4 s sans exception et produit balles ou dégâts', () => {
    const fails: string[] = [];
    const report: string[] = [];
    for (const d of weapons()) {
      const w = makeWorld('WPN_' + d.id);
      const ctx = w.ctx;
      const p = w.players[0];
      const wi = ctx.giveWeapon(p, d.id);
      expect(wi).not.toBeNull();
      expect(p.weapons[p.cur].def.id).toBe(d.id);
      // cibles : mannequins devant le joueur + un vrai ennemi du monde 1
      const spots = [[26, 0], [40, 14], [40, -14], [60, 0]];
      for (const [dx, dy] of spots) {
        const x = ctx.isFree(p.x + dx, p.y + dy, 6) ? p.x + dx : p.x + 20, y = ctx.isFree(p.x + dx, p.y + dy, 6) ? p.y + dy : p.y;
        ctx.spawnEnemy('dummy', x, y, { delay: 0 });
      }
      const real = [...R.enemies.values()].find((e) => e.world === 1 && !e.boss);
      if (real) ctx.spawnEnemy(real.id, p.x + 30, p.y + 6, { delay: 0 });
      const shots0 = w.stats.shots, dmg0 = w.stats.damage;
      let spawned = 0;
      const seen = new Set<number>();
      try {
        for (let i = 0; i < 240; i++) {
          if (w.choice) { w.pick(0); continue; }
          p.hp = w.maxHp(p);
          p.energy = w.maxEnergy(p);
          p.invuln = 1;
          const t = w.enemies.find((e) => !e.dead);
          p.input = { mx: 0, my: 0, ax: t ? t.x - p.x : 1, ay: t ? t.y - p.y : 0, aimManual: true, fire: true, firePressed: i % 2 === 0, swap: false, interact: false, skill: false };
          w.update(1 / 60);
          for (const b of w.bullets) if (b.team === 'player' && !seen.has(b.id)) { seen.add(b.id); spawned++; }
          w.fx.length = 0;
        }
      } catch (e) {
        fails.push(`${d.id} : exception ${(e as Error).message}`);
        continue;
      }
      report.push(`${d.id}:${spawned}b/${Math.round(w.stats.damage - dmg0)}d`);
      if (!(spawned > 0 || w.stats.damage > dmg0)) fails.push(`${d.id} : ni balle ni dégât`);
      if (w.stats.shots === shots0) fails.push(`${d.id} : aucun tir`);
      if (w.rules.errors.length) fails.push(`${d.id} : erreurs ${w.rules.errors}`);
    }
    console.log(report.join('  '));
    expect(fails).toEqual([]);
  });
});

