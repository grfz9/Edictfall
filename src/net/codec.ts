// Sérialisation de l'état du World en instantanés compacts (côté hôte) et application sur un World « miroir »
// (côté invité), avec interpolation des positions entre deux instantanés.
// Chaque liste d'entités est delta-encodée : [id, statique | 0, ...dynamique]. La partie statique (sprite, arme,
// définition…) n'est renvoyée que lorsqu'elle change ; le canal est fiable et ordonné, donc rien ne se perd.
import type {
  Player, Enemy, Bullet, Pickup, Chest, Prop, Interactable, Pet, Fx, Room, Dialog, Mods, ModInst, WeaponInst, ModifierDef,
} from '../core/types';
import { R } from '../core/registry';
import { ModStack, baseMods } from '../core/mods';
import type { World, Bubble, Choice, RunSummary } from '../sim/world';
import { T, type Floor } from '../sim/dungeon';
import type { Snapshot, FloorPacket } from './protocol';

const STATUS = ['burn', 'poison', 'freeze', 'shock', 'slow'] as const;
const MODES = ['hub', 'run', 'dead', 'won'] as const;
const BKIND = ['shot', 'slash', 'beam', 'lob'] as const;
const r1 = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);
const r2 = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
const r3 = (v: number) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0);
const smask = (st: Partial<Record<string, number>>) => { let m = 0; STATUS.forEach((k, i) => { if (st[k]) m |= 1 << i; }); return m; };
const sfrom = (m: number) => { const o: Partial<Record<string, number>> = {}; STATUS.forEach((k, i) => { if (m & (1 << i)) o[k] = 1; }); return o; };
/** Effets transmis aux invités (les autres sont purement locaux). */
const FX_OK = new Set(['shake', 'burst', 'text', 'sfx', 'flash', 'casing', 'ring', 'banner', 'decal']);
const MAX_FX = 260;

// =================================================================== carte
export function encodeFloor(f: Floor): FloorPacket {
  const tiles: number[] = [];
  for (let i = 0; i < f.tiles.length;) {
    const v = f.tiles[i];
    let n = 1;
    while (i + n < f.tiles.length && f.tiles[i + n] === v) n++;
    tiles.push(v, n);
    i += n;
  }
  const rooms = f.rooms.map((r) => ({
    id: r.id, type: r.type, cx: r.cx, cy: r.cy, x: r.x, y: r.y, w: r.w, h: r.h, state: r.state, locked: r.locked,
    doors: r.doors, links: r.links, seen: r.seen, visited: r.visited, waves: r.waves, wave: r.wave, exit: r.exit, hidden: r.hidden,
  }));
  return { w: f.w, h: f.h, tiles, rooms, start: f.start.id, world: f.world, floor: f.floor, rev: f.rev };
}
export function decodeFloor(p: FloorPacket): Floor {
  const tiles = new Uint8Array(p.w * p.h);
  let k = 0;
  for (let i = 0; i < p.tiles.length; i += 2) { tiles.fill(p.tiles[i], k, k + p.tiles[i + 1]); k += p.tiles[i + 1]; }
  const rooms: Room[] = p.rooms.map((r) => ({ ...r, data: {} }));
  const start = rooms.find((r) => r.id === p.start) ?? rooms[0];
  return { w: p.w, h: p.h, tiles, rooms, start, world: p.world, floor: p.floor, props: [], cracks: [], rev: p.rev };
}
const roomBits = (r: Room) => (r.state === 'fresh' ? 0 : r.state === 'active' ? 1 : 2) | (r.locked ? 4 : 0) | (r.seen ? 8 : 0) | (r.visited ? 16 : 0) | (r.hidden ? 32 : 0);

// =================================================================== encodeur (hôte, un par invité)
export interface EncodeExtras { votes?: [number, string][]; dialogId?: number }

export class Encoder {
  private cache: Record<string, Map<number, string>> = {};
  private keys: Record<string, string> = {};
  private floorRef: Floor | null = null;
  private floorRev = -1;
  private shots = new Map<number, { ref: unknown; n: number }>();
  private n = 0;

