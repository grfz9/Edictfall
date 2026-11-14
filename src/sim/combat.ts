// Combat : balles, explosions, dégâts, statuts, tir des armes.
import type { Bullet, BulletSpec, Enemy, Player, Team, DamageEvent, WeaponInst, ShootEvent, StatusKind, Entity, Prop } from '../core/types';
import { rollDamage, absorbDamage, enemyDamage, rarityDamageMult } from '../core/damage';
import { T, TILE, tileAt, isSolidTile } from './dungeon';
import type { World } from './world';

export const MAX_BULLETS = 900;
const TAU = Math.PI * 2;
export const angDiff = (a: number, b: number) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

// ----------------------------------------------------------------- création
export function spawnBullet(w: World, spec: BulletSpec, x: number, y: number, angle: number, team: Team, owner: Player | Enemy | null = null, gen = 0): Bullet | null {
  if (w.bullets.length >= MAX_BULLETS) return null;
  const dir = angle + (spec.angle ?? 0);
  const kind = spec.kind ?? 'shot';
  const b: Bullet = {
    ...spec,
    id: w.nextId++, team, owner, x, y, dir, kind,
    vx: 0, vy: 0, age: 0, dead: false, hit: new Set(), gen, sx: x, sy: y,
    life: spec.life ?? (kind === 'slash' ? 0.16 : kind === 'beam' ? 0.12 : kind === 'lob' ? 0.9 : 1.4),
    radius: spec.radius ?? 3,
    speed: spec.speed ?? (kind === 'shot' ? 220 : 0),
  };
  if (team === 'player' && owner && (owner as Player).mods) {
    const m = (owner as Player).mods;
    b.speed! *= m.bulletSpeed;
    b.radius *= m.bulletSize;
    b.scale = (b.scale ?? 1) * m.bulletSize;
    if (kind === 'shot') {
      b.bounces = (b.bounces ?? 0) + m.bulletBounce;
      b.pierce = (b.pierce ?? 0) + m.bulletPierce;
      b.homing = (b.homing ?? 0) + m.bulletHoming;
      b.life *= m.bulletRange;
    } else if (kind === 'beam') {
      b.bounces = (b.bounces ?? 0) + m.bulletBounce;
    } else if (kind === 'slash') {
      b.damage *= m.meleeDamage;
      b.range = (b.range ?? 26) * Math.sqrt(m.bulletSize);
    }
    b.damage *= m.damage;
    b.critChance = (b.critChance ?? 0.05) + m.crit + ((owner as Player).hero.crit ?? 0);
    b.critMult = b.critMult ?? m.critMult;
  } else if (team === 'enemy') {
    b.speed! *= w.mods.enemyBulletSpeed;
  }
  b.vx = Math.cos(dir) * b.speed!;
  b.vy = Math.sin(dir) * b.speed!;
  if (kind === 'lob') {
    if (b.tx === undefined || b.ty === undefined) {
      const d = b.range ?? 90;
      b.tx = x + Math.cos(dir) * d;
      b.ty = y + Math.sin(dir) * d;
    }
  }
  w.bullets.push(b);
  w.rules.emit('onBulletSpawn', b);
  if (kind === 'beam') castBeam(w, b);
  return b;
}

