// ============================================================================
// EDICTFALL — Contrats de données. Tout le contenu du jeu implémente ces types.
// Unités : pixels (1 tuile = 16 px), secondes, radians. PV joueur ~6, armure ~5,
// énergie ~180. Dégâts d'armes joueur 2-40. PV ennemis 8-120, boss 500-1600.
// Dégâts des ennemis sur le joueur : 1 à 4 (entiers).
// ============================================================================
import type { Ctx } from '../sim/ctx';

export type Team = 'player' | 'enemy';
export type Rarity = 0 | 1 | 2 | 3 | 4; // blanc, vert, bleu, violet, orange
export type StatusKind = 'burn' | 'poison' | 'freeze' | 'shock' | 'slow';

// ------------------------------------------------------------------ Sprites
/** Sprite ASCII. Chaque caractère = 1 pixel, '.' ou ' ' = transparent.
 *  Les lettres pointent vers la palette partagée (render/palette.ts), surchargée par `pal`. */
export interface SpriteDef {
  id: string;
  px: string[];
  /** Frames d'animation supplémentaires (même taille que px). */
  frames?: string[][];
  pal?: Record<string, string>;
  /** Couleur du contour auto 1px (défaut '#1b1326'). false = pas de contour. */
  outline?: string | false;
  /** Point d'origine en pixels (défaut : centre). Pour les armes : la poignée. */
  ox?: number;
  oy?: number;
}

// ------------------------------------------------------------------ Balles
export interface BulletSpec {
  /** shot = projectile ; slash = coup de mêlée en arc ; beam = rayon instantané ; lob = tir en cloche vers (tx,ty) */
  kind?: 'shot' | 'slash' | 'beam' | 'lob';
  sprite?: string;
  /** Teinte (0xRRGGBB) du sprite / couleur du rayon ou du slash. */
  color?: number;
  damage: number;
  speed?: number; // px/s (shot)
  life?: number; // s
  radius?: number; // px (hitbox)
  scale?: number; // échelle visuelle
  /** Décalage angulaire relatif à la visée (posé par le moteur lors du tir, modifiable dans onShoot). */
  angle?: number;
  pierce?: number; // ennemis traversés
  bounces?: number; // rebonds sur les murs
  homing?: number; // rad/s
  accel?: number; // px/s²
  drag?: number; // fraction de vitesse perdue par seconde
  wave?: { amp: number; freq: number };
  /** Revient vers son tireur à mi-vie. */
  boomerang?: boolean;
  /** Traverse les murs. */
  ghost?: boolean;
  explode?: { radius: number; damage?: number; status?: { kind: StatusKind; dur: number } };
  /** Éclats créés à la fin de vie / à l'impact. */
  split?: { count: number; spec: Partial<BulletSpec>; spread?: number };
  status?: { kind: StatusKind; dur: number };
  knockback?: number;
  critChance?: number;
  critMult?: number;
  spin?: number; // rad/s (visuel)
  trail?: number; // couleur de traînée
  // slash
  arc?: number; // rad
  range?: number; // px
  reflect?: boolean; // renvoie les balles ennemies
  // beam
  width?: number;
  length?: number;
  // lob
  tx?: number;
  ty?: number;
  // callbacks (pour armes/ennemis scriptés)
  onHit?: (ctx: Ctx, b: Bullet, target: Enemy | Player) => void;
  onTick?: (ctx: Ctx, b: Bullet, dt: number) => void;
  onEnd?: (ctx: Ctx, b: Bullet) => void;
  /** Données libres. */
  data?: any;
}

export interface Bullet extends BulletSpec {
  id: number;
  team: Team;
  owner: Player | Enemy | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: number;
  age: number;
  life: number;
  radius: number;
  kind: 'shot' | 'slash' | 'beam' | 'lob';
  dead: boolean;
  hit: Set<number>;
  /** Profondeur de génération (éclats d'éclats…) pour borner les cascades. */
  gen: number;
  /** points du rayon (beam) : [x0,y0,x1,y1,...] */
  pts?: number[];
  sx: number;
  sy: number;
  weaponId?: string;
}

