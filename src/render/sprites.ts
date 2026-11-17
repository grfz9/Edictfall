// Atlas de sprites : transforme les SpriteDef ASCII en une texture unique (+ variante « flash blanc »).
// N'importe PAS Pixi : produit un canvas + des rectangles. Le renderer en fait des textures, l'UI des icônes.
import { R } from '../core/registry';
import type { SpriteDef } from '../core/types';
import { PAL, OUTLINE } from './palette';

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface AtlasEntry {
  frames: Frame[];
  flash: Frame[];
  /** Ancre normalisée (0..1). */
  ax: number;
  ay: number;
  w: number;
  h: number;
  /** Couleur dominante (0xRRGGBB). */
  color: number;
}
export interface Atlas {
  canvas: HTMLCanvasElement;
  entries: Map<string, AtlasEntry>;
}

// Police 3×5 intégrée (chiffres de dégâts, étiquettes en jeu).
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001',
  '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110',
  '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', ':': '000010000010000', '.': '000000000000010',
  "'": '010010000000000', '?': '110001010000010', '/': '001001010100100', '%': '101001010100101', '*': '000101010101000',
};
export const glyphId = (ch: string) => 'f_' + ch;

function fontSprites(): SpriteDef[] {
  return Object.entries(FONT).map(([ch, bits]) => {
    const px: string[] = [];
    for (let y = 0; y < 5; y++) px.push(bits.slice(y * 3, y * 3 + 3).replace(/1/g, '1').replace(/0/g, '.'));
    return { id: glyphId(ch), px };
  });
}

function builtinSprites(): SpriteDef[] {
  return [
    { id: 'px', px: ['1'], outline: false },
    { id: 'missing', px: ['mkmk', 'kmkm', 'mkmk', 'kmkm'], outline: false },
    { id: 'shadow', px: ['..kkkkkk..', '.kkkkkkkk.', 'kkkkkkkkkk', '.kkkkkkkk.', '..kkkkkk..'], outline: false },
    // --- effets du renderer (blancs/clairs : teintés à l'affichage)
    // flash de bouche : pointe vers la droite, ancre à gauche
    {
      id: 'fx_muzzle', ox: 0, oy: 3, outline: false,
      px: ['...1.....', '.1.11..1.', '..11111..', '111111111', '..11111..', '.1.11..1.', '...1.....'],
      frames: [
        ['.........', '..1...1..', '..1111...', '11111111.', '..1111...', '..1...1..', '.........'],
        ['.........', '.........', '...11....', '1111111..', '...11....', '.........', '.........'],
      ],
    },
    // douilles : laiton / cartouche rouge
    { id: 'fx_casing', px: ['y1Y', 'YYN'], outline: '#2a1a10' },
    { id: 'fx_shell', px: ['yrrR', 'YRRR'], outline: '#2a1a10' },
    // flammes de torche (4 frames), ancre à la base
    {
      id: 'fx_flame', oy: 7, outline: false,
      px: ['..y..', '..y..', '.yoy.', '.y1o.', 'oy1yo', 'oy1yv', '.vyv.', '..V..'],
      frames: [
        ['.y...', '.yy..', '.yoy.', 'oy1y.', 'oy1yo', '.y1yv', '.vyv.', '..V..'],
        ['...y.', '..yy.', '.yoy.', '.y1yo', 'oy1yo', 'oy1y.', '.vyv.', '..V..'],
        ['.....', '..y..', '.yyy.', '.y1o.', 'oy11o', 'oy1yv', '.vyv.', '..V..'],
      ],
    },
    {
      id: 'fx_wisp', oy: 7, outline: false,
      px: ['..i..', '..c..', '.cic.', '.c1C.', 'Cc1cC', 'Cc1cb', '.bcb.', '..B..'],
      frames: [
        ['.i...', '.cc..', '.cic.', 'Cc1c.', 'Cc1cC', '.c1cb', '.bcb.', '..B..'],
        ['...i.', '..cc.', '.cic.', '.c1cC', 'Cc1cC', 'Cc1c.', '.bcb.', '..B..'],
        ['.....', '..c..', '.ccc.', '.c1C.', 'Cc11C', 'Cc1cb', '.bcb.', '..B..'],
      ],
    },
    // lanterne de la forêt (verre jaune-vert qui vacille)
    {
      id: 'fx_lantern', oy: 1,
      px: ['..d..', '.ddd.', 'dlyld', 'dy1yd', 'dlyld', '.ddd.'],
      frames: [['..d..', '.ddd.', 'dyyld', 'dl1yd', 'dyyld', '.ddd.'], ['..d..', '.ddd.', 'dlyyd', 'dy1ld', 'dlyyd', '.ddd.']],
      pal: { d: '#2c2018' },
    },
    // étincelle (4 branches)
    { id: 'fx_spark', px: ['.1.', '111', '.1.'], outline: false },
    { id: 'fx_star', px: ['..1..', '..1..', '11111', '..1..', '..1..'], outline: false },
    ...fontSprites(),
  ];
}

