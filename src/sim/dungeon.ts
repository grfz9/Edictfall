// Génération procédurale des étages : salles sur une grille, reliées par des couloirs.
import type { Room, RoomType, FloorPlan, ThemeDef } from '../core/types';
import type { Rng } from '../core/rng';

export const TILE = 16;
export const T = { VOID: 0, FLOOR: 1, WALL: 2, DOOR: 3, DOORC: 4, HAZARD: 5, SLICK: 6, CRACK: 7, BLOCK: 8 } as const;
export const CELL_W = 25;
export const CELL_H = 19;
export const GRID_W = 5;
export const GRID_H = 4;

export interface Floor {
  w: number;
  h: number;
  tiles: Uint8Array;
  rooms: Room[];
  start: Room;
  world: number;
  floor: number;
  /** Caisses et barils à poser (coordonnées en pixels). */
  props: { x: number; y: number; kind: 'crate' | 'barrel' }[];
  /** Groupes de tuiles fissurées (entrée de salle secrète) : casser une tuile casse le groupe. */
  cracks: { tiles: { x: number; y: number }[]; room: number }[];
  /** Incrémenté quand la carte change (mur cassé) → le rendu redessine le sol. */
  rev: number;
}

export const isSolidTile = (t: number) => t === T.WALL || t === T.DOORC || t === T.CRACK || t === T.BLOCK || t === T.VOID;

export function tileAt(f: Floor, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= f.w || ty >= f.h) return T.VOID;
  return f.tiles[tx + ty * f.w];
}
export function solidAt(f: Floor, x: number, y: number): boolean {
  return isSolidTile(tileAt(f, Math.floor(x / TILE), Math.floor(y / TILE)));
}
/** Salle dont le rectangle (murs inclus) contient le point (pixels). */
export function roomAt(f: Floor, x: number, y: number): Room | null {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  for (const r of f.rooms) if (tx >= r.x && ty >= r.y && tx < r.x + r.w && ty < r.y + r.h) return r;
  return null;
}
export const roomCenter = (r: Room) => ({ x: (r.x + r.w / 2) * TILE, y: (r.y + r.h / 2) * TILE });

export function defaultPlan(world: number, floor: number): FloorPlan {
  const end = floor === 5 ? 'boss' : floor === 3 ? 'guardian' : 'exit';
  const combat = floor === 5 ? 2 : floor <= 2 ? 3 : 4;
  const specials: string[] = [];
  if (floor !== 5) specials.push('chest');
  if (floor === 2 || floor === 4 || floor === 5) specials.push('shop');
  if (floor === 3 || (floor === 1 && world > 1)) specials.push('statue');
  return { world, floor, combat: end === 'exit' ? combat : combat - 1, specials, end };
}

function roomSize(type: RoomType, rng: Rng): [number, number] {
  switch (type) {
    case 'boss':
      return [23, 17];
    case 'guardian':
      return [19, 13];
    case 'combat':
      return [13 + 2 * rng.int(0, 4), 9 + 2 * rng.int(0, 3)];
    case 'shop':
      return [13, 9];
    case 'special':
      return [15, 11];
    default:
      return [11, 9];
  }
}

