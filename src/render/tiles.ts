// Peint le sol et les murs d'un étage dans un canvas, selon le thème du monde.
import type { ThemeDef } from '../core/types';
import { T, TILE, tileAt, type Floor } from '../sim/dungeon';

export const DEFAULT_THEME: ThemeDef = {
  world: 0, name: 'Le Hall',
  floor: ['#3b3550', '#403a57', '#37314b'], floorDeco: '#4c4668',
  wallTop: '#6a5f8c', wallTopLight: '#8a7fb0', wallFace: '#4a4168', wallFaceDark: '#352e4e',
  voidColor: '#0b0812', hazard: ['#7a2a4a', '#c04a6a'], slick: ['#5a7aa8', '#8ab0d8'], door: '#c8901c',
  ambient: 0xffffff, music: { bpm: 96, root: 45, scale: [0, 2, 3, 5, 7, 8, 10] }, hazardRate: 0, slickRate: 0,
};

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const wallish = (t: number) => t === T.WALL || t === T.CRACK || t === T.BLOCK;
const floorish = (t: number) => t === T.FLOOR || t === T.DOOR || t === T.DOORC || t === T.HAZARD || t === T.SLICK;

export function paintFloor(f: Floor, theme: ThemeDef): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = f.w * TILE; c.height = f.h * TILE;
  const g = c.getContext('2d')!;
  g.fillStyle = theme.voidColor;
  g.fillRect(0, 0, c.width, c.height);
  // --- sols
  for (let ty = 0; ty < f.h; ty++)
    for (let tx = 0; tx < f.w; tx++) {
      const t = f.tiles[tx + ty * f.w];
      if (!floorish(t)) continue;
      const x = tx * TILE, y = ty * TILE, h = hash(tx, ty);
      g.fillStyle = theme.floor[(tx + ty) % 2 === 0 ? 0 : 1];
      g.fillRect(x, y, TILE, TILE);
      if (h < 0.18) { g.fillStyle = theme.floor[2]; g.fillRect(x, y, TILE, TILE); }
      // petits détails
      g.fillStyle = theme.floorDeco;
      if (h > 0.55) g.fillRect(x + ((h * 97) % 12 | 0) + 1, y + ((h * 53) % 12 | 0) + 1, 2, 1);
      if (h > 0.8) g.fillRect(x + ((h * 31) % 11 | 0) + 2, y + ((h * 71) % 11 | 0) + 2, 1, 2);
      if (h > 0.93) { g.fillRect(x + 5, y + 8, 3, 1); g.fillRect(x + 6, y + 7, 1, 3); }
      if (t === T.HAZARD) {
        g.fillStyle = theme.hazard[0];
        g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
        g.fillStyle = theme.hazard[1];
        for (let k = 0; k < 4; k++) {
          const sx = x + 2 + ((k % 2) * 7) + ((hash(tx + k, ty) * 3) | 0), sy = y + 3 + ((k >> 1) * 7);
          g.fillRect(sx + 1, sy, 1, 1); g.fillRect(sx, sy + 1, 3, 1); g.fillRect(sx, sy + 2, 3, 2);
        }
      } else if (t === T.SLICK) {
        g.fillStyle = theme.slick[0];
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = theme.slick[1];
        const o = (h * 8) | 0;
        g.fillRect(x + 2 + o, y + 3, 4, 1); g.fillRect(x + 3 + o, y + 4, 2, 1); g.fillRect(x + 9 - o, y + 11, 5, 1);
      }
    }
  // --- ombres portées sous les murs
  g.fillStyle = 'rgba(0,0,0,0.28)';
  for (let ty = 1; ty < f.h; ty++)
    for (let tx = 0; tx < f.w; tx++) if (floorish(f.tiles[tx + ty * f.w]) && wallish(tileAt(f, tx, ty - 1))) g.fillRect(tx * TILE, ty * TILE, TILE, 5);
  // --- murs
  for (let ty = 0; ty < f.h; ty++)
    for (let tx = 0; tx < f.w; tx++) {
      const t = f.tiles[tx + ty * f.w];
      if (!wallish(t)) continue;
      const x = tx * TILE, y = ty * TILE, h = hash(tx * 3, ty * 7);
      const below = tileAt(f, tx, ty + 1), above = tileAt(f, tx, ty - 1);
      const block = t === T.BLOCK;
      g.fillStyle = theme.wallTop;
      g.fillRect(x, y, TILE, TILE);
      if (floorish(below) || below === T.VOID) {
        // face avant
        g.fillStyle = theme.wallFace;
        g.fillRect(x, y + 6, TILE, 10);
        g.fillStyle = theme.wallFaceDark;
        g.fillRect(x, y + 10, TILE, 1); g.fillRect(x, y + 15, TILE, 1);
        g.fillRect(x + ((h * 10) | 0) + 2, y + 6, 1, 4);
        g.fillRect(x + ((h * 7) | 0) + 6, y + 11, 1, 4);
      }
      if (!wallish(above)) { g.fillStyle = theme.wallTopLight; g.fillRect(x, y, TILE, 1); }
      if (!wallish(tileAt(f, tx - 1, ty))) { g.fillStyle = theme.wallTopLight; g.fillRect(x, y, 1, floorish(below) ? 6 : TILE); }
      if (!wallish(tileAt(f, tx + 1, ty))) { g.fillStyle = theme.wallFaceDark; g.fillRect(x + TILE - 1, y, 1, TILE); }
      if (block) { g.fillStyle = theme.wallTopLight; g.fillRect(x + 3, y + 2, 4, 1); g.fillRect(x + 9, y + 3, 3, 1); }
      else if (h > 0.7) { g.fillStyle = theme.wallTopLight; g.fillRect(x + ((h * 9) | 0) + 2, y + 3, 2, 1); }
      if (t === T.CRACK) {
        g.fillStyle = theme.wallFaceDark;
        const pts = [[7, 1], [8, 2], [8, 3], [7, 4], [6, 5], [7, 6], [8, 7], [9, 8], [8, 9], [7, 10], [7, 11], [8, 12], [6, 13], [9, 4], [10, 5], [5, 8], [4, 9]];
        for (const [px, py] of pts) g.fillRect(x + px, y + py, 1, 1);
      }
    }
  return c;
}

/** Couleurs de la minimap / utilitaires. */
export function hexNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
