// Synergies cachées : s'activent seules quand toutes les règles requises sont réunies (et tombent si l'une disparaît).
//
// | Synergie         | Règles requises                                   | Effet bonus                                                        |
// |------------------|---------------------------------------------------|--------------------------------------------------------------------|
// | chain_reaction   | volatile_dead + tiny_horde                        | explosions +30 % ; 40 % des morts lâchent un orbe d'énergie        |
// | ricochet_fury    | rubber_walls + rear_guard                         | chaque rebond multiplie les dégâts de la balle par 1,3 (max ×4)   |
// | frozen_spring    | hourglass_still + endless_energy                  | immobile : l'armure se recharge à nouveau (2× plus tôt), cadence +30 % |
// | mirror_parry     | reflex_parry + copycats                           | la parade réflexe se recharge en 1 s au lieu de 2                  |
// | gold_rush        | golden_gravity + compound_interest                | intérêts doublés (plafond doublé), aimant à pièces ×2              |
// | transfusion      | blood_market + golden_balm                        | chaque achat au marché du sang coûte 1 PV de moins                 |
// | david            | lilliput + heavy_caliber                          | +50 % de dégâts contre élites, gardiens et boss                    |
// | owl_eyes         | black_night + eagle_eye                           | rayon de vision dans le noir ×1,7, +5 % de critiques               |
// | noble_mimics     | aristocracy + toothy_chests                       | chaque mimic garde en plus une arme de rareté épique              |
// | fireworks        | volatile_dead + mitosis + tiny_horde              | chaque mort projette 6 éclats (plafonné à 6 gerbes / 0,5 s)        |
// | divine_weapon    | sole_legend + scatter_decree                      | +1 perforation et tête chercheuse légère                           |
// | tempest          | cold_blood + storm_skill                          | l'anneau de la compétence double (24) et la compétence rend 40 énergie |
// | overload         | amplifier + extremism                             | +20 % de dégâts, mais ennemis +10 % de PV                           |
// | swamp            | ooze_trail + mastodons                            | les flaques ralentissent les ennemis qui les traversent            |
import { defineSynergy } from '../../core/registry';
import { icon, pw, inRun, alivePlayers, tag } from './_kit';

defineSynergy({
  id: 'chain_reaction', name: 'Réaction en chaîne', requires: ['volatile_dead', 'tiny_horde'],
  desc: 'Les explosions sont 30 % plus larges et 40 % des morts lâchent un orbe d\'énergie.',
  icon: icon('ic_syn_chain_reaction', 'flame', 'o', 'V', 'y'),
  modify: (m) => { m.explosionSize *= 1.3; },
  onEnemyDeath: (ctx, e) => {
    if (inRun(ctx) && !e.charmed && ctx.rng.chance(0.4)) ctx.spawnPickup('energy', e.x, e.y, 4);
  },
});

defineSynergy({
  id: 'ricochet_fury', name: 'Furie des ricochets', requires: ['rubber_walls', 'rear_guard'],
  desc: 'Chaque rebond multiplie les dégâts de la balle par 1,3 (jusqu\'à ×4).',
  icon: icon('ic_syn_ricochet_fury', 'arrow', 'v', 'V', 'y'),
  onTick: (ctx) => {
    for (const b of ctx.bullets) {
      if (b.dead || b.team !== 'player' || b.kind !== 'shot') continue;
      const t = tag(b);
      const now = b.bounces ?? 0;
      if (t.bc === undefined) { t.bc = now; t.rf = 1; continue; }
      if (now < t.bc) {
        const mult = Math.min(Math.pow(1.3, t.bc - now), 4 / t.rf);
        t.rf *= mult;
        b.damage *= mult;
        if (t.sw !== undefined) t.sw *= mult; // compatible avec les balles gonflantes
      }
      t.bc = now;
    }
  },
});

defineSynergy({
  id: 'frozen_spring', name: 'Source gelée', requires: ['hourglass_still', 'endless_energy'], priority: 250,
  desc: 'Tant que tu restes immobile, ton armure se recharge à nouveau (deux fois plus tôt) et tu tires 30 % plus vite.',
  icon: icon('ic_syn_frozen_spring', 'hourglass', 'c', 'B'),
  modify: (m, ctx) => {
    const ps = alivePlayers(ctx);
    if (!inRun(ctx) || !ps.length || !ps.every((p) => p.still > 0.15)) return;
    m.armorRegen = true;
    m.armorDelay *= 0.5;
    m.fireRate *= 1.3;
  },
});

defineSynergy({
  id: 'mirror_parry', name: 'Parade miroir', requires: ['reflex_parry', 'copycats'],
  desc: 'Ta parade réflexe se recharge en 1 seconde au lieu de 2.',
  icon: icon('ic_syn_mirror_parry', 'shield', 'm', 'M', 'c'),
  modify: (m) => { m.flags.parryFast = 1; },
});

defineSynergy({
  id: 'gold_rush', name: 'Ruée vers l\'or', requires: ['golden_gravity', 'compound_interest'],
  desc: 'Tes intérêts sont doublés (plafond compris) et les pièces sont attirées deux fois plus loin.',
  icon: icon('ic_syn_gold_rush', 'coin', 'y', 'O', 'w'),
  modify: (m) => {
    m.flags.interestBoost = 1;
    m.coinMagnet *= 2;
  },
});