// ----------------------------------------------------------------- rayon
function castBeam(w: World, b: Bullet): void {
  const pts = [b.x, b.y];
  let x = b.x, y = b.y, dx = Math.cos(b.dir), dy = Math.sin(b.dir);
  let left = b.length ?? 260;
  let bounces = b.bounces ?? 0;
  const step = 4;
  while (left > 0) {
    const nx = x + dx * step, ny = y + dy * step;
    if (w.solid(nx, ny) && !b.ghost) {
      if (b.team === 'player') w.breakCrack(nx, ny);
      if (bounces-- > 0) {
        const hx = w.solid(nx, y), hy = w.solid(x, ny);
        if (hx || !hy) dx = -dx;
        if (hy || !hx) dy = -dy;
        pts.push(x, y);
        continue;
      }
      break;
    }
    x = nx;
    y = ny;
    left -= step;
  }
  pts.push(x, y);
  b.pts = pts;
  if (!(b.damage > 0)) return; // rayon d'avertissement : purement visuel
  const half = (b.width ?? 3) / 2 + 1;
  const targets: (Enemy | Player)[] = b.team === 'player' ? w.enemies : w.players;
  for (const t of targets) {
    if (t.dead || (t as Enemy).spawnT > 0 || (t as Player).downed) continue;
    const r = t.radius * ((t as Enemy).scale ?? 1) + half;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      if (segDist2(t.x, t.y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) < r * r) {
        hitTarget(w, b, t);
        break;
      }
    }
  }
  if (b.team === 'player') for (const p of w.props) if (!p.dead) for (let i = 0; i + 3 < pts.length; i += 2) if (segDist2(p.x, p.y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) < (p.radius + half) ** 2) { hitProp(w, p, b.damage); break; }
}
function segDist2(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0, dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x0 + dx * t - px, cy = y0 + dy * t - py;
  return cx * cx + cy * cy;
}

// ----------------------------------------------------------------- mise à jour
export function updateBullets(w: World, dt: number): void {
  const bs = w.bullets;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (b.dead) continue;
    const d = b.team === 'enemy' ? dt * w.mods.timeScale : dt;
    const first = b.age === 0;
    b.age += d;
    if (b.onTick) b.onTick(w.ctx, b, d);
    if (b.kind === 'slash') {
      if (b.owner && !b.owner.dead) {
        b.x = b.owner.x;
        b.y = b.owner.y;
      }
      if (first) doSlash(w, b);
    } else if (b.kind === 'lob') {
      const t = Math.min(1, b.age / b.life);
      b.x = b.sx + (b.tx! - b.sx) * t;
      b.y = b.sy + (b.ty! - b.sy) * t;
    } else if (b.kind === 'shot') {
      stepShot(w, b, d);
    }
    if (!b.dead && b.age >= b.life) endBullet(w, b, false);
  }
  // compactage
  let n = 0;
  for (let i = 0; i < bs.length; i++) if (!bs[i].dead) bs[n++] = bs[i];
  bs.length = n;
}

function doSlash(w: World, b: Bullet): void {
  const range = b.range ?? 26;
  const arc = b.arc ?? 1.8;
  const inArc = (x: number, y: number, extra: number) => {
    const dx = x - b.x, dy = y - b.y;
    const dist = Math.hypot(dx, dy);
    return dist < range + extra && (dist < 6 || Math.abs(angDiff(Math.atan2(dy, dx), b.dir)) <= arc / 2 + 0.15);
  };
  const targets: (Enemy | Player)[] = b.team === 'player' ? w.enemies : w.players;
  for (const t of targets) {
    if (t.dead || (t as Enemy).spawnT > 0 || (t as Player).downed) continue;
    if (inArc(t.x, t.y, t.radius * ((t as Enemy).scale ?? 1))) hitTarget(w, b, t);
  }
  if (b.team === 'player') {
    for (const p of w.props) if (!p.dead && inArc(p.x, p.y, p.radius)) hitProp(w, p, b.damage);
    // la mêlée détruit (ou renvoie) les balles ennemies
    for (const o of w.bullets) {
      if (o.team !== 'enemy' || o.dead || o.kind !== 'shot' || !inArc(o.x, o.y, o.radius)) continue;
      if (b.reflect) {
        o.team = 'player';
        o.owner = b.owner;
        o.vx = -o.vx;
        o.vy = -o.vy;
        o.dir += Math.PI;
        o.damage = Math.max(4, b.damage * 0.6);
        o.hit.clear();
        o.age = 0;
      } else {
        o.dead = true;
      }
      w.fx.push({ t: 'burst', x: o.x, y: o.y, color: 0xffffff, n: 3 });
    }
    // casse les murs fissurés à portée
    w.breakCrack(b.x + Math.cos(b.dir) * range, b.y + Math.sin(b.dir) * range);
  }
}

