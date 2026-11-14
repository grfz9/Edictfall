import { describe, it, expect } from 'vitest';
import { rollDamage, enemyDamage, absorbDamage, rollRarity, rarityDamageMult, weaponPrice } from '../src/core/damage';

describe('rollDamage', () => {
  it('sans critique : base × mult', () => {
    expect(rollDamage(10, { mult: 1.5, critChance: 0.2, rand: 0.5 })).toEqual({ amount: 15, crit: false });
  });
  it('critique quand rand < critChance, critMult par défaut 2', () => {
    expect(rollDamage(10, { critChance: 0.2, rand: 0.1 })).toEqual({ amount: 20, crit: true });
    expect(rollDamage(10, { critChance: 0.2, critMult: 3.5, rand: 0.1 }).amount).toBeCloseTo(35);
  });
  it('limite stricte : rand === critChance n\'est pas un critique', () => {
    expect(rollDamage(10, { critChance: 0.2, rand: 0.2 }).crit).toBe(false);
  });
  it('critChance absente = jamais de critique ; critChance ≥ 1 = toujours', () => {
    expect(rollDamage(10, { rand: 0 }).crit).toBe(false);
    expect(rollDamage(10, { critChance: 1, rand: 0.999 }).crit).toBe(true);
  });
  it('jamais négatif, base nulle = 0', () => {
    expect(rollDamage(-5, { rand: 0.5 }).amount).toBe(0);
    expect(rollDamage(10, { mult: -2, rand: 0.5 }).amount).toBe(0);
    expect(rollDamage(0, { critChance: 1, rand: 0 }).amount).toBe(0);
  });
});

describe('enemyDamage', () => {
  it('entier arrondi, minimum 1 si base > 0', () => {
    expect(enemyDamage(1, 1)).toBe(1);
    expect(enemyDamage(1, 0.25)).toBe(1);
    expect(enemyDamage(2, 1.3)).toBe(3);
    expect(enemyDamage(3, 1.5)).toBe(5); // 4.5 → 5
    expect(enemyDamage(1, 1.4)).toBe(1);
  });
  it('base nulle ou négative = 0', () => {
    expect(enemyDamage(0, 5)).toBe(0);
    expect(enemyDamage(-2, 5)).toBe(0);
  });
  it('mult nul : quand même 1', () => {
    expect(enemyDamage(2, 0)).toBe(1);
  });
});

describe('absorbDamage', () => {
  it('l\'armure encaisse d\'abord', () => {
    expect(absorbDamage(6, 5, 3)).toEqual({ hp: 6, armor: 2, hpLost: 0, armorLost: 3 });
  });
  it('le surplus passe aux PV', () => {
    expect(absorbDamage(6, 2, 5)).toEqual({ hp: 3, armor: 0, hpLost: 3, armorLost: 2 });
  });
  it('pierceArmor ignore l\'armure', () => {
    expect(absorbDamage(6, 5, 2, true)).toEqual({ hp: 4, armor: 5, hpLost: 2, armorLost: 0 });
  });
  it('les PV ne passent jamais sous 0', () => {
    expect(absorbDamage(2, 1, 99)).toEqual({ hp: 0, armor: 0, hpLost: 2, armorLost: 1 });
  });
  it('montant arrondi et jamais négatif', () => {
    expect(absorbDamage(6, 0, 1.4)).toMatchObject({ hp: 5, hpLost: 1 });
    expect(absorbDamage(6, 3, -4)).toEqual({ hp: 6, armor: 3, hpLost: 0, armorLost: 0 });
    expect(absorbDamage(6, 3, 0)).toEqual({ hp: 6, armor: 3, hpLost: 0, armorLost: 0 });
  });
  it('déjà à 0 PV', () => {
    expect(absorbDamage(0, 0, 3)).toEqual({ hp: 0, armor: 0, hpLost: 0, armorLost: 0 });
  });
});

describe('rollRarity', () => {
  const dist = (depth: number, bonus = 0) => {
    const c = [0, 0, 0, 0, 0];
    for (let i = 0; i < 2000; i++) c[rollRarity((i + 0.5) / 2000, depth, bonus)]++;
    return c;
  };
  it('retourne toujours une rareté 0..4', () => {
    for (const r of [0, 1e-9, 0.25, 0.5, 0.75, 0.999999, 1]) for (const d of [-5, 0, 7, 14, 40]) for (const b of [-5, -0.5, 0, 1, 5]) {
      const v = rollRarity(r, d, b);
      expect([0, 1, 2, 3, 4]).toContain(v);
    }
  });
  it('rand = 0 → blanc, rand ≈ 1 → orange', () => {
    expect(rollRarity(0, 0)).toBe(0);
    expect(rollRarity(0.99999, 0)).toBe(4);
    expect(rollRarity(1, 0)).toBe(4);
  });
  it('monotone en rand', () => {
    let last = 0;
    for (let i = 0; i <= 100; i++) {
      const v = rollRarity(i / 100, 5, 0.2);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
  it('la profondeur et le bonus font monter la rareté moyenne', () => {
    const mean = (c: number[]) => c.reduce((a, n, i) => a + n * i, 0) / c.reduce((a, b) => a + b, 0);
    expect(mean(dist(14))).toBeGreaterThan(mean(dist(0)));
    expect(mean(dist(0, 1))).toBeGreaterThan(mean(dist(0)));
    expect(mean(dist(0, -0.9))).toBeLessThan(mean(dist(0)));
  });
  it('profondeur plafonnée (au-delà de 21, plus d\'effet) et bonus ≤ -0.9 borné', () => {
    expect(dist(21)).toEqual(dist(100));
    expect(dist(0, -0.9)).toEqual(dist(0, -50));
    expect(dist(0)).toEqual(dist(-3));
  });
});

describe('rarityDamageMult & weaponPrice', () => {
  it('+30 % par cran au-dessus de la rareté de base, jamais en dessous de 1', () => {
    expect(rarityDamageMult(0, 0)).toBe(1);
    expect(rarityDamageMult(0, 4)).toBeCloseTo(2.2);
    expect(rarityDamageMult(2, 3)).toBeCloseTo(1.3);
    expect(rarityDamageMult(4, 1)).toBe(1);
  });
  it('prix par rareté, défaut 30', () => {
    expect(weaponPrice(0)).toBe(18);
    expect(weaponPrice(4)).toBe(85);
    expect(weaponPrice(9)).toBe(30);
  });
});
