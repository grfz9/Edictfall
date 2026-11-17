// Vesna la Lame-Vent : ruée invulnérable qui taillade tout sur son passage.
import { defineHero } from '../../core/registry';
import { heroArt, legs } from './_kit';

// Lame-vent : queue de cheval rose, écharpe rouge qui claque au vent, tenue sombre ajustée.
heroArt('vesna', {
  base: [
    '..............',
    '.....mmmm.....',
    '...MmmmmmmM...',
    '..MMmmsssmm...',
    '..Mms0ss0sm...',
    '.MM.mssSss....',
    '.M...sss......',
    'rrRrrrrrrr....',
    '..rR45555r....',
    '...4555r55....',
    '..s45555554s..',
    '....4rrrr4....',
    '....455554....',
    '....54..45....',
    '....5....5....',
    '...00....00...',
  ],
  waist: 11,
  walk: legs('5', '0', 4, [
    { 7: '.rrRrrrrrrr...', 8: 'r.rR45555r....', 5: '.MM.mssSss....', 6: 'MM...sss......' },
    { 7: 'RrrRrrrrrr....', 8: '.r.R45555r....' },
    { 7: '.rRrrrrrrr....', 8: 'rr.R45555r....', 6: 'MM...sss......' },
  ]),
  bob: [false, true, false],
  blink: { 4: '..MmsSssSsm...' },
});

defineHero({
  id: 'vesna', name: 'Vesna', title: 'la Lame-Vent', desc: 'Rapide, fragile, insolente. Elle arrive avant le bruit de ses pas.',
  sprite: 'hero_vesna', hp: 4, armor: 4, energy: 140, speed: 104, crit: 0.1, weapon: 'sword_iron', cost: 90,
  skill: {
    name: 'Ruée du vent', desc: 'Fonce, invulnérable, et blesse tout ce que tu traverses.', cooldown: 5, duration: 0.3,
    use: (ctx, p) => {
      const a = p.moving ? Math.atan2(p.input.my, p.input.mx) : p.aim;
      p.kx += Math.cos(a) * 540;
      p.ky += Math.sin(a) * 540;
      p.invuln = Math.max(p.invuln, 0.45);
      p.data.dashHit = [] as number[];
      ctx.burst(p.x, p.y, 0xff70b8, 10, 90, 0.3);
      ctx.sfx('dash', 0.7);
    },
    tick: (ctx, p) => {
      const hit: number[] = p.data.dashHit ?? (p.data.dashHit = []);
      for (const e of ctx.enemiesIn(p.x, p.y, 14)) {
        if (e.charmed || hit.includes(e.id)) continue;
        hit.push(e.id);
        ctx.damageEnemy(e, 18 + 3 * ctx.worldNum, { cause: 'melee', source: p });
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        const k = 160 * (1 - (e.def.knockbackResist ?? 0));
        e.kx += ((e.x - p.x) / d) * k; e.ky += ((e.y - p.y) / d) * k;
        ctx.burst(e.x, e.y, 0xffffff, 5, 80, 0.25);
      }
      ctx.burst(p.x, p.y, 0xff70b8, 1, 20, 0.25);
    },
  },
  // Trait : la mêlée frappe plus fort.
  modify: (m) => { m.meleeDamage *= 1.15; },
});
