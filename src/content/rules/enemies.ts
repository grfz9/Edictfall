// Édits « ennemis » : qui ils sont, combien, et ce qu'ils laissent derrière eux.
// (« Morts volatiles » est dans core.ts.)
import { defineRule } from '../../core/registry';
import { icon, pw, alivePlayers, inRun, sanitizeCopy } from './_kit';

defineRule({
  id: 'tiny_horde', name: 'Nuée minuscule', category: 'enemies', flavor: 'mixed', excludes: ['mastodons'],
  desc: 'Les ennemis deviennent minuscules et deux fois plus nombreux, mais n\'ont que la moitié de leurs PV.',
  icon: icon('ic_tiny_horde', 'dots', 'l', 'f'),
  modify: (m) => {
    m.enemyScale *= 0.55;
    m.enemyCount *= 2;
    m.enemyHp *= 0.5;
  },
});

defineRule({
  id: 'copycats', name: 'Singeries', category: 'enemies', flavor: 'curse',
  desc: 'Les ennemis copient ton dernier tir (en version ennemie, 1 dégât) toutes les 3 à 4 s ; en échange tes dégâts augmentent de 25 % et ils lâchent 30 % d\'énergie en plus.',
  icon: icon('ic_copycats', 'eye', 'm', 'M'),
  modify: (m, _c, s) => {
    m.damage *= 1 + 0.25 * pw(s, 3);
    m.energyDrop *= 1.3;
  },
  onEnemySpawn: (ctx, e) => {
    e.data.copyT = ctx.rng.range(1.6, 3.5);
  },
  onTick: (ctx, dt, s) => {
    if (!inRun(ctx) || ctx.bullets.length > 600) return;
    const d = dt * ctx.mods.timeScale;
    for (const e of ctx.enemies) {
      if (e.dead || e.spawnT > 0 || e.charmed || e.def.id === 'dummy' || e.status.shock) continue;
      let t = (typeof e.data.copyT === 'number' ? e.data.copyT : 2) - d;
      if (t > 0) {
        if (t < 0.35) e.flash = Math.max(e.flash, 0.04); // annonce : l'ennemi clignote avant de copier
        e.data.copyT = t;
        continue;
      }
      e.data.copyT = ctx.rng.range(3, 4.2) / Math.min(1.6, Math.sqrt(pw(s, 3)));
      const target = ctx.nearestPlayer(e.x, e.y);
      if (!target) continue;
      const shot = target.lastShot ?? null;
      if (!shot || !shot.length) continue;
      if (Math.hypot(target.x - e.x, target.y - e.y) > 230 || !ctx.los(e.x, e.y, target.x, target.y)) continue;
      const n = Math.min(3, shot.length);
      const base = Math.atan2(target.y - e.y, target.x - e.x);
      for (let i = 0; i < n; i++) {
        ctx.spawnBullet(sanitizeCopy(shot[i]), e.x, e.y, base + (n > 1 ? (i - (n - 1) / 2) * 0.22 : 0), 'enemy', e);
      }
    }
  },
});

defineRule({
  id: 'ooze_trail', name: 'Flaques acides', category: 'enemies', flavor: 'curse',
  desc: 'Chaque ennemi tué laisse une flaque acide 4 s (1 dégât si tu marches dedans) ; en échange ils lâchent 50 % d\'énergie et 30 % d\'or en plus.',
  icon: icon('ic_ooze_trail', 'drop', 'l', 'G'),
  modify: (m) => {
    m.energyDrop *= 1.5;
    m.coinMult *= 1.3;
  },
  onEnemyDeath: (ctx, e, s) => {
    if (!inRun(ctx) || e.charmed) return;
    const pools: { x: number; y: number; t: number }[] = (s.state.pools ??= []);
    if (pools.length < 24) pools.push({ x: e.x, y: e.y, t: 4 });
  },
  onTick: (ctx, dt, s) => {
    const pools: { x: number; y: number; t: number }[] = s.state.pools ?? [];
    if (!pools.length) return;
    const swamp = !!ctx.mods.flags.swamp;
    for (const pl of pools) {
      pl.t -= dt;
      if (pl.t <= 0) continue;
      for (const p of alivePlayers(ctx)) if (p.invuln <= 0 && Math.hypot(p.x - pl.x, p.y - pl.y) < 11) ctx.damagePlayer(p, 1, 'hazard');
      if (swamp) for (const e of ctx.enemiesIn(pl.x, pl.y, 14)) ctx.addStatus(e, 'slow', 0.3);
    }
    s.state.pools = pools.filter((pl) => pl.t > 0);
  },
  onRoomClear: (_c, _r, s) => { s.state.pools = []; },
  onFloorStart: (_c, s) => { s.state.pools = []; },
  render: (_ctx, g, s) => {
    for (const pl of (s.state.pools ?? []) as { x: number; y: number; t: number }[]) g.circle(pl.x, pl.y, 11, 0x70d840, 0.35 * Math.min(1, pl.t), true);
  },
});