/** Couleur dominante d'un sprite (hors contour, blanc, noir) — pour les éclats, traînées, dissolutions. */
function dominantColor(def: SpriteDef): number {
  const count = new Map<string, number>();
  for (const row of def.px)
    for (const ch of row) {
      if (ch === '.' || ch === ' ' || ch === '0' || ch === '1' || ch === 'k' || ch === 'w' || ch === '5') continue;
      count.set(ch, (count.get(ch) ?? 0) + 1);
    }
  let best = '', bn = 0;
  for (const [ch, n] of count) if (n > bn) { bn = n; best = ch; }
  const hex = best ? ((def.pal && def.pal[best]) ?? PAL[best]) : undefined;
  if (!hex) return 0xffffff;
  const [r, g, b] = hexToRgb(hex);
  return (r << 16) | (g << 8) | b;
}

interface Raster {
  w: number;
  h: number;
  data: Uint8ClampedArray;
  flash: Uint8ClampedArray;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function rasterize(def: SpriteDef, rows: string[]): Raster {
  const outline = def.outline === undefined ? OUTLINE : def.outline;
  const pad = outline ? 1 : 0;
  const sw = Math.max(...rows.map((r) => r.length)), sh = rows.length;
  const w = sw + pad * 2, h = sh + pad * 2;
  const data = new Uint8ClampedArray(w * h * 4);
  const flash = new Uint8ClampedArray(w * h * 4);
  const pal = def.pal ? { ...PAL, ...def.pal } : PAL;
  for (let y = 0; y < sh; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch] ?? '#ff00ff';
      const [r, g, b] = hexToRgb(col);
      const i = (x + pad + (y + pad) * w) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      flash[i] = flash[i + 1] = flash[i + 2] = 255; flash[i + 3] = 255;
    }
  }
  if (outline) {
    const [r, g, b] = hexToRgb(outline);
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && flash[(x + y * w) * 4 + 3] === 255;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
          const i = (x + y * w) * 4;
          data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
          flash[i] = r; flash[i + 1] = g; flash[i + 2] = b; flash[i + 3] = 254; // 254 : contour, pas "solide"
        }
      }
    for (let i = 3; i < flash.length; i += 4) if (flash[i] === 254) flash[i] = 255;
  }
  return { w, h, data, flash };
}

/** Construit l'atlas à partir de tous les sprites enregistrés. */
export function buildAtlas(): Atlas {
  const defs = [...builtinSprites(), ...R.sprites.values()];
  type Item = { id: string; frame: number; flash: boolean; r: Raster; pix: Uint8ClampedArray };
  const items: Item[] = [];
  const meta = new Map<string, AtlasEntry>();
  for (const def of defs) {
    const all = [def.px, ...(def.frames ?? [])];
    const pad = def.outline === false ? 0 : 1;
    const sw = Math.max(...def.px.map((r) => r.length)), sh = def.px.length;
    const w = sw + pad * 2, h = sh + pad * 2;
    meta.set(def.id, {
      frames: [], flash: [], w, h, color: dominantColor(def),
      ax: def.ox !== undefined ? (def.ox + pad) / w : 0.5,
      ay: def.oy !== undefined ? (def.oy + pad) / h : 0.5,
    });
    all.forEach((rows, fi) => {
      const r = rasterize(def, rows);
      items.push({ id: def.id, frame: fi, flash: false, r, pix: r.data });
      items.push({ id: def.id, frame: fi, flash: true, r, pix: r.flash });
    });
  }
  // empaquetage en étagères
  items.sort((a, b) => b.r.h - a.r.h);
  const W = 1024;
  let x = 1, y = 1, shelf = 0;
  const pos: { x: number; y: number }[] = [];
  for (const it of items) {
    if (x + it.r.w + 1 > W) { x = 1; y += shelf + 1; shelf = 0; }
    pos.push({ x, y });
    x += it.r.w + 1;
    shelf = Math.max(shelf, it.r.h);
  }
  const H = Math.max(64, 2 ** Math.ceil(Math.log2(y + shelf + 2)));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(W, H);
  items.forEach((it, i) => {
    const p = pos[i];
    for (let yy = 0; yy < it.r.h; yy++) {
      const src = yy * it.r.w * 4, dst = (p.x + (p.y + yy) * W) * 4;
      img.data.set(it.pix.subarray(src, src + it.r.w * 4), dst);
    }
    const e = meta.get(it.id)!;
    (it.flash ? e.flash : e.frames)[it.frame] = { x: p.x, y: p.y, w: it.r.w, h: it.r.h };
  });
  g.putImageData(img, 0, 0);
  return { canvas, entries: meta };
}

let ATLAS: Atlas | null = null;
export function getAtlas(): Atlas {
  return (ATLAS ??= buildAtlas());
}

/** Canvas autonome d'un sprite, agrandi `scale` fois — pour les icônes de l'interface DOM. */
export function spriteCanvas(id: string, scale = 3, frame = 0): HTMLCanvasElement {
  const atlas = getAtlas();
  const e = atlas.entries.get(id) ?? atlas.entries.get('missing')!;
  const f = e.frames[Math.min(frame, e.frames.length - 1)];
  const c = document.createElement('canvas');
  c.width = f.w * scale; c.height = f.h * scale;
  c.style.imageRendering = 'pixelated';
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(atlas.canvas, f.x, f.y, f.w, f.h, 0, 0, c.width, c.height);
  return c;
}
export function spriteDataUrl(id: string, scale = 3): string {
  return spriteCanvas(id, scale).toDataURL();
}