function stepShot(w: World, b: Bullet, d: number): void {
  // --- pilotage
  if (b.homing || (b.boomerang && b.age > b.life * 0.45) || (b.team === 'enemy' && w.mods.bulletMagnet)) {
    let tx = 0, ty = 0, has = false, rate = b.homing ?? 0;
    if (b.boomerang && b.age > b.life * 0.45 && b.owner && !b.owner.dead) {
      tx = b.owner.x; ty = b.owner.y; has = true; rate = 9;
      if (Math.hypot(tx - b.x, ty - b.y) < 10) { b.dead = true; return; }
    } else if (b.team === 'player' && b.homing) {
      const e = w.nearestEnemy(b.x, b.y, 150);
      if (e) { tx = e.x; ty = e.y; has = true; }
    } else if (b.team === 'enemy') {
      const p = w.nearestPlayer(b.x, b.y);
      if (p) {
        tx = p.x; ty = p.y;
        if (b.homing) has = true;
        if (w.mods.bulletMagnet) {
          const dist = Math.max(20, Math.hypot(tx - b.x, ty - b.y));
          if (dist < 140) {
            const sp = Math.hypot(b.vx, b.vy);
            b.vx += ((tx - b.x) / dist) * w.mods.bulletMagnet * d;
            b.vy += ((ty - b.y) / dist) * w.mods.bulletMagnet * d;
            const ns = Math.hypot(b.vx, b.vy) || 1;
            b.vx = (b.vx / ns) * sp; b.vy = (b.vy / ns) * sp;
            b.dir = Math.atan2(b.vy, b.vx);
          }
        }
      }
    }
    if (has && rate) {
      const want = Math.atan2(ty - b.y, tx - b.x);
      const diff = angDiff(want, b.dir);
      const turn = Math.max(-rate * d, Math.min(rate * d, diff));
      b.dir += turn;
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(b.dir) * sp;
      b.vy = Math.sin(b.dir) * sp;
    }
  }
  if (b.accel) {
    const sp = Math.hypot(b.vx, b.vy);
    const ns = Math.max(10, sp + b.accel * d);
    if (sp > 0) { b.vx *= ns / sp; b.vy *= ns / sp; }
  }
  if (b.drag) {
    const k = Math.max(0, 1 - b.drag * d);
    b.vx *= k; b.vy *= k;
  }
  let mx = b.vx * d, my = b.vy * d;
  if (b.wave) {
    const s = Math.cos(b.age * b.wave.freq) * b.wave.amp * b.wave.freq * d;
    mx += -Math.sin(b.dir) * s;
    my += Math.cos(b.dir) * s;
  }
  // --- déplacement par sous-pas (pas de tunneling)
  const dist = Math.hypot(mx, my);
  const steps = Math.max(1, Math.ceil(dist / 6));
  mx /= steps; my /= steps;
  for (let s = 0; s < steps && !b.dead; s++) {
    const ox = b.x, oy = b.y;
    b.x += mx; b.y += my;
    if (!b.ghost && w.solid(b.x, b.y)) {
      if (b.team === 'player' && w.breakCrack(b.x, b.y)) { endBullet(w, b, true); return; }
      const hx = w.solid(b.x, oy), hy = w.solid(ox, b.y);
      const nx = hx || !hy ? -Math.sign(mx) : 0, ny = hy || !hx ? -Math.sign(my) : 0;
      b.x = ox; b.y = oy;
      if ((b.bounces ?? 0) > 0) {
        b.bounces!--;
        if (nx) { b.vx = -b.vx; mx = -mx; }
        if (ny) { b.vy = -b.vy; my = -my; }
        b.dir = Math.atan2(b.vy, b.vx);
        b.hit.clear();
        w.fx.push({ t: 'burst', x: b.x, y: b.y, color: b.color ?? 0xffffff, n: 2 });
      } else {
        const ev = { bullet: b, nx, ny, handled: false };
        w.rules.emit('onBulletHitWall', ev);
        if (!ev.handled) { endBullet(w, b, true); return; }
        mx = (b.vx * d) / steps; my = (b.vy * d) / steps;
      }
      continue;
    }
    // --- collisions entités
    if (b.team === 'player') {
      for (const e of w.enemies) {
        if (e.dead || e.spawnT > 0 || e.charmed || b.hit.has(e.id)) continue;
        const r = b.radius + e.radius * e.scale;
        const dx = e.x - b.x, dy = e.y - b.y;
        if (dx * dx + dy * dy < r * r) { if (bulletImpact(w, b, e)) return; }
      }
      for (const p of w.props) {
        if (p.dead) continue;
        const r = b.radius + p.radius;
        const dx = p.x - b.x, dy = p.y - b.y;
        if (dx * dx + dy * dy < r * r) {
          hitProp(w, p, b.damage);
          if ((b.pierce ?? 0) > 0) b.pierce!--;
          else { endBullet(w, b, true); return; }
        }
      }
    } else {
      for (const p of w.players) {
        if (p.downed || p.invuln > 0 || b.hit.has(p.id)) continue;
        const r = b.radius + p.radius * 0.7;
        const dx = p.x - b.x, dy = p.y - b.y;
        if (dx * dx + dy * dy < r * r) { if (bulletImpact(w, b, p)) return; }
      }
      for (const e of w.enemies) {
        if (!e.charmed || e.dead || b.hit.has(e.id)) continue;
        const r = b.radius + e.radius * e.scale;
        const dx = e.x - b.x, dy = e.y - b.y;
        if (dx * dx + dy * dy < r * r) { if (bulletImpact(w, b, e)) return; }
      }
    }
  }
}

