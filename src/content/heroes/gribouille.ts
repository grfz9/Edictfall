// Gribouille le Bricoleur : pose une tourelle alliée (ennemi charmé stationnaire) qui mitraille.
import { defineHero, defineSprite, defineEnemy } from '../../core/registry';
import type { Player } from '../../core/types';

const TURRET_LIFE = 8;

defineSprite('hero_gribouille', [
  '............', '....NNNN....', '..NNNNNNNN..', 'dddddddddddd', '..g1cgg1cg..', '..gggrrggg..', '...gggggg...',
  '.ooOooooOoo.', 'aooooyyooooa', 'aoOoooooOoo.', '..oooooooo..', '..NN....NN..', '..dd....dd..', '............',
], {
  frames: [[
    '............', '....NNNN....', '..NNNNNNNN..', 'dddddddddddd', '..g1cgg1cg..', '..gggrrggg..', '...gggggg...',
    '.ooOooooOoo.', 'aooooyyooooa', 'aoOoooooOoo.', '..oooooooo..', '...NN..NN...', '...dd..dd...', '............',
  ]],
});

defineSprite('e_gribouille_turret', [
  '...AAAA...', '..Aa11aA..', '..AabbaAAA', '..AabbaAaa', '..AaaaaA..', '...AAAA...', '....oo....', '...oOOo...', '..oOOOOo..', '..OOOOOO..',
], {
  frames: [[
    '...AAAA...', '..Aa11aA..', '..AaccaAAA', '..AaccaAaa', '..AaaaaA..', '...AAAA...', '....oo....', '...oOOo...', '..oOOOOo..', '..OOOOOO..',
  ]],
});

defineEnemy({
  id: 'gribouille_turret', name: 'Tourelle de Gribouille', world: 0, sprite: 'e_gribouille_turret', hp: 60, speed: 0, radius: 6,
  contact: 0, coins: [0, 0], energy: 0, knockbackResist: 1, noChampion: true,
  immune: ['burn', 'poison', 'freeze', 'shock', 'slow'],
  move: { kind: 'stationary' },
  onUpdate: (ctx, e, dt) => {
    e.data.life = (e.data.life ?? TURRET_LIFE) - dt;
    if (e.data.life <= 0) {
      ctx.despawnEnemy(e); // disparition silencieuse (pas de kill, pas de hooks de mort)
      ctx.burst(e.x, e.y, 0xf08030, 10, 70, 0.4);
      return;
    }
    e.data.cd = (e.data.cd ?? 0.2) - dt;
    if (e.data.cd > 0) return;
    const t = ctx.nearestEnemy(e.x, e.y, 210);
    if (!t || !ctx.los(e.x, e.y, t.x, t.y)) return;
    e.data.cd = 0.3;
    const a = Math.atan2(t.y - e.y, t.x - e.x);
    e.facing = t.x > e.x ? 1 : -1;
    const owner = (e.data.owner ?? null) as Player | null;
    ctx.spawnBullet({ damage: 6, speed: 280, sprite: 'b_small', color: 0xffb040, life: 0.9 }, e.x + Math.cos(a) * 7, e.y + Math.sin(a) * 7, a, 'player', owner && !owner.downed ? owner : null);
    ctx.sfx('shoot', 0.3);
  },
});

defineHero({
  id: 'gribouille', name: 'Gribouille', title: 'le Bricoleur', desc: 'Un lutin à lunettes qui répare tout, surtout ce qui tire tout seul.',
  sprite: 'hero_gribouille', hp: 6, armor: 4, energy: 220, speed: 90, crit: 0, weapon: 'pistol_rusty', cost: 60,
  skill: {
    name: 'Tourelle bricolée', desc: 'Pose une tourelle qui mitraille les ennemis pendant 8 s.', cooldown: 18, duration: 0,
    use: (ctx, p) => {
      // une seule tourelle à la fois
      for (const o of ctx.enemies) if (!o.dead && o.def.id === 'gribouille_turret' && o.data.owner === p) { o.dead = true; ctx.burst(o.x, o.y, 0xf08030, 6); }
      let x = p.x + Math.cos(p.aim) * 16, y = p.y + Math.sin(p.aim) * 16;
      if (!ctx.isFree(x, y, 6)) { x = p.x; y = p.y; }
      const e = ctx.spawnEnemy('gribouille_turret', x, y, { charmed: true, summoned: true, delay: 0 });
      if (e) { e.data.owner = p; e.data.life = TURRET_LIFE; e.data.cd = 0.3; }
      ctx.burst(x, y, 0xffd23a, 12, 70, 0.4);
      ctx.ring(x, y, 18, 0xf08030);
    },
  },
  // Trait : les ennemis lâchent un peu plus d'énergie.
  modify: (m) => { m.energyDrop *= 1.2; },
});
