// Oriane l'Égide : bulle protectrice qui annule les dégâts et dissout les balles proches.
import { defineHero, defineSprite } from '../../core/registry';

const BUBBLE_R = 40;

defineSprite('hero_oriane', [
  '...yyyyyy...', '..iiiiiiii..', '.iiIssssIii.', '.iIs0ss0sIi.', '.iIssssssIi.', '..iIIIIIIi..', '.ciiiyyiiic.',
  '.ciiiiiiiic.', 'cCiiiiiiiiCc', '.CiiiiiiiiC.', '..iiiiiiii..', '..IIIIIIII..', '..2I....I2..', '..00....00..',
], {
  frames: [[
    '...yyyyyy...', '..iiiiiiii..', '.iiIssssIii.', '.iIs0ss0sIi.', '.iIssssssIi.', '..iIIIIIIi..', '.ciiiyyiiic.',
    '.ciiiiiiiic.', 'cCiiiiiiiiCc', '.CiiiiiiiiC.', '..iiiiiiii..', '..IIIIIIII..', '...2I..I2...', '...00..00...',
  ]],
});

defineHero({
  id: 'oriane', name: 'Oriane', title: "l'Égide", desc: 'Une paladine de verre soufflé. Elle ne craint rien, surtout pas les balles.',
  sprite: 'hero_oriane', hp: 5, armor: 7, energy: 160, speed: 88, crit: 0, weapon: 'pistol_rusty', cost: 30,
  skill: {
    name: 'Bulle d\'égide', desc: '3 s d\'invulnérabilité ; la bulle dissout les balles proches.', cooldown: 16, duration: 3,
    use: (ctx, p) => {
      p.data.bubbleFx = 0;
      ctx.ring(p.x, p.y, BUBBLE_R, 0x9ae8ff);
      ctx.burst(p.x, p.y, 0xd8f0ff, 16, 70, 0.5);
      ctx.flash(0x9ae8ff, 0.15);
    },
    tick: (ctx, p, dt) => {
      p.invuln = Math.max(p.invuln, 0.06);
      for (const b of ctx.bullets) {
        if (b.dead || b.team !== 'enemy' || b.kind === 'beam') continue;
        if (Math.hypot(b.x - p.x, b.y - p.y) < BUBBLE_R) { b.dead = true; ctx.burst(b.x, b.y, 0x9ae8ff, 3, 40, 0.2); }
      }
      p.data.bubbleFx = (p.data.bubbleFx ?? 0) - dt;
      if (p.data.bubbleFx <= 0) { p.data.bubbleFx = 0.2; ctx.ring(p.x, p.y, BUBBLE_R, 0x9ae8ff); }
    },
    end: (ctx, p) => { ctx.burst(p.x, p.y, 0x9ae8ff, 12, 90, 0.4); },
  },
  // Trait : l'armure se recharge plus tôt.
  modify: (m) => { m.armorDelay *= 0.75; },
});
