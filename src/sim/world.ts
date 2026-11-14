// World : l'état complet d'une partie + la boucle de simulation. Pur (ni DOM ni Pixi).
import type {
  Player, Enemy, Bullet, Pickup, Chest, Interactable, Prop, Pet, Fx, Mods, Room, SaveData, HeroDef, ModifierDef,
  PickupKind, WeaponInst, Loot, ChestEvent, RuleOfferEvent, PlayerInput, Entity, EnemyDef,
} from '../core/types';
import { R, allRules, allPassives } from '../core/registry';
import { Rng } from '../core/rng';
import { baseMods, clampMods, ModStack } from '../core/mods';
import { rollRarity, weaponPrice } from '../core/damage';
import { Ctx } from './ctx';
import { T, TILE, tileAt, isSolidTile, roomAt, roomCenter, generateFloor, generateHub, defaultPlan, type Floor } from './dungeon';
import { updateBullets, updateWeapon, makeWeapon, damagePlayer, tickStatus } from './combat';
import { spawnEnemy, updateEnemies, computeFlow, moveEntity, type Flow } from './enemies';
import './patterns';

export interface Choice {
  kind: 'rule' | 'passive';
  title: string;
  sub: string;
  options: ModifierDef[];
  picks: number;
  done?: () => void;
}
export interface RunSummary {
  win: boolean;
  seed: string;
  hero: string;
  world: number;
  floor: number;
  loop: number;
  time: number;
  kills: number;
  coins: number;
  gems: number;
  rules: string[];
  synergies: string[];
  passives: string[];
  damage: number;
  rooms: number;
  bosses: number;
}
export const emptyInput = (): PlayerInput => ({ mx: 0, my: 0, ax: 0, ay: 0, aimManual: false, fire: false, firePressed: false, swap: false, interact: false, skill: false });

export const WORLD_NAMES = ['Le Hall', 'Sylve Murmurante', 'Glacier Fendu', 'Forge Abyssale'];

export class World {
  reg = R;
  mode: 'hub' | 'run' | 'dead' | 'won' = 'hub';
  seed = '';
  rng = { dungeon: new Rng(1), loot: new Rng(2), rules: new Rng(3), combat: new Rng(4) };
  floor!: Floor;
  worldNum = 1;
  floorNum = 1;
  loop = 0;
  players: Player[] = [];
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  pickups: Pickup[] = [];
  chests: Chest[] = [];
  items: Interactable[] = [];
  props: Prop[] = [];
  pets: Pet[] = [];
  mods: Mods = baseMods();
  rules: ModStack;
  ctx: Ctx;
  coins = 0;
  gems = 0;
  kills = 0;
  time = 0;
  tick = 0;
  stats = { damage: 0, shots: 0, hits: 0, rooms: 0, bosses: 0 };
  fx: Fx[] = [];
  timers: { t: number; fn: () => void; owner: Entity | null }[] = [];
  choice: Choice | null = null;
  private choiceQueue: Choice[] = [];
  hitstop = 0;
  explosions = 0;
  curRoom: Room | null = null;
  flow: Flow | null = null;
  private flowT = 0;
  boss: Enemy | null = null;
  nextId = 1;
  warned = new Set<string>();
  /** Interactif à portée de chaque joueur (pour l'invite à l'écran). */
  focus: (Interactable | null)[] = [];
  /** Demandes à l'interface ('arsenal', 'pets', …). */
  request: { type: string; data?: any } | null = null;
  summary: RunSummary | null = null;
  /** Aspiration de tout le butin (après une salle nettoyée). */
  vacuum = 0;
  private pending = 0;
  /** Appelé quand la sauvegarde doit être écrite. */
  persist: () => void = () => {};

  constructor(public save: SaveData) {
    this.ctx = new Ctx(this);
    this.rules = new ModStack(() => this.ctx);
  }

