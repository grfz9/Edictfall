import { describe, it, expect } from 'vitest';
import { makeWorld } from './helpers';
import { R } from '../src/core/registry';
import { PAL } from '../src/render/palette';
import type { WeaponDef } from '../src/core/types';

// Fourchettes du CONTENT_GUIDE (DPS soutenu et énergie par seconde de tir).
const DPS: [number, number][] = [[14, 24], [22, 34], [30, 48], [44, 68], [62, 100]];
const EPS: [number, number][] = [[0, 4], [3, 7], [5, 10], [8, 15], [12, 22]];
const TOL = 0.05; // 5 % de tolérance

/** DPS effectifs documentés pour les armes dont la signature (onFire/onTick) ne se lit pas dans la formule :
 *  - pistol_echo : 55 de base + écho rejoué à 50 % → 82.5
 *  - launcher_requiem : la roquette (18 + souffle 18) se divise à 0,35 s en 3 têtes (≈ 10.8 + souffle 10.8) → ≈ 76
 *  - staff_void : orbe de 6, champ qui ronge 6 / 0,25 s pendant ~2-3 s puis implosion ×5 (30) → ≈ 85 par cible */
const EFFECTIVE_DPS: Record<string, number> = { pistol_echo: 82.5, launcher_requiem: 76, staff_void: 85 };

const cycle = (d: WeaponDef) => d.cooldown + (d.charge?.time ?? 0);
function formulaDps(d: WeaponDef): number {
  const b = d.bullet;
  const per = (b.kind === 'lob' ? 0 : d.damage) + (b.explode ? b.explode.damage ?? d.damage : 0);
  return (per * (d.count ?? 1) * (d.burst?.count ?? 1)) / cycle(d);
}
const isMelee = (d: WeaponDef) => d.bullet.kind === 'slash';

const weapons = () => [...R.weapons.values()];
const ours = () => weapons().filter((d) => d.id !== 'pistol_rusty' && d.id !== 'sword_iron');

describe('armes : contenu', () => {
  it('au moins 62 armes (hors départ), ids uniques en snake_case', () => {
    const list = weapons();
    expect(ours().length).toBeGreaterThanOrEqual(62);
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
    for (const s of ['b_star', 'b_rocket', 'b_echo', 'b_crescent', 'b_note']) ids.add(s);
    for (const id of ids) {
      const s = R.sprites.get(id);
      expect(s, `sprite manquant : ${id}`).toBeDefined();
      for (const frame of [s!.px, ...(s!.frames ?? [])]) {
        const w = frame[0].length;
        for (const row of frame) {
          expect(row.length, `${id} : largeur`).toBe(w);
          for (const ch of row) if (ch !== '.' && ch !== ' ') expect(PAL[ch] ?? s!.pal?.[ch], `${id} : caractère « ${ch} » hors palette`).toBeDefined();
        }
      }
    }
    // toutes nos armes et balles respectent les préfixes
    for (const d of ours()) {
      expect(d.sprite.startsWith('w_')).toBe(true);
      if (d.bullet.sprite) expect(d.bullet.sprite.startsWith('b_')).toBe(true);
    }
  });

  it('DPS et énergie dans la fourchette de la rareté', () => {
    const bad: string[] = [];
    for (const d of ours()) {
      const [lo, hi] = DPS[d.rarity];
      const dps = EFFECTIVE_DPS[d.id] ?? formulaDps(d);
      if (dps < lo * (1 - TOL) || dps > hi * (1 + TOL)) bad.push(`${d.id} DPS ${dps.toFixed(1)} ∉ [${lo},${hi}]`);
      if (isMelee(d)) {
        // mêlée (épées/lances/absurdes au corps à corps) : 0–1 par coup ; une « mêlée » à distance (klaxon) peut suivre la fourchette normale
        const eps = d.energy / cycle(d);
        const [elo, ehi] = EPS[d.rarity];
        if (d.energy > 1 && (eps < elo || eps > ehi * (1 + TOL))) bad.push(`${d.id} énergie mêlée ${d.energy}`);
      } else {
        const eps = d.energy / cycle(d);
        const [elo, ehi] = EPS[d.rarity];
        if (eps < elo * (1 - TOL) || eps > ehi * (1 + TOL)) bad.push(`${d.id} énergie/s ${eps.toFixed(1)} ∉ [${elo},${ehi}]`);
      }
      if (d.unlock !== undefined && (d.unlock < 15 || d.unlock > 120)) bad.push(`${d.id} unlock ${d.unlock}`);
      expect(d.desc && d.desc.length > 5, `${d.id} sans desc`).toBe(true);
    }
    expect(bad).toEqual([]);
  });

  it('répartition des raretés et des déblocages', () => {
    const by = [0, 0, 0, 0, 0];
    for (const d of ours()) by[d.rarity]++;
    console.log('raretés', by.join(' / '), '— à débloquer :', ours().filter((d) => d.unlock !== undefined).length, '— absurdes :', ours().filter((d) => d.type === 'weird').length);
    expect(by[4]).toBeGreaterThanOrEqual(7);
    expect(ours().filter((d) => d.type === 'weird').length).toBeGreaterThanOrEqual(12);
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
