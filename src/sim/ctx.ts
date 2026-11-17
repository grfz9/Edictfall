// Ctx : l'API que reçoivent TOUS les scripts de contenu (règles, armes, ennemis, héros, patterns).
// C'est la seule surface dont le contenu a besoin ; elle ne dépend ni du rendu ni du DOM.
import type { BulletSpec, Bullet, Enemy, Player, Team, StatusKind, PickupKind, ModifierDef, Room, Mods, WeaponInst, Interactable, Entity, Dialog, RunMode } from '../core/types';
import type { Rng } from '../core/rng';
import type { ModStack } from '../core/mods';
import { spawnBullet, explode, damageEnemy, damagePlayer, addStatus, makeWeapon } from './combat';
import { spawnEnemy, type SpawnOpts } from './enemies';
import type { World } from './world';
import { T, TILE, tileAt } from './dungeon';

/** Pacte : effet persistant pour la run (marchés de Wassim, salles spéciales…), appliqué à chaque frame. */
export interface Pact {
  id: string;
  name: string;
  desc: string;
  modify?: (m: Mods, ctx: Ctx) => void;
}

export class Ctx {
  constructor(public world: World) {}

  // ---------------------------------------------------------------- lecture
  get players(): Player[] { return this.world.players; }
  /** Joueur principal (le premier encore debout). */
  get player(): Player { return this.world.lead(); }
  get enemies(): Enemy[] { return this.world.enemies; }
  get bullets(): Bullet[] { return this.world.bullets; }
  /** Salle courante (la dernière où le joueur est entré). */
  get room(): Room | null { return this.world.curRoom; }
  /** RNG de combat (déterministe). Ne jamais utiliser Math.random(). */
  get rng(): Rng { return this.world.rng.combat; }
  /** RNG dédié au butin. */
  get lootRng(): Rng { return this.world.rng.loot; }
  /** Temps de jeu écoulé dans la run (s). */
  get time(): number { return this.world.time; }
  /** Mods globaux de la frame (lecture seule ; pour modifier : hook modify). */
  get mods(): Mods { return this.world.mods; }
  get rules(): ModStack { return this.world.rules; }
  get coins(): number { return this.world.coins; }
  /** Numéro de monde (1-3), d'étage (1-5), et profondeur totale 0-14 (+15 par boucle). */
  get worldNum(): number { return this.world.worldNum; }
  get floorNum(): number { return this.world.floorNum; }
  get depth(): number { return this.world.depth(); }
  hasRule(id: string): boolean { return this.world.rules.has(id); }
  /** Puissance d'une règle active (0 si absente). */
  power(id: string): number { return this.world.rules.get(id)?.power ?? 0; }

  // ---------------------------------------------------------------- balles & dégâts
  /** Crée une balle. angle = direction (rad) ; spec.angle s'y ajoute. Retourne null si le plafond est atteint. */
  spawnBullet(spec: BulletSpec, x: number, y: number, angle: number, team: Team, owner: Player | Enemy | null = null): Bullet | null {
    return spawnBullet(this.world, spec, x, y, angle, team, owner);
  }
  /** Explosion : blesse le camp opposé à `team` dans le rayon. Pour team 'enemy', damage est en PV joueur (1-3). */
  explode(x: number, y: number, radius: number, damage: number, team: Team = 'player', opts: { status?: { kind: StatusKind; dur: number }; owner?: Player | Enemy | null; silent?: boolean } = {}): void {
    explode(this.world, x, y, radius, damage, team, opts);
  }
  damageEnemy(e: Enemy, amount: number, opts: { crit?: boolean; source?: any; cause?: string } = {}): void {
    damageEnemy(this.world, e, amount, opts);
  }
  /** Blesse un joueur (amount en PV entiers). cause 'rule' ignore l'invulnérabilité. Retourne true si touché. */
  damagePlayer(p: Player, amount: number, cause = 'rule', source: any = null): boolean {
    return damagePlayer(this.world, p, amount, cause, source);
  }
  killEnemy(e: Enemy): void { if (!e.dead) this.world.killEnemy(e); }
  /** Retire un ennemi sans le tuer : pas de butin, pas de onDeath, pas de hook onEnemyDeath (invocations alliées qui expirent…). */
  despawnEnemy(e: Enemy): void { if (e.dead) return; e.dead = true; this.burst(e.x, e.y, 0xc0b0ff, 8, 50, 0.35); }
  addStatus(target: Entity, kind: StatusKind, dur: number): void { addStatus(this.world, target, kind, dur); }
  heal(p: Player, n: number): void { this.world.heal(p, n); }
  addArmor(p: Player, n: number): void { p.armor = Math.min(this.world.maxArmor(p), p.armor + n); }
  addEnergy(p: Player, n: number): void { p.energy = Math.max(0, Math.min(this.world.maxEnergy(p), p.energy + n)); }
  addCoins(n: number): void { this.world.coins = Math.max(0, this.world.coins + Math.round(n)); }
  addGems(n: number): void { this.world.gems = Math.max(0, this.world.gems + Math.round(n)); }
  maxHp(p: Player): number { return this.world.maxHp(p); }
  maxArmor(p: Player): number { return this.world.maxArmor(p); }
  maxEnergy(p: Player): number { return this.world.maxEnergy(p); }

