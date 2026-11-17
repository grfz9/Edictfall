// Bouldre le Moine-Racine : onde de sève qui soigne les alliés et repousse les ennemis.
import { defineHero } from '../../core/registry';
import { heroArt, legs } from './_kit';

const R_HEAL = 72;

// Moine-Racine : couronne de feuilles et sa baie, visage d'écorce, barbe de mousse, bure de lierre, pieds-racines.
heroArt('bouldre', {
  base: [
    '..............',
    '....lllfl.....',
    '..llfllllfl...',
    '.lflFlrllFfl..',
    '..FnnnnnnnF...',
    '..nNy0nny0N...',
    '..nnnnNnnnn...',
    '.fnllllllln...',
    'fFnlwlllwlnf..',
    'fFnnllfllnnFf.',
    '.FNnnflfnnNF..',
    '.lNnnnggnnNl..',
    '..NnnnnnnnN...',
    '...ddd.ddd....',
    '...dd...dd....',
    '..dddd.dddd...',
  ],
  waist: 12,
  walk: legs('d', 'd', 4, [{ 15: '.ddd......dddd' }, { 1: '.....lllfl....' }, { 15: '.dddd....ddd..' }]),
  bob: [false, true, false],
  blink: { 5: '..nNnnnnnnN...' },
});

defineHero({
  id: 'bouldre', name: 'Bouldre', title: 'le Moine-Racine', desc: 'Un vieil arbre qui a appris à marcher, puis à frapper. Patient, mais têtu.',
  sprite: 'hero_bouldre', hp: 8, armor: 3, energy: 170, speed: 84, crit: 0, weapon: 'sword_iron', cost: 180,
  skill: {
    name: 'Onde de sève', desc: 'Rend 2 PV aux alliés proches et repousse les ennemis.', cooldown: 28, duration: 0,
    use: (ctx, p) => {
      for (const q of ctx.players) if (!q.downed && Math.hypot(q.x - p.x, q.y - p.y) < R_HEAL) ctx.heal(q, 2);
      for (const e of ctx.enemiesIn(p.x, p.y, R_HEAL)) {
        if (e.charmed) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        const k = 320 * (1 - (e.def.knockbackResist ?? 0));
        e.kx += ((e.x - p.x) / d) * k; e.ky += ((e.y - p.y) / d) * k;
        ctx.addStatus(e, 'slow', 1.5);
      }
      for (const b of ctx.bullets) if (!b.dead && b.team === 'enemy' && b.kind !== 'beam' && Math.hypot(b.x - p.x, b.y - p.y) < R_HEAL) b.dead = true;
      ctx.ring(p.x, p.y, R_HEAL, 0x6ee06e);
      ctx.burst(p.x, p.y, 0xa8f070, 22, 110, 0.6);
      ctx.flash(0x6ee06e, 0.2);
      ctx.sfx('heal');
    },
  },
  // Trait : chaque ennemi vaincu a une petite chance de rendre 1 PV.
  modify: (m) => { m.lifeSteal += 0.03; },
});
