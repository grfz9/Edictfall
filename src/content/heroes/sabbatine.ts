// Sabbatine, Sorcière des Platines : elle mixe des incantations à 120 BPM.
// Compétence « Drop de minuit » : 6 s de set ; chaque temps envoie une onde qui blesse et repousse, le 4e temps « droppe » plus fort.
// Trait « Groove » : tire 12 % plus vite tant qu'elle bouge.
import { defineHero } from '../../core/registry';
import type { Player } from '../../core/types';
import type { Ctx } from '../../sim/ctx';
import { heroArt, legs } from './_kit';

const BEAT = 0.5;

heroArt('sabbatine', {
  pal: { j: '#22183a', h: '#3d2a66' },
  base: [
    '..............',
    '.........hP...',
    '........hPP...',
    '.......hPPP...',
    '......hPPPP...',
    '...mmmmmmmmm..',
    '..hhPPPPPPPhh.',
    '..cttsssstc...',
    '..5tsm0sm05...',
    '..5ttsssSs5...',
    '...t.jmmj.....',
    '..sjjcjjcjjs..',
    '...jjmjjmjj...',
    '..jmjjjjjjmj..',
    '....hh..hh....',
    '...mmm..mmm...',
  ],
  waist: 12,
  walk: legs('h', 'm', 4, [
    { 13: '..jmjjjjjjmj..', 11: '.sjjcjjcjjs...' },
    { 13: '...jmjjjjmj...' },
    { 13: '..jmjjjjjjmj..', 11: '...sjcjjcjjs..' },
  ]),
  bob: [false, true, false],
  blink: { 8: '..5tsSSsSS5...' },
});

function beat(ctx: Ctx, p: Player, n: number): void {
  const drop = n % 4 === 3;
  const r = drop ? 84 : 60;
  const dmg = (drop ? 2 : 1) * (6 + 2 * ctx.worldNum);
  for (const e of ctx.enemiesIn(p.x, p.y, r)) {
    if (e.charmed) continue;
    ctx.damageEnemy(e, dmg, { cause: 'skill', source: p });
    const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
    const k = (drop ? 220 : 110) * (1 - (e.def.knockbackResist ?? 0));
    e.kx += ((e.x - p.x) / d) * k; e.ky += ((e.y - p.y) / d) * k;
  }
  const col = n % 2 ? 0x58e8ff : 0xff70d8;
  ctx.ring(p.x, p.y, r, col);
  ctx.burst(p.x, p.y - 6, col, drop ? 16 : 6, drop ? 120 : 60, 0.35);
  if (drop) { ctx.flash(0xff70d8, 0.15); ctx.shake(3); ctx.text(p.x, p.y - 18, 'DROP !', 0x58e8ff, true); }
  ctx.sfx(drop ? 'explode' : 'magic', drop ? 0.5 : 0.35);
}

defineHero({
  id: 'sabbatine', name: 'Sabbatine', title: 'Sorcière des Platines',
  desc: 'Elle mixe des incantations à 120 BPM. Les squelettes dansent, les autres explosent.',
  sprite: 'hero_sabbatine', hp: 4, armor: 5, energy: 220, speed: 96, crit: 0, weapon: 'pistol_rusty', cost: 150,
  skill: {
    name: 'Drop de minuit', desc: '6 s de set : chaque temps blesse autour, le 4e temps fait tout sauter.', cooldown: 20, duration: 6,
    use: (ctx, p) => {
      p.data.beatN = 0; p.data.beatT = 0;
      beat(ctx, p, 0);
    },
    tick: (ctx, p, dt) => {
      p.data.beatT = (p.data.beatT ?? 0) + dt;
      if (p.data.beatT < BEAT) return;
      p.data.beatT -= BEAT;
      p.data.beatN = (p.data.beatN ?? 0) + 1;
      beat(ctx, p, p.data.beatN);
    },
    modify: (m) => { m.fireRate *= 1.3; m.tint = 0xffe0ff; },
  },
  modify: (m, p) => { if (p && p.moving) m.fireRate *= 1.12; },
});
