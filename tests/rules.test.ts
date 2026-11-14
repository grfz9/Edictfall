import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeWorld } from './helpers';
import { ModStack, baseMods, clampMods } from '../src/core/mods';
import { R, allRules, allSynergies } from '../src/core/registry';
import { PAL } from '../src/render/palette';
import type { ModifierDef, Mods, Player, Enemy, ChestEvent, FloorPlan, RuleOfferEvent } from '../src/core/types';
import type { World } from '../src/sim/world';

const fake = (d: Partial<ModifierDef> & { id: string }): ModifierDef => ({ name: d.id, desc: '', icon: 'ic_boom', kind: 'rule', ...d }) as ModifierDef;
const temp: string[] = [];
const register = (d: ModifierDef) => { R.mods.set(d.id, d); temp.push(d.id); return d; };
afterEach(() => { for (const id of temp.splice(0)) R.mods.delete(id); vi.restoreAllMocks(); });

function freshStack(): { w: World; s: ModStack } {
  const w = makeWorld('ENGINE');
  return { w, s: new ModStack(() => w.ctx) };
}
/** Monde prêt à simuler : choix fondateur écarté, aucune règle. */
function ready(seed = 'BEHAV'): World {
  const w = makeWorld(seed);
  w.choice = null;
  return w;
}
const step = (w: World, n = 1) => { for (let i = 0; i < n; i++) { w.update(1 / 60); w.fx.length = 0; } };
const enemyId = (w: World) => w.enemyPool()[0].id;

