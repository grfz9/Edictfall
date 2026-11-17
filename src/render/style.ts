// Direction artistique par monde : tout ce que le thème (couleurs) ne dit pas — motifs, lumières, ambiance.
// Indexé par ThemeDef.world (0 = Hall / thème par défaut). Données pures : aucun import Pixi.

export type FloorStyle = 'flag' | 'grass' | 'snow' | 'basalt';
export type WallStyle = 'brick' | 'roots' | 'ice' | 'forge';
export type HazardStyle = 'goo' | 'bramble' | 'thinice' | 'lava';
export type SlickStyle = 'puddle' | 'ice' | 'oil';
/** 0 poussière · 1 luciole · 2 flocon · 3 braise · 4 cendre · 5 spore */
export type AmbientKind = 0 | 1 | 2 | 3 | 4 | 5;

export interface WorldStyle {
  floor: FloorStyle;
  wall: WallStyle;
  hazard: HazardStyle;
  slick: SlickStyle;
  /** Particules d'ambiance (mélangées) et leur nombre à l'écran. */
  ambient: AmbientKind[];
  ambientN: number;
  ambientColors: number[];
  /** Source lumineuse murale : sprite + couleur du halo. */
  torch: 'fx_flame' | 'fx_wisp' | 'fx_lantern';
  light: number;
  /** Assombrissement global (couleur, opacité) : les halos additifs font ensuite office d'éclairage. */
  dimColor: number;
  dim: number;
  /** Respiration de couleur : amplitude de variation de l'assombrissement. */
  breathe: number;
  vignette: number;
  /** Lumière autour du joueur. */
  playerLight: number;
  /** Les tuiles dangereuses émettent de la lumière (couleur) ou non. */
  hazardLight: number | null;
  /** Décorations de sol (motifs de deco.ts) et leurs couleurs. */
  deco: string[];
  decoPal: Record<string, number>;
  decoRate: number;
  /** Couleur des éclats d'impact par défaut. */
  accent: number;
}

const HUB: WorldStyle = {
  floor: 'flag', wall: 'brick', hazard: 'goo', slick: 'puddle',
  ambient: [0, 0, 5], ambientN: 36, ambientColors: [0xb8a8ff, 0xffe0a8, 0x9a88d8],
  torch: 'fx_flame', light: 0xffb060,
  dimColor: 0x0a0618, dim: 0.16, breathe: 0.025, vignette: 0.55, playerLight: 0xffe8c8, hazardLight: 0xc04a6a,
  deco: ['pebbles', 'rune', 'bones', 'candle'], decoRate: 0.05,
  decoPal: { a: 0x8a7fb0, b: 0x5a5078, c: 0xe8d8a0, d: 0x2a2440, e: 0xffd890, f: 0xc8b8f0 },
  accent: 0xc8b8f0,
};

export const STYLES: Record<number, WorldStyle> = {
  0: HUB,
  1: {
    floor: 'grass', wall: 'roots', hazard: 'bramble', slick: 'puddle',
    ambient: [1, 1, 5], ambientN: 44, ambientColors: [0xd8ff70, 0xfff08a, 0x9af0b0],
    torch: 'fx_lantern', light: 0xe0f070,
    dimColor: 0x04140a, dim: 0.24, breathe: 0.035, vignette: 0.62, playerLight: 0xfff0c8, hazardLight: null,
    deco: ['flower', 'flower2', 'mushroom', 'tuft', 'tuft', 'leaves', 'pebbles', 'fern'], decoRate: 0.11,
    decoPal: { a: 0xff70b8, b: 0xffd23a, c: 0xf4f0e0, d: 0x1e4a2a, e: 0x58d858, f: 0xe0404a, g: 0x8a6e4a, h: 0xc070ff, i: 0x3a7a3a },
    accent: 0x9af070,
  },
  2: {
    floor: 'snow', wall: 'ice', hazard: 'thinice', slick: 'ice',
    ambient: [2, 2, 2, 0], ambientN: 56, ambientColors: [0xffffff, 0xe8f6ff, 0xc8e8ff],
    torch: 'fx_wisp', light: 0x78d8ff,
    dimColor: 0x0a1a38, dim: 0.14, breathe: 0.03, vignette: 0.5, playerLight: 0xe8f4ff, hazardLight: 0x4a90d0,
    deco: ['crystal', 'crystal2', 'drift', 'pebbles', 'icebit', 'bones'], decoRate: 0.07,
    decoPal: { a: 0x9ae8ff, b: 0x58c0e8, c: 0xffffff, d: 0x2858c8, e: 0xd8f0ff, f: 0x88b8e0, g: 0x6a90b8 },
    accent: 0xd8f0ff,
  },
  3: {
    floor: 'basalt', wall: 'forge', hazard: 'lava', slick: 'oil',
    ambient: [3, 3, 4, 3], ambientN: 52, ambientColors: [0xff9a30, 0xffd060, 0xff5030],
    torch: 'fx_flame', light: 0xff8a30,
    dimColor: 0x14040a, dim: 0.3, breathe: 0.045, vignette: 0.68, playerLight: 0xffd8b0, hazardLight: 0xff6a20,
    deco: ['bones', 'skull', 'ember', 'ember', 'pebbles', 'ashpile', 'chainbit'], decoRate: 0.08,
    decoPal: { a: 0xe8dcc0, b: 0xa89878, c: 0xff9a30, d: 0xd83a20, e: 0xffd060, f: 0x2a1a1e, g: 0x6a5a6a, h: 0x555c70 },
    accent: 0xffb060,
  },
};

export function styleFor(world: number): WorldStyle {
  return STYLES[world] ?? HUB;
}

/** Petits motifs de décor peints au sol (non bloquants). Lettres → decoPal du monde ; '.' transparent. */
export const DECO: Record<string, string[]> = {
  pebbles: ['.a..', 'ab.a', '..ab'],
  rune: ['.f.f.', 'f.f.f', '.fff.', 'f.f.f', '.f.f.'],
  bones: ['c...c', '.c.c.', '..c..', '.c.c.', 'c...c'],
  candle: ['.e.', '.c.', '.c.', 'ccc'],
  flower: ['.a.', 'aba', '.a.', '.e.', 'ee.'],
  flower2: ['h.h', '.b.', 'h.h', '.i.'],
  mushroom: ['.ff.', 'fcff', '.cc.', '.cc.'],
  tuft: ['e.e.e', '.eie.', '.iii.'],
  fern: ['e...e', '.e.e.', 'e.e.e', '.eie.', '..i..'],
  leaves: ['g..b', '.b..', 'g.g.'],
  crystal: ['..a.', '.aa.', '.aab', 'aabb', 'abbd'],
  crystal2: ['.a..a', '.ab.a', 'aab.b', 'abbbd'],
  drift: ['..cccc..', '.ceeecc.', 'ceeeeeef'],
  icebit: ['e.', 'ef', '.f'],
  skull: ['.aaa.', 'afafa', 'aaaaa', '.a.a.'],
  ember: ['.c.', 'cec', '.d.'],
  ashpile: ['..g..', '.ggh.', 'ghhhh'],
  chainbit: ['hh.hh', 'h.h.h', 'hh.hh'],
};
/** Décors qui brillent (halo de lumière ajouté par le renderer). */
export const DECO_LIGHT: Record<string, number> = { crystal: 0x78d8ff, crystal2: 0x78d8ff, ember: 0xff7a30, candle: 0xffc070, mushroom: 0, rune: 0x9a88ff };