// ------------------------------------------------------------------ Armes
export type WeaponType = 'pistol' | 'rifle' | 'shotgun' | 'laser' | 'bow' | 'launcher' | 'sword' | 'spear' | 'staff' | 'weird';

export interface WeaponDef {
  id: string;
  name: string;
  desc?: string;
  rarity: Rarity;
  type: WeaponType;
  sprite: string;
  energy: number;
  /** Secondes entre deux tirs. */
  cooldown: number;
  damage: number;
  crit?: number; // chance (défaut 0.05)
  /** true (défaut) = tir continu en maintenant. */
  auto?: boolean;
  count?: number; // projectiles par tir
  spread?: number; // cône total (rad) réparti entre les projectiles
  jitter?: number; // imprécision aléatoire (rad)
  burst?: { count: number; interval: number };
  /** Arcs : maintenir pour charger. minMult = multiplicateur à charge nulle. */
  charge?: { time: number; minMult?: number };
  bullet: Partial<BulletSpec>;
  recoil?: number; // recul visuel de l'arme (px)
  kick?: number; // poussée du joueur (px/s)
  shake?: number;
  sfx?: string;
  casing?: boolean;
  muzzle?: number; // couleur du flash
  /** Script libre exécuté à chaque tir, après la construction de ev.specs. */
  onFire?: (ctx: Ctx, ev: ShootEvent) => void;
  /** Coût en gemmes pour ajouter l'arme au pool (absent = disponible d'office). */
  unlock?: number;
}

export interface WeaponInst {
  def: WeaponDef;
  cd: number;
  charge: number;
  burstLeft: number;
  burstT: number;
  rarity: Rarity;
  /** État libre propre à cette arme (chaleur, mode courant…). */
  data: any;
}

export interface ShootEvent {
  player: Player;
  weapon: WeaponInst;
  /** Angle de visée (rad). */
  angle: number;
  /** Projectiles qui vont être créés — mutable (ajouter, retirer, modifier). */
  specs: BulletSpec[];
  /** Multiplicateur de charge 0..1 (arcs). */
  chargeMult: number;
  cancel?: boolean;
}

// ------------------------------------------------------------------ Ennemis
export type MoveKind = 'chase' | 'keepDistance' | 'wander' | 'charge' | 'stationary' | 'teleport' | 'orbit' | 'flee' | 'hop' | 'zigzag';
export interface MoveSpec {
  kind: MoveKind;
  /** keepDistance/orbit : distance préférée. chase : distance d'arrêt. */
  range?: number;
  /** hop/charge/teleport : période (s). */
  period?: number;
  /** charge : multiplicateur de vitesse pendant la ruée ; durée dans `dur`. */
  mult?: number;
  dur?: number;
}
export interface AttackSpec {
  /** Nom d'un pattern enregistré (sim/patterns.ts). */
  pattern: string;
  cooldown: number;
  /** Délai avant la 1re utilisation (défaut : aléatoire dans [0.5, cooldown]). */
  first?: number;
  /** Portée max de déclenchement (px). */
  range?: number;
  /** Durée du flash d'annonce avant l'attaque (défaut 0.35 s). */
  telegraph?: number;
  /** Secondes d'immobilité pendant/après l'attaque. */
  stop?: number;
  weight?: number;
  /** Paramètres libres passés au pattern (count, speed, spread, damage, bullet, …). */
  params?: Record<string, any>;
}
export interface BossPhase {
  /** Phase active quand PV% <= hp (1 = dès le début). Lister par ordre décroissant. */
  hp: number;
  move?: MoveSpec;
  speed?: number;
  attacks: AttackSpec[];
  onEnter?: (ctx: Ctx, e: Enemy) => void;
  /** Apparence propre à cette phase (sprite, échelle visuelle, teinte 0xRRGGBB, aura colorée autour du boss). */
  sprite?: string;
  scale?: number;
  tint?: number;
  aura?: number;
}
export interface EnemyDef {
  id: string;
  name: string;
  /** 1 forêt, 2 glacier, 3 volcan ; 0 = hors pool (invocations, boss, spéciaux). */
  world: 0 | 1 | 2 | 3;
  sprite: string;
  hp: number;
  speed: number;
  radius?: number; // défaut 6
  /** Dégâts de contact (0 = aucun). */
  contact?: number;
  /** Coût dans le budget de vague (défaut 1). Les gros valent 2-4. */
  cost?: number;
  /** Étage minimum (1-5) dans son monde. */
  minFloor?: number;
  /** Poids de tirage dans les vagues (défaut 1 ; 0,25 pour les ids `elite_*`). Tirage ∝ weight / √cost. */
  weight?: number;
  move: MoveSpec;
  attacks?: AttackSpec[];
  /** Ignore les obstacles/murs intérieurs. */
  phasing?: boolean;
  knockbackResist?: number; // 0..1
  immune?: StatusKind[];
  coins?: [number, number];
  energy?: number; // orbes lâchés (défaut 1)
  scale?: number;
  onSpawn?: (ctx: Ctx, e: Enemy) => void;
  onUpdate?: (ctx: Ctx, e: Enemy, dt: number) => void;
  onDeath?: (ctx: Ctx, e: Enemy) => void;
  onHurt?: (ctx: Ctx, e: Enemy, ev: DamageEvent) => void;
  boss?: { title: string; phases: BossPhase[] };
  /** Ne peut pas devenir Gardien (mini-boss). */
  noChampion?: boolean;
}

