// FUSILS (précision, rafales, mitraillettes)
// id                | rareté | DPS                 | énergie/s
// rifle_scout       | 0      | 18.4                | 2.6
// rifle_peashooter  | 0      | 21.4                | 0
// rifle_knitter     | 1      | 30.0 (rafale 3)     | 6.0
// rifle_pepper      | 1      | 30.0                | 6.7
// rifle_sniper      | 2      | 40.0 (perce 4)      | 7.0
// rifle_hail        | 3      | 53.3 (rafale 4)     | 11.1
// rifle_syringe     | 3      | 56.3 (+ poison)     | 12.5
import { defineWeapon } from '../../core/registry';
import { spr, muzzleFx } from './_helpers';

spr('b_pea', ['.g.', 'glg', '.g.']);
spr('b_needle', ['....l.', 'llllgl', '....l.']);
spr('b_tracer', ['..yyyyy', 'v111111', '..yyyyy']);

spr('w_rifle_scout', ['............4.', '.nnnn44444444a', 'nNnnNaa2222221', 'NN..Naaaaaaa4.', 'N....N........'], { ox: 3, oy: 2 });
defineWeapon({
  id: 'rifle_scout', name: 'Carabine de garde-champêtre', desc: 'A déjà verbalisé trois lapins et un nuage.', rarity: 0, type: 'rifle',
  sprite: 'w_rifle_scout', energy: 1, cooldown: 0.38, damage: 7, jitter: 0.02, recoil: 3, kick: 8, shake: 0.8, muzzle: 0xfff0a0,
  bullet: { speed: 360, sprite: 'b_slug', life: 1, trail: 0xfff0a0 },
});

spr('w_rifle_peashooter', ['..gggggggg', 'gGlllllllg', 'gGGGGGGGG.', '.FF.......', '.F........'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'rifle_peashooter', name: 'Crachoir à pois', desc: 'Cadence folle, précision de soupe.', rarity: 0, type: 'rifle',
  sprite: 'w_rifle_peashooter', energy: 0, cooldown: 0.14, damage: 3, jitter: 0.15, recoil: 1.5, shake: 0.3, sfx: 'pew', muzzle: 0xa8f070, casing: false,
  bullet: { speed: 230, sprite: 'b_pea', life: 0.8 },
});

spr('w_rifle_knitter', ['.....mMm.....', 'nnnn4aaaaaaa1', 'NNnNa2222222a', '.N..4Mm4.....', '.....M.......'], { ox: 3, oy: 2 });
defineWeapon({
  id: 'rifle_knitter', name: 'Tricoteuse', desc: 'Trois mailles à l\'endroit, trois trous dans l\'ennemi.', rarity: 1, type: 'rifle',
  sprite: 'w_rifle_knitter', energy: 3, cooldown: 0.5, damage: 5, burst: { count: 3, interval: 0.07 }, jitter: 0.04, recoil: 2, kick: 4, shake: 0.7, muzzle: 0xffe070,
  bullet: { speed: 330, sprite: 'b_slug', life: 1, trail: 0xffe070 },
});

spr('w_rifle_pepper', ['..4444444a33', 'nn4a2222aa31', 'NN4aaaaaaa33', '.N4444444a3.', '..4...4.....'], { ox: 2, oy: 3 });
defineWeapon({
  id: 'rifle_pepper', name: 'Moulin à poivre', desc: 'Assaisonne généreusement. Éternuements non garantis.', rarity: 1, type: 'rifle',
  sprite: 'w_rifle_pepper', energy: 1, cooldown: 0.15, damage: 4.5, jitter: 0.18, recoil: 2, shake: 0.5, muzzle: 0xfff0a0,
  bullet: { speed: 290, sprite: 'b_pellet', life: 0.9, trail: 0xfff0a0 },
});

spr('w_rifle_sniper', ['....333..........', '....5c5..........', 'nnnn44444444444a4', 'NNNNNaaaaaaaaaaa.', 'N..N.............'], { ox: 4, oy: 3 });
defineWeapon({
  id: 'rifle_sniper', name: 'Long-Silence', desc: 'On ne l\'entend jamais deux fois.', rarity: 2, type: 'rifle',
  sprite: 'w_rifle_sniper', energy: 7, cooldown: 1.0, damage: 40, crit: 0.25, auto: false, recoil: 8, kick: 50, shake: 3, muzzle: 0xffffff,
  bullet: { speed: 620, sprite: 'b_tracer', life: 0.9, pierce: 4, knockback: 80, trail: 0xffd23a },
  onFire: (ctx, ev) => { muzzleFx(ctx, ev, 0xffffff, 8, 7, 18); ctx.hitstop(0.03); },
});

spr('w_rifle_hail', ['..3333333333.', 'nnaaaaaaaaaa1', 'NN4444444444.', 'N.44.4.......', '...4.........'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'rifle_hail', name: 'Grêle de plomb', desc: 'Quatre balles d\'un coup : la météo est formelle.', rarity: 3, type: 'rifle',
  sprite: 'w_rifle_hail', energy: 5, cooldown: 0.45, damage: 6, burst: { count: 4, interval: 0.05 }, jitter: 0.05, recoil: 3, shake: 1, sfx: 'rifle', muzzle: 0xffd070,
  bullet: { speed: 380, sprite: 'b_tracer', life: 0.9, trail: 0xffd070 },
  unlock: 35,
});

spr('w_rifle_syringe', ['.....GGG.....', '22lllllllll33', '2ggggggggggg3', '22lllllllll33', '.4.....4.....', '.4...........'], { ox: 2, oy: 3 });
defineWeapon({
  id: 'rifle_syringe', name: 'Seringueuse', desc: 'Vaccin contre la bonne santé.', rarity: 3, type: 'rifle',
  sprite: 'w_rifle_syringe', energy: 2, cooldown: 0.16, damage: 9, jitter: 0.06, recoil: 2, shake: 0.5, sfx: 'pew', muzzle: 0xa8f070, casing: false,
  bullet: { speed: 340, sprite: 'b_needle', life: 0.9, status: { kind: 'poison', dur: 2.5 } },
});