  // =================================================================== requêtes
  depth(): number { return (this.worldNum - 1) * 5 + (this.floorNum - 1) + this.loop * 15; }
  solid(x: number, y: number): boolean { return isSolidTile(tileAt(this.floor, Math.floor(x / TILE), Math.floor(y / TILE))); }
  isFree(x: number, y: number, r = 5): boolean {
    return !this.solid(x - r, y - r) && !this.solid(x + r, y - r) && !this.solid(x - r, y + r) && !this.solid(x + r, y + r);
  }
  los(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0, dy = y1 - y0;
    const n = Math.ceil(Math.hypot(dx, dy) / 7);
    for (let i = 1; i < n; i++) if (this.solid(x0 + (dx * i) / n, y0 + (dy * i) / n)) return false;
    return true;
  }
  inRoom(room: Room, x: number, y: number): boolean {
    return x > (room.x + 1) * TILE && x < (room.x + room.w - 1) * TILE && y > (room.y + 1) * TILE && y < (room.y + room.h - 1) * TILE;
  }
  lead(): Player { return this.players.find((p) => !p.downed) ?? this.players[0]; }
  nearestPlayer(x: number, y: number): Player | null {
    let best: Player | null = null, bd = Infinity;
    for (const p of this.players) {
      if (p.downed) continue;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  /** forCharmed = cherche une proie pour un ennemi charmé (ignore les autres charmés). */
  nearestEnemy(x: number, y: number, range = 9999, forCharmed = false): Enemy | null {
    let best: Enemy | null = null, bd = range * range;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0 || e.charmed) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  freeSpot(room: Room | null, minDist = 0): { x: number; y: number } {
    if (!room) return { x: this.lead().x, y: this.lead().y };
    const rng = this.rng.combat;
    for (let i = 0; i < 60; i++) {
      const tx = rng.int(room.x + 1, room.x + room.w - 2), ty = rng.int(room.y + 1, room.y + room.h - 2);
      if (tileAt(this.floor, tx, ty) !== T.FLOOR) continue;
      const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
      if (minDist && this.players.some((p) => Math.hypot(p.x - x, p.y - y) < minDist * (i < 40 ? 1 : 0.5))) continue;
      return { x, y };
    }
    return roomCenter(room);
  }
  maxHp(p: Player): number { return Math.max(1, Math.round(p.hero.hp + p.mods.maxHp)); }
  maxArmor(p: Player): number { return Math.max(0, Math.round(p.hero.armor + p.mods.maxArmor)); }
  maxEnergy(p: Player): number { return Math.max(0, Math.round(p.hero.energy + p.mods.maxEnergy)); }
  heal(p: Player, n: number): void {
    if (p.downed) return;
    const amt = Math.max(0, Math.round(n * p.mods.healMult));
    if (!amt) return;
    const before = p.hp;
    p.hp = Math.min(this.maxHp(p), p.hp + amt);
    if (p.hp > before) {
      this.fx.push({ t: 'text', x: p.x, y: p.y - 14, s: '+' + (p.hp - before), color: 0x6ee06e });
      this.fx.push({ t: 'burst', x: p.x, y: p.y, color: 0x6ee06e, n: 6, speed: 40, life: 0.5 });
    }
  }

  // =================================================================== cycle de vie
  private reset(): void {
    this.enemies = []; this.bullets = []; this.pickups = []; this.chests = []; this.items = []; this.props = []; this.pets = [];
    this.timers = []; this.choice = null; this.choiceQueue = []; this.boss = null; this.flow = null; this.curRoom = null;
    this.hitstop = 0; this.vacuum = 0; this.pending = 0; this.focus = [];
    this.fx.push({ t: 'tiles' });
  }

  heroDef(id?: string): HeroDef {
    const list = [...R.heroes.values()];
    return R.heroes.get(id ?? '') ?? list.find((h) => h.cost === 0) ?? list[0];
  }
  heroUnlocked(h: HeroDef): boolean { return h.cost === 0 || this.save.heroes.includes(h.id); }

  makePlayer(hero: HeroDef, index: number, x = 0, y = 0): Player {
    const p: Player = {
      id: this.nextId++, team: 'player', index, hero, x, y, vx: 0, vy: 0, kx: 0, ky: 0, radius: 6,
      hp: hero.hp, maxHp: hero.hp, armor: hero.armor, energy: hero.energy, mods: baseMods(),
      weapons: [], cur: 0, aim: 0, facing: 1, moving: false, sinceHit: 99, armorAcc: 0, invuln: 0,
      skillCd: 0, skillT: 0, recoil: 0, swing: 0, input: emptyInput(), still: 0, downed: false, lastShot: null,
      flash: 0, status: {}, dead: false, data: {},
    };
    const wi = makeWeapon(this, hero.weapon) ?? makeWeapon(this, [...R.weapons.keys()][0]);
    if (wi) p.weapons.push(wi);
    return p;
  }

  private addPet(owner: Player): void {
    const def = R.pets.get(this.save.pet ?? '') ?? null;
    if (def) this.pets.push({ def, x: owner.x - 12, y: owner.y + 6, cd: 1, facing: 1, owner, data: {} });
  }

  startHub(): void {
    this.reset();
    this.mode = 'hub';
    this.rules = new ModStack(() => this.ctx);
    this.mods = baseMods();
    this.worldNum = 0; this.floorNum = 0; this.loop = 0;
    this.floor = generateHub();
    this.curRoom = this.floor.start;
    this.summary = null;
    const c = roomCenter(this.floor.start);
    const hero = this.heroDef(this.save.hero);
    this.save.hero = hero.id;
    this.players = [this.makePlayer(hero, 0, c.x, c.y + 40)];
    this.addPet(this.players[0]);
    // héros alignés en haut du hall
    const heroes = [...R.heroes.values()];
    heroes.forEach((h, i) => {
      const x = c.x + (i - (heroes.length - 1) / 2) * 44;
      this.items.push(this.heroStand(h, x, c.y - 52));
    });
    this.items.push({
      id: this.nextId++, kind: 'portal', x: c.x, y: c.y + 4, sprite: 'portal', label: 'Entrer dans le donjon', sub: 'Commencer une run', radius: 16, dead: false, bob: true,
      use: () => { this.request = { type: 'start' }; },
    });
    this.items.push({
      id: this.nextId++, kind: 'npc', x: c.x - 150, y: c.y + 50, sprite: 'npc_smith', label: 'Arsenal', sub: 'Débloquer des armes', radius: 18, dead: false,
      use: () => { this.request = { type: 'arsenal' }; },
    });
    this.items.push({
      id: this.nextId++, kind: 'npc', x: c.x + 150, y: c.y + 50, sprite: 'npc_keeper', label: 'Chenil', sub: 'Choisir un familier', radius: 18, dead: false,
      use: () => { this.request = { type: 'pets' }; },
    });
    this.items.push({
      id: this.nextId++, kind: 'npc', x: c.x - 150, y: c.y - 10, sprite: 'npc_scribe', label: 'Codex', sub: 'Édits et synergies découverts', radius: 18, dead: false,
      use: () => { this.request = { type: 'codex' }; },
    });
    if (R.enemies.has('dummy')) spawnEnemy(this, 'dummy', c.x + 150, c.y - 10, { delay: 0 });
  }

  private heroStand(h: HeroDef, x: number, y: number): Interactable {
    const unlocked = this.heroUnlocked(h);
    return {
      id: this.nextId++, kind: 'hero', x, y, sprite: h.sprite, label: h.name + ' — ' + h.title,
      sub: unlocked ? h.skill.name + ' : ' + h.skill.desc : `Débloquer : ${h.cost} gemmes`, radius: 16, dead: false,
      tint: unlocked ? 0xffffff : 0x333344, data: { hero: h.id },
      use: (_ctx, p, self) => {
        if (!this.heroUnlocked(h)) {
          if (this.save.gems < h.cost) {
            this.fx.push({ t: 'text', x, y: y - 16, s: 'GEMMES INSUFFISANTES', color: 0xff6677 });
            this.fx.push({ t: 'sfx', id: 'deny' });
            return false;
          }
          this.save.gems -= h.cost;
          this.save.heroes.push(h.id);
          self.tint = 0xffffff;
          self.sub = h.skill.name + ' : ' + h.skill.desc;
          this.fx.push({ t: 'sfx', id: 'unlock' });
          this.fx.push({ t: 'burst', x, y, color: 0xffd23a, n: 20, speed: 90, life: 0.7 });
        }
        if (p.hero !== h) {
          const np = this.makePlayer(h, p.index, p.x, p.y);
          this.players[this.players.indexOf(p)] = np;
          for (const pet of this.pets) if (pet.owner === p) pet.owner = np;
          if (p.index === 0) this.save.hero = h.id;
          this.fx.push({ t: 'sfx', id: 'select' });
          this.fx.push({ t: 'burst', x: p.x, y: p.y, color: 0x9ad8ff, n: 12, speed: 70, life: 0.5 });
          this.fx.push({ t: 'banner', title: h.name, sub: h.title });
        }
        this.persist();
      },
    };
  }

  /** Démarre une run. heroIds : un héros par joueur (1 ou 2). */
  startRun(seed: string, heroIds: string[]): void {
    this.reset();
    this.mode = 'run';
    this.seed = seed;
    const base = new Rng(seed);
    this.rng = { dungeon: base.fork('dungeon'), loot: base.fork('loot'), rules: base.fork('rules'), combat: base.fork('combat') };
    this.rules = new ModStack(() => this.ctx);
    this.mods = baseMods();
    this.coins = 0; this.gems = 0; this.kills = 0; this.time = 0; this.tick = 0;
    this.stats = { damage: 0, shots: 0, hits: 0, rooms: 0, bosses: 0 };
    this.worldNum = 1; this.floorNum = 1; this.loop = 0; this.summary = null;
    this.players = heroIds.map((id, i) => this.makePlayer(this.heroDef(id), i));
    this.save.stats.runs++;
    this.loadFloor();
    this.offerRules('ÉDIT FONDATEUR', 'Choisis la première règle qui régira cette run.');
    this.persist();
  }

  loadFloor(): void {
    const keepPlayers = this.players;
    this.reset();
    this.players = keepPlayers;
    const plan = defaultPlan(this.worldNum, this.floorNum);
    this.rules.emit('onFloorPlan', plan);
    const theme = R.themes.get(this.worldNum);
    this.floor = generateFloor(this.rng.dungeon.fork(`${this.loop}-${this.worldNum}-${this.floorNum}`), plan, theme);
    const c = roomCenter(this.floor.start);
    this.players.forEach((p, i) => {
      p.x = c.x + (i ? 14 : 0); p.y = c.y; p.vx = p.vy = p.kx = p.ky = 0; p.status = {};
      if (p.downed) { p.downed = false; p.hp = Math.max(1, Math.ceil(this.maxHp(p) / 2)); }
      this.addPet(p);
    });
    this.curRoom = this.floor.start;
    this.reveal(this.floor.start);
    for (const pr of this.floor.props) this.props.push({ id: this.nextId++, kind: pr.kind, x: pr.x, y: pr.y, hp: pr.kind === 'barrel' ? 8 : 12, radius: 6, flash: 0, dead: false });
    for (const room of this.floor.rooms) this.populate(room);
    this.fx.push({ t: 'tiles' });
    this.fx.push({ t: 'banner', title: `${this.worldNum}-${this.floorNum}`, sub: (theme?.name ?? WORLD_NAMES[this.worldNum] ?? '') + (this.loop ? ` · Boucle ${this.loop + 1}` : '') });
    this.rules.emit('onFloorStart');
    if ((this.floorNum === 2 || this.floorNum === 4) && allPassives().length) this.offerPassives();
  }

  private populate(room: Room): void {
    const c = roomCenter(room);
    const rng = this.rng.loot;
    if (room.type === 'chest') this.spawnChest(c.x, c.y, 'big');
    else if (room.type === 'secret') {
      this.spawnChest(c.x, c.y, 'big');
      for (let i = 0; i < 3; i++) this.spawnPickup('gem', c.x - 24 + i * 24, c.y + 26, 1, true);
      for (let i = 0; i < 6; i++) this.spawnPickup('coin', c.x + rng.range(-40, 40), c.y - 26 + rng.range(-8, 8), 2, true);
    } else if (room.type === 'statue') {
      this.items.push({
        id: this.nextId++, kind: 'statue', x: c.x, y: c.y - 6, sprite: 'statue', label: 'Statue des Anciens', sub: 'Recevoir une bénédiction', radius: 20, dead: false,
        use: (_c, _p, self) => {
          if (self.data?.used) return false;
          self.data = { used: true };
          self.sub = 'La statue est silencieuse.';
          self.tint = 0x777788;
          this.offerPassives();
        },
      });
    } else if (room.type === 'shop') {
      this.items.push({ id: this.nextId++, kind: 'npc', x: c.x, y: c.y - 26, sprite: 'npc_merchant', label: 'Marchand', sub: 'Tout se paie en or.', radius: 0, dead: false });
      const stock: Loot[] = [
        { t: 'weapon', id: this.rollWeapon(0.4) },
        { t: 'hp', n: 2 },
        rng.chance(0.5) ? { t: 'weapon', id: this.rollWeapon(0.8) } : { t: 'energy', n: 80 },
      ];
      const pas = allPassives().filter((d) => !this.rules.has(d.id));
      if (pas.length) stock.push({ t: 'passive', id: rng.pick(pas).id });
      stock.forEach((loot, i) => this.items.push(this.shopItem(loot, c.x + (i - (stock.length - 1) / 2) * 34, c.y + 10)));
    }
  }

  private shopItem(loot: Loot, x: number, y: number): Interactable {
    let sprite = 'pk_hp', label = '', price = 15, weapon: WeaponInst | undefined, tint: number | undefined, sub: string | undefined;
    if (loot.t === 'weapon') {
      weapon = makeWeapon(this, loot.id)!;
      sprite = weapon.def.sprite; label = weapon.def.name; price = weaponPrice(weapon.rarity); sub = weapon.def.desc;
    } else if (loot.t === 'hp') { sprite = 'potion_hp'; label = `Potion de vie (+${loot.n})`; price = 14; }
    else if (loot.t === 'energy') { sprite = 'potion_en'; label = `Potion d'énergie (+${loot.n})`; price = 10; }
    else if (loot.t === 'passive') { const d = R.mods.get(loot.id)!; sprite = d.icon; label = d.name; sub = d.desc; price = 40; }
    return {
      id: this.nextId++, kind: 'shopitem', x, y, sprite, label, sub, price, weapon, loot, radius: 15, dead: false, bob: true, tint,
      use: (_c, p, self) => {
        const cost = this.priceOf(self);
        if (this.coins < cost) {
          this.fx.push({ t: 'text', x, y: y - 14, s: 'PAS ASSEZ D\'OR', color: 0xff6677 });
          this.fx.push({ t: 'sfx', id: 'deny' });
          return false;
        }
        this.coins -= cost;
        this.fx.push({ t: 'sfx', id: 'buy' });
        self.dead = true;
        if (loot.t === 'weapon') this.equip(p, self.weapon!, x, y);
        else if (loot.t === 'hp') this.heal(p, loot.n);
        else if (loot.t === 'energy') this.ctx.addEnergy(p, loot.n);
        else if (loot.t === 'passive') this.takeMod(R.mods.get(loot.id)!);
      },
    };
  }
  priceOf(it: Interactable): number { return Math.max(0, Math.round((it.price ?? 0) * this.mods.shopPrice)); }

  private reveal(room: Room): void {
    room.visited = true; room.seen = true;
    for (const id of room.links) { const r = this.floor.rooms[id]; if (!r.hidden) r.seen = true; }
  }

  // =================================================================== butin
  rollWeapon(bonus = 0): string {
    const pool = [...R.weapons.values()].filter((d) => d.unlock === undefined || this.save.weapons.includes(d.id));
    if (!pool.length) return '';
    const rar = rollRarity(this.rng.loot.next(), this.depth(), bonus + this.mods.weaponRarityBonus + this.mods.chestRarityBonus);
    for (let d = 0; d < 5; d++) {
      const c = pool.filter((x) => x.rarity === rar - d || x.rarity === rar + d);
      if (c.length) return this.rng.loot.pick(c).id;
    }
    return pool[0].id;
  }
  spawnPickup(kind: PickupKind, x: number, y: number, amount = 1, still = false): void {
    if (this.pickups.length > 400) return;
    const a = this.rng.combat.range(0, 6.283), s = still ? 0 : this.rng.combat.range(30, 90);
    this.pickups.push({ id: this.nextId++, kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, amount, age: 0, dead: false });
  }
  spawnChest(x: number, y: number, kind: string): Chest {
    const c: Chest = { id: this.nextId++, x, y, kind, opened: false, dead: false };
    this.chests.push(c);
    return c;
  }
  dropWeapon(wi: WeaponInst, x: number, y: number): Interactable {
    const it: Interactable = {
      id: this.nextId++, kind: 'weapon', x, y, sprite: wi.def.sprite, label: wi.def.name, sub: wi.def.desc, weapon: wi, radius: 16, dead: false, bob: true,
      use: (_c, p, self) => { self.dead = true; this.equip(p, wi, self.x, self.y); },
    };
    this.items.push(it);
    return it;
  }
  /** Équipe une arme (échange avec l'arme en main si l'inventaire est plein). */
  equip(p: Player, wi: WeaponInst, x = p.x, y = p.y): void {
    if (p.mods.forceRarity >= 0) wi.rarity = Math.max(wi.rarity, p.mods.forceRarity) as any;
    if (p.weapons.length < p.mods.maxWeapons) { p.weapons.push(wi); p.cur = p.weapons.length - 1; }
    else {
      const old = p.weapons[p.cur];
      p.weapons[p.cur] = wi;
      old.charge = 0; old.burstLeft = 0;
      this.dropWeapon(old, x, y);
    }
    wi.cd = 0.2;
    this.rules.emit('onWeaponPickup', { player: p, weapon: wi });
    this.fx.push({ t: 'sfx', id: 'pickup' });
    this.fx.push({ t: 'text', x: p.x, y: p.y - 16, s: wi.def.name.toUpperCase(), color: [0xe8e8f0, 0x58d858, 0x48a8ff, 0xc070ff, 0xff9a30][wi.rarity] });
  }
  private openChest(c: Chest, p: Player): void {
    c.opened = true;
    const rng = this.rng.loot;
    const loot: Loot[] = [];
    if (c.kind === 'weapon') loot.push({ t: 'weapon', id: this.rollWeapon(0) });
    else if (c.kind === 'big') { loot.push({ t: 'weapon', id: this.rollWeapon(0.6) }); loot.push({ t: 'coin', n: rng.int(6, 12) }); }
    else {
      const hurt = this.players.some((q) => q.hp < this.maxHp(q));
      const r = rng.next();
      if (hurt && r < 0.4) loot.push({ t: 'hp', n: 2 });
      else if (r < 0.75) loot.push({ t: 'energy', n: rng.int(40, 70) });
      else loot.push({ t: 'coin', n: rng.int(8, 14) });
      if (rng.chance(0.35)) loot.push({ t: 'coin', n: rng.int(3, 6) });
    }
    const ev: ChestEvent = { chest: c, player: p, mimic: R.enemies.has('mimic') && rng.chance(this.mods.mimicChance), loot };
    this.rules.emit('onChestOpen', ev);
    this.fx.push({ t: 'sfx', id: 'chest' });
    this.fx.push({ t: 'burst', x: c.x, y: c.y, color: 0xffd23a, n: 10, speed: 70, life: 0.5 });
    if (ev.mimic) {
      c.dead = true;
      const e = spawnEnemy(this, 'mimic', c.x, c.y, { delay: 0.25 });
      if (e) { e.data.loot = ev.loot; this.fx.push({ t: 'banner', title: 'MIMIC !', color: '#ff5577' }); this.fx.push({ t: 'sfx', id: 'mimic' }); return; }
    }
    this.dropLoot(ev.loot, c.x, c.y + 4);
  }
  dropLoot(loot: Loot[], x: number, y: number): void {
    let k = 0;
    for (const l of loot) {
      if (l.t === 'weapon') {
        const wi = makeWeapon(this, l.id, l.rarity);
        if (wi) this.dropWeapon(wi, x + k * 18, y + 14);
        k++;
      } else if (l.t === 'passive') this.takeMod(R.mods.get(l.id));
      else if (l.t === 'coin') for (let n = l.n; n > 0; n -= 3) this.spawnPickup('coin', x, y, Math.min(3, n));
      else if (l.t === 'energy') for (let n = l.n; n > 0; n -= 10) this.spawnPickup('energy', x, y, Math.min(10, n));
      else if (l.t === 'hp') for (let n = 0; n < l.n; n++) this.spawnPickup('hp', x, y, 1);
      else if (l.t === 'gem') for (let n = 0; n < l.n; n++) this.spawnPickup('gem', x, y, 1);
    }
  }

  // =================================================================== choix (édits / passifs)
  private pushChoice(c: Choice): void {
    if (!c.options.length) { c.done?.(); return; }
    if (this.choice) this.choiceQueue.push(c);
    else { this.choice = c; this.fx.push({ t: 'sfx', id: 'offer' }); }
  }
  /** Rejette les règles au max, exclues par une règle active, ou qui excluent une règle active. */
  eligibleRules(): ModifierDef[] {
    const active = this.rules.list;
    return allRules().filter((d) => {
      const inst = this.rules.get(d.id);
      if (inst && inst.stacks >= (d.maxStacks ?? 1)) return false;
      if (d.excludes?.some((x) => this.rules.has(x))) return false;
      if (active.some((a) => a.def.excludes?.includes(d.id))) return false;
      return true;
    });
  }
  offerRules(title = 'UN ÉDIT TOMBE', sub = 'Choisis une règle. Elle restera jusqu\'à la fin de la run.', done?: () => void): void {
    const ev: RuleOfferEvent = { count: 3, choices: [], picks: 1 };
    this.rules.emit('onRuleOffer', ev);
    const pool = this.eligibleRules().filter((d) => !ev.choices.includes(d));
    const count = Math.max(1, Math.min(5, Math.round(ev.count)));
    while (ev.choices.length < count && pool.length) {
      const d = this.rng.rules.weighted(pool, (x) => x.weight ?? 1);
      pool.splice(pool.indexOf(d), 1);
      ev.choices.push(d);
    }
    this.pushChoice({ kind: 'rule', title, sub, options: ev.choices.slice(0, 5), picks: Math.max(1, Math.min(ev.choices.length, Math.round(ev.picks))), done });
  }
  offerPassives(done?: () => void): void {
    const pool = allPassives().filter((d) => { const i = this.rules.get(d.id); return !i || i.stacks < (d.maxStacks ?? 1); });
    const options: ModifierDef[] = [];
    while (options.length < 3 && pool.length) {
      const d = this.rng.rules.weighted(pool, (x) => x.weight ?? 1);
      pool.splice(pool.indexOf(d), 1);
      options.push(d);
    }
    this.pushChoice({ kind: 'passive', title: 'BÉNÉDICTION', sub: 'Choisis un passif.', options, picks: 1, done });
  }
  takeMod(def: ModifierDef | undefined): void {
    if (!def) return;
    const inst = this.rules.add(def);
    if (!inst) return;
    if (def.kind === 'rule' && !this.save.seenRules.includes(def.id)) this.save.seenRules.push(def.id);
    this.fx.push({ t: 'banner', title: def.name, sub: def.desc, color: def.kind === 'rule' ? (def.flavor === 'curse' ? '#ff5577' : def.flavor === 'boon' ? '#6ee06e' : '#c9a0ff') : '#9ad8ff' });
    this.fx.push({ t: 'sfx', id: def.kind === 'rule' ? 'edict' : 'buff' });
    this.fx.push({ t: 'flash', color: 0xffffff, a: 0.2 });
  }
  /** L'interface appelle pick(i) quand le joueur choisit une carte. */
  pick(i: number): void {
    const c = this.choice;
    if (!c || !c.options[i]) return;
    this.takeMod(c.options[i]);
    c.options.splice(i, 1);
    if (c.kind === 'rule') { const ok = new Set(this.eligibleRules()); c.options = c.options.filter((d) => ok.has(d)); }
    if (--c.picks > 0 && c.options.length) return;
    this.choice = null;
    c.done?.();
    if (!this.choice && this.choiceQueue.length) this.choice = this.choiceQueue.shift()!;
  }

  // =================================================================== salles
  private lockRoom(room: Room): void {
    room.state = 'active'; room.locked = true; room.wave = 0;
    for (const d of room.doors) this.floor.tiles[d.x + d.y * this.floor.w] = T.DOORC;
    this.fx.push({ t: 'tiles' }); this.fx.push({ t: 'sfx', id: 'lock' }); this.fx.push({ t: 'shake', a: 2 });
    const lead = this.lead();
    for (const p of this.players) if (p !== lead && !this.inRoom(room, p.x, p.y)) { p.x = lead.x; p.y = lead.y; }
    for (const pet of this.pets) { pet.x = pet.owner.x; pet.y = pet.owner.y; }
    const c = roomCenter(room);
    if (room.type === 'boss') {
      const bosses = [...R.enemies.values()].filter((d) => d.boss && d.world === this.worldNum);
      const def = bosses.length ? this.rng.dungeon.pick(bosses) : [...R.enemies.values()].find((d) => d.boss);
      if (def) {
        const e = spawnEnemy(this, def, c.x, c.y - 30, { delay: 1.2 });
        this.boss = e;
        this.fx.push({ t: 'banner', title: def.name.toUpperCase(), sub: def.boss!.title, color: '#ff5577' });
        this.fx.push({ t: 'sfx', id: 'boss' });
      }
      room.waves = 1; room.wave = 1;
    } else if (room.type === 'guardian') {
      const pool = this.enemyPool().filter((d) => !d.noChampion && (d.attacks?.length ?? 0) > 0);
      const def = pool.length ? this.rng.dungeon.pick(pool) : this.enemyPool()[0];
      if (def) {
        const e = spawnEnemy(this, def, c.x, c.y - 20, { delay: 1.1, champion: true });
        this.boss = e;
        this.fx.push({ t: 'banner', title: 'GARDIEN', sub: def.name + ' champion', color: '#ffb040' });
        this.fx.push({ t: 'sfx', id: 'boss' });
      }
      room.waves = 1; room.wave = 1;
      this.spawnWave(room, 0.5, false);
    } else this.spawnWave(room);
  }

  enemyPool(): EnemyDef[] {
    const all = [...R.enemies.values()].filter((d) => !d.boss && d.world > 0);
    const w = ((this.worldNum - 1) % 3) + 1;
    let pool = all.filter((d) => d.world === w && (d.minFloor ?? 1) <= this.floorNum);
    if (!pool.length) pool = all.filter((d) => d.world === w);
    if (!pool.length) pool = all;
    return pool;
  }

  private spawnWave(room: Room, budgetMult = 1, count = true): void {
    if (count) room.wave++;
    const pool = this.enemyPool();
    if (!pool.length) return;
    const rng = this.rng.combat;
    let budget = (4 + this.worldNum * 1.5 + this.floorNum * 0.8 + this.loop * 3) * this.mods.enemyCount * budgetMult * (this.players.length > 1 ? 1.3 : 1) * rng.range(0.85, 1.15);
    budget *= Math.min(1.3, (room.w * room.h) / 190);
    const eliteChance = 0.03 + 0.012 * this.depth() + this.mods.eliteChance;
    let n = 0;
    while (budget >= 1 && n < 26 && this.enemies.length < 70) {
      const afford = pool.filter((d) => (d.cost ?? 1) <= budget);
      if (!afford.length) break;
      const def = rng.weighted(afford, (d) => 1 / Math.sqrt(d.cost ?? 1));
      const pos = this.freeSpot(room, 75);
      spawnEnemy(this, def, pos.x, pos.y, { elite: rng.chance(eliteChance), delay: 0.7 + n * 0.04 });
      budget -= (def.cost ?? 1) / (this.mods.enemyCount > 1.5 ? 1 : 1);
      n++;
    }
    this.fx.push({ t: 'sfx', id: 'wave' });
  }

  private clearRoom(room: Room): void {
    room.state = 'cleared'; room.locked = false;
    for (const d of room.doors) this.floor.tiles[d.x + d.y * this.floor.w] = T.DOOR;
    this.fx.push({ t: 'tiles' }); this.fx.push({ t: 'sfx', id: 'clear' });
    this.stats.rooms++;
    this.vacuum = 1.6;
    for (const p of this.players) if (p.downed) { p.downed = false; p.hp = Math.max(1, Math.ceil(this.maxHp(p) / 2)); p.invuln = 2; const l = this.lead(); p.x = l.x; p.y = l.y; }
    for (const b of this.bullets) if (b.team === 'enemy') b.dead = true;
    const c = roomCenter(room);
    const spot = this.isFree(c.x, c.y + 8, 7) ? { x: c.x, y: c.y + 8 } : this.freeSpot(room);
    const special = room.type === 'boss' || room.type === 'guardian';
    this.spawnChest(spot.x, spot.y, special ? 'big' : this.rng.loot.chance(0.3) ? 'weapon' : 'supply');
    this.rules.emit('onRoomClear', room);
    if (room.exit && !special) this.spawnPortal(room);
  }

  spawnPortal(room: Room): void {
    const c = roomCenter(room);
    const spot = this.isFree(c.x, c.y - 26, 8) ? { x: c.x, y: c.y - 26 } : c;
    const final = this.floorNum === 5 && this.worldNum === 3;
    this.items.push({
      id: this.nextId++, kind: 'portal', x: spot.x, y: spot.y, sprite: 'portal', label: final ? 'Portail de sortie' : 'Portail', sub: final ? 'Quitter le donjon, victorieux' : 'Descendre à l\'étage suivant',
      radius: 16, dead: false, bob: true, use: (_c, _p, self) => { self.dead = true; this.nextFloor(); },
    });
    this.fx.push({ t: 'sfx', id: 'portal' });
    this.fx.push({ t: 'ring', x: spot.x, y: spot.y, r: 30, color: 0x9a70ff });
  }

  nextFloor(): void {
    if (this.floorNum >= 5) {
      if (this.worldNum >= 3) { this.finish(true); return; }
      this.worldNum++; this.floorNum = 1;
    } else this.floorNum++;
    this.loadFloor();
  }
  /** Après une victoire : repartir au monde 1 avec les mêmes édits, ennemis renforcés. */
  continueLoop(): void {
    if (this.mode !== 'won') return;
    this.mode = 'run'; this.loop++; this.worldNum = 1; this.floorNum = 1; this.gems = 0; this.summary = null;
    this.loadFloor();
  }

  /** Casse un mur fissuré (entrée de salle secrète). */
  breakCrack(x: number, y: number): boolean {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tileAt(this.floor, tx, ty) !== T.CRACK) return false;
    const g = this.floor.cracks.find((c) => c.tiles.some((t) => t.x === tx && t.y === ty));
    for (const t of g?.tiles ?? [{ x: tx, y: ty }]) {
      this.floor.tiles[t.x + t.y * this.floor.w] = T.FLOOR;
      this.fx.push({ t: 'burst', x: (t.x + 0.5) * TILE, y: (t.y + 0.5) * TILE, color: 0xb0a090, n: 8, speed: 80, life: 0.5, size: 2 });
    }
    if (g) { const r = this.floor.rooms[g.room]; r.hidden = false; r.seen = true; }
    this.floor.rev++;
    this.fx.push({ t: 'tiles' }); this.fx.push({ t: 'sfx', id: 'secret' }); this.fx.push({ t: 'shake', a: 4 });
    this.fx.push({ t: 'banner', title: 'SALLE SECRÈTE', sub: 'Le mur sonnait creux…', color: '#ffd23a' });
    return true;
  }

  // =================================================================== morts
  killEnemy(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    const big = !!e.def.boss || e.champion;
    if (!e.summoned) {
      const rng = this.rng.loot;
      const [c0, c1] = e.def.coins ?? [0, 2];
      let coins = rng.int(c0, c1) * this.mods.coinMult * (e.elite ? 2 : 1) * (big ? 0 : 1);
      coins = Math.floor(coins) + (rng.chance(coins % 1) ? 1 : 0);
      for (; coins > 0; coins -= 2) this.spawnPickup('coin', e.x, e.y, Math.min(2, coins));
      let orbs = (e.def.energy ?? 1) * this.mods.energyDrop * (e.elite ? 2 : 1);
      orbs = Math.floor(orbs) + (rng.chance(orbs % 1) ? 1 : 0);
      for (let i = 0; i < orbs; i++) if (rng.chance(0.75)) this.spawnPickup('energy', e.x, e.y, 4);
      if (e.elite && rng.chance(0.25)) this.spawnPickup('hp', e.x, e.y, 1);
      if (e.data.loot) this.dropLoot(e.data.loot, e.x, e.y);
    }
    const sc = e.scale * e.radius;
    this.fx.push({ t: 'burst', x: e.x, y: e.y, color: 0xffffff, n: Math.min(24, 5 + sc), speed: 80, life: 0.35, size: big ? 3 : 2 });
    this.fx.push({ t: 'decal', x: e.x, y: e.y, r: sc * 0.9, color: 0x1a0a14 });
    this.fx.push({ t: 'sfx', id: big ? 'bossdie' : 'die', vol: 0.7 });
    this.fx.push({ t: 'shake', a: big ? 12 : 1.5 });
    this.hitstop = Math.max(this.hitstop, big ? 0.25 : 0.025);
    if (e.def.onDeath) e.def.onDeath(this.ctx, e);
    this.rules.emit('onEnemyDeath', e);
    for (const p of this.players) if (p.mods.lifeSteal > 0 && this.rng.combat.chance(p.mods.lifeSteal)) this.heal(p, 1);
    if (e === this.boss) this.bossDefeated(e);
  }

  private bossDefeated(e: Enemy): void {
    this.boss = null;
    this.stats.bosses++;
    this.save.stats.bosses++;
    for (const b of this.bullets) if (b.team === 'enemy') b.dead = true;
    for (const o of this.enemies) if (o !== e && !o.dead && !o.charmed && (o.summoned || e.def.boss)) { o.summoned = true; this.killEnemy(o); }
    this.fx.push({ t: 'flash', color: 0xffffff, a: 0.6 });
    const gems = e.def.boss ? 6 + 2 * this.worldNum + 3 * this.loop : 2 + this.worldNum;
    for (let i = 0; i < gems; i++) this.spawnPickup('gem', e.x, e.y, 1);
    for (let i = 0; i < 10; i++) this.spawnPickup('coin', e.x, e.y, 2);
    const room = this.curRoom;
    this.ctx.after(1.7, () => {
      this.offerRules(e.def.boss ? 'LE SEIGNEUR EST TOMBÉ' : 'LE GARDIEN EST TOMBÉ', 'Un Édit s\'inscrit dans la pierre. Choisis-le.', () => {
        if (room && room.exit && this.mode === 'run') this.spawnPortal(room);
      });
    });
  }

  playerDown(p: Player): void {
    const ev = { player: p, cancel: false };
    this.rules.emit('onPlayerDeath', ev);
    if (ev.cancel) { if (p.hp <= 0) p.hp = 1; p.invuln = Math.max(p.invuln, 2); return; }
    p.downed = true;
    p.hp = 0;
    this.fx.push({ t: 'burst', x: p.x, y: p.y, color: 0xff4455, n: 24, speed: 110, life: 0.8, size: 2 });
    this.fx.push({ t: 'sfx', id: 'death' });
    this.fx.push({ t: 'shake', a: 10 });
    this.hitstop = 0.3;
    if (this.players.every((q) => q.downed)) this.ctx.after(1.2, () => this.finish(false));
  }

  /** Termine la run : calcule le récapitulatif et crédite les gemmes. */
  finish(win: boolean): void {
    if (this.mode !== 'run') return;
    this.mode = win ? 'won' : 'dead';
    const progress = this.depth() + (win ? 1 : 0);
    const earned = Math.round((this.gems + progress + this.stats.bosses * 2 + (win ? 10 : 0)) * 1);
    this.summary = {
      win, seed: this.seed, hero: this.players[0].hero.id, world: this.worldNum, floor: this.floorNum, loop: this.loop,
      time: this.time, kills: this.kills, coins: this.coins, gems: earned,
      rules: this.rules.ofKind('rule').map((i) => i.def.id), synergies: this.rules.ofKind('synergy').map((i) => i.def.id),
      passives: this.rules.ofKind('passive').map((i) => i.def.id), damage: Math.round(this.stats.damage), rooms: this.stats.rooms, bosses: this.stats.bosses,
    };
    const s = this.save;
    s.gems += earned;
    s.stats.kills += this.kills;
    if (win) s.stats.wins++;
    const best = `${this.loop * 3 + this.worldNum}-${this.floorNum}`;
    if (!s.stats.best || best > s.stats.best) s.stats.best = best;
    this.fx.push({ t: 'sfx', id: win ? 'victory' : 'gameover' });
    this.persist();
  }

  // =================================================================== boucle
  update(dt: number): void {
    if (this.choice || this.mode === 'dead' || this.mode === 'won') return;
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.tick++;
    if (this.mode === 'run') this.time += dt;
    this.explosions = 0;

    // --- Mods de la frame (repart de zéro : aucun état ne dérive)
    const m = clampMods(this.rules.apply(baseMods()));
    this.mods = m;
    for (const p of this.players) {
      const pm: Mods = { ...m, flags: { ...m.flags } };
      if (p.hero.modify) p.hero.modify(pm, p);
      if (p.skillT > 0 && p.hero.skill.modify) p.hero.skill.modify(pm, p);
      p.mods = clampMods(pm);
      p.maxHp = this.maxHp(p);
      if (p.hp > p.maxHp) p.hp = p.maxHp;
      if (p.armor > this.maxArmor(p)) p.armor = this.maxArmor(p);
      if (p.energy > this.maxEnergy(p)) p.energy = this.maxEnergy(p);
    }
    // Effets « globaux » posés par un héros ou une compétence (ralentir le temps, zoom…) : ils s'appliquent au monde.
    for (const p of this.players) {
      if (p.downed) continue;
      m.timeScale = Math.min(m.timeScale, p.mods.timeScale);
      if (p.mods.zoom !== m.zoom && p.index === 0) m.zoom = p.mods.zoom;
    }
    // --- minuteries
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      if (t.owner && t.owner.dead) { this.timers.splice(i, 1); continue; }
      t.t -= t.owner && (t.owner as Enemy).team === 'enemy' ? dt * m.timeScale : dt;
      if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
    }
    this.rules.emit('onTick', dt);
    for (const p of this.players) this.updatePlayer(p, dt);
    if (this.mode !== 'run' && this.mode !== 'hub') return;
    this.updateRooms();
    if (this.curRoom && this.enemies.length && (this.flowT -= dt) <= 0) {
      this.flowT = 0.2;
      const l = this.lead();
      this.flow = computeFlow(this, this.curRoom, l.x, l.y);
    }
    updateEnemies(this, dt);
    updateBullets(this, dt);
    this.updatePickups(dt);
    this.updatePets(dt);
    // coffres : s'ouvrent au contact
    for (const c of this.chests) {
      if (c.opened) continue;
      for (const p of this.players) if (!p.downed && Math.hypot(p.x - c.x, p.y - c.y) < 15) { this.openChest(c, p); break; }
    }
    for (const pr of this.props) if (pr.flash > 0) pr.flash -= dt;
    if (this.tick % 30 === 0) {
      this.items = this.items.filter((i) => !i.dead);
      this.props = this.props.filter((i) => !i.dead);
      this.chests = this.chests.filter((i) => !i.dead);
    }
    if (this.vacuum > 0) this.vacuum -= dt;
  }