// =========================================================================== moteur
describe('ModStack : moteur de règles', () => {
  it('ordre : priorité croissante, puis ordre d\'acquisition', () => {
    const { s } = freshStack();
    const log: string[] = [];
    const mk = (id: string, priority?: number) => fake({ id, priority, modify: () => { log.push(id); } });
    s.add(mk('b', 100)); s.add(mk('a', 50)); s.add(mk('c', 100)); s.add(mk('m', 900)); s.add(mk('d'));
    s.apply(baseMods());
    expect(log).toEqual(['a', 'b', 'c', 'd', 'm']);
    expect(s.order().map((i) => i.def.id)).toEqual(['a', 'b', 'c', 'd', 'm']);
  });

  it('cumul : stacks jusqu\'à maxStacks, puis refus ; power = stacks', () => {
    const { s } = freshStack();
    const d = fake({ id: 'stacky', maxStacks: 3, modify: (m, _c, self) => { m.damage *= 1 + self.power; } });
    expect(s.add(d)?.stacks).toBe(1);
    expect(s.add(d)?.stacks).toBe(2);
    expect(s.add(d)?.stacks).toBe(3);
    expect(s.add(d)).toBeNull();
    expect(s.get('stacky')!.power).toBe(3);
    expect(s.apply(baseMods()).damage).toBe(4);
    const single = fake({ id: 'single' });
    expect(s.add(single)).not.toBeNull();
    expect(s.add(single)).toBeNull();
    expect(s.add('id_inconnu')).toBeNull();
  });

  it('modifyPower : une méta transforme la puissance des autres (pas des autres métas), bornée à [0, 8]', () => {
    const { s } = freshStack();
    const plain = fake({ id: 'plain', maxStacks: 3 });
    s.add(plain);
    s.add(fake({ id: 'amp', priority: 900, modifyPower: (_c, _t, p) => p * 1.5 }));
    s.add(fake({ id: 'amp2', priority: 901, modifyPower: (_c, _t, p) => p * 10 }));
    expect(s.get('plain')!.power).toBe(8); // 1 × 1.5 × 10 = 15 → 8
    expect(s.get('amp')!.power).toBe(1);
    expect(s.get('amp2')!.power).toBe(1);
    s.remove('amp2');
    expect(s.get('plain')!.power).toBe(1.5);
    s.add(plain);
    expect(s.get('plain')!.power).toBe(3);
    s.add(fake({ id: 'nan', priority: 902, modifyPower: () => NaN }));
    expect(s.get('plain')!.power).toBe(3); // NaN ignoré
  });

  it('emit : événements mutables transmis dans l\'ordre, onAcquire/onRemove/onRuleAcquired', () => {
    const { s } = freshStack();
    const seen: string[] = [];
    s.add(fake({ id: 'second', priority: 120, onDamage: (_c, ev) => { seen.push('second:' + ev.amount); ev.amount *= 10; } }));
    s.add(fake({ id: 'first', priority: 10, onDamage: (_c, ev) => { seen.push('first:' + ev.amount); ev.amount += 1; } }));
    s.add(fake({ id: 'canceller', priority: 150, onDamage: (_c, ev) => { if (ev.amount > 15) ev.cancel = true; } }));
    const ev: any = { amount: 1, crit: false, source: null, target: null, cause: 'rule' };
    s.emit('onDamage', ev);
    expect(seen).toEqual(['first:1', 'second:2']);
    expect(ev.amount).toBe(20);
    expect(ev.cancel).toBe(true);

    const life: string[] = [];
    s.add(fake({ id: 'watcher', onRuleAcquired: (_c, inst) => life.push('acq:' + inst.def.id) }));
    s.add(fake({ id: 'life', onAcquire: () => life.push('on'), onRemove: () => life.push('off') }));
    s.remove('life');
    expect(life).toEqual(['on', 'acq:life', 'off']);
    expect(s.remove('life')).toBe(false);
  });

  it('isolation : une règle qui plante est journalisée puis mise en sourdine après 3 erreurs ; les autres continuent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { s } = freshStack();
    let ok = 0;
    s.add(fake({ id: 'boom', priority: 1, onTick: () => { throw new Error('bug'); }, modify: () => { throw new Error('bug'); } }));
    s.add(fake({ id: 'fine', onTick: () => { ok++; } }));
    s.emit('onTick', 1 / 60);
    s.emit('onTick', 1 / 60);
    expect(s.get('boom')!.muted).toBe(false);
    const m = s.apply(baseMods());
    expect(m.damage).toBe(1);
    expect(s.get('boom')!.muted).toBe(true);
    s.emit('onTick', 1 / 60);
    expect(s.errors.filter((e) => e.id === 'boom')).toHaveLength(3);
    expect(s.errors.every((e) => e.id === 'boom')).toBe(true);
    expect(ok).toBe(3);
  });

  it('synergies : activées quand les règles requises sont réunies, retirées si l\'une disparaît', () => {
    const { w, s } = freshStack();
    register(fake({ id: 'zz_a' }));
    register(fake({ id: 'zz_b' }));
    register(fake({ id: 'zz_c' }));
    register(fake({ id: 'zz_syn', kind: 'synergy', requires: ['zz_a', 'zz_b'], modify: (m) => { m.damage *= 2; } }));
    register(fake({ id: 'zz_syn3', kind: 'synergy', requires: ['zz_a', 'zz_b', 'zz_c'] }));
    s.add('zz_a');
    expect(s.has('zz_syn')).toBe(false);
    s.add('zz_b');
    expect(s.has('zz_syn')).toBe(true);
    expect(s.has('zz_syn3')).toBe(false);
    expect(w.save.seenSynergies).toContain('zz_syn');
    expect(s.apply(baseMods()).damage).toBe(2);
    s.add('zz_c');
    expect(s.has('zz_syn3')).toBe(true);
    s.remove('zz_b');
    expect(s.has('zz_syn')).toBe(false);
    expect(s.has('zz_syn3')).toBe(false);
    expect(s.apply(baseMods()).damage).toBe(1);
    s.add('zz_b');
    expect(s.has('zz_syn')).toBe(true);
  });

  it('clampMods : toute combinaison reste dans des bornes jouables, NaN/Infinity neutralisés', () => {
    const m = baseMods();
    m.speed = 99; m.damage = -3; m.fireRate = NaN; m.bulletBounce = 2.6; m.maxWeapons = 0; m.enemyCount = 50; m.timeScale = 0;
    m.zoom = Infinity; m.bulletCount = 99; m.enemyScale = 0.01; m.dmgTaken = 0; m.mimicChance = 7;
    clampMods(m);
    expect(m.speed).toBe(2.5);
    expect(m.damage).toBe(0.1);
    expect(m.fireRate).toBe(0.2);
    expect(m.bulletBounce).toBe(3);
    expect(m.maxWeapons).toBe(1);
    expect(m.enemyCount).toBe(3);
    expect(m.timeScale).toBe(0.1);
    expect(m.zoom).toBe(0.6); // non fini → borne basse
    expect(m.bulletCount).toBe(6);
    expect(m.enemyScale).toBe(0.45);
    expect(m.dmgTaken).toBe(0.25);
    expect(m.mimicChance).toBe(1);
    const base = clampMods(baseMods());
    expect(base).toEqual(baseMods());
  });

  it('excludes : world.eligibleRules() écarte les règles contradictoires dans les deux sens et les règles au max', () => {
    const w = ready();
    register(fake({ id: 'zz_x', excludes: ['zz_y'] }));
    register(fake({ id: 'zz_y' }));
    register(fake({ id: 'zz_once' }));
    const ids = () => w.eligibleRules().map((d) => d.id);
    expect(ids()).toEqual(expect.arrayContaining(['zz_x', 'zz_y', 'zz_once']));
    w.rules.add('zz_y');
    expect(ids()).not.toContain('zz_x');
    w.rules.remove('zz_y');
    w.rules.add('zz_x');
    expect(ids()).not.toContain('zz_y');
    w.rules.add('zz_once');
    expect(ids()).not.toContain('zz_once');
    // contenu réel
    const w2 = ready();
    w2.rules.add('sole_legend');
    expect(w2.eligibleRules().map((d) => d.id)).not.toContain('wide_arsenal');
    const w3 = ready();
    w3.rules.add('wide_arsenal');
    expect(w3.eligibleRules().map((d) => d.id)).not.toContain('sole_legend');
  });
});

