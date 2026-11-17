// Ferrokan, Rōnin Rouillé : un automate-samouraï oublié sous la pluie pendant trois siècles.
// Compétence « Iaï grinçant » : garde de 0,5 s (invulnérable) qui renvoie les balles proches, puis une coupe circulaire.
// Trait « Carcasse de fer » : +1 armure max, mêlée +10 %.
import { defineHero } from '../../core/registry';
import { heroArt, legs } from './_kit';

const PARRY_R = 44;

heroArt('ferrokan', {
  pal: { q: '#b0643a', Q: '#6e3a1e', u: '#d88a50', j: '#3a2a2e' },
  base: [
    '..............',
    '...y.....y....',
    '...yy...yy....',
    '....yQQQy.....',
    '...QquuqqQ....',
    '..QqqqqqqqQ...',
    '..QAAAAAAAQ...',
    '...A5cc5cA....',
    '...AA555AA....',
    '.QqqAaaaAqqQ..',
    '.QuqqaaaqqqQ..',
    '.a.QrrrrrQ.a..',
    '..jQqQ.QqQj...',
    '...AA...AA....',
    '...AA...AA....',
    '..QQQ..QQQ....',
  ],
  waist: 11,
  walk: legs('A', 'Q', 4, [{ 12: '..jQqQ.QqQ.j..' }, { 12: '...QqQjQqQ....' }, { 12: '.j.QqQ.QqQj...' }]),
  bob: [false, true, false],
  blink: { 7: '...A5555cA....' },
});

defineHero({
  id: 'ferrokan', name: 'Ferrokan', title: 'le Rōnin Rouillé',
  desc: 'Un automate samouraï resté trois siècles sous la pluie. Il grince, mais il tranche.',
  sprite: 'hero_ferrokan', hp: 5, armor: 6, energy: 150, speed: 86, crit: 0.08, weapon: 'sword_iron', cost: 210,
  skill: {
    name: 'Iaï grinçant', desc: 'Garde invulnérable qui renvoie les balles, puis coupe tout autour.', cooldown: 11, duration: 0.5,
    use: (ctx, p) => {
      ctx.ring(p.x, p.y, PARRY_R, 0xffd23a);
      ctx.text(p.x, p.y - 16, '*grince*', 0xd88a50);
      ctx.sfx('lock', 0.6);
    },
    tick: (ctx, p) => {
      p.invuln = Math.max(p.invuln, 0.06);
      for (const b of ctx.bullets) {
        if (b.dead || b.team !== 'enemy' || b.kind !== 'shot') continue;
        if (Math.hypot(b.x - p.x, b.y - p.y) > PARRY_R) continue;
        // renvoi vers le tireur (ou tout droit en arrière)
        b.team = 'player'; b.owner = p;
        b.vx = -b.vx; b.vy = -b.vy; b.dir += Math.PI;
        b.damage = 10 + 3 * ctx.worldNum;
        b.hit.clear(); b.age = 0; b.color = 0xffe080;
        ctx.burst(b.x, b.y, 0xffd23a, 3, 50, 0.2);
      }
    },
    end: (ctx, p) => {
      ctx.spawnBullet({ kind: 'slash', damage: 30 + 8 * ctx.worldNum, arc: Math.PI * 2, range: 52, color: 0xffd23a, knockback: 220, reflect: true },
        p.x, p.y, p.aim, 'player', p);
      ctx.ring(p.x, p.y, 52, 0xffffff);
      ctx.flash(0xffd23a, 0.15);
      ctx.shake(4);
      ctx.hitstop(0.05);
      ctx.sfx('swing', 1);
    },
  },
  modify: (m) => { m.maxArmor += 1; m.meleeDamage *= 1.1; },
});