/** Retourne true si la balle est détruite. */
function bulletImpact(w: World, b: Bullet, t: Enemy | Player): boolean {
  hitTarget(w, b, t);
  if (b.dead) return true;
  if ((b.pierce ?? 0) > 0 && !b.explode) {
    b.pierce!--;
    return false;
  }
  endBullet(w, b, true);
  return true;
}

function hitTarget(w: World, b: Bullet, t: Enemy | Player): void {
  b.hit.add(t.id);
  w.rules.emit('onBulletHit', { bullet: b, target: t });
  if (b.onHit) b.onHit(w.ctx, b, t);
  if (b.dead && b.kind === 'shot') return;
  if (t.team === 'enemy') {
    const roll = rollDamage(b.damage, { critChance: b.team === 'player' ? b.critChance ?? 0 : 0, critMult: b.critMult ?? 2, rand: w.rng.combat.next() });
    damageEnemy(w, t, roll.amount, { crit: roll.crit, source: b, cause: b.kind === 'slash' ? 'melee' : 'bullet' });
    if (!t.dead) {
      const kb = (b.knockback ?? (b.kind === 'slash' ? 90 : 30)) * (1 - (t.def.knockbackResist ?? 0));
      const a = b.kind === 'shot' ? Math.atan2(b.vy, b.vx) : Math.atan2(t.y - b.y, t.x - b.x);
      t.kx += Math.cos(a) * kb;
      t.ky += Math.sin(a) * kb;
      if (b.status) addStatus(w, t, b.status.kind, b.status.dur);
    }
  } else {
    damagePlayer(w, t, enemyDamage(b.damage, w.mods.enemyDamage * ((b.owner as Enemy)?.damageMult ?? 1)), 'bullet', b);
    if (b.status) addStatus(w, t, b.status.kind, b.status.dur);
  }
}