export interface Entity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  /** Temps restant de flash blanc. */
  flash: number;
  status: Partial<Record<StatusKind, number>>;
  dead: boolean;
  /** Poussée externe (knockback) qui s'amortit. */
  kx: number;
  ky: number;
}

export interface Enemy extends Entity {
  def: EnemyDef;
  team: 'enemy';
  speed: number;
  damageMult: number;
  scale: number;
  facing: number; // -1 / 1
  /** Attaques et déplacement effectifs (copiés de la def ; changent avec les phases de boss). */
  attacks: AttackSpec[];
  move: MoveSpec;
  /** Chrono par attaque. */
  atkCd: number[];
  /** Annonce d'attaque en cours. */
  tele: number;
  teleAtk: number;
  stop: number;
  moveT: number;
  moveState: number;
  mx: number;
  my: number;
  phase: number;
  elite: boolean;
  champion: boolean;
  /** Vient d'une invocation (pas de loot, ne compte pas dans le budget). */
  summoned: boolean;
  /** Temps d'apparition restant (inactif tant que > 0). */
  spawnT: number;
  age: number;
  target: Player | null;
  /** Allié du joueur (règles/charmes). */
  charmed?: boolean;
  data: any;
}

// ------------------------------------------------------------------ Héros / joueur
export interface SkillDef {
  name: string;
  desc: string;
  cooldown: number;
  /** Durée d'activité (0 = instantané). */
  duration?: number;
  use: (ctx: Ctx, p: Player) => void;
  tick?: (ctx: Ctx, p: Player, dt: number) => void;
  end?: (ctx: Ctx, p: Player) => void;
  /** Modifie les Mods du joueur tant que la compétence est active. */
  modify?: (m: Mods, p: Player) => void;
}
export interface HeroDef {
  id: string;
  name: string;
  title: string;
  desc: string;
  sprite: string;
  hp: number;
  armor: number;
  energy: number;
  speed: number; // px/s (~95)
  crit?: number;
  weapon: string;
  /** Coût en gemmes (0 = débloqué). */
  cost: number;
  skill: SkillDef;
  /** Trait passif permanent. */
  modify?: (m: Mods, p: Player) => void;
}

export interface PlayerInput {
  mx: number;
  my: number; // direction de déplacement (-1..1)
  /** Direction de visée manuelle (vecteur non nul) ou null => visée auto. */
  ax: number;
  ay: number;
  aimManual: boolean;
  fire: boolean;
  firePressed: boolean;
  swap: boolean; // front montant
  interact: boolean; // front montant
  skill: boolean; // front montant
}