function makeRoom(id: number, type: RoomType, cx: number, cy: number, rng: Rng): Room {
  const [w, h] = roomSize(type, rng);
  return {
    id, type, cx, cy,
    x: cx * CELL_W + ((CELL_W - w) >> 1),
    y: cy * CELL_H + ((CELL_H - h) >> 1),
    w, h,
    state: type === 'combat' || type === 'boss' || type === 'guardian' ? 'fresh' : 'cleared',
    locked: false, doors: [], links: [], seen: false, visited: false,
    waves: 1, wave: 0, exit: false, hidden: false, data: {},
  };
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function generateFloor(rng: Rng, plan: FloorPlan, theme: ThemeDef | undefined, secretChance = 0.45): Floor {
  const w = GRID_W * CELL_W;
  const h = GRID_H * CELL_H;
  const f: Floor = { w, h, tiles: new Uint8Array(w * h), rooms: [], start: null as any, world: plan.world, floor: plan.floor, props: [], cracks: [], rev: 0 };
  const grid = new Map<number, Room>();
  const key = (cx: number, cy: number) => cx + cy * GRID_W;
  const inGrid = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < GRID_W && cy < GRID_H;

  // --- 1. chemin principal (marche aléatoire auto-évitante, avec reprises)
  const mainLen = Math.max(1, Math.min(8, plan.combat)) + 2; // départ + combats + fin
  let path: [number, number][] = [];
  for (let attempt = 0; attempt < 200; attempt++) {
    path = [[rng.int(0, GRID_W - 1), rng.int(0, GRID_H - 1)]];
    const used = new Set<number>([key(path[0][0], path[0][1])]);
    while (path.length < mainLen) {
      const [cx, cy] = path[path.length - 1];
      const opts = DIRS.map(([dx, dy]) => [cx + dx, cy + dy] as [number, number]).filter(([x, y]) => inGrid(x, y) && !used.has(key(x, y)));
      if (!opts.length) break;
      const nxt = rng.pick(opts);
      used.add(key(nxt[0], nxt[1]));
      path.push(nxt);
    }
    if (path.length === mainLen) break;
  }
  const link = (a: Room, b: Room) => {
    a.links.push(b.id);
    b.links.push(a.id);
  };
  path.forEach(([cx, cy], i) => {
    const last = i === path.length - 1;
    const type: RoomType = i === 0 ? 'start' : last && plan.end === 'boss' ? 'boss' : last && plan.end === 'guardian' ? 'guardian' : 'combat';
    const room = makeRoom(f.rooms.length, type, cx, cy, rng);
    room.exit = last;
    f.rooms.push(room);
    grid.set(key(cx, cy), room);
    if (i > 0) link(f.rooms[i - 1], room);
  });
  f.start = f.rooms[0];

  // --- 2. salles spéciales en branches
  const specials = [...plan.specials];
  if (rng.chance(secretChance) && !specials.includes('secret')) specials.push('secret');
  for (const s of specials) {
    const hosts = rng.shuffle(f.rooms.filter((r) => r.type !== 'boss' && r.type !== 'secret' && !r.hidden));
    let placed = false;
    for (const host of hosts) {
      const free = DIRS.map(([dx, dy]) => [host.cx + dx, host.cy + dy]).filter(([x, y]) => inGrid(x, y) && !grid.has(key(x, y)));
      if (!free.length) continue;
      const [cx, cy] = rng.pick(free);
      const room = makeRoom(f.rooms.length, s as RoomType, cx, cy, rng);
      if (s === 'secret') room.hidden = true;
      f.rooms.push(room);
      grid.set(key(cx, cy), room);
      link(host, room);
      placed = true;
      break;
    }
    if (!placed) continue;
  }

  // --- 3. creusage
  const set = (x: number, y: number, t: number) => {
    if (x >= 0 && y >= 0 && x < w && y < h) f.tiles[x + y * w] = t;
  };
  const get = (x: number, y: number) => tileAt(f, x, y);
  for (const r of f.rooms) {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        const edge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1;
        set(x, y, edge ? T.WALL : T.FLOOR);
      }
  }
  // couloirs (3 tuiles de large) + portes
  const done = new Set<string>();
  for (const a of f.rooms) {
    for (const bid of a.links) {
      const b = f.rooms[bid];
      const k = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
      if (done.has(k)) continue;
      done.add(k);
      const secret = a.hidden || b.hidden;
      const crackTiles: { x: number; y: number }[] = [];
      const host = a.hidden ? b : a;
      const doorTile = (room: Room, x: number, y: number) => {
        if (secret && room === host) {
          set(x, y, T.CRACK);
          crackTiles.push({ x, y });
        } else if (secret) {
          set(x, y, T.FLOOR);
        } else {
          set(x, y, T.DOOR);
          room.doors.push({ x, y });
        }
      };
      if (a.cy === b.cy) {
        const [l, r] = a.cx < b.cx ? [a, b] : [b, a];
        const ry = l.cy * CELL_H + ((CELL_H - 1) >> 1);
        const x0 = l.x + l.w - 1;
        const x1 = r.x;
        for (let d = -1; d <= 1; d++) {
          doorTile(l, x0, ry + d);
          doorTile(r, x1, ry + d);
          for (let x = x0 + 1; x < x1; x++) set(x, ry + d, T.FLOOR);
        }
        for (let x = x0 + 1; x < x1; x++) {
          if (get(x, ry - 2) === T.VOID) set(x, ry - 2, T.WALL);
          if (get(x, ry + 2) === T.VOID) set(x, ry + 2, T.WALL);
        }
      } else {
        const [u, d2] = a.cy < b.cy ? [a, b] : [b, a];
        const rx = u.cx * CELL_W + ((CELL_W - 1) >> 1);
        const y0 = u.y + u.h - 1;
        const y1 = d2.y;
        for (let d = -1; d <= 1; d++) {
          doorTile(u, rx + d, y0);
          doorTile(d2, rx + d, y1);
          for (let y = y0 + 1; y < y1; y++) set(rx + d, y, T.FLOOR);
        }
        for (let y = y0 + 1; y < y1; y++) {
          if (get(rx - 2, y) === T.VOID) set(rx - 2, y, T.WALL);
          if (get(rx + 2, y) === T.VOID) set(rx + 2, y, T.WALL);
        }
      }
      if (crackTiles.length) f.cracks.push({ tiles: crackTiles, room: (a.hidden ? a : b).id });
    }
  }

  // --- 4. décor des salles de combat : obstacles isolés (ne bloquent jamais), dangers, caisses
  const hazardRate = theme?.hazardRate ?? 0.3;
  const slickRate = theme?.slickRate ?? 0;
  for (const r of f.rooms) {
    const depth = plan.floor;
    if (r.type === 'combat') {
      r.waves = Math.min(3, 1 + (depth >= 2 ? 1 : 0) + (rng.chance(0.15 + 0.12 * plan.world + 0.04 * depth) ? 1 : 0));
    }
    if (r.type !== 'combat' && r.type !== 'boss' && r.type !== 'guardian') continue;
    const ix0 = r.x + 3, iy0 = r.y + 3, ix1 = r.x + r.w - 4, iy1 = r.y + r.h - 4; // zone intérieure (2 tuiles de marge)
    const midX = r.x + (r.w >> 1), midY = r.y + (r.h >> 1);
    const freeFloor = (x: number, y: number) => get(x, y) === T.FLOOR;
    const lonely = (x: number, y: number) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (get(x + dx, y + dy) !== T.FLOOR) return false;
      return true;
    };
    const layout = r.type === 'boss' ? 'corners' : rng.pick(['open', 'pillars', 'center', 'scatter', 'scatter', 'rows', 'corners']);
    const block = (x: number, y: number) => {
      if (x >= ix0 && x <= ix1 && y >= iy0 && y <= iy1 && freeFloor(x, y)) set(x, y, T.BLOCK);
    };
    if (layout === 'pillars' || layout === 'corners') {
      const ox = layout === 'corners' ? 0 : Math.max(1, ((ix1 - ix0) >> 2));
      const oy = layout === 'corners' ? 0 : Math.max(0, ((iy1 - iy0) >> 2));
      for (const [px, py] of [[ix0 + ox, iy0 + oy], [ix1 - ox, iy0 + oy], [ix0 + ox, iy1 - oy], [ix1 - ox, iy1 - oy]]) block(px, py);
    } else if (layout === 'center') {
      const len = rng.int(1, 2);
      for (let d = -len; d <= len; d++) block(midX + d, midY);
    } else if (layout === 'scatter') {
      const n = rng.int(3, 7);
      for (let i = 0, tries = 0; i < n && tries < 60; tries++) {
        const x = rng.int(ix0, ix1), y = rng.int(iy0, iy1);
        if (lonely(x, y) && !(Math.abs(x - midX) < 2 && Math.abs(y - midY) < 2)) {
          set(x, y, T.BLOCK);
          i++;
        }
      }
    } else if (layout === 'rows') {
      for (let x = ix0 + 1; x <= ix1 - 1; x += 3) {
        block(x, iy0 + 1);
        if (iy1 - 1 > iy0 + 2) block(x, iy1 - 1);
      }
    }
    // dangers et glisse (taches)
    const blob = (t: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const bx = rng.int(ix0 - 1, ix1), by = rng.int(iy0 - 1, iy1);
        const bw = rng.int(1, 3), bh = rng.int(1, 2);
        for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (freeFloor(x, y) && x > r.x + 1 && x < r.x + r.w - 2 && y > r.y + 1 && y < r.y + r.h - 2) set(x, y, t);
      }
    };
    if (r.type === 'combat' && rng.chance(hazardRate)) blob(T.HAZARD, rng.int(1, 3));
    if (r.type !== 'boss' && rng.chance(slickRate)) blob(T.SLICK, rng.int(2, 4));
    // caisses / barils
    if (r.type === 'combat') {
      const n = rng.int(0, 5);
      for (let i = 0, tries = 0; i < n && tries < 40; tries++) {
        const x = rng.int(r.x + 2, r.x + r.w - 3), y = rng.int(r.y + 2, r.y + r.h - 3);
        if (!freeFloor(x, y) || (Math.abs(x - midX) < 2 && Math.abs(y - midY) < 2)) continue;
        if (f.props.some((p) => Math.abs(p.x - (x + 0.5) * TILE) < 2 && Math.abs(p.y - (y + 0.5) * TILE) < 2)) continue;
        f.props.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, kind: rng.chance(0.25) ? 'barrel' : 'crate' });
        i++;
      }
    }
  }
  return f;
}

