// Ennemis : apparition, IA de déplacement (données `move`), déclenchement des attaques (patterns), boss à phases.
import type { Enemy, EnemyDef, Player, AttackSpec, MoveSpec, Room } from '../core/types';
import { T, TILE, tileAt, isSolidTile } from './dungeon';
import { damagePlayer, tickStatus, damageEnemy } from './combat';
import { enemyDamage } from '../core/damage';
import type { World } from './world';

export const MAX_ENEMIES = 80;

export interface SpawnOpts {
  summoned?: boolean;
  elite?: boolean;
  champion?: boolean;
  /** Durée de l'annonce d'apparition (défaut 0.7 s ; 0 = immédiat). */
  delay?: number;
  charmed?: boolean;
}

export function spawnEnemy(w: World, id: string | EnemyDef, x: number, y: number, o: SpawnOpts = {}): Enemy | null {
  const def = typeof id === 'string' ? w.reg.enemies.get(id) : id;
  if (!def || w.enemies.length >= MAX_ENEMIES) return null;
  const m = w.mods;
  const depthMult = 1 + 0.08 * (w.floorNum - 1) + 0.7 * w.loop;
  let hp = def.hp * m.enemyHp * depthMult * (w.players.length > 1 ? 1.5 : 1);
  let scale = (def.scale ?? 1) * m.enemyScale;
  let attacks: AttackSpec[] = def.boss ? def.boss.phases[0].attacks : def.attacks ?? [];
  let speed = (def.boss?.phases[0].speed ?? def.speed) * m.enemySpeed;
  if (o.elite) {
    hp *= 2.2;
    scale *= 1.25;
    speed *= 1.1;
  }
  if (o.champion) {
    hp = hp * 7 + 120 * w.worldNum;
    scale *= 1.7;
    attacks = [
      ...attacks.map((a) => ({ ...a, cooldown: a.cooldown * 0.65 })),
      { pattern: 'ring', cooldown: 3.4, telegraph: 0.5, params: { count: 12 + 2 * w.worldNum, speed: 85 } },
      { pattern: 'burst', cooldown: 5, telegraph: 0.4, params: { shots: 4, interval: 0.16, count: 3, spread: 0.5, speed: 120 } },
    ];
  }
  const e: Enemy = {
    id: w.nextId++, def, team: 'enemy', x, y, vx: 0, vy: 0, kx: 0, ky: 0,
    radius: def.radius ?? 6, hp, maxHp: hp, flash: 0, status: {}, dead: false,
    speed, damageMult: 1, scale, facing: 1,
    attacks, move: def.boss?.phases[0].move ?? def.move,
    atkCd: [], tele: 0, teleAtk: -1, stop: 0, moveT: w.rng.combat.range(0, 1.5), moveState: 0, mx: 0, my: 0,
    phase: 0, elite: !!o.elite, champion: !!o.champion, summoned: !!o.summoned,
    spawnT: o.delay ?? 0.7, age: 0, target: null, charmed: o.charmed, data: {},
  };
  resetAttackTimers(w, e);
  if (def.boss) { const P = def.boss.phases[0]; e.data.look = { sprite: P.sprite, scale: P.scale, tint: P.tint, aura: P.aura }; }
  w.enemies.push(e);
  if (def.onSpawn) def.onSpawn(w.ctx, e);
  w.rules.emit('onEnemySpawn', e);
  return e;
}

function resetAttackTimers(w: World, e: Enemy): void {
  e.atkCd = e.attacks.map((a) => a.first ?? w.rng.combat.range(0.6, Math.max(0.8, a.cooldown)));
}

// ----------------------------------------------------------------- champ de flux (pathfinding par salle)
export interface Flow {
  room: Room;
  dist: Int16Array;
  t: number;
}
export function computeFlow(w: World, room: Room, px: number, py: number): Flow {
  const f = w.floor;
  const dist = new Int16Array(room.w * room.h).fill(-1);
  const sx = Math.max(0, Math.min(room.w - 1, Math.floor(px / TILE) - room.x));
  const sy = Math.max(0, Math.min(room.h - 1, Math.floor(py / TILE) - room.y));
  const q = new Int32Array(room.w * room.h);
  let qh = 0, qt = 0;
  q[qt++] = sx + sy * room.w;
  dist[sx + sy * room.w] = 0;
  while (qh < qt) {
    const i = q[qh++];
    const x = i % room.w, y = (i / room.w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= room.w || ny >= room.h) continue;
      const j = nx + ny * room.w;
      if (dist[j] >= 0 || isSolidTile(tileAt(f, room.x + nx, room.y + ny))) continue;
      dist[j] = dist[i] + 1;
      q[qt++] = j;
    }
  }
  return { room, dist, t: 0 };
}