export function endBullet(w: World, b: Bullet, impact: boolean): void {
  if (b.dead) return;
  b.dead = true;
  if (b.onEnd) b.onEnd(w.ctx, b);
  if (b.explode) {
    explode(w, b.x, b.y, b.explode.radius, b.explode.damage ?? b.damage, b.team, { status: b.explode.status, owner: b.owner, gen: b.gen });
  } else if (b.kind === 'shot' && impact) {
    w.fx.push({ t: 'burst', x: b.x, y: b.y, color: b.color ?? (b.team === 'enemy' ? 0xff5566 : 0xfff2a8), n: 3, speed: 40, life: 0.18 });
  }
  if (b.split && b.gen < 2) {
    const n = Math.min(12, b.split.count);
    const spread = b.split.spread ?? TAU;
    const base = impact && spread < TAU ? b.dir + Math.PI : b.dir;
    for (let i = 0; i < n; i++) {
      const a = base + (spread >= TAU ? (i / n) * TAU : -spread / 2 + (spread * (i + 0.5)) / n);
      const spec: BulletSpec = { damage: b.damage * 0.5, speed: 160, life: 0.5, radius: 2.5, sprite: b.sprite, color: b.color, ...b.split.spec };
      const nb = spawnBullet(w, spec, b.x, b.y, a, b.team, b.owner, b.gen + 1);
      if (nb) for (const id of b.hit) nb.hit.add(id);
    }
  }
}

// ----------------------------------------------------------------- explosions
export function explode(w: World, x: number, y: number, radius: number, damage: number, team: Team, o: { status?: { kind: StatusKind; dur: number }; owner?: Player | Enemy | null; gen?: number; silent?: boolean } = {}): void {
  if (w.explosions++ > 40) return; // garde-fou anti-cascade
  radius *= w.mods.explosionSize;
  w.fx.push({ t: 'ring', x, y, r: radius, color: team === 'player' ? 0xffc04a : 0xff5544 });
  w.fx.push({ t: 'burst', x, y, color: 0xffa030, n: Math.min(18, 6 + radius / 4), speed: 90, life: 0.4, size: 2 });
  w.fx.push({ t: 'decal', x, y, r: radius * 0.6, color: 0x000000 });
  if (!o.silent) {
    w.fx.push({ t: 'shake', a: Math.min(8, 2 + radius / 12) });
    w.fx.push({ t: 'sfx', id: 'explode' });
  }
  const src = (o.owner ?? null) as any;
  if (team === 'player') {
    for (const e of w.enemies) {
      if (e.dead || e.spawnT > 0 || e.charmed) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius + e.radius * e.scale) {
        damageEnemy(w, e, damage, { crit: false, source: src, cause: 'explosion' });
        if (!e.dead) {
          const k = 140 * (1 - (e.def.knockbackResist ?? 0));
          e.kx += ((e.x - x) / (d || 1)) * k;
          e.ky += ((e.y - y) / (d || 1)) * k;
          if (o.status) addStatus(w, e, o.status.kind, o.status.dur);
        }
      }
    }
    for (const p of w.props) if (!p.dead && Math.hypot(p.x - x, p.y - y) < radius + p.radius) hitProp(w, p, damage);
    for (let a = 0; a < 8; a++) w.breakCrack(x + Math.cos((a / 8) * TAU) * radius, y + Math.sin((a / 8) * TAU) * radius);
  } else {
    for (const p of w.players) {
      if (p.downed) continue;
      if (Math.hypot(p.x - x, p.y - y) < radius + p.radius * 0.5) {
        damagePlayer(w, p, enemyDamage(damage, w.mods.enemyDamage), 'explosion', src);
        if (o.status) addStatus(w, p, o.status.kind, o.status.dur);
      }
    }
  }
}