defineRule({
  id: 'aristocracy', name: 'Aristocratie', category: 'enemies', flavor: 'curse', maxStacks: 2,
  desc: 'Un ennemi sur trois devient une élite (plus gros, plus coriace), mais tout l\'or est doublé et les coffres s\'améliorent.',
  icon: icon('ic_aristocracy', 'star', 'y', 'Y'),
  modify: (m, _c, s) => {
    const k = pw(s, 2);
    m.eliteChance += 0.3 * k;
    m.coinMult *= 1 + k;
    m.energyDrop *= 1.3;
    m.chestRarityBonus += 0.25 * k;
  },
});

defineRule({
  id: 'turncoats', name: 'Transfuges', category: 'enemies', flavor: 'boon', weight: 0.6, maxStacks: 2,
  desc: '12 % des ennemis qui apparaissent changent de camp et se battent pour toi jusqu\'à la fin de la salle.',
  icon: icon('ic_turncoats', 'heart', 'p', 'P'),
  onEnemySpawn: (ctx, e, s) => {
    if (e.def.boss || e.champion || e.summoned || e.charmed || e.def.world === 0) return;
    if (ctx.rng.chance(Math.min(0.35, 0.12 * pw(s, 3)))) { e.charmed = true; e.data.turncoat = 1; }
  },
  onRoomClear: (ctx) => {
    for (const e of ctx.enemies) if (e.charmed && !e.dead) { e.dead = true; ctx.burst(e.x, e.y, 0xc070ff, 8); }
  },
});

defineRule({
  id: 'mastodons', name: 'Mastodontes', category: 'enemies', flavor: 'curse', excludes: ['tiny_horde'],
  desc: 'Les ennemis sont 40 % plus gros et 50 % plus résistants (mais 20 % plus lents) ; en échange ils lâchent 50 % d\'or et d\'énergie en plus.',
  icon: icon('ic_mastodons', 'skull', 'n', 'N'),
  modify: (m, _c, s) => {
    const k = Math.min(2, pw(s, 2));
    m.enemyScale *= 1.4;
    m.enemyHp *= 1 + 0.5 * k;
    m.enemySpeed *= 0.8;
    m.coinMult *= 1.5;
    m.energyDrop *= 1.5;
  },
});

defineRule({
  id: 'frenzy', name: 'Frénésie', category: 'enemies', flavor: 'mixed',
  desc: 'Les ennemis bougent 30 % et attaquent 25 % plus vite, mais n\'ont que 65 % de leurs PV.',
  icon: icon('ic_frenzy', 'flame', 'r', 'R', 'y'),
  modify: (m) => {
    m.enemySpeed *= 1.3;
    m.enemyFireRate *= 1.25;
    m.enemyHp *= 0.65;
  },
});

defineRule({
  id: 'mitosis', name: 'Mitose', category: 'enemies', flavor: 'curse',
  desc: 'Chaque ennemi tué se scinde en deux petits rejetons fragiles (sans butin) ; en échange tes dégâts augmentent de 15 % et l\'or de 25 %.',
  icon: icon('ic_mitosis', 'twin', 'g', 'G'),
  modify: (m) => {
    m.damage *= 1.15;
    m.coinMult *= 1.25;
  },
  onEnemyDeath: (ctx, e) => {
    if (!inRun(ctx) || e.summoned || e.charmed || e.def.boss || e.champion || e.def.world === 0 || ctx.enemies.length > 60) return;
    for (let i = 0; i < 2; i++) {
      const ox = (i ? 6 : -6), x = ctx.isFree(e.x + ox, e.y, 4) ? e.x + ox : e.x;
      const c = ctx.spawnEnemy(e.def.id, x, e.y, { summoned: true, delay: 0.3 });
      if (!c) break;
      c.maxHp = c.hp = Math.max(1, c.maxHp * 0.35);
      c.scale *= 0.65;
      c.data.split = 1;
    }
  },
});