export interface Player extends Entity {
  team: 'player';
  index: number;
  hero: HeroDef;
  armor: number;
  energy: number;
  /** Mods effectifs de ce joueur (globaux + héros + compétence). */
  mods: Mods;
  weapons: WeaponInst[];
  cur: number;
  aim: number;
  facing: number;
  moving: boolean;
  /** Temps depuis le dernier dégât (recharge d'armure). */
  sinceHit: number;
  armorAcc: number;
  invuln: number;
  skillCd: number;
  skillT: number;
  recoil: number;
  swing: number;
  input: PlayerInput;
  /** Temps immobile (s). */
  still: number;
  downed: boolean;
  lastShot: BulletSpec[] | null;
  data: any;
}

// ------------------------------------------------------------------ Mods
/** Structure recalculée à chaque frame par tous les modificateurs actifs.
 *  Sauf mention contraire : *Mult = multiplicateur (défaut 1), *Add = additif (défaut 0). */
export interface Mods {
  // --- joueur
  maxHp: number; // additif
  maxArmor: number; // additif
  maxEnergy: number; // additif
  speed: number; // mult
  damage: number; // mult dégâts infligés
  fireRate: number; // mult cadence (2 = deux fois plus vite)
  crit: number; // additif chance
  critMult: number; // défaut 2
  energyCost: number; // mult
  energyInfinite: boolean;
  armorRegen: boolean; // false = l'armure ne se recharge plus
  armorDelay: number; // mult du délai avant recharge
  armorRate: number; // mult vitesse de recharge
  dmgTaken: number; // mult dégâts subis
  invulnTime: number; // mult durée d'invulnérabilité après coup
  skillCd: number; // mult recharge compétence
  pickupRange: number; // mult
  lifeSteal: number; // PV rendus par ennemi tué (probabilité 0..1)
  meleeDamage: number; // mult
  playerScale: number;
  // --- balles du joueur
  bulletSpeed: number;
  bulletSize: number;
  bulletBounce: number; // additif
  bulletPierce: number; // additif
  bulletHoming: number; // additif rad/s
  bulletCount: number; // projectiles supplémentaires par tir
  bulletSpread: number; // mult du cône
  bulletRange: number; // mult durée de vie
  // --- armes
  maxWeapons: number; // défaut 2
  forceRarity: number; // -1 = non ; sinon toute arme ramassée prend cette rareté
  weaponRarityBonus: number; // additif au tirage de rareté
  // --- ennemis
  enemyHp: number;
  enemySpeed: number;
  enemyDamage: number; // mult, arrondi, min 1
  enemyCount: number;
  enemyScale: number;
  enemyBulletSpeed: number;
  enemyFireRate: number;
  eliteChance: number; // additif
  // --- économie
  coinMult: number;
  coinMagnet: number; // mult du rayon d'attraction
  shopPrice: number;
  energyDrop: number; // mult orbes
  gemMult: number;
  mimicChance: number; // 0..1
  chestRarityBonus: number;
  healMult: number;
  // --- monde
  timeScale: number; // vitesse des ennemis et de leurs balles
  wallDamage: number; // dégâts quand le joueur touche un mur (0 = non)
  /** Le joueur ne subit pas les dégâts des tuiles dangereuses (T.HAZARD). Défaut false. */
  hazardImmune: boolean;
  bulletMagnet: number; // attraction des balles ennemies vers le joueur (px/s²)
  explosionSize: number;
  // --- visuel
  zoom: number; // mult
  darkness: number; // 0 = non ; sinon rayon de vision en px
  mirror: boolean;
  grayscale: number; // 0..1
  tint: number; // 0xRRGGBB, 0xffffff = aucun
  shake: number; // mult
  /** Extension libre pour règles (clé → valeur). Le moteur ne les lit pas. */
  flags: Record<string, number>;
}

