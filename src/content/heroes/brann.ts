// Héros de départ. Modèle à suivre pour les autres héros.
import { defineHero, defineSprite } from '../../core/registry';

defineSprite('hero_brann', [
  '...aaaaaa...', '..a222222a..', '.a22222222a.', '.a2AAAAAA2a.', '.a2A1AA1A2a.', '.a22222222a.', '..aAAAAAAa..',
  '.rBBBBBBBBr.', '.rBbBBBBbBr.', '.rBBByyBBBr.', '..BBBBBBBB..', '..AA....AA..', '..AA....AA..', '..00....00..',
], {
  frames: [[
    '...aaaaaa...', '..a222222a..', '.a22222222a.', '.a2AAAAAA2a.', '.a2A1AA1A2a.', '.a22222222a.', '..aAAAAAAa..',
    '.rBBBBBBBBr.', '.rBbBBBBbBr.', '.rBBByyBBBr.', '..BBBBBBBB..', '...AA..AA...', '...AA..AA...', '...00..00...',
  ]],
});

defineHero({
  id: 'brann', name: 'Brann', title: 'le Garde', desc: 'Solide et polyvalent. Idéal pour apprendre les règles… avant de les briser.',
  sprite: 'hero_brann', hp: 6, armor: 5, energy: 180, speed: 92, crit: 0, weapon: 'pistol_rusty', cost: 0,
  skill: {
    name: 'Double détente', desc: 'Pendant 5 s, chaque tir part en double et la cadence grimpe.', cooldown: 14, duration: 5,
    use: (ctx, p) => { ctx.burst(p.x, p.y, 0xffd23a, 14, 80, 0.5); ctx.ring(p.x, p.y, 26, 0xffd23a); },
    modify: (m) => { m.bulletCount += 1; m.fireRate *= 1.25; },
  },
});