  /** Liste delta-encodée : [id, statique | 0, ...dynamique]. */
  private list<T>(name: string, ents: T[], id: (e: T) => number, stat: (e: T) => unknown[], dyn: (e: T) => unknown[]): unknown[] {
    const old = this.cache[name] ?? new Map<number, string>();
    const now = new Map<number, string>();
    const out: unknown[] = [];
    for (const e of ents) {
      const i = id(e);
      if (now.has(i)) continue;
      const s = stat(e), k = JSON.stringify(s);
      now.set(i, k);
      out.push([i, old.get(i) === k ? 0 : s, ...dyn(e)]);
    }
    this.cache[name] = now;
    return out;
  }
  private changed(name: string, v: unknown): boolean {
    const k = JSON.stringify(v) ?? 'u';
    if (this.keys[name] === k) return false;
    this.keys[name] = k;
    return true;
  }
  private shotN(p: Player): number {
    let s = this.shots.get(p.id);
    if (!s) { s = { ref: p.lastShot, n: 0 }; this.shots.set(p.id, s); }
    if (s.ref !== p.lastShot) { s.ref = p.lastShot; if (p.lastShot) s.n++; }
    return s.n;
  }

  encode(w: World, me: number, fx: Fx[], extra: EncodeExtras = {}): Snapshot {
    const snap: Snapshot = {
      t: 's', n: ++this.n, me,
      h: [MODES.indexOf(w.mode), w.runMode, w.hubMode, w.worldNum, w.floorNum, w.loop, w.coins, w.gems, w.kills, r1(w.time),
        w.boss && !w.boss.dead ? w.boss.id : 0, w.curRoom ? w.curRoom.id : -1, w.seed, w.tick],
      P: this.list('P', w.players, (p) => p.id,
        (p) => [p.hero.id, p.index, p.weapons.map((x) => [x.def.id, x.rarity]), w.maxHp(p), w.maxArmor(p), w.maxEnergy(p),
          r2(p.mods.playerScale), p.mods.energyInfinite ? 1 : 0, r2(p.mods.energyCost), r2(p.mods.skillCd)],
        (p) => [r1(p.x), r1(p.y), r3(p.aim), p.facing, (p.moving ? 1 : 0) | (p.downed ? 2 : 0), Math.ceil(p.hp), Math.ceil(p.armor), Math.floor(p.energy),
          r1(p.skillCd), r2(p.skillT), r2(p.swing), r1(p.recoil), r2(p.flash), p.cur, this.shotN(p), smask(p.status), r2(p.invuln),
          r2(p.weapons[p.cur]?.charge ?? 0)]),
      E: this.list('E', w.enemies.filter((e) => !e.dead), (e) => e.id,
        (e) => {
          const lk = e.data?.look;
          return [e.def.id, e.elite ? 1 : 0, e.champion ? 1 : 0, r1(e.radius), r2(e.scale),
            lk ? [lk.sprite ?? '', lk.scale ?? 0, lk.tint ?? -1, lk.aura ?? -1] : 0];
        },
        (e) => [r1(e.x), r1(e.y), r1(e.hp), r1(e.maxHp), r2(e.flash), e.facing, r2(e.spawnT),
          (e.tele > 0 || e.data?.windup > 0 ? 1 : 0) | (Math.abs(e.vx) + Math.abs(e.vy) > 4 ? 2 : 0) | (e.charmed ? 4 : 0), smask(e.status), e.phase]),
      B: this.list('B', w.bullets.filter((b) => !b.dead), (b) => b.id,
        (b) => [BKIND.indexOf(b.kind), b.team === 'enemy' ? 1 : 0, b.sprite ?? '', b.color ?? -1, b.scale ?? -1, b.spin ?? 0, b.trail ?? -1,
          b.explode ? b.explode.radius : -1, r1(b.tx ?? 0), r1(b.ty ?? 0), r2(b.life), b.range ?? -1, b.arc ?? -1, b.width ?? -1,
          b.data?.warn ? 1 : 0, b.owner && (b.owner as Player).team === 'player' ? b.owner.id : 0, b.pts ? b.pts.map(r1) : 0],
        (b) => [r1(b.x), r1(b.y), r2(b.dir), Math.round(b.vx), Math.round(b.vy), r2(b.age)]),
      K: this.list('K', w.pickups.filter((k) => !k.dead), (k) => k.id, (k) => [k.kind], (k) => [r1(k.x), r1(k.y)]),
      C: this.list('C', w.chests.filter((c) => !c.dead), (c) => c.id, (c) => [r1(c.x), r1(c.y), c.kind, c.opened ? 1 : 0], () => []),
      O: this.list('O', w.props.filter((p) => !p.dead), (p) => p.id, (p) => [p.kind, r1(p.x), r1(p.y)], (p) => [p.flash > 0 ? 1 : 0]),
      I: this.list('I', w.items.filter((i) => !i.dead), (i) => i.id,
        (i) => [i.kind, i.sprite, i.label, i.sub ?? '', i.price ?? -1, i.radius ?? 16, i.weapon ? [i.weapon.def.id, i.weapon.rarity] : 0,
          i.bob ? 1 : 0, i.tint ?? -1, i.data?.hero ?? ''],
        (i) => [r1(i.x), r1(i.y)]),
      T: this.list('T', w.pets, (p) => p.owner.id, (p) => [p.def.id], (p) => [r1(p.x), r1(p.y), p.facing]),
      U: w.bubbles.map((b) => [b.id, r1(b.x), r1(b.y), b.text, r1(b.t), r1(b.max)]),
      Fo: w.players.map((p) => w.focus[p.index]?.id ?? 0),
      fx: fx.length > MAX_FX ? fx.filter((f) => f.t === 'sfx' || f.t === 'banner' || f.t === 'flash' || f.t === 'shake').slice(-MAX_FX) : fx,
    };
    if (w.floor && (w.floor !== this.floorRef || w.floor.rev !== this.floorRev)) {
      this.floorRef = w.floor; this.floorRev = w.floor.rev;
      snap.F = encodeFloor(w.floor);
      delete this.keys.R;
    }
    const rb = w.floor ? w.floor.rooms.map(roomBits) : [];
    if (this.changed('R', rb)) snap.R = rb;
    if (this.changed('M', w.mods)) snap.M = w.mods;
    const ru = w.rules.order().map((i) => [i.def.id, i.stacks, i.muted ? 1 : 0, i.order, r2(i.power)]);
    if (this.changed('Ru', ru)) snap.Ru = ru;
    const ch = w.choice ? { k: w.choice.kind, ti: w.choice.title, su: w.choice.sub, o: w.choice.options.map((d) => d.id), p: w.choice.picks } : null;
    if (this.changed('Ch', ch)) snap.Ch = ch;
    const d = w.dialog ? { id: extra.dialogId ?? 0, l: w.dialog.lines, o: (w.dialog.options ?? []).map((o) => ({ label: o.label, sub: o.sub, cancel: o.cancel })), hasOpt: !!w.dialog.options } : null;
    if (this.changed('D', d)) snap.D = d;
    if (this.changed('S', w.summary)) snap.S = w.summary;
    if (extra.votes && this.changed('V', extra.votes)) snap.V = extra.votes;
    return snap;
  }
}

