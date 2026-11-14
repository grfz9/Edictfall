// Édits « armes » : changent la manière de tirer.
import { defineRule } from '../../core/registry';
import type { BulletSpec } from '../../core/types';
import { icon, pw, alivePlayers, inRun, tag } from './_kit';

defineRule({
  id: 'rubber_walls', name: 'Murs de caoutchouc', category: 'weapons', flavor: 'mixed',
  desc: 'Tes balles rebondissent 2 fois de plus sur les murs, mais heurter un mur en marchant te coûte 1 point de vie ou d\'armure.',
  icon: icon('ic_rubber_walls', 'arrow', 'g', 'G'),
  modify: (m, _c, s) => {
    m.bulletBounce += Math.round(2 * pw(s, 3));
    m.wallDamage = Math.max(m.wallDamage, 1);
  },
});

defineRule({
  id: 'sole_legend', name: 'Lame unique', category: 'weapons', flavor: 'mixed', priority: 200, excludes: ['wide_arsenal'],
  desc: 'Toute arme que tu portes ou ramasses devient légendaire, mais tu ne peux plus en porter qu\'une seule.',
  icon: icon('ic_sole_legend', 'sword', 'v', 'V', 'y'),
  onAcquire: (ctx) => {
    for (const p of ctx.players) for (const wi of p.weapons) if (wi.rarity < 4) wi.rarity = 4;
  },
  modify: (m) => {
    m.forceRarity = 4;
    m.maxWeapons = 1;
  },
});

defineRule({
  id: 'wide_arsenal', name: 'Ceinturon garni', category: 'weapons', flavor: 'mixed', priority: 200, excludes: ['sole_legend'],
  desc: 'Tu portes 3 armes au lieu de 2, mais tout ce fer te ralentit de 8 %.',
  icon: icon('ic_wide_arsenal', 'twin', 'a', 'N'),
  modify: (m) => {
    m.maxWeapons = Math.max(m.maxWeapons, 3);
    m.speed *= 0.92;
  },
});

defineRule({
  id: 'rear_guard', name: 'Dos couvert', category: 'weapons', flavor: 'mixed',
  desc: 'Chaque tir part aussi derrière toi (à 60 % des dégâts), mais tes armes consomment 30 % d\'énergie en plus.',
  icon: icon('ic_rear_guard', 'twin', 'b', 'B'),
  modify: (m) => { m.energyCost *= 1.3; },
  onShoot: (_ctx, ev, s) => {
    const mult = Math.min(1, 0.6 * Math.sqrt(pw(s, 2.7)));
    const extra: BulletSpec[] = [];
    for (const sp of ev.specs.slice(0, 6)) extra.push({ ...sp, angle: (sp.angle ?? 0) + Math.PI, damage: sp.damage * mult });
    ev.specs.push(...extra);
  },
});

defineRule({
  id: 'swelling_rounds', name: 'Balles gonflantes', category: 'weapons', flavor: 'mixed',
  desc: 'Tes balles grossissent et frappent plus fort à mesure qu\'elles voyagent (jusqu\'à ×2,5), mais elles volent 20 % moins vite.',
  icon: icon('ic_swelling_rounds', 'bigdot', 'o', 'O', 'y'),
  modify: (m) => { m.bulletSpeed *= 0.8; },
  onTick: (ctx, _dt, s) => {
    const k0 = pw(s, 2);
    for (const b of ctx.bullets) {
      if (b.dead || b.team !== 'player' || b.kind !== 'shot') continue;
      const t = tag(b);
      if (t.sw === undefined) { t.sw = b.damage; t.sr = b.radius; t.ss = b.scale ?? 1; }
      const d = Math.hypot(b.x - b.sx, b.y - b.sy);
      const k = Math.min(2.5, 1 + (d / 140) * k0);
      b.damage = t.sw * k;
      b.radius = t.sr * (1 + (k - 1) * 0.5);
      b.scale = t.ss * (1 + (k - 1) * 0.6);
    }
  },
});