// =========================================================================== contenu
describe('contenu : règles et synergies', () => {
  const rules = allRules();
  const syns = allSynergies();
  const cats = ['weapons', 'hero', 'enemies', 'rooms', 'visual', 'economy', 'meta'] as const;

  it('au moins 44 règles, au moins 5 par catégorie, trois saveurs', () => {
    expect(rules.length).toBeGreaterThanOrEqual(44);
    for (const c of cats) expect(rules.filter((r) => r.category === c).length, c).toBeGreaterThanOrEqual(5);
    expect(rules.filter((r) => r.category === 'meta').length).toBeGreaterThanOrEqual(6);
    for (const f of ['boon', 'curse', 'mixed']) expect(rules.some((r) => r.flavor === f)).toBe(true);
    expect(rules.filter((r) => (r.maxStacks ?? 1) >= 2).length).toBeGreaterThanOrEqual(8);
  });

  it('métadonnées complètes, ids uniques en snake_case, noms uniques', () => {
    const all = [...rules, ...syns];
    const ids = all.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(rules.map((r) => r.name)).size).toBe(rules.length);
    for (const r of all) {
      expect(r.id).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/);
      expect(r.name.length, r.id).toBeGreaterThan(2);
      expect(r.name.length, r.id).toBeLessThanOrEqual(24);
      expect(r.desc.length, r.id).toBeGreaterThan(20);
      expect(r.icon, r.id).toMatch(/^ic_/);
    }
    for (const r of rules) {
      expect(cats, r.id).toContain(r.category);
      expect(['boon', 'curse', 'mixed'], r.id).toContain(r.flavor);
      for (const x of r.excludes ?? []) expect(R.mods.get(x)?.kind, `${r.id} exclut ${x}`).toBe('rule');
    }
  });

  it('au moins 10 synergies dont tous les requires existent', () => {
    expect(syns.length).toBeGreaterThanOrEqual(10);
    for (const s of syns) {
      expect(s.requires?.length ?? 0, s.id).toBeGreaterThanOrEqual(2);
      for (const r of s.requires!) expect(R.mods.get(r)?.kind, `${s.id} requiert ${r}`).toBe('rule');
      // les règles requises ne s'excluent pas entre elles
      for (const a of s.requires!) for (const b of s.requires!) expect(R.mods.get(a)!.excludes ?? [], s.id).not.toContain(b);
    }
  });

  it('icônes : existantes, 10×10, lignes de même largeur, caractères dans la palette', () => {
    for (const r of [...rules, ...syns]) {
      const sp = R.sprites.get(r.icon);
      expect(sp, r.icon).toBeDefined();
      expect(sp!.px.length, r.icon).toBe(10);
      for (const row of sp!.px) {
        expect(row.length, r.icon).toBe(10);
        for (const ch of row) expect(ch === '.' || ch === ' ' || ch in PAL || ch in (sp!.pal ?? {}), `${r.icon} : '${ch}'`).toBe(true);
      }
    }
  });

  it('tous les synergies s\'activent dans un vrai monde', () => {
    for (const syn of syns) {
      const w = ready('SYN');
      for (const r of syn.requires!) w.rules.add(r);
      expect(w.rules.has(syn.id), syn.id).toBe(true);
    }
  });
});

