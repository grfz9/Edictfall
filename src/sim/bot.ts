// Pilote automatique : joue une run tout seul. Sert aux tests (headless et navigateur), pas au joueur.
import type { Player, PlayerInput } from '../core/types';
import { T, TILE, tileAt, isSolidTile, roomCenter } from './dungeon';
import { emptyInput, type World } from './world';

interface BotState { bad: Set<string>; floor: unknown; field: Int32Array | null; goal: string; t: number; strafe: number; stuck: number; lx: number; ly: number }
const states = new WeakMap<World, BotState>();

function flowTo(w: World, gx: number, gy: number): Int32Array {
  const f = w.floor;
  const dist = new Int32Array(f.w * f.h).fill(-1);
  const sx = Math.floor(gx / TILE), sy = Math.floor(gy / TILE);
  const q = new Int32Array(f.w * f.h);
  let qh = 0, qt = 0;
  q[qt++] = sx + sy * f.w;
  dist[sx + sy * f.w] = 0;
  while (qh < qt) {
    const i = q[qh++], x = i % f.w, y = (i / f.w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= f.w || ny >= f.h) continue;
      const j = nx + ny * f.w;
      const t = f.tiles[j];
      if (dist[j] >= 0 || isSolidTile(t)) continue;
      dist[j] = dist[i] + (t === T.HAZARD ? 6 : 1);
      q[qt++] = j;
    }
  }
  return dist;
}

