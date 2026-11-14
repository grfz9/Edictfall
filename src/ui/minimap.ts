// Minimap des salles : canvas basse résolution agrandi en pixelated.
import type { World } from '../sim/world';
import type { Room } from '../core/types';
import { GRID_W, GRID_H } from '../sim/dungeon';

const CELL_W = 26, CELL_H = 20;
const ROOM_COLORS: Record<string, string> = {
  start: '#c8d0e0', combat: '#8a93a8', chest: '#ffd23a', shop: '#58d858', statue: '#48a8ff', secret: '#c070ff', guardian: '#ff9a30', boss: '#ff4455', hub: '#8a93a8',
};
// Pictogrammes 5×5 (1 = pixel sombre posé sur la salle).
const GLYPH: Record<string, string[]> = {
  chest: ['11111', '10001', '11011', '10001', '11111'],
  shop: ['01110', '10100', '01110', '00101', '01110'],
  statue: ['00100', '01110', '00100', '01110', '11111'],
  secret: ['01110', '10001', '00110', '00000', '00100'],
  guardian: ['10001', '01010', '00100', '01010', '10001'],
  boss: ['01110', '10101', '11111', '01110', '01010'],
  start: ['10000', '11110', '11100', '10000', '10000'],
  exit: ['01110', '10001', '10101', '10001', '01110'],
};

export class Minimap {
  readonly el: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private t = 0;
  constructor() {
    this.el = document.createElement('canvas');
    this.el.id = 'minimap';
    this.el.width = GRID_W * CELL_W;
    this.el.height = GRID_H * CELL_H;
    this.el.setAttribute('aria-label', 'Carte de l\'étage');
    this.g = this.el.getContext('2d')!;
  }
  draw(w: World, dt: number): void {
    this.t += dt;
    const g = this.g, W = this.el.width, H = this.el.height;
    g.clearRect(0, 0, W, H);
    if (!w.floor) return;
    const rooms = w.floor.rooms;
    const vis = (r: Room) => r.seen && !r.hidden;
    const c = (r: Room) => ({ x: Math.round(r.cx * CELL_W + CELL_W / 2), y: Math.round(r.cy * CELL_H + CELL_H / 2) });
    // liens
    g.fillStyle = 'rgba(200,190,230,.45)';
    for (const r of rooms) {
      if (!vis(r)) continue;
      for (const id of r.links) {
        const o = rooms[id];
        if (!o || o.id < r.id || !vis(o)) continue;
        const a = c(r), b = c(o);
        if (a.y === b.y) g.fillRect(Math.min(a.x, b.x), a.y - 1, Math.abs(a.x - b.x), 2);
        else if (a.x === b.x) g.fillRect(a.x - 1, Math.min(a.y, b.y), 2, Math.abs(a.y - b.y));
        else { g.fillRect(Math.min(a.x, b.x), a.y - 1, Math.abs(a.x - b.x), 2); g.fillRect(b.x - 1, Math.min(a.y, b.y), 2, Math.abs(a.y - b.y)); }
      }
    }
    // salles
    const rw = 18, rh = 13;
    for (const r of rooms) {
      if (!vis(r)) continue;
      const p = c(r), x = p.x - rw / 2, y = p.y - rh / 2;
      const cur = r === w.curRoom;
      g.globalAlpha = r.visited ? 1 : 0.5;
      g.fillStyle = '#1b1326'; g.fillRect(x - 1, y - 1, rw + 2, rh + 2);
      let col = ROOM_COLORS[r.type] ?? '#8a93a8';
      if (r.type === 'combat' && r.state === 'cleared') col = '#4e5468';
      if (r.type === 'combat' && r.state === 'active') col = '#c84050';
      g.fillStyle = col; g.fillRect(x, y, rw, rh);
      g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, y, rw, 2);
      const glyph = GLYPH[r.type] ?? (r.exit ? GLYPH.exit : null);
      if (glyph && (r.visited || r.type === 'boss' || r.type === 'secret')) {
        g.fillStyle = r.type === 'combat' || r.type === 'start' ? '#1b1326' : 'rgba(27,19,38,.85)';
        for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) if (glyph[yy][xx] === '1') g.fillRect(p.x - 2 + xx, p.y - 2 + yy, 1, 1);
      }
      if (r.exit && r.visited && r.type !== 'boss') { g.fillStyle = '#c070ff'; g.fillRect(x + rw - 5, y + 2, 3, 3); }
      g.globalAlpha = 1;
      if (cur) {
        const on = Math.floor(this.t * 3) % 2 === 0;
        g.fillStyle = on ? '#ffffff' : '#ffd23a';
        g.fillRect(x - 2, y - 2, rw + 4, 1); g.fillRect(x - 2, y + rh + 1, rw + 4, 1);
        g.fillRect(x - 2, y - 2, 1, rh + 4); g.fillRect(x + rw + 1, y - 2, 1, rh + 4);
      }
    }
  }
}