  private updateRooms(): void {
    if (this.mode !== 'run') return;
    const l = this.lead();
    const room = roomAt(this.floor, l.x, l.y);
    if (room && room !== this.curRoom) {
      this.curRoom = room;
      this.flow = null;
      if (!room.visited) { this.reveal(room); this.rules.emit('onRoomEnter', room); }
    }
    const r = this.curRoom;
    if (!r) return;
    if (r.state === 'fresh') {
      const tx = l.x / TILE, ty = l.y / TILE;
      if (tx > r.x + 2.2 && tx < r.x + r.w - 2.2 && ty > r.y + 2.2 && ty < r.y + r.h - 2.2) this.lockRoom(r);
    } else if (r.state === 'active') {
      let alive = 0;
      for (const e of this.enemies) if (!e.dead && !e.charmed) alive++;
      if (alive === 0) {
        if (r.wave < r.waves) this.spawnWave(r);
        else this.clearRoom(r);
      }
    }
  }

  private updatePlayer(p: Player, dt: number): void {
    if (p.downed) return;
    const inp = p.input, m = p.mods, hero = p.hero;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.flash > 0) p.flash -= dt;
    if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 28);
    if (p.swing > 0) p.swing -= dt;
    if (p.skillCd > 0) p.skillCd -= dt;
    if (p.skillT > 0) {
      p.skillT -= dt;
      hero.skill.tick?.(this.ctx, p, dt);
      if (p.skillT <= 0) hero.skill.end?.(this.ctx, p);
    }
    tickStatus(this, p, dt);
    if (p.downed) return;

    // --- déplacement
    let ix = inp.mx, iy = inp.my;
    const il = Math.hypot(ix, iy);
    if (il > 1) { ix /= il; iy /= il; }
    p.moving = il > 0.15;
    p.still = p.moving ? 0 : p.still + dt;
    const speed = hero.speed * m.speed * (p.status.freeze || p.status.slow ? 0.55 : 1);
    const tile = tileAt(this.floor, Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    const a = 1 - Math.exp(-(tile === T.SLICK ? 2.4 : 26) * dt);
    p.vx += (ix * speed - p.vx) * a;
    p.vy += (iy * speed - p.vy) * a;
    const hitWall = moveEntity(this, p, (p.vx + p.kx) * dt, (p.vy + p.ky) * dt);
    const damp = Math.exp(-10 * dt);
    p.kx *= damp; p.ky *= damp;
    if (hitWall && m.wallDamage > 0 && p.moving) damagePlayer(this, p, m.wallDamage, 'wall');
    if (tile === T.HAZARD && this.mode === 'run') {
      p.data.hz = (p.data.hz ?? 0.3) - dt;
      if (p.data.hz <= 0) { p.data.hz = 0.8; damagePlayer(this, p, 1, 'hazard'); }
    } else p.data.hz = 0.3;

    // --- visée
    let target: Enemy | null = null;
    if (this.save.options.autoAim && !inp.aimManual) {
      let bd = 240 * 240;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0 || e.charmed) continue;
        const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
        if (d < bd && this.los(p.x, p.y, e.x, e.y)) { bd = d; target = e; }
      }
    }
    if (target) p.aim = Math.atan2(target.y - p.y, target.x - p.x);
    else if (inp.ax || inp.ay) p.aim = Math.atan2(inp.ay, inp.ax);
    else if (p.moving) p.aim = Math.atan2(iy, ix);
    p.facing = Math.cos(p.aim) >= 0 ? 1 : -1;

    // --- interaction
    let near: Interactable | null = null, nd = Infinity;
    for (const it of this.items) {
      if (it.dead || !it.use) continue;
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (d < (it.radius ?? 16) && d < nd) { nd = d; near = it; }
    }
    this.focus[p.index] = near;
    let consumed = false;
    if (near && inp.interact) { near.use!(this.ctx, p, near); consumed = true; }

    // --- armes
    while (p.weapons.length > Math.max(1, m.maxWeapons)) {
      const idx = p.weapons.findIndex((_, i) => i !== p.cur);
      const [old] = p.weapons.splice(idx, 1);
      p.cur = Math.min(p.cur > idx ? p.cur - 1 : p.cur, p.weapons.length - 1);
      this.dropWeapon(old, p.x + this.rng.combat.range(-10, 10), p.y + 12);
    }
    if (inp.swap && p.weapons.length > 1) {
      p.weapons[p.cur].charge = 0;
      p.cur = (p.cur + 1) % p.weapons.length;
      p.weapons[p.cur].cd = Math.max(p.weapons[p.cur].cd, 0.12);
      this.fx.push({ t: 'sfx', id: 'swap' });
    }
    for (let i = 0; i < p.weapons.length; i++) {
      if (i === p.cur) updateWeapon(this, p, p.weapons[i], dt, inp.fire && !consumed);
      else p.weapons[i].cd -= dt;
    }
    // --- compétence
    if (inp.skill && p.skillCd <= 0 && this.mode === 'run') {
      p.skillCd = hero.skill.cooldown * m.skillCd;
      p.skillT = hero.skill.duration ?? 0;
      hero.skill.use(this.ctx, p);
      this.rules.emit('onSkill', p);
      this.fx.push({ t: 'sfx', id: 'skill' });
    }
    // --- armure
    p.sinceHit += dt;
    if (m.armorRegen && p.sinceHit > 3.5 * m.armorDelay && p.armor < this.maxArmor(p)) {
      p.armorAcc += dt * m.armorRate * 1.3;
      if (p.armorAcc >= 1) { p.armorAcc -= 1; p.armor++; this.fx.push({ t: 'sfx', id: 'armorup', vol: 0.3 }); }
    }
  }

  private updatePickups(dt: number): void {
    const ps = this.pickups;
    for (const k of ps) {
      k.age += dt;
      const p = this.nearestPlayer(k.x, k.y);
      if (p && k.age > 0.25) {
        const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy) || 1;
        const full = k.kind === 'hp' && p.hp >= this.maxHp(p);
        const range = 30 * p.mods.pickupRange * (k.kind === 'coin' ? p.mods.coinMagnet : 1);
        if (!full && (d < range || this.vacuum > 0)) {
          const pull = this.vacuum > 0 ? 520 : 380;
          k.vx += (dx / d) * pull * dt; k.vy += (dy / d) * pull * dt;
          const sp = Math.hypot(k.vx, k.vy), max = 260;
          if (sp > max) { k.vx *= max / sp; k.vy *= max / sp; }
        }
        if (d < 9 && !full) {
          const ev = { kind: k.kind, amount: k.amount, player: p, cancel: false };
          this.rules.emit('onPickup', ev);
          if (!ev.cancel) {
            k.dead = true;
            if (k.kind === 'coin') { this.coins += Math.round(ev.amount); this.fx.push({ t: 'sfx', id: 'coin', vol: 0.4 }); }
            else if (k.kind === 'energy') { this.ctx.addEnergy(p, ev.amount); this.fx.push({ t: 'sfx', id: 'orb', vol: 0.3 }); }
            else if (k.kind === 'hp') { this.heal(p, ev.amount); this.fx.push({ t: 'sfx', id: 'heal' }); }
            else if (k.kind === 'gem') {
              let g = ev.amount * this.mods.gemMult;
              g = Math.floor(g) + (this.rng.loot.chance(g % 1) ? 1 : 0);
              this.gems += g; this.fx.push({ t: 'sfx', id: 'gem' });
              this.fx.push({ t: 'text', x: p.x, y: p.y - 14, s: '+' + g, color: 0xc070ff });
            }
          }
        }
      }
      const damp = Math.exp(-5 * dt);
      k.vx *= damp; k.vy *= damp;
      const nx = k.x + k.vx * dt, ny = k.y + k.vy * dt;
      if (!this.solid(nx, k.y)) k.x = nx; else k.vx = -k.vx * 0.5;
      if (!this.solid(k.x, ny)) k.y = ny; else k.vy = -k.vy * 0.5;
    }
    let n = 0;
    for (let i = 0; i < ps.length; i++) if (!ps[i].dead) ps[n++] = ps[i];
    ps.length = n;
  }

  private updatePets(dt: number): void {
    for (const pet of this.pets) {
      const o = pet.owner;
      if (o.downed) continue;
      const gx = o.x - o.facing * 14, gy = o.y + 8;
      const dx = gx - pet.x, dy = gy - pet.y, d = Math.hypot(dx, dy);
      if (d > 160) { pet.x = gx; pet.y = gy; }
      else if (d > 6) {
        const sp = Math.min(d * 5, (pet.def.speed ?? 110) * (d > 60 ? 1.6 : 1));
        const nx = pet.x + (dx / d) * sp * dt, ny = pet.y + (dy / d) * sp * dt;
        if (!this.solid(nx, pet.y)) pet.x = nx;
        if (!this.solid(pet.x, ny)) pet.y = ny;
        if (Math.abs(dx) > 1) pet.facing = dx > 0 ? 1 : -1;
      }
      pet.cd -= dt;
      const atk = pet.def.attack;
      if (atk && pet.cd <= 0 && this.mode === 'run') {
        const e = this.nearestEnemy(pet.x, pet.y, atk.range);
        if (e && this.los(pet.x, pet.y, e.x, e.y)) {
          pet.cd = atk.cooldown;
          pet.facing = e.x > pet.x ? 1 : -1;
          this.ctx.spawnBullet(atk.bullet, pet.x, pet.y, Math.atan2(e.y - pet.y, e.x - pet.x), 'player', o);
          this.fx.push({ t: 'sfx', id: atk.sfx ?? 'pet', vol: 0.35 });
        }
      }
      pet.def.onUpdate?.(this.ctx, pet, dt);
    }
  }
}