export function botInput(w: World, p: Player): PlayerInput {
  const inp = emptyInput();
  if (p.downed || !w.floor) return inp;
  let st = states.get(w);
  if (!st) { st = { bad: new Set(), floor: null, field: null, goal: '', t: 0, strafe: 1, stuck: 0, lx: p.x, ly: p.y }; states.set(w, st); }
  st.t -= 1 / 60;
  if (st.floor !== w.floor) { st.floor = w.floor; st.bad.clear(); st.field = null; st.goal = ''; }
  if (w.tick % 240 === 0) st.bad.clear(); // une porte a pu s'ouvrir entre-temps
  const ok = (k: string) => !st!.bad.has(k);
  const rng = w.rng.combat;

  // --- combat
  let target = null as null | { x: number; y: number };
  let bd = Infinity;
  for (const e of w.enemies) {
    if (e.dead || e.charmed || e.def.id === 'dummy') continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd) { bd = d; target = e; }
  }
  let mx = 0, my = 0;
  if (target && w.mode === 'run') {
    const dx = (target.x - p.x) / (bd || 1), dy = (target.y - p.y) / (bd || 1);
    const melee = p.weapons[p.cur]?.def.bullet.kind === 'slash';
    const want = melee ? 14 : 80, slack = melee ? 4 : 20;
    const radial = bd > want + slack ? 1 : bd < want - slack ? -1 : 0;
    if (st.t <= 0) { st.t = 0.6 + rng.next(); st.strafe = rng.chance(0.5) ? 1 : -1; }
    mx = dx * radial - dy * st.strafe * 0.8; my = dy * radial + dx * st.strafe * 0.8;
    // esquive des balles proches
    for (const b of w.bullets) {
      if (b.team !== 'enemy' || b.kind !== 'shot') continue;
      const ox = p.x - b.x, oy = p.y - b.y, d = Math.hypot(ox, oy);
      if (d < 36 && d > 0.1) {
        const side = Math.sign(-b.vy * ox + b.vx * oy) || 1, sp = Math.hypot(b.vx, b.vy) || 1;
        mx += (-b.vy / sp) * side * 1.6 + (ox / d) * 0.5; my += (b.vx / sp) * side * 1.6 + (oy / d) * 0.5;
      }
    }
    inp.fire = true;
    inp.firePressed = w.tick % 12 === 0;
    inp.ax = dx; inp.ay = dy;
    if (p.skillCd <= 0) inp.skill = true;
    if (p.energy < 6 && p.weapons.length > 1 && w.tick % 90 === 0) inp.swap = true;
    // sans ligne de vue : marcher vers la cible par le champ de flux
    if (!w.los(p.x, p.y, target.x, target.y)) {
      const key = 'e' + Math.floor(target.x / TILE) + ',' + Math.floor(target.y / TILE);
      if (st.goal !== key || !st.field) { st.goal = key; st.field = flowTo(w, target.x, target.y); }
      const v = follow(w, st.field!, p);
      mx = v.x; my = v.y;
    }
  } else {
    // --- exploration : coffre > arme meilleure > soin > portail > salle non visitée
    let gx = 0, gy = 0, key = '';
    const chest = w.chests.find((c) => !c.opened && !c.dead && ok('c' + c.id));
    const hurt = p.hp < w.maxHp(p);
    const heal = hurt ? w.pickups.find((k) => k.kind === 'hp' && ok('h' + k.id)) : undefined;
    const cur = p.weapons[p.cur];
    const gun = w.items.find((i) => !i.dead && i.kind === 'weapon' && i.weapon && (p.weapons.length < p.mods.maxWeapons || i.weapon.rarity > (cur?.rarity ?? 0)) && Math.hypot(i.x - p.x, i.y - p.y) < 200 && ok('g' + i.id));
    const portal = w.items.find((i) => !i.dead && i.kind === 'portal');
    const fresh = w.floor.rooms.filter((r) => !r.visited && r.seen && !r.hidden && ok('r' + r.id));
    if (w.mode === 'hub') { if (portal) { gx = portal.x; gy = portal.y; key = 'portal'; } }
    else if (chest) { gx = chest.x; gy = chest.y; key = 'c' + chest.id; }
    else if (gun) { gx = gun.x; gy = gun.y; key = 'g' + gun.id; }
    else if (heal) { gx = heal.x; gy = heal.y; key = 'h' + heal.id; }
    else if (fresh.length && !(portal && fresh.every((r) => r.type !== 'combat'))) {
      const r = fresh.sort((a, b) => Math.hypot(roomCenter(a).x - p.x, roomCenter(a).y - p.y) - Math.hypot(roomCenter(b).x - p.x, roomCenter(b).y - p.y))[0];
      const c = roomCenter(r); gx = c.x; gy = c.y; key = 'r' + r.id;
    } else if (portal) { gx = portal.x; gy = portal.y; key = 'portal'; }
    else if (fresh.length) { const c = roomCenter(fresh[0]); gx = c.x; gy = c.y; key = 'r' + fresh[0].id; }
    else {
      // rien à faire : chercher une fissure (salle secrète) n'est pas nécessaire ; rester au centre
      const c = w.curRoom ? roomCenter(w.curRoom) : p; gx = c.x; gy = c.y; key = 'idle';
    }
    if (key) {
      if (isSolidTile(tileAt(w.floor, Math.floor(gx / TILE), Math.floor(gy / TILE)))) { gy += TILE; }
      if (st.goal !== key || !st.field) { st.goal = key; st.field = flowTo(w, gx, gy); }
      // but inatteignable (salle secrète fermée…) : on l'écarte
      if (st.field[Math.floor(p.x / TILE) + Math.floor(p.y / TILE) * w.floor.w] < 0 && key !== 'idle') { st.bad.add(key); st.field = null; }
      else if (Math.hypot(gx - p.x, gy - p.y) > 6) { const v = follow(w, st.field, p); mx = v.x; my = v.y; }
    }
    const f = w.focus[p.index];
    if (f && (f.kind === 'portal' || (gun && f === gun))) inp.interact = w.tick % 20 === 0;
    // casser les caisses sur le chemin
    inp.fire = w.props.some((pr) => !pr.dead && Math.hypot(pr.x - p.x, pr.y - p.y) < 22);
    if (inp.fire) { const pr = w.props.find((q) => !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 22)!; inp.ax = pr.x - p.x; inp.ay = pr.y - p.y; inp.aimManual = true; inp.firePressed = w.tick % 10 === 0; }
  }
  // anti-blocage
  if (w.tick % 60 === 0) {
    if (Math.hypot(p.x - st.lx, p.y - st.ly) < 3 && (mx || my)) st.stuck = 30;
    st.lx = p.x; st.ly = p.y;
  }
  if (st.stuck > 0) { st.stuck--; const a = (w.tick * 0.7) % 6.283; mx += Math.cos(a) * 2; my += Math.sin(a) * 2; st.field = null; }
  const l = Math.hypot(mx, my);
  if (l > 0.01) { inp.mx = mx / l; inp.my = my / l; }
  return inp;
}

function follow(w: World, field: Int32Array, p: Player): { x: number; y: number } {
  const f = w.floor;
  const cx = Math.floor(p.x / TILE), cy = Math.floor(p.y / TILE);
  let best = field[cx + cy * f.w];
  if (best < 0) best = 1e9;
  let bx = 0, by = 0;
  for (let oy = -1; oy <= 1; oy++)
    for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= f.w || ny >= f.h) continue;
      const d = field[nx + ny * f.w];
      if (d < 0 || d >= best) continue;
      if (ox && oy && (field[cx + ox + cy * f.w] < 0 || field[cx + (cy + oy) * f.w] < 0)) continue;
      best = d; bx = ox; by = oy;
    }
  if (!bx && !by) return { x: 0, y: 0 };
  const gx = (cx + bx + 0.5) * TILE - p.x, gy = (cy + by + 0.5) * TILE - p.y, g = Math.hypot(gx, gy) || 1;
  return { x: gx / g, y: gy / g };
}
