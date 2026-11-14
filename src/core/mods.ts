// Moteur de modificateurs : règles (édits), passifs et synergies partagent ce pipeline.
import type { Mods, ModInst, ModifierDef, Hooks } from './types';
import { R } from './registry';
import type { Ctx } from '../sim/ctx';

export function baseMods(): Mods {
  return {
    maxHp: 0, maxArmor: 0, maxEnergy: 0, speed: 1, damage: 1, fireRate: 1, crit: 0, critMult: 2,
    energyCost: 1, energyInfinite: false, armorRegen: true, armorDelay: 1, armorRate: 1, dmgTaken: 1,
    invulnTime: 1, skillCd: 1, pickupRange: 1, lifeSteal: 0, meleeDamage: 1, playerScale: 1,
    bulletSpeed: 1, bulletSize: 1, bulletBounce: 0, bulletPierce: 0, bulletHoming: 0, bulletCount: 0,
    bulletSpread: 1, bulletRange: 1,
    maxWeapons: 2, forceRarity: -1, weaponRarityBonus: 0,
    enemyHp: 1, enemySpeed: 1, enemyDamage: 1, enemyCount: 1, enemyScale: 1, enemyBulletSpeed: 1,
    enemyFireRate: 1, eliteChance: 0,
    coinMult: 1, coinMagnet: 1, shopPrice: 1, energyDrop: 1, gemMult: 1, mimicChance: 0,
    chestRarityBonus: 0, healMult: 1,
    timeScale: 1, wallDamage: 0, bulletMagnet: 0, explosionSize: 1,
    zoom: 1, darkness: 0, mirror: false, grayscale: 0, tint: 0xffffff, shake: 1,
    flags: {},
  };
}

const clamp = (v: number, a: number, b: number) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a);

/** Garde-fous : quelles que soient les combinaisons de règles, le jeu reste jouable et stable. */
export function clampMods(m: Mods): Mods {
  m.speed = clamp(m.speed, 0.35, 2.5);
  m.damage = clamp(m.damage, 0.1, 20);
  m.fireRate = clamp(m.fireRate, 0.2, 6);
  m.crit = clamp(m.crit, -1, 1);
  m.critMult = clamp(m.critMult, 1, 10);
  m.energyCost = clamp(m.energyCost, 0, 5);
  m.armorDelay = clamp(m.armorDelay, 0.1, 5);
  m.armorRate = clamp(m.armorRate, 0.1, 8);
  m.dmgTaken = clamp(m.dmgTaken, 0.25, 5);
  m.invulnTime = clamp(m.invulnTime, 0.2, 4);
  m.skillCd = clamp(m.skillCd, 0.15, 4);
  m.pickupRange = clamp(m.pickupRange, 0.3, 20);
  m.lifeSteal = clamp(m.lifeSteal, 0, 1);
  m.meleeDamage = clamp(m.meleeDamage, 0.1, 20);
  m.playerScale = clamp(m.playerScale, 0.5, 2);
  m.bulletSpeed = clamp(m.bulletSpeed, 0.3, 3);
  m.bulletSize = clamp(m.bulletSize, 0.4, 4);
  m.bulletBounce = clamp(Math.round(m.bulletBounce), 0, 6);
  m.bulletPierce = clamp(Math.round(m.bulletPierce), 0, 10);
  m.bulletHoming = clamp(m.bulletHoming, 0, 12);
  m.bulletCount = clamp(Math.round(m.bulletCount), -1, 6);
  m.bulletSpread = clamp(m.bulletSpread, 0, 4);
  m.bulletRange = clamp(m.bulletRange, 0.3, 4);
  m.maxWeapons = clamp(Math.round(m.maxWeapons), 1, 4);
  m.forceRarity = clamp(Math.round(m.forceRarity), -1, 4);
  m.enemyHp = clamp(m.enemyHp, 0.2, 10);
  m.enemySpeed = clamp(m.enemySpeed, 0.3, 2.5);
  m.enemyDamage = clamp(m.enemyDamage, 0.25, 5);
  m.enemyCount = clamp(m.enemyCount, 0.4, 3);
  m.enemyScale = clamp(m.enemyScale, 0.45, 2.2);
  m.enemyBulletSpeed = clamp(m.enemyBulletSpeed, 0.3, 2.5);
  m.enemyFireRate = clamp(m.enemyFireRate, 0.3, 3);
  m.eliteChance = clamp(m.eliteChance, 0, 1);
  m.coinMult = clamp(m.coinMult, 0, 10);
  m.coinMagnet = clamp(m.coinMagnet, 0, 40);
  m.shopPrice = clamp(m.shopPrice, 0, 5);
  m.energyDrop = clamp(m.energyDrop, 0, 6);
  m.gemMult = clamp(m.gemMult, 0, 10);
  m.mimicChance = clamp(m.mimicChance, 0, 1);
  m.healMult = clamp(m.healMult, 0, 5);
  m.timeScale = clamp(m.timeScale, 0.1, 2.5);
  m.wallDamage = clamp(m.wallDamage, 0, 5);
  m.bulletMagnet = clamp(m.bulletMagnet, -400, 400);
  m.explosionSize = clamp(m.explosionSize, 0.3, 3);
  m.zoom = clamp(m.zoom, 0.6, 1.6);
  m.darkness = clamp(m.darkness, 0, 400);
  m.grayscale = clamp(m.grayscale, 0, 1);
  m.shake = clamp(m.shake, 0, 4);
  return m;
}

