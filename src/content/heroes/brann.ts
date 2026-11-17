// Héros de départ. Modèle à suivre pour les autres héros.
import { defineHero } from '../../core/registry';
import { heroArt, legs } from './_kit';

// Casque à cimier rouge, écharpe, tunique bleue à boucle dorée, bottes ferrées.
heroArt('brann', {
  pal: { j: '#3a2a4a' },
  base: [
    '..............',
    '......rrR.....',
    '.....rRR......',
    '....a222aA....',
    '...a21222aA...',
    '..a2122222aA..',
    '..AAAAAAAAAA..',
    '..As0sss0sA...',
    '...sssSSss....',
    '..rrrrrrrrRr..',
    '.2aBbBBBBBaA..',
    '.sBbBBBBBBBs..',
    '..YYYyyYYYY...',
    '...jjj..jjj...',
    '...AA....AA...',
    '..AAA...AAA...',
  ],
  waist: 11,
  walk: legs('j', 'A', 4, [{ 11: '.sBbBBBBBBBs..', 10: '.2aBbBBBBBaAr.' }, {}, { 10: '.2aBbBBBBBaA.r' }]),
  bob: [false, true, false],
  blink: { 7: '..AsSsssSsA...' },
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