defineRule({
  id: 'reflex_parry', name: 'Parade réflexe', category: 'weapons', flavor: 'mixed',
  desc: 'Quand une balle ennemie va te toucher, une parade automatique la renvoie (recharge 2 s), mais tes dégâts baissent de 10 %.',
  icon: icon('ic_reflex_parry', 'shield', 'c', 'C'),
  modify: (m) => { m.damage *= 0.9; },
  onTick: (ctx, dt, s) => {
    if (!inRun(ctx)) return;
    const cds: Record<number, number> = (s.state.cd ??= {});
    for (const p of alivePlayers(ctx)) {
      const cd = (cds[p.index] ?? 0) - dt;
      cds[p.index] = cd;
      if (cd > 0) continue;
      let threat = null as null | { x: number; y: number };
      for (const b of ctx.bullets) {
        if (b.dead || b.team !== 'enemy' || b.kind !== 'shot') continue;
        if (Math.hypot(b.x - p.x, b.y - p.y) < 18 + b.radius) { threat = b; break; }
      }
      if (!threat) continue;
      const a = Math.atan2(threat.y - p.y, threat.x - p.x);
      ctx.spawnBullet({ kind: 'slash', damage: 6 + ctx.depth, range: 24, arc: Math.PI * 2, reflect: true, knockback: 70, color: 0x9ae8ff }, p.x, p.y, a, 'player', p);
      ctx.ring(p.x, p.y, 22, 0x9ae8ff);
      ctx.sfx('swing', 0.6);
      cds[p.index] = (ctx.mods.flags.parryFast ? 1 : 2) / Math.min(2, pw(s, 2));
    }
  },
});

defineRule({
  id: 'heavy_caliber', name: 'Gros calibre', category: 'weapons', flavor: 'mixed', maxStacks: 2,
  desc: 'Tes armes tirent 35 % moins vite, mais chaque balle est plus grosse et fait 75 % de dégâts en plus.',
  icon: icon('ic_heavy_caliber', 'bigdot', 'a', 'A'),
  modify: (m, _c, s) => {
    const k = pw(s, 3);
    m.fireRate *= Math.pow(0.65, k);
    m.damage *= Math.pow(1.75, k);
    m.bulletSize *= 1 + 0.3 * k;
    m.shake *= 1.2;
  },
});

defineRule({
  id: 'scatter_decree', name: 'Décret de dispersion', category: 'weapons', flavor: 'mixed', maxStacks: 2,
  desc: 'Chaque tir gagne 2 projectiles et s\'élargit, mais chaque projectile fait 30 % de dégâts en moins.',
  icon: icon('ic_scatter_decree', 'dots', 'y', 'Y'),
  modify: (m, _c, s) => {
    const k = pw(s, 3);
    m.bulletCount += Math.round(2 * k);
    m.bulletSpread *= 1 + 0.5 * k;
    m.damage *= Math.pow(0.7, k);
  },
});

defineRule({
  id: 'piercing_faith', name: 'Foi perçante', category: 'weapons', flavor: 'boon', maxStacks: 2, weight: 0.6,
  desc: 'Tes balles traversent 2 ennemis de plus et volent 15 % plus vite.',
  icon: icon('ic_piercing_faith', 'arrow', 'w', '3'),
  modify: (m, _c, s) => {
    m.bulletPierce += Math.round(2 * pw(s, 3));
    m.bulletSpeed *= 1.15;
  },
});

defineRule({
  id: 'last_breath', name: 'Dernier souffle', category: 'weapons', flavor: 'boon', priority: 210, excludes: ['endless_energy'],
  desc: 'À court d\'énergie (moins de 4), tes armes tirent gratuitement, à 50 % des dégâts.',
  icon: icon('ic_last_breath', 'bolt', 'c', 'B'),
  modify: (m, ctx) => {
    const p = ctx.players.find((q) => !q.downed);
    if (!p || p.energy >= 4) return;
    m.energyInfinite = true;
    m.damage *= 0.5;
    m.flags.lastBreath = 1;
  },
});