// =========================================================================== règles obligatoires
describe('comportement des règles obligatoires', () => {
  it('volatile_dead : un ennemi tué explose et blesse ses voisins', () => {
    const w = ready();
    w.rules.add('volatile_dead');
    const p = w.players[0];
    const a = w.ctx.spawnEnemy(enemyId(w), p.x + 60, p.y, { delay: 0 })!;
    const b = w.ctx.spawnEnemy(enemyId(w), p.x + 70, p.y, { delay: 0 })!;
    const hp = b.hp;
    w.killEnemy(a);
    expect(b.dead || b.hp < hp).toBe(true);
  });

  it('rubber_walls : +2 rebonds, et les murs blessent', () => {
    const w = ready();
    w.rules.add('rubber_walls');
    step(w);
    const p = w.players[0];
    expect(p.mods.bulletBounce).toBeGreaterThanOrEqual(2);
    expect(p.mods.wallDamage).toBeGreaterThanOrEqual(1);
    const b = w.ctx.spawnBullet({ damage: 5 }, p.x, p.y, 0, 'player', p)!;
    expect(b.bounces).toBeGreaterThanOrEqual(2);
    // le joueur fonce dans un mur : il perd armure ou PV
    const st = w.floor.start;
    p.x = (st.x + 1.5) * 16; p.y = (st.y + 1.5) * 16;
    const before = p.hp + p.armor;
    for (let i = 0; i < 240 && p.hp + p.armor === before; i++) { p.input = { ...p.input, mx: -1, my: -1 }; step(w); }
    expect(p.hp + p.armor).toBeLessThan(before);
  });

  it('endless_energy : énergie infinie, armure figée', () => {
    const w = ready();
    w.rules.add('endless_energy');
    step(w);
    const p = w.players[0];
    expect(p.mods.energyInfinite).toBe(true);
    expect(p.mods.armorRegen).toBe(false);
    p.armor = 0; p.sinceHit = 10;
    step(w, 300);
    expect(p.armor).toBe(0);
  });

  it('sole_legend : armes légendaires, une seule portée', () => {
    const w = ready();
    const p = w.players[0];
    w.rules.add('sole_legend');
    expect(p.weapons[0].rarity).toBe(4);
    step(w);
    const other = [...R.weapons.values()].find((d) => d.id !== p.weapons[0].def.id && d.unlock === undefined)!;
    w.ctx.giveWeapon(p, other.id);
    step(w, 2);
    expect(p.weapons).toHaveLength(1);
    expect(p.weapons[0].rarity).toBe(4);
    expect(p.mods.maxWeapons).toBe(1);
  });

  it('copycats : les ennemis copient le dernier tir, version assainie (1 dégât, vitesse raisonnable, sans callback)', () => {
    const w = ready();
    w.rules.add('copycats');
    const p = w.players[0];
    const e = w.ctx.spawnEnemy(enemyId(w), p.x + 50, p.y, { delay: 0 })!;
    e.attacks = []; e.atkCd = [];
    p.lastShot = [{ kind: 'beam', damage: 999, speed: 2000, life: 9, radius: 30, onHit: () => { throw new Error('callback copié'); }, onTick: () => {}, onEnd: () => {}, explode: { radius: 99 }, split: { count: 9, spec: {} }, homing: 50, pierce: 9, bounces: 9 }];
    e.data.copyT = 0.01;
    step(w, 2);
    const copies = w.bullets.filter((b) => b.team === 'enemy' && b.owner === e);
    expect(copies.length).toBeGreaterThan(0);
    for (const b of copies) {
      expect(b.damage).toBe(1);
      expect(b.kind).toBe('shot');
      expect(Math.hypot(b.vx, b.vy)).toBeLessThanOrEqual(115 * w.mods.enemyBulletSpeed + 1);
      expect(b.onHit).toBeUndefined();
      expect(b.onTick).toBeUndefined();
      expect(b.onEnd).toBeUndefined();
      expect(b.explode).toBeUndefined();
      expect(b.split).toBeUndefined();
      expect(b.homing ?? 0).toBe(0);
      expect(b.radius).toBeLessThanOrEqual(4.5);
    }
    expect(w.rules.errors).toEqual([]);
  });

  it('hourglass_still : le temps ralentit à l\'arrêt, accélère en mouvement', () => {
    const w = ready();
    w.rules.add('hourglass_still');
    const p = w.players[0];
    p.still = 1;
    expect(w.rules.apply(baseMods()).timeScale).toBeLessThan(0.6);
    p.still = 0;
    expect(w.rules.apply(baseMods()).timeScale).toBeGreaterThan(1);
  });

  it('toothy_chests : mimics possibles, et leur butin est enrichi', () => {
    const w = ready();
    w.rules.add('toothy_chests');
    step(w);
    expect(w.mods.mimicChance).toBeGreaterThan(0.25);
    const ev: ChestEvent = { chest: { id: 1, x: 0, y: 0, kind: 'supply', opened: true, dead: false }, player: w.players[0], mimic: true, loot: [{ t: 'coin', n: 3 }] };
    w.rules.emit('onChestOpen', ev);
    expect(ev.loot.length).toBeGreaterThanOrEqual(3);
    expect(ev.loot.some((l) => l.t === 'gem')).toBe(true);
    const plain: ChestEvent = { ...ev, mimic: false, loot: [] };
    w.rules.emit('onChestOpen', plain);
    expect(plain.loot).toEqual([]);
  });

  it('golden_gravity : pièces aimantées… et balles ennemies aussi', () => {
    const w = ready();
    w.rules.add('golden_gravity');
    step(w);
    expect(w.mods.coinMagnet).toBeGreaterThan(3);
    expect(w.mods.bulletMagnet).toBeGreaterThan(0);
    // une balle ennemie qui passe à côté dévie vers le joueur
    const p = w.players[0];
    const b = w.ctx.spawnBullet({ damage: 1, speed: 80, life: 3 }, p.x - 80, p.y - 40, 0, 'enemy', null)!;
    step(w, 20);
    expect(b.vy).toBeGreaterThan(0);
  });

  it('tiny_horde : ennemis minuscules, deux fois plus nombreux, moitié moins de PV', () => {
    const w = ready();
    const p = w.players[0];
    const ref = w.ctx.spawnEnemy(enemyId(w), p.x + 40, p.y, { delay: 0 })!;
    w.rules.add('tiny_horde');
    step(w);
    expect(w.mods.enemyScale).toBeLessThan(0.6);
    expect(w.mods.enemyCount).toBe(2);
    expect(w.mods.enemyHp).toBeLessThanOrEqual(0.5);
    const e = w.ctx.spawnEnemy(enemyId(w), p.x + 40, p.y, { delay: 0 })!;
    expect(e.scale).toBeLessThan(ref.scale);
    expect(e.maxHp).toBeLessThan(ref.maxHp);
  });
});