defineSynergy({
  id: 'transfusion', name: 'Transfusion', requires: ['blood_market', 'golden_balm'],
  desc: 'Chaque achat au marché du sang coûte 1 PV de moins.',
  icon: icon('ic_syn_transfusion', 'drop', 'r', 'y', 'w'),
  modify: (m) => { m.flags.bloodDiscount = 1; },
});

defineSynergy({
  id: 'david', name: 'Petit mais costaud', requires: ['lilliput', 'heavy_caliber'],
  desc: 'Tu infliges 50 % de dégâts en plus aux élites, gardiens et boss.',
  icon: icon('ic_syn_david', 'target', 's', 'S', 'r'),
  onDealDamage: (_ctx, ev, s) => {
    const e = ev.target as any;
    if (e && e.team === 'enemy' && (e.elite || e.champion || e.def?.boss)) ev.amount *= 1 + 0.5 * Math.min(2, pw(s, 2));
  },
});

defineSynergy({
  id: 'owl_eyes', name: 'Yeux de hibou', requires: ['black_night', 'eagle_eye'], priority: 300,
  desc: 'Dans le noir, tu vois 70 % plus loin et tu gagnes 5 % de coups critiques.',
  icon: icon('ic_syn_owl_eyes', 'eye', 'y', 'N'),
  modify: (m) => {
    if (m.darkness > 0) m.darkness *= 1.7;
    m.crit += 0.05;
  },
});

defineSynergy({
  id: 'noble_mimics', name: 'Mimics nobles', requires: ['aristocracy', 'toothy_chests'],
  desc: 'Chaque mimic garde en plus une arme de rareté épique.',
  icon: icon('ic_syn_noble_mimics', 'chest', 'p', 'P', 'y'),
  onChestOpen: (ctx, ev) => {
    if (!ev.mimic) return;
    const id = ctx.randomWeaponId(1.5);
    if (id) ev.loot.push({ t: 'weapon', id, rarity: 3 });
  },
});

defineSynergy({
  id: 'fireworks', name: 'Feu d\'artifice', requires: ['volatile_dead', 'mitosis', 'tiny_horde'],
  desc: 'Chaque ennemi tué projette 6 éclats brûlants autour de lui.',
  icon: icon('ic_syn_fireworks', 'star', 'm', 'p', 'y'),
  onTick: (ctx, dt, s) => {
    s.state.t = (s.state.t ?? 0) - dt;
    if (s.state.t <= 0) { s.state.t = 0.5; s.state.n = 0; }
  },
  onEnemyDeath: (ctx, e, s) => {
    if (!inRun(ctx) || e.charmed || (s.state.n ?? 0) >= 6 || ctx.bullets.length > 500) return;
    s.state.n = (s.state.n ?? 0) + 1;
    const p = ctx.player;
    for (let i = 0; i < 6; i++) {
      ctx.spawnBullet({ damage: 5 + ctx.depth, speed: 170, life: 0.45, radius: 2.5, sprite: 'b_small', color: 0xff9a30, status: { kind: 'burn', dur: 1.5 } }, e.x, e.y, (i / 6) * Math.PI * 2 + ctx.rng.range(0, 1), 'player', p ?? null);
    }
  },
});

defineSynergy({
  id: 'divine_weapon', name: 'Arme divine', requires: ['sole_legend', 'scatter_decree'],
  desc: 'Ton arme unique gagne +1 perforation et des balles légèrement chercheuses.',
  icon: icon('ic_syn_divine_weapon', 'sword', 'y', 'Y', 'w'),
  modify: (m) => {
    m.bulletPierce += 1;
    m.bulletHoming += 1.5;
  },
});

defineSynergy({
  id: 'tempest', name: 'Œil du cyclone', requires: ['cold_blood', 'storm_skill'],
  desc: 'L\'anneau de ta compétence double (24 projectiles) et chaque compétence te rend 40 points d\'énergie.',
  icon: icon('ic_syn_tempest', 'swirl', 'c', 'P', 'w'),
  modify: (m) => { m.flags.tempest = 1; },
  onSkill: (ctx, p) => { ctx.addEnergy(p, 40); },
});

defineSynergy({
  id: 'overload', name: 'Surtension', requires: ['amplifier', 'extremism'],
  desc: 'Tes dégâts augmentent de 20 %, mais les ennemis gagnent 10 % de PV.',
  icon: icon('ic_syn_overload', 'bolt', 'r', 'R', 'y'),
  modify: (m) => {
    m.damage *= 1.2;
    m.enemyHp *= 1.1;
  },
});

defineSynergy({
  id: 'swamp', name: 'Marécage', requires: ['ooze_trail', 'mastodons'],
  desc: 'Les flaques acides ralentissent les ennemis qui les traversent.',
  icon: icon('ic_syn_swamp', 'drop', 'f', 'F', 'l'),
  modify: (m) => { m.flags.swamp = 1; },
});