// ------------------------------------------------------------------ Événements
export interface DamageEvent {
  /** Montant (mutable). Pour le joueur : entier après arrondi. */
  amount: number;
  crit: boolean;
  source: Bullet | Enemy | Player | null;
  target: Enemy | Player;
  /** 'bullet' | 'contact' | 'explosion' | 'status' | 'wall' | 'hazard' | 'rule' … */
  cause: string;
  cancel?: boolean;
  /** Ignore l'armure (joueur). */
  pierceArmor?: boolean;
}
export interface PickupEvent {
  kind: PickupKind;
  amount: number;
  player: Player;
  cancel?: boolean;
}
export interface ChestEvent {
  chest: Chest;
  player: Player;
  /** Devient un mimic si true (mutable). */
  mimic: boolean;
  /** Butin (mutable). */
  loot: Loot[];
}
export type Loot =
  | { t: 'weapon'; id: string; rarity?: Rarity }
  | { t: 'coin' | 'energy' | 'hp' | 'gem'; n: number }
  | { t: 'passive'; id: string };
export interface WallHitEvent {
  bullet: Bullet;
  /** Normale du mur. */
  nx: number;
  ny: number;
  /** true = un hook a géré l'impact (la balle survit). */
  handled?: boolean;
}
export interface FloorPlan {
  world: number;
  floor: number;
  /** Nombre de salles de combat sur le chemin principal. */
  combat: number;
  /** Salles spéciales en branches : 'chest' | 'shop' | 'statue' | 'secret' | 'combat'. */
  specials: string[];
  /** 'boss' | 'guardian' | 'exit' */
  end: string;
}
export interface RuleOfferEvent {
  /** Nombre de choix proposés (défaut 3). */
  count: number;
  choices: ModifierDef[];
  /** Nombre d'édits à prendre (défaut 1). */
  picks: number;
}

// ------------------------------------------------------------------ Modificateurs (règles / passifs / synergies)
export type RuleCategory = 'weapons' | 'hero' | 'enemies' | 'rooms' | 'visual' | 'economy' | 'meta';
export interface ModInst {
  def: ModifierDef;
  stacks: number;
  /** Puissance effective (stacks × effets méta). Utiliser pour doser les effets. */
  power: number;
  order: number;
  /** État privé de l'instance. */
  state: any;
  muted: boolean;
}
export interface Hooks {
  onAcquire?: (ctx: Ctx, self: ModInst) => void;
  onRemove?: (ctx: Ctx, self: ModInst) => void;
  modify?: (m: Mods, ctx: Ctx, self: ModInst) => void;
  onTick?: (ctx: Ctx, dt: number, self: ModInst) => void;
  onShoot?: (ctx: Ctx, ev: ShootEvent, self: ModInst) => void;
  /** Toute balle créée (les deux camps). */
  onBulletSpawn?: (ctx: Ctx, b: Bullet, self: ModInst) => void;
  onBulletHitWall?: (ctx: Ctx, ev: WallHitEvent, self: ModInst) => void;
  /** Une balle touche une cible (avant dégâts). */
  onBulletHit?: (ctx: Ctx, ev: { bullet: Bullet; target: Enemy | Player }, self: ModInst) => void;
  /** Le joueur inflige des dégâts à un ennemi. */
  onDealDamage?: (ctx: Ctx, ev: DamageEvent, self: ModInst) => void;
  /** Un joueur va subir des dégâts. */
  onDamage?: (ctx: Ctx, ev: DamageEvent, self: ModInst) => void;
  onEnemySpawn?: (ctx: Ctx, e: Enemy, self: ModInst) => void;
  onEnemyDeath?: (ctx: Ctx, e: Enemy, self: ModInst) => void;
  /** ev.cancel = true pour empêcher la mort (penser à rendre des PV). */
  onPlayerDeath?: (ctx: Ctx, ev: { player: Player; cancel?: boolean }, self: ModInst) => void;
  onRoomEnter?: (ctx: Ctx, room: Room, self: ModInst) => void;
  onRoomClear?: (ctx: Ctx, room: Room, self: ModInst) => void;
  onFloorPlan?: (ctx: Ctx, plan: FloorPlan, self: ModInst) => void;
  onFloorStart?: (ctx: Ctx, self: ModInst) => void;
  onChestOpen?: (ctx: Ctx, ev: ChestEvent, self: ModInst) => void;
  onPickup?: (ctx: Ctx, ev: PickupEvent, self: ModInst) => void;
  onWeaponPickup?: (ctx: Ctx, ev: { player: Player; weapon: WeaponInst }, self: ModInst) => void;
  onSkill?: (ctx: Ctx, p: Player, self: ModInst) => void;
  // --- méta
  onRuleOffer?: (ctx: Ctx, ev: RuleOfferEvent, self: ModInst) => void;
  onRuleAcquired?: (ctx: Ctx, inst: ModInst, self: ModInst) => void;
  /** Retourne la nouvelle puissance d'une AUTRE instance. */
  modifyPower?: (ctx: Ctx, target: ModInst, power: number, self: ModInst) => number;
  /** Dessin libre en coordonnées monde, par-dessus les entités. */
  render?: (ctx: Ctx, g: DrawAPI, self: ModInst) => void;
}
export interface ModifierDef extends Hooks {
  id: string;
  name: string;
  desc: string;
  /** id de sprite (≈ 10×10) pour l'icône. */
  icon: string;
  kind: 'rule' | 'passive' | 'synergy';
  category?: RuleCategory;
  flavor?: 'boon' | 'curse' | 'mixed';
  /** Ordre d'application (défaut 100). Voir PLAN.md. */
  priority?: number;
  /** Règles incompatibles : jamais proposées ensemble. */
  excludes?: string[];
  /** Synergie : ids des règles requises. */
  requires?: string[];
  /** Nombre de fois où on peut la reprendre (défaut 1). */
  maxStacks?: number;
  /** Poids de tirage (défaut 1). */
  weight?: number;
}
/** API de dessin immédiat pour le hook render (coordonnées monde). */
export interface DrawAPI {
  circle(x: number, y: number, r: number, color: number, alpha?: number, fill?: boolean): void;
  line(x0: number, y0: number, x1: number, y1: number, color: number, alpha?: number, width?: number): void;
  rect(x: number, y: number, w: number, h: number, color: number, alpha?: number): void;
}