  // ---------------------------------------------------------------- entités
  spawnEnemy(id: string, x: number, y: number, opts: SpawnOpts = {}): Enemy | null { return spawnEnemy(this.world, id, x, y, opts); }
  spawnPickup(kind: PickupKind, x: number, y: number, amount = 1): void { this.world.spawnPickup(kind, x, y, amount); }
  /** Pose une arme au sol. */
  dropWeapon(id: string, x: number, y: number, rarity?: number): Interactable | null {
    const wi = makeWeapon(this.world, id, rarity);
    return wi ? this.world.dropWeapon(wi, x, y) : null;
  }
  /** Id d'arme aléatoire du pool débloqué (rareté tirée selon la profondeur + bonus). */
  randomWeaponId(rarityBonus = 0): string { return this.world.rollWeapon(rarityBonus); }
  /** Donne directement une arme au joueur (remplace l'arme en main si plein). */
  giveWeapon(p: Player, id: string, rarity?: number): WeaponInst | null {
    const wi = makeWeapon(this.world, id, rarity);
    if (wi) this.world.equip(p, wi);
    return wi;
  }
  spawnChest(x: number, y: number, kind: 'weapon' | 'supply' | 'big' = 'supply'): void { this.world.spawnChest(x, y, kind); }
  /** Ajoute un modificateur (règle/passif) par id. */
  addModifier(id: string): boolean { return !!this.world.rules.add(id); }
  removeModifier(id: string): boolean { return this.world.rules.remove(id); }

  // ---------------------------------------------------------------- requêtes spatiales
  nearestEnemy(x: number, y: number, range = 9999): Enemy | null { return this.world.nearestEnemy(x, y, range); }
  nearestPlayer(x: number, y: number): Player | null { return this.world.nearestPlayer(x, y); }
  enemiesIn(x: number, y: number, radius: number): Enemy[] {
    return this.world.enemies.filter((e) => !e.dead && e.spawnT <= 0 && Math.hypot(e.x - x, e.y - y) < radius + e.radius * e.scale);
  }
  /** Mur ou vide à cette position (px) ? */
  isSolid(x: number, y: number): boolean { return this.world.solid(x, y); }
  /** Type de tuile à cette position (px) : comparer avec T (sim/dungeon) — T.SLICK, T.HAZARD… */
  tileAt(x: number, y: number): number { return tileAt(this.world.floor, Math.floor(x / TILE), Math.floor(y / TILE)); }
  isSlick(x: number, y: number): boolean { return this.tileAt(x, y) === T.SLICK; }
  isHazard(x: number, y: number): boolean { return this.tileAt(x, y) === T.HAZARD; }
  /** Un cercle de rayon r tient-il ici ? */
  isFree(x: number, y: number, r = 5): boolean { return this.world.isFree(x, y, r); }
  /** Ligne de vue dégagée ? */
  los(x0: number, y0: number, x1: number, y1: number): boolean { return this.world.los(x0, y0, x1, y1); }
  /** Position libre aléatoire dans la salle (courante par défaut), à au moins minDist des joueurs. */
  freeSpot(room: Room | null = this.world.curRoom, minDist = 0): { x: number; y: number } { return this.world.freeSpot(room, minDist); }