type EventHook = Exclude<keyof Hooks, 'modify' | 'modifyPower' | 'render'>;

export class ModStack {
  list: ModInst[] = [];
  private sorted: ModInst[] | null = null;
  private counter = 0;
  /** Journal des erreurs de hooks (pour les tests). */
  errors: { id: string; hook: string; error: unknown }[] = [];
  constructor(private getCtx: () => Ctx) {}

  has(id: string): boolean {
    return this.list.some((i) => i.def.id === id);
  }
  get(id: string): ModInst | undefined {
    return this.list.find((i) => i.def.id === id);
  }
  ofKind(kind: ModifierDef['kind']): ModInst[] {
    return this.order().filter((i) => i.def.kind === kind);
  }
  /** Instances triées : priorité croissante puis ordre d'acquisition. */
  order(): ModInst[] {
    if (!this.sorted) {
      this.sorted = [...this.list].sort((a, b) => (a.def.priority ?? 100) - (b.def.priority ?? 100) || a.order - b.order);
    }
    return this.sorted;
  }

  /** Ajoute (ou empile) un modificateur. Retourne l'instance, ou null si l'id est inconnu / au max. */
  add(defOrId: ModifierDef | string, silent = false): ModInst | null {
    const def = typeof defOrId === 'string' ? R.mods.get(defOrId) : defOrId;
    if (!def) return null;
    let inst = this.get(def.id);
    if (inst) {
      if (inst.stacks >= (def.maxStacks ?? 1)) return null;
      inst.stacks++;
    } else {
      inst = { def, stacks: 1, power: 1, order: this.counter++, state: {}, muted: false };
      this.list.push(inst);
      this.sorted = null;
    }
    this.recomputePower();
    this.call(inst, 'onAcquire', undefined);
    if (def.kind !== 'synergy') {
      for (const other of this.order()) if (other !== inst) this.call(other, 'onRuleAcquired', inst);
    }
    this.recomputePower();
    this.checkSynergies(silent);
    return inst;
  }

  remove(id: string): boolean {
    const inst = this.get(id);
    if (!inst) return false;
    this.call(inst, 'onRemove', undefined);
    this.list = this.list.filter((i) => i !== inst);
    this.sorted = null;
    // les synergies qui dépendaient de cette règle tombent
    for (const s of [...this.list]) {
      if (s.def.kind === 'synergy' && s.def.requires?.some((r) => !this.has(r))) this.remove(s.def.id);
    }
    this.recomputePower();
    return true;
  }

  private checkSynergies(silent: boolean): void {
    for (const def of R.mods.values()) {
      if (def.kind !== 'synergy' || this.has(def.id) || !def.requires?.length) continue;
      if (def.requires.every((r) => this.has(r))) {
        this.add(def, silent);
        if (!silent) this.getCtx().onSynergy(def);
      }
    }
  }

  /** power = stacks, puis chaque règle méta (dans l'ordre) peut la transformer. */
  recomputePower(): void {
    const ctx = this.getCtx();
    const ord = this.order();
    for (const inst of ord) inst.power = inst.stacks;
    for (const meta of ord) {
      const fn = meta.def.modifyPower;
      if (!fn || meta.muted) continue;
      for (const target of ord) {
        if (target === meta || target.def.modifyPower) continue; // une méta ne modifie pas une autre méta de puissance
        try {
          const p = fn(ctx, target, target.power, meta);
          if (Number.isFinite(p)) target.power = Math.min(8, Math.max(0, p));
        } catch (error) {
          this.fail(meta, 'modifyPower', error);
        }
      }
    }
  }

  /** Construit les Mods globaux de la frame. */
  apply(m: Mods): Mods {
    const ctx = this.getCtx();
    for (const inst of this.order()) {
      const fn = inst.def.modify;
      if (!fn || inst.muted) continue;
      try {
        fn(m, ctx, inst);
      } catch (error) {
        this.fail(inst, 'modify', error);
      }
    }
    return m;
  }

  /** Diffuse un événement à toutes les instances, dans l'ordre. `arg` est l'événement mutable. */
  emit(hook: EventHook, arg?: any): void {
    const ord = this.order();
    for (let i = 0; i < ord.length; i++) this.call(ord[i], hook, arg);
  }

  private call(inst: ModInst, hook: EventHook, arg: any): void {
    const fn = inst.def[hook] as any;
    if (!fn || inst.muted) return;
    try {
      if (arg === undefined) fn(this.getCtx(), inst);
      else fn(this.getCtx(), arg, inst);
    } catch (error) {
      this.fail(inst, hook, error);
    }
  }

  private fail(inst: ModInst, hook: string, error: unknown): void {
    this.errors.push({ id: inst.def.id, hook, error });
    console.error(`[mods] ${inst.def.id}.${hook} a levé une exception`, error);
    // Une règle qui plante trois fois est mise en sourdine pour protéger la run.
    if (this.errors.filter((e) => e.id === inst.def.id).length >= 3) inst.muted = true;
  }
}