// ------------------------------------------------------------------ Familiers / thèmes
export interface Pet {
  def: PetDef;
  x: number;
  y: number;
  cd: number;
  facing: number;
  owner: Player;
  data: any;
}
export interface PetDef {
  id: string;
  name: string;
  desc: string;
  sprite: string;
  cost: number;
  speed?: number;
  /** Attaque simple : tire `bullet` sur l'ennemi le plus proche à portée. */
  attack?: { cooldown: number; range: number; bullet: BulletSpec; sfx?: string };
  onUpdate?: (ctx: Ctx, pet: Pet, dt: number) => void;
}
export interface ThemeDef {
  world: number;
  name: string;
  /** Couleurs hex '#rrggbb'. */
  floor: [string, string, string];
  floorDeco: string; // couleur des petits détails du sol
  wallTop: string;
  wallTopLight: string;
  wallFace: string;
  wallFaceDark: string;
  voidColor: string;
  hazard: [string, string]; // tuile dangereuse (ronces / glace fine / lave)
  slick: [string, string]; // tuile glissante
  door: string;
  /** Couleur d'ambiance (teinte légère de l'écran). */
  ambient: number;
  /** Paramètres musicaux lus par audio/. */
  music: { bpm: number; root: number; scale: number[] };
  /** Proportion de tuiles : obstacles, hasard, glisse (0..1 indicatifs). */
  hazardRate: number;
  slickRate: number;
}