// =========================================================================== quelques autres règles
describe('autres règles : effets ciblés', () => {
  it('labyrinth / whispering_walls modifient le plan d\'étage', () => {
    const w = ready();
    w.rules.add('labyrinth'); w.rules.add('whispering_walls');
    const plan: FloorPlan = { world: 1, floor: 1, combat: 3, specials: ['chest'], end: 'exit' };
    w.rules.emit('onFloorPlan', plan);
    expect(plan.combat).toBe(4);
    expect(plan.specials).toContain('secret');
    expect(plan.specials.filter((s) => s === 'chest')).toHaveLength(2);
  });

  it('abundance / double_edict modifient les offres', () => {
    const w = ready();
    w.rules.add('abundance'); w.rules.add('double_edict');
    const ev: RuleOfferEvent = { count: 3, choices: [], picks: 1 };
    w.rules.emit('onRuleOffer', ev);
    expect(ev.count).toBeGreaterThanOrEqual(4);
    expect(ev.picks).toBe(2);
    w.offerRules();
    expect(w.choice!.options.length).toBeGreaterThanOrEqual(4);
    expect(w.choice!.picks).toBe(2);
  });

  it('amplifier multiplie la puissance des autres règles par 1,5 ; extremism double bénédictions et malédictions', () => {
    const w = ready();
    w.rules.add('copycats'); w.rules.add('frenzy'); w.rules.add('amplifier');
    expect(w.rules.get('copycats')!.power).toBe(1.5);
    w.rules.add('extremism');
    expect(w.rules.get('copycats')!.power).toBe(3);
    expect(w.rules.get('frenzy')!.power).toBe(1.5);
    expect(w.rules.has('overload')).toBe(true);
  });

  it('echo empile la règle suivante deux fois', () => {
    const w = ready();
    w.rules.add('echo');
    w.rules.add('heavy_caliber');
    expect(w.rules.get('heavy_caliber')!.stacks).toBe(2);
    w.rules.add('piercing_faith');
    expect(w.rules.get('piercing_faith')!.stacks).toBe(1);
  });

  it('mutation remplace une règle au début de l\'étage', () => {
    const w = ready();
    w.rules.add('mutation'); w.rules.add('frenzy');
    w.rules.emit('onFloorStart');
    expect(w.rules.has('frenzy')).toBe(false);
    expect(w.rules.ofKind('rule').filter((i) => i.def.category !== 'meta').length).toBe(1);
    expect(w.rules.errors).toEqual([]);
  });

  it('amnesia efface les autres règles et récompense', () => {
    const w = ready();
    w.rules.add('frenzy'); w.rules.add('heavy_caliber'); w.rules.add('heavy_caliber');
    w.rules.add('amnesia');
    expect(w.rules.ofKind('rule').map((i) => i.def.id)).toEqual(['amnesia']);
    expect(w.rules.get('amnesia')!.state.n).toBe(3);
    expect(w.rules.apply(baseMods()).maxHp).toBe(3);
  });

  it('dice_roll donne deux règles de plus', () => {
    const w = ready();
    w.rules.add('dice_roll');
    expect(w.rules.ofKind('rule').length).toBe(3);
  });

  it('blood_market : achats gratuits en or, payés en PV sans jamais tuer', () => {
    const w = ready();
    w.rules.add('blood_market');
    step(w);
    expect(w.mods.shopPrice).toBe(0);
    const p = w.players[0];
    p.hp = 2;
    w.items.push({ id: 99991, kind: 'shopitem', x: p.x, y: p.y, sprite: 'pk_hp', label: 'x', loot: { t: 'weapon', id: 'x' }, dead: true });
    step(w);
    expect(p.hp).toBe(1);
    expect(p.downed).toBe(false);
  });
});