// ----------------------------------------------------------------- dégâts
export function damageEnemy(w: World, e: Enemy, amount: number, o: { crit?: boolean; source?: any; cause?: string } = {}): void {
  if (e.dead || e.spawnT > 0) return;
  const ev: DamageEvent = { amount, crit: !!o.crit, source: o.source ?? null, target: e, cause: o.cause ?? 'rule' };
  if (ev.cause !== 'status') w.rules.emit('onDealDamage', ev);
  if (e.def.onHurt) e.def.onHurt(w.ctx, e, ev);
  if (ev.cancel || !(ev.amount > 0)) return;
  e.hp -= ev.amount;
  e.flash = 0.1;
  w.stats.damage += ev.amount;
  if (ev.cause !== 'status' || w.tick % 2 === 0) {
    w.fx.push({ t: 'text', x: e.x, y: e.y - e.radius * e.scale - 4, s: String(Math.max(1, Math.round(ev.amount))), color: ev.crit ? 0xffd23a : ev.cause === 'status' ? 0xff9a50 : 0xffffff, big: ev.crit });
  }
  if (ev.cause !== 'status') w.fx.push({ t: 'sfx', id: ev.crit ? 'crit' : 'hit', vol: 0.5 });
  if (e.hp <= 0) w.killEnemy(e);
}

export function damagePlayer(w: World, p: Player, amount: number, cause = 'rule', source: any = null): boolean {
  if (p.downed || p.dead || w.mode !== 'run') return false;
  if (p.invuln > 0 && cause !== 'rule') return false;
  const ev: DamageEvent = { amount: Math.round(amount * p.mods.dmgTaken), crit: false, source, target: p, cause };
  if (amount > 0 && ev.amount < 1) ev.amount = 1;
  w.rules.emit('onDamage', ev);
  if (ev.cancel || !(ev.amount > 0)) return false;
  const r = absorbDamage(p.hp, p.armor, ev.amount, ev.pierceArmor);
  p.hp = r.hp;
  p.armor = r.armor;
  p.sinceHit = 0;
  p.armorAcc = 0;
  p.flash = 0.15;
  p.invuln = Math.max(p.invuln, 0.55 * p.mods.invulnTime);
  w.stats.hits++;
  w.fx.push({ t: 'shake', a: r.hpLost > 0 ? 5 : 3 });
  w.fx.push({ t: 'sfx', id: r.hpLost > 0 ? 'hurt' : 'armor' });
  w.fx.push({ t: 'flash', color: r.hpLost > 0 ? 0xff2244 : 0x88aaff, a: r.hpLost > 0 ? 0.28 : 0.14 });
  w.fx.push({ t: 'text', x: p.x, y: p.y - 12, s: '-' + ev.amount, color: r.hpLost > 0 ? 0xff4455 : 0x9ab8ff });
  w.hitstop = Math.max(w.hitstop, r.hpLost > 0 ? 0.07 : 0.03);
  if (p.hp <= 0) w.playerDown(p);
  return true;
}

export function addStatus(w: World, t: Entity, kind: StatusKind, dur: number): void {
  const def = (t as Enemy).def;
  if (def?.immune?.includes(kind)) return;
  if (def?.boss && (kind === 'freeze' || kind === 'shock')) dur *= 0.3;
  t.status[kind] = Math.max(t.status[kind] ?? 0, dur);
}

export function hitProp(w: World, p: Prop, dmg: number): void {
  p.hp -= dmg;
  p.flash = 0.1;
  if (p.hp > 0) return;
  p.dead = true;
  w.fx.push({ t: 'burst', x: p.x, y: p.y, color: p.kind === 'barrel' ? 0xd84a3a : 0xb98a52, n: 8, speed: 70, life: 0.4, size: 2 });
  w.fx.push({ t: 'sfx', id: 'break' });
  if (p.kind === 'barrel') {
    explode(w, p.x, p.y, 34, 22, 'player');
    // un baril blesse aussi les joueurs trop proches
    for (const pl of w.players) if (!pl.downed && Math.hypot(pl.x - p.x, pl.y - p.y) < 30) damagePlayer(w, pl, 1, 'explosion');
  } else if (w.rng.loot.chance(0.3)) {
    w.spawnPickup(w.rng.loot.chance(0.6) ? 'coin' : 'energy', p.x, p.y, w.rng.loot.chance(0.6) ? 2 : 6);
  }
}