// ------------------------------------------------------------------ Monde : salles & objets
export type RoomType = 'start' | 'combat' | 'chest' | 'shop' | 'statue' | 'secret' | 'guardian' | 'boss' | 'hub' | 'special';
export interface Room {
  id: number;
  type: RoomType;
  cx: number;
  cy: number;
  /** Rectangle en tuiles, murs inclus. */
  x: number;
  y: number;
  w: number;
  h: number;
  state: 'fresh' | 'active' | 'cleared';
  locked: boolean;
  doors: { x: number; y: number }[];
  links: number[];
  /** Vue sur la minimap. */
  seen: boolean;
  visited: boolean;
  waves: number;
  wave: number;
  /** Fin du chemin principal (portail). */
  exit: boolean;
  hidden: boolean;
  data: any;
}
export type PickupKind = 'coin' | 'energy' | 'hp' | 'gem';
export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  amount: number;
  age: number;
  dead: boolean;
}
export interface Chest {
  id: number;
  x: number;
  y: number;
  /** 'weapon' | 'supply' | 'big' */
  kind: string;
  opened: boolean;
  dead: boolean;
}
/** Objet interactif générique (arme au sol, article de boutique, statue, portail, PNJ du hall…). */
export interface Interactable {
  id: number;
  kind: 'weapon' | 'shopitem' | 'statue' | 'portal' | 'hero' | 'npc' | 'altar';
  x: number;
  y: number;
  sprite: string;
  label: string;
  /** Sous-texte (prix, description). */
  sub?: string;
  price?: number;
  radius?: number;
  weapon?: WeaponInst;
  loot?: Loot;
  dead: boolean;
  /** Retourne false pour refuser (pas assez d'or…). */
  use?: (ctx: Ctx, p: Player, self: Interactable) => void | boolean;
  /** Déclenché automatiquement au contact (portail). */
  auto?: boolean;
  bob?: boolean;
  tint?: number;
  data?: any;
}
export interface Prop {
  id: number;
  kind: 'crate' | 'barrel';
  x: number;
  y: number;
  hp: number;
  radius: number;
  flash: number;
  dead: boolean;
}

/** Effets visuels/sonores émis par la simulation, consommés par render/ et audio/. */
export type Fx =
  | { t: 'shake'; a: number }
  | { t: 'burst'; x: number; y: number; color: number; n: number; speed?: number; life?: number; size?: number }
  | { t: 'text'; x: number; y: number; s: string; color: number; big?: boolean }
  | { t: 'sfx'; id: string; vol?: number }
  | { t: 'flash'; color: number; a: number }
  | { t: 'casing'; x: number; y: number; dir: number }
  | { t: 'ring'; x: number; y: number; r: number; color: number }
  | { t: 'banner'; title: string; sub?: string; color?: string }
  | { t: 'decal'; x: number; y: number; r: number; color: number }
  | { t: 'tiles' }; // la carte a changé (mur cassé) → re-rendu

export interface SaveData {
  v: number;
  gems: number;
  heroes: string[];
  weapons: string[];
  pets: string[];
  pet: string | null;
  hero: string;
  options: { autoAim: boolean; sfx: number; music: number; shake: number; touch: 'auto' | 'on' | 'off'; damageNumbers: boolean; lang?: string; showFps?: boolean };
  stats: { runs: number; wins: number; kills: number; best: string; bosses: number };
  seenRules: string[];
  seenSynergies: string[];
  /** Drapeaux divers (intro vue, salles spéciales découvertes…). */
  flags?: Record<string, any>;
  /** Records par mode de jeu. */
  records?: SaveRecords;
}

// ------------------------------------------------------------------ Modes de jeu
export type RunMode = 'story' | 'endless' | 'daily';
export interface RunRecord {
  score: number;
  /** Étage atteint (1 = premier). */
  stage: number;
  hero: string;
  kills: number;
  time: number;
}
export interface SaveRecords {
  endless?: RunRecord;
  /** Meilleur résultat du défi quotidien, par seed du jour. */
  daily?: { seed: string } & RunRecord;
  /** Nombre de défis quotidiens joués / terminés. */
  dailyPlayed?: number;
  dailyWon?: number;
  storyWins?: number;
}
/** Ligne de dialogue (boîte de dialogue avec portrait). */
export interface DialogLine {
  /** Nom affiché. */
  who: string;
  /** Sprite du portrait (id de sprite). */
  portrait?: string;
  text: string;
  /** Couleur du nom. */
  color?: string;
}
export interface DialogOption {
  label: string;
  sub?: string;
  /** Option « refus / retour » (B / Échap la choisit). */
  cancel?: boolean;
  act?: () => void;
}
export interface Dialog {
  lines: DialogLine[];
  /** Choix proposés après la dernière ligne (sinon : simple fermeture). */
  options?: DialogOption[];
  onClose?: () => void;
}