/** Direction (normalisée) pour aller vers (tx,ty) en contournant les obstacles. */
function steer(w: World, e: Enemy, tx: number, ty: number, out: { x: number; y: number }): void {
  const dx = tx - e.x, dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  out.x = dx / d;
  out.y = dy / d;
  if (e.def.phasing || w.los(e.x, e.y, tx, ty)) return;
  const fl = w.flow;
  if (!fl) return;
  const r = fl.room;
  const cx = Math.floor(e.x / TILE) - r.x, cy = Math.floor(e.y / TILE) - r.y;
  if (cx < 0 || cy < 0 || cx >= r.w || cy >= r.h) return;
  let best = fl.dist[cx + cy * r.w];
  if (best < 0) best = 9999;
  let bx = 0, by = 0, found = false;
  for (let oy = -1; oy <= 1; oy++)
    for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= r.w || ny >= r.h) continue;
      const dd = fl.dist[nx + ny * r.w];
      if (dd < 0 || dd >= best) continue;
      // diagonale : les deux orthogonales doivent être libres
      if (ox && oy && (fl.dist[cx + ox + cy * r.w] < 0 || fl.dist[cx + (cy + oy) * r.w] < 0)) continue;
      best = dd; bx = ox; by = oy; found = true;
    }
  if (found) {
    const gx = (r.x + cx + bx + 0.5) * TILE - e.x, gy = (r.y + cy + by + 0.5) * TILE - e.y;
    const g = Math.hypot(gx, gy) || 1;
    out.x = gx / g;
    out.y = gy / g;
  }
}

/** Déplace une entité avec collisions sur les tuiles. Retourne true si un mur a été touché. */
export function moveEntity(w: World, e: { x: number; y: number; radius: number }, dx: number, dy: number, phasing = false): boolean {
  const r = Math.min(e.radius, 6) - 0.5;
  let hit = false;
  if (phasing) {
    e.x += dx;
    e.y += dy;
    const room = w.curRoom;
    if (room) {
      e.x = Math.max((room.x + 1) * TILE + r, Math.min((room.x + room.w - 1) * TILE - r, e.x));
      e.y = Math.max((room.y + 1) * TILE + r, Math.min((room.y + room.h - 1) * TILE - r, e.y));
    }
    return false;
  }
  // sous-pas pour les grandes vitesses
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6));
  dx /= steps; dy /= steps;
  for (let s = 0; s < steps; s++) {
    if (dx) {
      const nx = e.x + dx;
      const ex = nx + Math.sign(dx) * r;
      if (w.solid(ex, e.y - r) || w.solid(ex, e.y + r)) hit = true;
      else e.x = nx;
    }
    if (dy) {
      const ny = e.y + dy;
      const ey = ny + Math.sign(dy) * r;
      if (w.solid(e.x - r, ey) || w.solid(e.x + r, ey)) hit = true;
      else e.y = ny;
    }
  }
  return hit;
}

const V = { x: 0, y: 0 };