// ----------------------------------------------------------------- armes
export function makeWeapon(w: World, id: string, rarity?: number): WeaponInst | null {
  const def = w.reg.weapons.get(id);
  if (!def) return null;
  return { def, cd: 0, charge: 0, burstLeft: 0, burstT: 0, rarity: (rarity ?? def.rarity) as any, data: {} };
}

const TYPE_SFX: Record<string, string> = {
  pistol: 'shoot', rifle: 'rifle', shotgun: 'shotgun', laser: 'laser', bow: 'bow', launcher: 'launch', sword: 'swing', spear: 'swing', staff: 'magic', weird: 'weird',
};

/** Gère la gâchette d'une arme pour cette frame. */
export function updateWeapon(w: World, p: Player, wi: WeaponInst, dt: number, trigger: boolean): void {
  const def = wi.def;
  const m = p.mods;
  wi.cd -= dt * m.fireRate;
  // rafale en cours
  if (wi.burstLeft > 0) {
    wi.burstT -= dt * m.fireRate;
    if (wi.burstT <= 0) {
      wi.burstLeft--;
      wi.burstT = def.burst!.interval;
      shoot(w, p, wi, 1);
    }
    return;
  }
  if (p.status.shock) return;
  if (def.charge) {
    if (trigger && wi.cd <= 0) {
      wi.charge = Math.min(1, wi.charge + (dt * m.fireRate) / def.charge.time);
      if (wi.charge >= 1) release(w, p, wi);
    } else if (wi.charge > 0) release(w, p, wi);
    return;
  }
  if (trigger && wi.cd <= 0 && (def.auto !== false || p.input.firePressed)) {
    if (!pay(w, p, wi)) return;
    wi.cd = def.cooldown;
    shoot(w, p, wi, 1);
    if (def.burst && def.burst.count > 1) {
      wi.burstLeft = def.burst.count - 1;
      wi.burstT = def.burst.interval;
    }
  }
}
function release(w: World, p: Player, wi: WeaponInst): void {
  const c = wi.charge;
  wi.charge = 0;
  if (c < 0.12 || !pay(w, p, wi)) return;
  wi.cd = wi.def.cooldown;
  const min = wi.def.charge!.minMult ?? 0.35;
  shoot(w, p, wi, min + (1 - min) * c);
}
function pay(w: World, p: Player, wi: WeaponInst): boolean {
  if (p.mods.energyInfinite) return true;
  const cost = Math.round(wi.def.energy * p.mods.energyCost);
  if (p.energy < cost) {
    if (wi.cd <= 0) {
      wi.cd = 0.35;
      w.fx.push({ t: 'sfx', id: 'empty' });
      w.fx.push({ t: 'text', x: p.x, y: p.y - 14, s: 'ENERGIE!', color: 0x58b8ff });
    }
    return false;
  }
  p.energy -= cost;
  return true;
}

