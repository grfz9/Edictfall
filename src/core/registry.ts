// Registres de contenu. Les fichiers de src/content/** s'y enregistrent à l'import.
import type { SpriteDef, WeaponDef, EnemyDef, HeroDef, ModifierDef, PetDef, ThemeDef, Enemy, Player } from './types';
import type { Ctx } from '../sim/ctx';

export type PatternFn = (ctx: Ctx, e: Enemy, p: Record<string, any>, target: Player | null) => void;

export const R = {
  sprites: new Map<string, SpriteDef>(),
  weapons: new Map<string, WeaponDef>(),
  enemies: new Map<string, EnemyDef>(),
  heroes: new Map<string, HeroDef>(),
  mods: new Map<string, ModifierDef>(),
  pets: new Map<string, PetDef>(),
  themes: new Map<number, ThemeDef>(),
  patterns: new Map<string, PatternFn>(),
};

function put<T>(map: Map<any, T>, key: any, v: T, what: string): T {
  if (map.has(key)) console.warn(`[registry] ${what} "${key}" défini deux fois — la dernière définition gagne.`);
  map.set(key, v);
  return v;
}

/** defineSprite('id', ['..aa..', ...], { pal: {a:'#fff'} }) — retourne l'id. */
export function defineSprite(id: string, px: string[], opts: Partial<Omit<SpriteDef, 'id' | 'px'>> = {}): string {
  const w = px[0]?.length ?? 0;
  for (const row of px) if (row.length !== w) console.warn(`[sprite] "${id}" : lignes de largeurs différentes`);
  put(R.sprites, id, { id, px, ...opts }, 'sprite');
  return id;
}
export const defineWeapon = (d: WeaponDef) => put(R.weapons, d.id, d, 'arme');
export const defineEnemy = (d: EnemyDef) => put(R.enemies, d.id, d, 'ennemi');
export const defineHero = (d: HeroDef) => put(R.heroes, d.id, d, 'héros');
export const definePet = (d: PetDef) => put(R.pets, d.id, d, 'familier');
export const defineTheme = (d: ThemeDef) => put(R.themes, d.world, d, 'thème');
export const definePattern = (id: string, fn: PatternFn) => put(R.patterns, id, fn, 'pattern');
type ModInput = Omit<ModifierDef, 'kind'>;
export const defineRule = (d: ModInput) => put(R.mods, d.id, { flavor: 'mixed', ...d, kind: 'rule' } as ModifierDef, 'règle');
export const definePassive = (d: ModInput) => put(R.mods, d.id, { flavor: 'boon', ...d, kind: 'passive' } as ModifierDef, 'passif');
export const defineSynergy = (d: ModInput) => put(R.mods, d.id, { flavor: 'boon', ...d, kind: 'synergy' } as ModifierDef, 'synergie');

export const allRules = () => [...R.mods.values()].filter((m) => m.kind === 'rule');
export const allPassives = () => [...R.mods.values()].filter((m) => m.kind === 'passive');
export const allSynergies = () => [...R.mods.values()].filter((m) => m.kind === 'synergy');
