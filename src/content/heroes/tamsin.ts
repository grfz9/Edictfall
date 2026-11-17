// Tamsin l'Horlogère : ralentit le temps des ennemis et de leurs balles.
import { defineHero } from '../../core/registry';
import { heroArt, legs } from './_kit';

const SLOW = 0.35;

// Horlogère : haut-de-forme à cadran, monocle doré, redingote violette à basques, chaîne de montre.
heroArt('tamsin', {
  pal: { j: '#4a2a6a' },
  base: [
    '..............',
    '....PPPPPP....',
    '....PpppPP....',
    '....Py1yPP....',
    '....PyRyPP....',
    '..PPPPPPPPPP..',
    '....ssssss....',
    '....s0sy1s....',
    '....sssSYs....',
    '...ppwyywpp...',
    '..pPpwwwwpPp..',
    '.spPppyppYpPs.',
    '..pPppppYpPp..',
    '..pP.jj.jjPp..',
    '....jj..jj....',
    '...00...00....',
  ],
  waist: 12,
  walk: legs('j', '0', 4, [
    { 12: '..pPppppYpPp..', 13: '.pP.jj...jjPp.' },
    { 12: '..pPppppYpPp..', 13: '..pP.jjjj.Pp..' },
    { 12: '..pPpppYppPp..', 13: '..pPjj...jjp..' },
  ]),
  bob: [false, true, false],
  blink: { 7: '....sSsy1s....' },
});

defineHero({
  id: 'tamsin', name: 'Tamsin', title: "l'Horlogère", desc: 'Elle a volé une seconde à chaque horloge du royaume. Elle les dépense ici.',
  sprite: 'hero_tamsin', hp: 5, armor: 5, energy: 200, speed: 94, crit: 0.05, weapon: 'pistol_rusty', cost: 130,
  skill: {
    name: 'Seconde volée', desc: 'Pendant 5 s, ennemis et balles ennemies vont au ralenti.', cooldown: 20, duration: 5,
    use: (ctx, p) => {
      ctx.flash(0xc070ff, 0.3);
      ctx.ring(p.x, p.y, 60, 0xc070ff);
      ctx.burst(p.x, p.y, 0xffd23a, 14, 60, 0.6);
    },
    tick: (ctx) => {
      // Le moteur lit le timeScale global (world.mods) pour les ennemis : on l'applique ici, il est recalculé à chaque frame.
      const wm = ctx.world.mods;
      wm.timeScale = Math.max(0.1, wm.timeScale * SLOW);
    },
    end: (ctx, p) => { ctx.ring(p.x, p.y, 40, 0xffd23a); },
    modify: (m) => { m.timeScale *= SLOW; m.fireRate *= 1.15; m.tint = 0xe0d0ff; },
  },
  // Trait : compétence plus vite rechargée.
  modify: (m) => { m.skillCd *= 0.9; },
});