export function shoot(w: World, p: Player, wi: WeaponInst, chargeMult: number): void {
  const def = wi.def;
  const m = p.mods;
  const kind = def.bullet.kind ?? 'shot';
  const multi = kind === 'shot' || kind === 'lob';
  const baseCount = def.count ?? 1;
  const count = Math.max(1, baseCount + (multi ? m.bulletCount : 0));
  let spread = (def.spread ?? 0) * m.bulletSpread;
  if (count > baseCount && spread < 0.1 * (count - 1)) spread = 0.1 * (count - 1) * Math.max(0.3, m.bulletSpread);
  const dmg = def.damage * rarityDamageMult(def.rarity, wi.rarity) * chargeMult;
  const specs: BulletSpec[] = [];
  for (let i = 0; i < count; i++) {
    const off = count > 1 ? -spread / 2 + (spread * i) / (count - 1) : 0;
    const jit = def.jitter ? w.rng.combat.range(-def.jitter, def.jitter) * m.bulletSpread : 0;
    const spec: BulletSpec = { critChance: def.crit ?? 0.05, ...def.bullet, damage: dmg, angle: off + jit };
    if (def.charge && spec.speed) spec.speed *= 0.6 + 0.4 * chargeMult;
    specs.push(spec);
  }
  const ev: ShootEvent = { player: p, weapon: wi, angle: p.aim, specs, chargeMult };
  if (def.onFire) def.onFire(w.ctx, ev);
  w.rules.emit('onShoot', ev);
  if (ev.cancel) return;
  const mx = p.x + Math.cos(ev.angle) * 9, my = p.y + Math.sin(ev.angle) * 9;
  // ne pas tirer à travers un mur collé au joueur
  const ox = w.solid(mx, my) ? p.x : mx, oy = w.solid(mx, my) ? p.y : my;
  for (const s of ev.specs) {
    const b = spawnBullet(w, s, s.kind === 'slash' ? p.x : ox, s.kind === 'slash' ? p.y : oy, ev.angle, 'player', p);
    if (b) b.weaponId = def.id;
  }
  p.lastShot = ev.specs;
  p.recoil = def.recoil ?? (kind === 'slash' ? 0 : 3);
  if (kind === 'slash') p.swing = 0.18;
  if (def.kick) {
    p.kx -= Math.cos(ev.angle) * def.kick;
    p.ky -= Math.sin(ev.angle) * def.kick;
  }
  w.stats.shots++;
  w.fx.push({ t: 'sfx', id: def.sfx ?? TYPE_SFX[def.type] ?? 'shoot', vol: 0.8 });
  if (def.shake ?? (kind === 'slash' ? 0 : 1)) w.fx.push({ t: 'shake', a: def.shake ?? 1 });
  if (kind === 'shot' && def.muzzle !== 0) w.fx.push({ t: 'burst', x: mx + Math.cos(ev.angle) * 4, y: my + Math.sin(ev.angle) * 4, color: def.muzzle ?? 0xfff0a0, n: 2, speed: 30, life: 0.1, size: 2 });
  if (def.casing ?? (def.type === 'pistol' || def.type === 'rifle' || def.type === 'shotgun')) w.fx.push({ t: 'casing', x: p.x, y: p.y, dir: ev.angle + Math.PI + (p.facing > 0 ? -0.8 : 0.8) });
}

/** Statuts : brûlure/poison (dégâts périodiques), gel/ralenti (vitesse), choc (étourdit). */
export function tickStatus(w: World, t: Enemy | Player, dt: number): void {
  const s = t.status;
  for (const k in s) {
    const kind = k as StatusKind;
    const before = s[kind]!;
    const after = before - dt;
    if (kind === 'burn' || kind === 'poison') {
      const period = kind === 'burn' ? 0.5 : 0.7;
      if (Math.floor(before / period) !== Math.floor(after / period)) {
        if (t.team === 'enemy') damageEnemy(w, t, (kind === 'burn' ? 4 : 3) * (1 + 0.5 * (w.worldNum - 1)), { cause: 'status' });
        else if (Math.floor(before / (period * 3)) !== Math.floor(after / (period * 3))) damagePlayer(w, t, 1, 'status');
        w.fx.push({ t: 'burst', x: t.x, y: t.y - 4, color: kind === 'burn' ? 0xff8030 : 0x70d840, n: 2, speed: 25, life: 0.3 });
      }
    }
    if (after <= 0) delete s[kind];
    else s[kind] = after;
  }
}

export { T, TILE, tileAt, isSolidTile };