  // ---------------------------------------------------------------- temps
  /** Exécute fn après delay secondes. Si owner est donné et meurt entre-temps, fn est annulée. */
  after(delay: number, fn: () => void, owner: Entity | null = null): void {
    this.world.timers.push({ t: delay, fn, owner });
  }
  /** Gèle la simulation un court instant (impact). */
  hitstop(sec: number): void { this.world.hitstop = Math.max(this.world.hitstop, Math.min(0.3, sec)); }

  // ---------------------------------------------------------------- effets (visuels / sons)
  shake(a: number): void { this.world.fx.push({ t: 'shake', a }); }
  burst(x: number, y: number, color: number, n = 6, speed = 60, life = 0.35, size = 1): void { this.world.fx.push({ t: 'burst', x, y, color, n, speed, life, size }); }
  text(x: number, y: number, s: string, color = 0xffffff, big = false): void { this.world.fx.push({ t: 'text', x, y, s, color, big }); }
  sfx(id: string, vol = 1): void { this.world.fx.push({ t: 'sfx', id, vol }); }
  flash(color: number, a = 0.3): void { this.world.fx.push({ t: 'flash', color, a }); }
  ring(x: number, y: number, r: number, color: number): void { this.world.fx.push({ t: 'ring', x, y, r, color }); }
  banner(title: string, sub?: string, color?: string): void { this.world.fx.push({ t: 'banner', title, sub, color }); }

  // ---------------------------------------------------------------- modes, PNJ, pactes
  /** Mode de la run en cours. */
  get mode(): RunMode { return this.world.runMode; }
  /** Ajoute un pacte (effet permanent pour la run ; même id = remplacé). */
  addPact(p: Pact): void { this.world.addPact(p); }
  hasPact(id: string): boolean { return this.world.pacts.some((p) => p.id === id); }
  /** Donne un édit (règle) comme si on l'avait choisi. */
  grantRule(id: string): boolean { const d = this.world.reg.mods.get(id); if (!d) return false; const n = this.world.rules.list.length; this.world.takeMod(d); return this.world.rules.list.length > n || this.world.rules.has(id); }
  /** Offre un choix d'édit supplémentaire. */
  offerRules(title?: string, sub?: string): void { this.world.offerRules(title, sub); }
  /** Crée une instance d'arme sans l'équiper. */
  makeWeapon(id: string, rarity?: number): WeaponInst | null { return makeWeapon(this.world, id, rarity); }
  /** Change le héros d'un joueur (garde armes, PV en proportion). */
  swapHero(p: Player, heroId: string): boolean { return this.world.swapHero(p, heroId); }
  /** Passe à l'étage suivant (après un court délai). */
  skipFloor(): void { this.after(0.6, () => { if (this.world.mode === 'run') this.world.nextFloor(); }); }
  /** Bulle de dialogue au-dessus d'une entité ou d'un point. */
  say(target: { x: number; y: number }, text: string, dur = 3): void { this.world.say(target, text, dur); }
  /** Ouvre la boîte de dialogue (met la simulation en pause). */
  dialog(d: Dialog): void { this.world.openDialog(d); }

  /** Appelé par le moteur quand une synergie s'active. */
  onSynergy(def: ModifierDef): void {
    const w = this.world;
    if (!w.save.seenSynergies.includes(def.id)) w.save.seenSynergies.push(def.id);
    w.fx.push({ t: 'banner', title: 'SYNERGIE : ' + def.name, sub: def.desc, color: '#ffd23a' });
    w.fx.push({ t: 'sfx', id: 'synergy' });
    w.fx.push({ t: 'flash', color: 0xffd23a, a: 0.25 });
  }
}
