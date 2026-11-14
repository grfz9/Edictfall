// Édits « héros » : le corps, la vie, l'armure, l'énergie, la compétence.
import { defineRule } from '../../core/registry';
import { icon, pw, alivePlayers, inRun } from './_kit';

defineRule({
  id: 'endless_energy', name: 'Source intarissable', category: 'hero', flavor: 'mixed', priority: 200, excludes: ['last_breath'],
  desc: 'Ton énergie est infinie, mais ton armure ne se recharge plus jamais toute seule.',
  icon: icon('ic_endless_energy', 'bolt', 'b', 'B', 'c'),
  modify: (m) => {
    m.energyInfinite = true;
    m.armorRegen = false;
  },
});

defineRule({
  id: 'hourglass_still', name: 'Sablier immobile', category: 'hero', flavor: 'mixed',
  desc: 'Quand tu restes immobile, les ennemis et leurs balles ralentissent de moitié ; quand tu bouges, ils vont 10 % plus vite.',
  icon: icon('ic_hourglass_still', 'hourglass', 'y', 'N'),
  modify: (m, ctx, s) => {
    if (!inRun(ctx)) return;
    const ps = alivePlayers(ctx);
    if (!ps.length) return;
    if (ps.every((p) => p.still > 0.15)) m.timeScale *= Math.max(0.2, Math.pow(0.5, Math.min(2, pw(s, 2))));
    else m.timeScale *= 1.1;
  },
});

defineRule({
  id: 'iron_skin', name: 'Peau de fer', category: 'hero', flavor: 'mixed', excludes: ['glass_cannon'],
  desc: 'Tu perds 3 PV max mais gagnes 6 points d\'armure max, qui se rechargent 50 % plus vite.',
  icon: icon('ic_iron_skin', 'shield', 'a', 'A'),
  modify: (m, _c, s) => {
    m.maxHp -= 3;
    m.maxArmor += Math.round(6 * Math.min(1.5, pw(s, 2)));
    m.armorRate *= 1.5;
  },
});

defineRule({
  id: 'glass_cannon', name: 'Canon de verre', category: 'hero', flavor: 'mixed', excludes: ['iron_skin'],
  desc: 'Tu infliges 60 % de dégâts en plus, mais tu perds 2 PV max.',
  icon: icon('ic_glass_cannon', 'gem', 'i', 'I'),
  modify: (m, _c, s) => {
    m.damage *= 1 + 0.6 * pw(s, 3);
    m.maxHp -= 2;
  },
});

defineRule({
  id: 'cold_blood', name: 'Sang-froid', category: 'hero', flavor: 'mixed',
  desc: 'Ta compétence se recharge 50 % plus lentement, mais chaque ennemi tué en retire 0,8 seconde.',
  icon: icon('ic_cold_blood', 'drop', 'b', 'B', 'c'),
  modify: (m) => { m.skillCd *= 1.5; },
  onEnemyDeath: (ctx, e, s) => {
    if (e.charmed) return;
    const cut = 0.8 * Math.min(2.5, pw(s, 3));
    for (const p of ctx.players) p.skillCd = Math.max(0, p.skillCd - cut);
  },
});

defineRule({
  id: 'adrenaline', name: 'Adrénaline', category: 'hero', flavor: 'boon', weight: 0.8,
  desc: 'Tant que tu as la moitié de tes PV ou moins, tu cours 25 % et tires 35 % plus vite.',
  icon: icon('ic_adrenaline', 'heart', 'r', 'R'),
  modify: (m, ctx, s) => {
    const p = ctx.players.find((q) => !q.downed);
    if (!p || p.maxHp <= 0 || p.hp > p.maxHp / 2) return;
    const k = Math.min(2, pw(s, 2));
    m.speed *= 1 + 0.25 * k;
    m.fireRate *= 1 + 0.35 * k;
  },
});

defineRule({
  id: 'ghost_step', name: 'Pas fantôme', category: 'hero', flavor: 'boon', weight: 0.7, maxStacks: 2,
  desc: 'Tu restes invulnérable 50 % plus longtemps après un coup et tu marches 6 % plus vite.',
  icon: icon('ic_ghost_step', 'moon', 'i', 'I'),
  modify: (m, _c, s) => {
    const k = pw(s, 3);
    m.invulnTime *= Math.pow(1.5, k);
    m.speed *= 1 + 0.06 * k;
  },
});

defineRule({
  id: 'blood_thirst', name: 'Soif rouge', category: 'hero', flavor: 'mixed',
  desc: 'Chaque ennemi tué a 6 % de chances de te rendre 1 PV, mais les cœurs ramassés ne soignent plus.',
  icon: icon('ic_blood_thirst', 'drop', 'r', 'R'),
  modify: (m, _c, s) => { m.lifeSteal += 0.06 * pw(s, 3); },
  onPickup: (_ctx, ev) => {
    if (ev.kind === 'hp') ev.amount = 0;
  },
});

defineRule({
  id: 'storm_skill', name: 'Compétence-tempête', category: 'hero', flavor: 'boon', weight: 0.8,
  desc: 'Ta compétence se recharge 15 % plus vite et libère un anneau de 12 projectiles autour de toi.',
  icon: icon('ic_storm_skill', 'swirl', 'p', 'P', 'c'),
  modify: (m) => { m.skillCd *= 0.85; },
  onSkill: (ctx, p, s) => {
    const n = ctx.mods.flags.tempest ? 24 : 12;
    const dmg = (8 + 2 * ctx.depth) * Math.min(2, Math.sqrt(pw(s, 4)));
    for (let i = 0; i < n; i++) {
      ctx.spawnBullet({ damage: dmg, speed: 200, life: 0.8, radius: 3, sprite: 'b_energy', pierce: 1 }, p.x, p.y, (i / n) * Math.PI * 2, 'player', p);
    }
    ctx.ring(p.x, p.y, 30, 0xc070ff);
  },
});