export function updateEnemies(w: World, dt: number): void {
  const m = w.mods;
  const es = w.enemies;
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    if (e.dead) continue;
    if (e.flash > 0) e.flash -= dt;
    if (e.spawnT > 0) {
      e.spawnT -= dt;
      if (e.spawnT <= 0) w.fx.push({ t: 'burst', x: e.x, y: e.y, color: 0xd070ff, n: 6, speed: 50, life: 0.3 });
      continue;
    }
    tickStatus(w, e, dt);
    if (e.dead) continue;
    let d = dt * m.timeScale;
    if (e.status.shock) d = 0;
    else if (e.status.freeze) d *= 0.35;
    else if (e.status.slow) d *= 0.6;
    e.age += d;
    // cible
    const target = e.charmed ? null : w.nearestPlayer(e.x, e.y);
    const foe = e.charmed ? w.nearestEnemy(e.x, e.y, 400, true) : null;
    e.target = target;
    const tx = target ? target.x : foe ? foe.x : e.x, ty = target ? target.y : foe ? foe.y : e.y;
    const hasT = !!(target || foe);
    const dist = Math.hypot(tx - e.x, ty - e.y);
    if (hasT && Math.abs(tx - e.x) > 2) e.facing = tx > e.x ? 1 : -1;

    // --- phases de boss
    const boss = e.def.boss;
    if (boss) {
      let ph = 0;
      const pct = e.hp / e.maxHp;
      for (let k = 0; k < boss.phases.length; k++) if (pct <= boss.phases[k].hp) ph = k;
      if (ph !== e.phase) {
        e.phase = ph;
        const P = boss.phases[ph];
        e.attacks = P.attacks;
        e.move = P.move ?? e.def.move;
        e.speed = (P.speed ?? e.def.speed) * m.enemySpeed;
        e.atkCd = e.attacks.map((a, k2) => 0.8 + k2 * 0.7);
        e.tele = 0;
        e.stop = 0.8;
        e.moveState = 0;
        w.fx.push({ t: 'ring', x: e.x, y: e.y, r: 70, color: 0xff4466 });
        w.fx.push({ t: 'shake', a: 7 });
        w.fx.push({ t: 'sfx', id: 'phase' });
        if (!P.onEnter) w.fx.push({ t: 'banner', title: `PHASE ${ph + 1}`, sub: e.def.name, color: '#ff5577' });
        // nettoie les balles ennemies pour une transition lisible
        for (const b of w.bullets) if (b.team === 'enemy') b.dead = true;
        e.data.look = { sprite: P.sprite, scale: P.scale, tint: P.tint, aura: P.aura };
        if (P.onEnter) P.onEnter(w.ctx, e);
      }
    }

    // --- attaques
    if (d > 0 && hasT && !e.charmed) {
      if (e.tele > 0) {
        e.tele -= d;
        if (e.tele <= 0) {
          const a = e.attacks[e.teleAtk];
          if (a) {
            const fn = w.reg.patterns.get(a.pattern);
            if (fn) fn(w.ctx, e, a.params ?? {}, target);
            else if (!w.warned.has(a.pattern)) { w.warned.add(a.pattern); console.warn(`[enemy] pattern inconnu : ${a.pattern}`); }
            e.stop = Math.max(e.stop, a.stop ?? 0);
          }
        }
      } else {
        let ready: number[] | null = null;
        for (let k = 0; k < e.attacks.length; k++) {
          const a = e.attacks[k];
          e.atkCd[k] -= d * m.enemyFireRate;
          if (e.atkCd[k] <= 0 && dist < (a.range ?? 260)) (ready ??= []).push(k);
        }
        if (ready && (boss || e.def.phasing || w.los(e.x, e.y, tx, ty))) {
          const k = ready.length === 1 ? ready[0] : w.rng.combat.weighted(ready, (q) => e.attacks[q].weight ?? 1);
          const a = e.attacks[k];
          e.atkCd[k] = a.cooldown * w.rng.combat.range(0.85, 1.15);
          e.tele = a.telegraph ?? 0.35;
          e.teleAtk = k;
          if (a.stop) e.stop = Math.max(e.stop, e.tele);
        }
      }
    }

    // --- déplacement
    let vx = 0, vy = 0;
    const dash = e.data.dash;
    if (dash && dash.t > 0) {
      dash.t -= d;
      vx = dash.vx; vy = dash.vy;
    } else if (e.stop > 0) {
      e.stop -= d;
    } else if (hasT) {
      moveAI(w, e, e.move, tx, ty, dist, d);
      vx = e.mx * e.speed;
      vy = e.my * e.speed;
    }
    // séparation douce
    if (!e.def.boss) {
      for (let j = i + 1; j < es.length; j++) {
        const o = es[j];
        if (o.dead || o.spawnT > 0) continue;
        const ox = o.x - e.x, oy = o.y - e.y;
        const rr = (e.radius * e.scale + o.radius * o.scale) * 0.9;
        const dd = ox * ox + oy * oy;
        if (dd < rr * rr && dd > 0.01) {
          const l = Math.sqrt(dd), push = ((rr - l) / l) * 0.5;
          const pe = o.def.boss ? 1 : 0.5;
          e.kx -= ox * push * 8 * pe; e.ky -= oy * push * 8 * pe;
          if (!o.def.boss) { o.kx += ox * push * 8 * 0.5; o.ky += oy * push * 8 * 0.5; }
        }
      }
    }
    e.vx = vx; e.vy = vy;
    const hitWall = moveEntity(w, e, (vx + e.kx) * d, (vy + e.ky) * d, e.def.phasing);
    if (hitWall && dash && dash.t > 0) {
      dash.t = 0;
      e.stop = 0.4;
      w.fx.push({ t: 'shake', a: 2 });
    }
    const damp = Math.exp(-9 * dt);
    e.kx *= damp; e.ky *= damp;

    // --- contact
    const contact = e.def.contact ?? 1;
    if (contact > 0 && target && !e.charmed) {
      const rr = e.radius * e.scale + target.radius * 0.6;
      if (dist < rr && d > 0) damagePlayer(w, target, enemyDamage(contact + (dash && dash.t > 0 ? 1 : 0), m.enemyDamage * e.damageMult), 'contact', e);
    } else if (e.charmed && foe && dist < e.radius * e.scale + foe.radius * foe.scale + 2) {
      if ((e.data.biteT = (e.data.biteT ?? 0) - dt) <= 0) {
        e.data.biteT = 0.5;
        damageEnemy(w, foe, 8 + 4 * w.worldNum, { cause: 'rule', source: e });
      }
    }
    if (e.def.onUpdate) e.def.onUpdate(w.ctx, e, d);
  }
  let n = 0;
  for (let i = 0; i < es.length; i++) if (!es[i].dead) es[n++] = es[i];
  es.length = n;
}