// =================================================================== miroir (invité)
interface Ip { x0: number; y0: number; x1: number; y1: number; a0: number; a1: number }
type WithIp = { _ip?: Ip; x: number; y: number };

/** Applique les instantanés sur un World qui ne simule rien : il est seulement lu par le rendu et l'interface. */
export class Mirror {
  me = -1;
  /** Intervalle moyen entre deux instantanés (ms). */
  interval = 1000 / 20;
  private lastAt = -1;
  private t0 = 0;
  private P = new Map<number, Player>();
  private E = new Map<number, Enemy>();
  private B = new Map<number, Bullet>();
  private K = new Map<number, Pickup>();
  private C = new Map<number, Chest>();
  private O = new Map<number, Prop>();
  private I = new Map<number, Interactable>();
  private T = new Map<number, Pet>();
  private shots = new Map<number, number>();
  dialogId = -1;
  /** Votes affichés sur les cartes d'édit : [index de carte, pseudo]. */
  votes: [number, string][] = [];
  applied = 0;

  constructor(public w: World) {}

  /** Oublie tout (nouvelle session). */
  reset(): void {
    for (const m of [this.P, this.E, this.B, this.K, this.C, this.O, this.I, this.T]) m.clear();
    this.shots.clear();
    this.lastAt = -1; this.applied = 0; this.dialogId = -1; this.votes = [];
  }

