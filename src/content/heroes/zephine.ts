// Zéphine, Capitaine des Astres : pirate de l'espace à bras mécanique.
// Compétence « Bordée stellaire » : trois salves de boulets tirées des deux flancs, perpendiculairement à la visée.
// Trait « Part du butin » : +25 % de pièces.
import { defineHero } from '../../core/registry';
import type { Player } from '../../core/types';
import type { Ctx } from '../../sim/ctx';
import { heroArt, legs } from './_kit';

const VOLLEYS = 3;
const GAP = 0.35;

heroArt('zephine', {
  pal: { j: '#26203a', q: '#3c3456' },
  base: [
    '..............',
    '.....jjjj.....',
    '...jjqj1jjj...',
    '.jjjqjjjjjjjj.',
    '..YyyyyyyyyY..',
    '..tttssssst...',
    '.ttts00ss0t...',
    '.tt.0sssSs....',
    '.t..rssss.....',
    '..RrrYrrrRr...',
    '.aARrrYrrRrs..',
    '.2aRYrrYrRR...',
    '..aRrrrrrrR...',
    '...jjj..jjj...',
    '...44...nn....',
    '..444..nnnn...',
  ],
  waist: 12,
  walk: legs('j', 'n', 4, [{ 14: '..44.....nn...', 15: '..44.....nnn..' }, { 14: '.....44nn.....', 15: '.....4nnn.....' }, { 14: '...44...nn....', 15: '..44....nnn...' }]),
  bob: [false, true, false],
  blink: { 6: '.tttsS0sSSt...' },
});

function volley(ctx: Ctx, p: Player, k: number): void {
  const dmg = 10 + 3 * ctx.worldNum;
  for (const side of [-1, 1]) {
    const base = p.aim + (side * Math.PI) / 2;
    for (let i = 0; i < 4; i++) {
      const a = base + (i - 1.5) * 0.22 + (k % 2 ? 0.11 : 0);
      ctx.spawnBullet({ damage: dmg, speed: 240, sprite: 'b_big', scale: 0.7, color: 0xffc060, life: 0.8, knockback: 90, trail: 0xffa040 },
        p.x + Math.cos(base) * 6, p.y + Math.sin(base) * 6, a, 'player', p);
    }
    ctx.burst(p.x + Math.cos(base) * 8, p.y + Math.sin(base) * 8, 0xfff0a0, 6, 70, 0.25);
  }
  ctx.shake(2);
  ctx.sfx('launch', 0.5);
}

defineHero({
  id: 'zephine', name: 'Zéphine', title: 'Capitaine des Astres',
  desc: 'Pirate de l\'espace. Elle a perdu un œil, un bras et trois vaisseaux, mais jamais un pari.',
  sprite: 'hero_zephine', hp: 5, armor: 4, energy: 190, speed: 96, crit: 0.05, weapon: 'pistol_rusty', cost: 110,
  skill: {
    name: 'Bordée stellaire', desc: 'Trois salves de boulets crachées des deux flancs. Feu à volonté !', cooldown: 13, duration: VOLLEYS * GAP,
    use: (ctx, p) => {
      p.data.bordee = 0; p.data.bordeeT = 0;
      volley(ctx, p, 0);
      ctx.text(p.x, p.y - 16, 'Feu !', 0xffd23a);
    },
    tick: (ctx, p, dt) => {
      p.data.bordeeT = (p.data.bordeeT ?? 0) + dt;
      while (p.data.bordeeT >= GAP && (p.data.bordee ?? 0) < VOLLEYS - 1) {
        p.data.bordeeT -= GAP;
        p.data.bordee = (p.data.bordee ?? 0) + 1;
        volley(ctx, p, p.data.bordee);
      }
    },
    modify: (m) => { m.speed *= 0.8; },
  },
  modify: (m) => { m.coinMult *= 1.25; },
});
