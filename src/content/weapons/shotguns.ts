// FUSILS À POMPE
// id                | rareté | DPS                     | énergie/s
// shotgun_blunder   | 0      | 20.0 (5 plombs)         | 2.7
// shotgun_pips      | 1      | 30.0 (6 plombs)         | 4.3
// shotgun_auto      | 2      | 40.0 (4 plombs)         | 8.6
// shotgun_lizard    | 2      | 38.9 (7 flammèches)     | 6.7
// shotgun_flak      | 3      | 58.3 (+ éclats bonus)   | 10.0
import { defineWeapon } from '../../core/registry';
import { spr } from './_helpers';

spr('b_flame', ['.vo.', 'vyyo', '.vo.'], { outline: false });
spr('b_flak', ['.aa.', 'a33a', 'a33a', '.aa.']);

spr('w_shotgun_blunder', ['.........NNN', 'nnnnn4444aaN', 'NNNNNaaaaaaN', 'N..N.....NNN'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'shotgun_blunder', name: 'Tromblon de grand-père', desc: 'Il racontait toujours qu\'il visait les loups.', rarity: 0, type: 'shotgun',
  sprite: 'w_shotgun_blunder', energy: 2, cooldown: 0.75, damage: 3, count: 5, spread: 0.6, jitter: 0.05, recoil: 5, kick: 30, shake: 2.5, muzzle: 0xffc060,
  bullet: { speed: 230, sprite: 'b_small', life: 0.45, drag: 1.2 },
});

spr('w_shotgun_pips', ['....RRR.....', 'nnnn44444444', 'NNNNaaaaaaaa', 'N..NRRR.....'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'shotgun_pips', name: 'Pompe-à-Pépins', desc: 'Chik-chak. Les fruits n\'ont jamais été aussi dangereux.', rarity: 1, type: 'shotgun',
  sprite: 'w_shotgun_pips', energy: 3, cooldown: 0.7, damage: 3.5, count: 6, spread: 0.55, jitter: 0.04, auto: false, recoil: 6, kick: 45, shake: 3, muzzle: 0xffd060,
  bullet: { speed: 260, sprite: 'b_small', life: 0.45, drag: 1.4, knockback: 45 },
});

spr('w_shotgun_auto', ['..4444444444', 'nn4aaaaaaaa4', 'NN44444aa444', 'N.d4...dd...', '..d....d....'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'shotgun_auto', name: 'Mitraille automatique', desc: 'Pour ceux qui trouvent le mot « viser » trop long.', rarity: 2, type: 'shotgun',
  sprite: 'w_shotgun_auto', energy: 3, cooldown: 0.35, damage: 3.5, count: 4, spread: 0.45, jitter: 0.06, recoil: 4, kick: 20, shake: 1.8, muzzle: 0xffc060,
  bullet: { speed: 270, sprite: 'b_small', life: 0.45, drag: 1.2 },
});

spr('w_shotgun_lizard', ['.....GG....', 'GGGGgggggvo', 'GggggGGGGvy', 'G.GG...GGvo', '..G........'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'shotgun_lizard', name: 'Souffle du lézard', desc: 'Il a mangé un piment. Vous récoltez les conséquences.', rarity: 2, type: 'shotgun',
  sprite: 'w_shotgun_lizard', energy: 3, cooldown: 0.45, damage: 2.5, count: 7, spread: 0.5, jitter: 0.08, recoil: 3, kick: 10, shake: 1.2, sfx: 'fire', muzzle: 0xff9a30, casing: false,
  bullet: { speed: 170, sprite: 'b_flame', life: 0.4, drag: 1.5, pierce: 1, status: { kind: 'burn', dur: 1.5 }, spin: 8 },
});

spr('w_shotgun_flak', ['...PPPPPPPPP.', 'nnnP4444444aa', 'NNNPaaaaaaaaa', 'N..PPPPPPPP4.', '...d.........'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'shotgun_flak', name: 'Pétaradeuse', desc: 'Chaque plomb éclate en trois. Les ennemis aussi.', rarity: 3, type: 'shotgun',
  sprite: 'w_shotgun_flak', energy: 6, cooldown: 0.6, damage: 7, count: 5, spread: 0.5, jitter: 0.05, recoil: 6, kick: 40, shake: 3, muzzle: 0xffa040,
  bullet: { speed: 260, sprite: 'b_flak', life: 0.5, drag: 1, split: { count: 3, spec: { damage: 2, speed: 170, life: 0.25, sprite: 'b_small' } } },
  unlock: 30,
});