function moveAI(w: World, e: Enemy, mv: MoveSpec, tx: number, ty: number, dist: number, d: number): void {
  const rng = w.rng.combat;
  e.moveT -= d;
  switch (mv.kind) {
    case 'stationary':
      e.mx = e.my = 0;
      break;
    case 'chase': {
      if (mv.range && dist < mv.range) { e.mx = e.my = 0; break; }
      steer(w, e, tx, ty, V);
      e.mx = V.x; e.my = V.y;
      break;
    }
    case 'zigzag': {
      steer(w, e, tx, ty, V);
      const s = Math.sin(e.age * 5 + e.id) * 0.9;
      const x = V.x - V.y * s, y = V.y + V.x * s, l = Math.hypot(x, y) || 1;
      e.mx = x / l; e.my = y / l;
      break;
    }
    case 'keepDistance': {
      const range = mv.range ?? 90;
      if (e.moveT <= 0) { e.moveT = rng.range(1.2, 2.6); e.moveState = rng.chance(0.5) ? 1 : -1; }
      if (dist > range * 1.2) { steer(w, e, tx, ty, V); e.mx = V.x; e.my = V.y; }
      else {
        const ax = (tx - e.x) / (dist || 1), ay = (ty - e.y) / (dist || 1);
        const back = dist < range * 0.75 ? -1 : 0;
        const s = e.moveState || 1;
        const x = ax * back - ay * s * 0.8, y = ay * back + ax * s * 0.8, l = Math.hypot(x, y) || 1;
        e.mx = (x / l) * 0.8; e.my = (y / l) * 0.8;
      }
      break;
    }
    case 'orbit': {
      const range = mv.range ?? 70;
      if (!e.moveState) e.moveState = rng.chance(0.5) ? 1 : -1;
      const ax = (tx - e.x) / (dist || 1), ay = (ty - e.y) / (dist || 1);
      const radial = Math.max(-1, Math.min(1, (dist - range) / 30));
      const x = ax * radial - ay * e.moveState, y = ay * radial + ax * e.moveState, l = Math.hypot(x, y) || 1;
      e.mx = x / l; e.my = y / l;
      break;
    }
    case 'wander': {
      if (e.moveT <= 0) {
        e.moveT = mv.period ?? rng.range(0.8, 1.8);
        const a = rng.range(0, Math.PI * 2);
        const toward = rng.chance(0.35);
        e.mx = toward ? (tx - e.x) / (dist || 1) : Math.cos(a);
        e.my = toward ? (ty - e.y) / (dist || 1) : Math.sin(a);
        e.mx *= 0.7; e.my *= 0.7;
      }
      break;
    }
    case 'flee': {
      const range = mv.range ?? 80;
      if (dist < range) { e.mx = -(tx - e.x) / (dist || 1); e.my = -(ty - e.y) / (dist || 1); }
      else if (e.moveT <= 0) { e.moveT = rng.range(0.8, 1.6); const a = rng.range(0, 6.283); e.mx = Math.cos(a) * 0.5; e.my = Math.sin(a) * 0.5; }
      break;
    }
    case 'hop': {
      // moveState 0 = au sol, 1 = en saut
      if (e.moveState === 0) {
        e.mx = e.my = 0;
        if (e.moveT <= 0) {
          e.moveState = 1; e.moveT = mv.dur ?? 0.32;
          steer(w, e, tx, ty, V);
          const j = rng.range(-0.4, 0.4), c = Math.cos(j), s = Math.sin(j), k = mv.mult ?? 2.4;
          e.mx = (V.x * c - V.y * s) * k; e.my = (V.x * s + V.y * c) * k;
        }
      } else if (e.moveT <= 0) { e.moveState = 0; e.moveT = (mv.period ?? 0.9) * rng.range(0.8, 1.2); }
      break;
    }
    case 'charge': {
      // 0 = approche lente, 1 = élan (annonce), 2 = ruée
      if (e.moveState === 0) {
        steer(w, e, tx, ty, V);
        e.mx = V.x * 0.5; e.my = V.y * 0.5;
        if (e.moveT <= 0 && dist < (mv.range ?? 170) && w.los(e.x, e.y, tx, ty)) { e.moveState = 1; e.moveT = 0.45; e.tele = Math.max(e.tele, 0); e.data.windup = 0.45; }
      } else if (e.moveState === 1) {
        e.mx = e.my = 0;
        e.flash = 0.05;
        if (e.moveT <= 0) {
          e.moveState = 2; e.moveT = mv.dur ?? 0.5;
          const k = mv.mult ?? 3.2;
          e.data.cx = ((tx - e.x) / (dist || 1)) * k; e.data.cy = ((ty - e.y) / (dist || 1)) * k;
          w.fx.push({ t: 'sfx', id: 'dash', vol: 0.5 });
        }
      } else {
        e.mx = e.data.cx; e.my = e.data.cy;
        if (e.moveT <= 0) { e.moveState = 0; e.moveT = (mv.period ?? 1.6) * rng.range(0.8, 1.2); }
      }
      break;
    }
    case 'teleport': {
      if (e.moveT <= 0) {
        e.moveT = (mv.period ?? 2.6) * rng.range(0.8, 1.2);
        const room = w.curRoom;
        for (let t = 0; t < 12; t++) {
          const a = rng.range(0, 6.283), r = rng.range(50, mv.range ?? 100);
          const nx = tx + Math.cos(a) * r, ny = ty + Math.sin(a) * r;
          if (!w.solid(nx, ny) && !w.solid(nx + 5, ny) && !w.solid(nx - 5, ny) && !w.solid(nx, ny + 5) && !w.solid(nx, ny - 5) && (!room || w.inRoom(room, nx, ny))) {
            w.fx.push({ t: 'burst', x: e.x, y: e.y, color: 0xc070ff, n: 8, speed: 60, life: 0.3 });
            e.x = nx; e.y = ny;
            w.fx.push({ t: 'burst', x: nx, y: ny, color: 0xc070ff, n: 8, speed: 60, life: 0.3 });
            w.fx.push({ t: 'sfx', id: 'blink', vol: 0.5 });
            break;
          }
        }
        const a2 = rng.range(0, 6.283);
        e.mx = Math.cos(a2) * 0.4; e.my = Math.sin(a2) * 0.4;
      }
      break;
    }
  }
}

export { T };