/** Le Hall des Ratures : une grande salle unique (le décor est posé par World.startHub). */
export function generateHub(): Floor {
  const w = 41, h = 27;
  const f: Floor = { w, h, tiles: new Uint8Array(w * h), rooms: [], start: null as any, world: 0, floor: 0, props: [], cracks: [], rev: 0 };
  const room: Room = {
    id: 0, type: 'hub', cx: 0, cy: 0, x: 1, y: 1, w: w - 2, h: h - 2, state: 'cleared', locked: false, doors: [], links: [],
    seen: true, visited: true, waves: 0, wave: 0, exit: false, hidden: false, data: {},
  };
  for (let y = room.y; y < room.y + room.h; y++)
    for (let x = room.x; x < room.x + room.w; x++) {
      const edge = x === room.x || y === room.y || x === room.x + room.w - 1 || y === room.y + room.h - 1;
      f.tiles[x + y * w] = edge ? T.WALL : T.FLOOR;
    }
  f.rooms.push(room);
  f.start = room;
  return f;
}

/** Vérifie que toutes les tuiles de sol d'un étage sont atteignables depuis le départ (portes ouvertes, fissures franchies). */
export function floorIsConnected(f: Floor): boolean {
  const seen = new Uint8Array(f.w * f.h);
  const c = roomCenter(f.start);
  const sx = Math.floor(c.x / TILE), sy = Math.floor(c.y / TILE);
  const q = [sx + sy * f.w];
  seen[q[0]] = 1;
  const pass = (t: number) => t === T.FLOOR || t === T.DOOR || t === T.HAZARD || t === T.SLICK || t === T.CRACK;
  while (q.length) {
    const i = q.pop()!;
    const x = i % f.w, y = (i / f.w) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= f.w || ny >= f.h) continue;
      const j = nx + ny * f.w;
      if (!seen[j] && pass(f.tiles[j])) {
        seen[j] = 1;
        q.push(j);
      }
    }
  }
  for (let i = 0; i < f.tiles.length; i++) if (pass(f.tiles[i]) && !seen[i]) return false;
  return true;
}