// =========================================================================== robustesse
describe('robustesse des hooks', () => {
  it('aucun hook ne lève d\'exception sans salle, sans ennemi, à la main', () => {
    const w = ready('NULLROOM');
    for (const r of allRules()) w.rules.add(r);
    w.curRoom = null;
    w.enemies = [];
    const p = w.players[0];
    const room = w.floor.rooms[0];
    const e = { id: 1, def: { id: 'ghost', world: 1, hp: 1 }, team: 'enemy', x: 0, y: 0, scale: 1, radius: 5, data: {}, status: {}, dead: true } as unknown as Enemy;
    const r = w.rules;
    r.emit('onTick', 1 / 60);
    r.emit('onRoomEnter', room);
    r.emit('onRoomClear', room);
    r.emit('onFloorStart');
    r.emit('onFloorPlan', { world: 1, floor: 5, combat: 1, specials: [], end: 'boss' });
    r.emit('onEnemySpawn', e);
    r.emit('onEnemyDeath', e);
    r.emit('onSkill', p);
    r.emit('onPickup', { kind: 'coin', amount: 3, player: p });
    r.emit('onPickup', { kind: 'hp', amount: 1, player: p });
    r.emit('onChestOpen', { chest: { id: 1, x: 0, y: 0, kind: 'big', opened: true, dead: false }, player: p, mimic: true, loot: [] });
    r.emit('onRuleOffer', { count: 3, choices: [], picks: 1 });
    r.emit('onShoot', { player: p, weapon: p.weapons[0], angle: 0, specs: [], chargeMult: 1 });
    r.emit('onDealDamage', { amount: 5, crit: false, source: null, target: e, cause: 'rule' });
    r.emit('onDamage', { amount: 1, crit: false, source: null, target: p, cause: 'rule' });
    r.emit('onPlayerDeath', { player: p });
    r.apply(baseMods());
    const draw = { circle() {}, line() {}, rect() {} };
    for (const inst of r.list) inst.def.render?.(w.ctx, draw, inst);
    expect(r.errors).toEqual([]);
  });

  it('dans le hall, toutes les règles tournent sans erreur', () => {
    const w = makeWorld('HUB');
    w.startHub();
    for (const r of allRules()) w.rules.add(r);
    for (let i = 0; i < 300; i++) { w.update(1 / 60); w.fx.length = 0; }
    expect(w.rules.errors).toEqual([]);
  });

  it('en coop (2 joueurs), un lot de règles tourne sans erreur', async () => {
    const { botInput } = await import('../src/sim/bot');
    const w = makeWorld('COOP');
    const h = w.players[0].hero.id;
    w.startRun('COOP', [h, h]);
    w.choice = null;
    for (const id of ['copycats', 'hourglass_still', 'reflex_parry', 'blood_market', 'golden_balm', 'ooze_trail', 'trapped_doors', 'turncoats', 'last_breath', 'adrenaline', 'mutation', 'rear_guard']) w.rules.add(id);
    for (let i = 0; i < 60 * 25 && w.mode === 'run'; i++) {
      if (w.choice) { w.pick(0); continue; }
      for (const p of w.players) { p.hp = w.maxHp(p); p.input = botInput(w, p); }
      w.update(1 / 60); w.fx.length = 0;
    }
    expect(w.rules.errors).toEqual([]);
    for (const p of w.players as Player[]) { expect(Number.isFinite(p.x)).toBe(true); expect(Number.isFinite(p.y)).toBe(true); }
  });

  it('Mods finis après application de toutes les règles', () => {
    const w = ready();
    for (const r of allRules()) w.rules.add(r);
    const m = clampMods(w.rules.apply(baseMods())) as Mods;
    for (const [k, v] of Object.entries(m)) if (typeof v === 'number') expect(Number.isFinite(v), k).toBe(true);
  });
});