  private target(o: WithIp, x: number, y: number, age?: number, fresh = false): void {
    const ip = o._ip;
    if (!ip || fresh || Math.abs(ip.x1 - x) + Math.abs(ip.y1 - y) > 90) {
      o._ip = { x0: x, y0: y, x1: x, y1: y, a0: age ?? 0, a1: age ?? 0 };
      o.x = x; o.y = y;
      return;
    }
    ip.x0 = o.x; ip.y0 = o.y; ip.x1 = x; ip.y1 = y;
    if (age !== undefined) { ip.a0 = (o as unknown as Bullet).age ?? age; ip.a1 = age; }
  }

  apply(s: Snapshot, now: number): void {
    const w = this.w;
    if (this.lastAt >= 0) {
      const gap = now - this.lastAt;
      if (gap > 5 && gap < 400) this.interval += (gap - this.interval) * 0.15;
      this.interval = Math.max(25, Math.min(160, this.interval));
    }
    this.lastAt = now; this.t0 = now;
    this.me = s.me;
    this.applied++;
    if (s.F) {
      w.floor = decodeFloor(s.F);
      for (const m of [this.E, this.B, this.K, this.C, this.O, this.I]) m.clear();
    }
    const rooms = w.floor?.rooms ?? [];
    if (s.R) s.R.forEach((b, i) => {
      const r = rooms[i];
      if (!r) return;
      r.state = (b & 3) === 0 ? 'fresh' : (b & 3) === 1 ? 'active' : 'cleared';
      r.locked = !!(b & 4); r.seen = !!(b & 8); r.visited = !!(b & 16); r.hidden = !!(b & 32);
      // portes : fermées tant que la salle est verrouillée (comme lockRoom / clearRoom chez l'hôte)
      const f = w.floor;
      for (const d of r.doors) { const k = d.x + d.y * f.w; if (f.tiles[k] === T.DOOR || f.tiles[k] === T.DOORC) f.tiles[k] = r.locked ? T.DOORC : T.DOOR; }
    });
    if (s.M) {
      // JSON transforme Infinity / NaN en null : on retombe sur les valeurs par défaut
      const m = baseMods() as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(s.M)) if (v !== null && v !== undefined) m[k] = v;
      w.mods = m as unknown as Mods;
    }
    if (s.Ru) {
      const st = new ModStack(() => w.ctx);
      st.list = s.Ru.map(([id, stacks, muted, order, power]: [string, number, number, number, number]) => {
        const def = R.mods.get(id);
        return def ? ({ def, stacks, muted: !!muted, order, power, state: {} } as ModInst) : null;
      }).filter((x: ModInst | null): x is ModInst => !!x);
      w.rules = st;
    }
    // --- en-tête
    const h = s.h;
    w.mode = MODES[h[0]] ?? 'hub';
    w.runMode = h[1]; w.hubMode = h[2]; w.worldNum = h[3]; w.floorNum = h[4]; w.loop = h[5];
    w.coins = h[6]; w.gems = h[7]; w.kills = h[8]; w.time = h[9];
    w.seed = h[12]; w.tick = h[13];
    // --- joueurs
    this.players(s.P);
    // --- ennemis
    w.enemies = this.sync(this.E, s.E, (id, st) => {
      const def = R.enemies.get(st[0]);
      if (!def) return null;
      return {
        id, team: 'enemy', def, x: 0, y: 0, vx: 0, vy: 0, radius: 6, hp: 1, maxHp: 1, flash: 0, status: {}, dead: false, kx: 0, ky: 0,
        speed: 0, damageMult: 1, scale: 1, facing: 1, attacks: [], move: def.move, atkCd: [], tele: 0, teleAtk: 0, stop: 0, moveT: 0, moveState: 0,
        mx: 0, my: 0, phase: 0, elite: false, champion: false, summoned: false, spawnT: 0, age: 0, target: null, charmed: false, data: {},
      } as Enemy;
    }, (e, st, d, fresh) => {
      if (st) {
        e.elite = !!st[1]; e.champion = !!st[2]; e.radius = st[3]; e.scale = st[4];
        const lk = st[5];
        e.data.look = lk ? { sprite: lk[0] || undefined, scale: lk[1] || undefined, tint: lk[2] >= 0 ? lk[2] : undefined, aura: lk[3] >= 0 ? lk[3] : undefined } : undefined;
      }
      this.target(e, d[0], d[1], undefined, fresh);
      e.hp = d[2]; e.maxHp = d[3]; e.flash = d[4]; e.facing = d[5]; e.spawnT = d[6];
      e.tele = d[7] & 1 ? 1 : 0; e.vx = d[7] & 2 ? 10 : 0; e.vy = 0; e.charmed = !!(d[7] & 4);
      e.status = sfrom(d[8]); e.phase = d[9];
    });
    // --- balles
    w.bullets = this.sync(this.B, s.B, (id, st) => ({
      id, team: st[1] ? 'enemy' : 'player', owner: null, x: 0, y: 0, vx: 0, vy: 0, dir: 0, age: 0, life: 1, radius: 3, kind: BKIND[st[0]] ?? 'shot',
      dead: false, hit: new Set<number>(), gen: 0, sx: 0, sy: 0, damage: 0,
    } as Bullet), (b, st, d, fresh) => {
      if (st) {
        b.kind = BKIND[st[0]] ?? 'shot'; b.team = st[1] ? 'enemy' : 'player';
        b.sprite = st[2] || undefined; b.color = st[3] >= 0 ? st[3] : undefined; b.scale = st[4] >= 0 ? st[4] : undefined;
        b.spin = st[5] || undefined; b.trail = st[6] >= 0 ? st[6] : undefined; b.explode = st[7] >= 0 ? { radius: st[7] } : undefined;
        b.tx = st[8]; b.ty = st[9]; b.life = st[10] || 1; b.range = st[11] >= 0 ? st[11] : undefined; b.arc = st[12] >= 0 ? st[12] : undefined;
        b.width = st[13] >= 0 ? st[13] : undefined; b.data = st[14] ? { warn: true } : undefined;
        b.owner = st[15] ? this.P.get(st[15]) ?? null : null;
        b.pts = st[16] ? st[16] : undefined;
      }
      this.target(b as unknown as WithIp, d[0], d[1], d[5], fresh);
      b.dir = d[2]; b.vx = d[3]; b.vy = d[4];
    });
    w.pickups = this.sync(this.K, s.K, (id, st) => ({ id, kind: st[0], x: 0, y: 0, vx: 0, vy: 0, amount: 1, age: 0, dead: false } as Pickup),
      (k, _st, d, fresh) => this.target(k, d[0], d[1], undefined, fresh));
    w.chests = this.sync(this.C, s.C, (id) => ({ id, x: 0, y: 0, kind: 'supply', opened: false, dead: false } as Chest),
      (c, st) => { if (st) { c.x = st[0]; c.y = st[1]; c.kind = st[2]; c.opened = !!st[3]; } });
    w.props = this.sync(this.O, s.O, (id, st) => ({ id, kind: st[0], x: 0, y: 0, hp: 1, radius: 6, flash: 0, dead: false } as Prop),
      (p, st, d) => { if (st) { p.kind = st[0]; p.x = st[1]; p.y = st[2]; } p.flash = d[0] ? 0.08 : 0; });
    w.items = this.sync(this.I, s.I, (id) => ({ id, kind: 'npc', x: 0, y: 0, sprite: 'missing', label: '', dead: false } as Interactable),
      (it, st, d, fresh) => {
        if (st) {
          it.kind = st[0]; it.sprite = st[1]; it.label = st[2]; it.sub = st[3] || undefined; it.price = st[4] >= 0 ? st[4] : undefined;
          it.radius = st[5]; it.bob = !!st[7]; it.tint = st[8] >= 0 ? st[8] : undefined; it.data = st[9] ? { hero: st[9] } : undefined;
          const wd = st[6] ? R.weapons.get(st[6][0]) : undefined;
          it.weapon = wd ? { def: wd, cd: 0, charge: 0, burstLeft: 0, burstT: 0, rarity: st[6][1], data: {} } : undefined;
        }
        this.target(it, d[0], d[1], undefined, fresh);
      });
    w.pets = this.sync(this.T, s.T, (_id, st) => {
      const def = R.pets.get(st[0]);
      return def ? ({ def, x: 0, y: 0, cd: 0, facing: 1, owner: null as unknown as Player, data: {} } as Pet) : null;
    }, (p, st, d, fresh, id) => {
      if (st) { const def = R.pets.get(st[0]); if (def) p.def = def; }
      p.owner = this.P.get(id) ?? p.owner;
      this.target(p, d[0], d[1], undefined, fresh);
      p.facing = d[2];
    }).filter((p) => !!p.owner);
    w.bubbles = s.U.map((u: any[]) => ({ id: u[0], x: u[1], y: u[2], text: u[3], t: u[4], max: u[5], follow: null } as Bubble));
    w.focus = [];
    w.players.forEach((p, i) => { w.focus[p.index] = s.Fo[i] ? this.I.get(s.Fo[i]) ?? null : null; });
    w.boss = h[10] ? this.E.get(h[10]) ?? null : null;
    w.curRoom = h[11] >= 0 ? rooms.find((r) => r.id === h[11]) ?? null : null;
    // --- choix, dialogue, récapitulatif
    if (s.Ch !== undefined) {
      w.choice = s.Ch ? ({ kind: s.Ch.k, title: s.Ch.ti, sub: s.Ch.su, options: s.Ch.o.map((id: string) => R.mods.get(id)).filter(Boolean) as ModifierDef[], picks: s.Ch.p } as Choice) : null;
      this.votes = [];
    }
    if (s.V) this.votes = s.V;
    if (s.D !== undefined) {
      this.dialogId = s.D ? s.D.id : -1;
      w.dialog = s.D ? ({ lines: s.D.l, options: s.D.hasOpt ? s.D.o : undefined } as Dialog) : null;
    }
    if (s.S !== undefined) w.summary = s.S as RunSummary | null;
    // --- effets
    for (const f of s.fx ?? []) if (f && FX_OK.has(f.t)) w.fx.push(f);
  }

  private players(rows: any[]): void {
    const w = this.w;
    const list: Player[] = [];
    const seen = new Set<number>();
    for (const row of rows) {
      const [id, st] = row;
      const d = row.slice(2);
      let p = this.P.get(id);
      let fresh = false;
      if (!p) {
        if (!st) continue;
        const hero = R.heroes.get(st[0]) ?? w.heroDef(st[0]);
        p = w.makePlayer(hero, st[1]);
        p.id = id;
        this.P.set(id, p);
        fresh = true;
      }
      seen.add(id);
      if (st) {
        p.hero = R.heroes.get(st[0]) ?? p.hero;
        p.index = st[1];
        const old = p.weapons;
        p.weapons = (st[2] as [string, number][]).map(([wid, rar], i) => {
          const o = old[i];
          if (o && o.def.id === wid && o.rarity === rar) return o;
          const def = R.weapons.get(wid);
          return def ? ({ def, cd: 0, charge: 0, burstLeft: 0, burstT: 0, rarity: rar, data: {} } as WeaponInst) : null;
        }).filter((x): x is WeaponInst => !!x);
        p.data.net = st.slice(3);
      }
      const ns = p.data.net ?? [p.hero.hp, p.hero.armor, p.hero.energy, 1, 0, 1, 1];
      p.mods = { ...w.mods, maxHp: ns[0] - p.hero.hp, maxArmor: ns[1] - p.hero.armor, maxEnergy: ns[2] - p.hero.energy, playerScale: ns[3], energyInfinite: !!ns[4], energyCost: ns[5], skillCd: ns[6] };
      p.maxHp = ns[0];
      this.target(p, d[0], d[1], undefined, fresh);
      p.aim = d[2]; p.facing = d[3]; p.moving = !!(d[4] & 1); p.downed = !!(d[4] & 2);
      p.hp = d[5]; p.armor = d[6]; p.energy = d[7]; p.skillCd = d[8]; p.skillT = d[9]; p.swing = d[10]; p.recoil = d[11]; p.flash = d[12];
      p.cur = Math.min(d[13], Math.max(0, p.weapons.length - 1));
      if (this.shots.get(id) !== d[14]) { if (this.shots.has(id)) p.lastShot = []; this.shots.set(id, d[14]); }
      p.status = sfrom(d[15]); p.invuln = d[16];
      const wi = p.weapons[p.cur];
      if (wi) wi.charge = d[17];
      list.push(p);
    }
    for (const id of [...this.P.keys()]) if (!seen.has(id)) { this.P.delete(id); this.shots.delete(id); }
    w.players = list;
  }

  /** Synchronise une liste : crée, met à jour, retire les entités absentes. */
  private sync<T extends object>(map: Map<number, T>, rows: any[], make: (id: number, st: any[]) => T | null, upd: (e: T, st: any[] | 0, d: any[], fresh: boolean, id: number) => void): T[] {
    const out: T[] = [];
    const seen = new Set<number>();
    for (const row of rows) {
      const id = row[0], st = row[1];
      let e = map.get(id);
      let fresh = false;
      if (!e) {
        if (!st) continue;
        const m = make(id, st);
        if (!m) continue;
        e = m; map.set(id, e); fresh = true;
      }
      seen.add(id);
      upd(e, st, row.slice(2), fresh, id);
      out.push(e);
    }
    for (const id of [...map.keys()]) if (!seen.has(id)) { const e = map.get(id) as { dead?: boolean }; if (e && 'dead' in e) e.dead = true; map.delete(id); }
    return out;
  }

  /** À chaque image : interpole les positions entre les deux derniers instantanés et fait vivre les petites animations. */
  interpolate(now: number, dt: number): void {
    const w = this.w;
    const k = this.lastAt < 0 ? 1 : Math.max(0, Math.min(1, (now - this.t0) / this.interval));
    const lerp = (o: WithIp) => {
      const ip = o._ip;
      if (!ip) return;
      o.x = ip.x0 + (ip.x1 - ip.x0) * k;
      o.y = ip.y0 + (ip.y1 - ip.y0) * k;
    };
    for (const p of w.players) {
      lerp(p);
      if (p.swing > 0) p.swing -= dt;
      if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 28);
      if (p.flash > 0) p.flash -= dt;
      if (p.invuln > 0) p.invuln -= dt;
    }
    for (const e of w.enemies) { lerp(e); if (e.flash > 0) e.flash -= dt; if (e.spawnT > 0) e.spawnT -= dt; }
    for (const b of w.bullets) {
      lerp(b as unknown as WithIp);
      const ip = (b as unknown as WithIp)._ip;
      if (ip) b.age = ip.a0 + (ip.a1 - ip.a0) * k;
    }
    for (const x of w.pickups) lerp(x);
    for (const x of w.items) lerp(x);
    for (const x of w.pets) lerp(x);
    for (const b of w.bubbles) b.t -= dt;
  }
}
