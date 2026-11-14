// Calculs de dégâts — fonctions pures, testées dans tests/damage.test.ts

export interface HitRoll {
  amount: number;
  crit: boolean;
}
/** Dégâts d'un coup du joueur. `rand` ∈ [0,1) fourni par le RNG de la sim. */
export function rollDamage(base: number, o: { mult?: number; critChance?: number; critMult?: number; rand: number }): HitRoll {
  const crit = o.rand < (o.critChance ?? 0);
  let amount = base * (o.mult ?? 1);
  if (crit) amount *= o.critMult ?? 2;
  return { amount: Math.max(0, amount), crit };
}

/** Dégâts d'un ennemi sur un joueur : entier, minimum 1 si la base est > 0. */
export function enemyDamage(base: number, mult: number): number {
  if (base <= 0) return 0;
  return Math.max(1, Math.round(base * mult));
}

export interface AbsorbResult {
  hp: number;
  armor: number;
  hpLost: number;
  armorLost: number;
}
/** L'armure encaisse d'abord ; le surplus passe aux PV. */
export function absorbDamage(hp: number, armor: number, amount: number, pierceArmor = false): AbsorbResult {
  amount = Math.max(0, Math.round(amount));
  let armorLost = 0;
  if (!pierceArmor) {
    armorLost = Math.min(armor, amount);
    amount -= armorLost;
  }
  const hpLost = Math.min(hp, amount);
  return { hp: hp - hpLost, armor: armor - armorLost, hpLost, armorLost };
}

/** Tirage de rareté. depth = progression 0..14 (étages franchis), bonus = Mods. */
export function rollRarity(rand: number, depth: number, bonus = 0): 0 | 1 | 2 | 3 | 4 {
  const d = Math.min(1.5, Math.max(0, depth) / 14);
  // poids blanc→orange, glissent vers le haut avec la profondeur
  const w = [Math.max(4, 50 - 40 * d), 30, 14 + 14 * d, 5 + 13 * d, 1 + 7 * d];
  for (let i = 0; i < 5; i++) w[i] *= Math.pow(1 + Math.max(-0.9, bonus), i);
  const total = w.reduce((a, b) => a + b, 0);
  let r = rand * total;
  for (let i = 0; i < 5; i++) {
    r -= w[i];
    if (r <= 0) return i as 0 | 1 | 2 | 3 | 4;
  }
  return 4;
}

/** Une arme dont la rareté d'instance dépasse sa rareté de base est renforcée. */
export function rarityDamageMult(defRarity: number, instRarity: number): number {
  return 1 + 0.3 * Math.max(0, instRarity - defRarity);
}

export function weaponPrice(rarity: number): number {
  return [18, 28, 42, 60, 85][rarity] ?? 30;
}

export const RARITY_NAMES = ['Commun', 'Peu commun', 'Rare', 'Épique', 'Légendaire'];
export const RARITY_COLORS = ['#e8e8f0', '#58d858', '#48a8ff', '#c070ff', '#ff9a30'];
export const RARITY_HEX = [0xe8e8f0, 0x58d858, 0x48a8ff, 0xc070ff, 0xff9a30];
