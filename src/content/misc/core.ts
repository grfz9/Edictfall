// Sprites et entités « système » dont le moteur a besoin : butin, coffres, décor, PNJ, balles de base.
import { defineSprite, defineEnemy, defineTheme } from '../../core/registry';

// ------------------------------------------------------------------ butin
defineSprite('pk_coin', ['.yyy.', 'y1yyY', 'yyyyY', 'yyyYY', '.YYY.'], { frames: [['..y..', '.y1Y.', '.yyY.', '.yYY.', '..Y..']] });
defineSprite('pk_energy', ['.ccc.', 'c1ccb', 'cccbb', 'ccbbB', '.bbB.'], { frames: [['.bcb.', 'bc1cb', 'ccccc', 'bcccb', '.bcb.']] });
defineSprite('pk_hp', ['.rr.rr.', 'r1rrrrR', 'rrrrrrR', '.rrrrR.', '..rrR..', '...R...']);
defineSprite('pk_gem', ['..p..', '.p1p.', 'p1ppP', '.ppP.', '..P..'], { frames: [['..p..', '.ppp.', 'pp1pP', '.p1P.', '..P..']] });
defineSprite('potion_hp', ['..22..', '..nn..', '.2222.', '2r1rr2', '2rrrr2', '2rrRR2', '.2222.']);
defineSprite('potion_en', ['..22..', '..nn..', '.2222.', '2b1bb2', '2bbbb2', '2bbBB2', '.2222.']);

// ------------------------------------------------------------------ coffres & décor
defineSprite('chest', ['.NNNNNNNNNN.', 'NnnnnnnnnnnN', 'NnnnnnnnnnnN', 'NyyyyyyyyyyN', 'dNNNNyyNNNNd', 'dnnnnyYnnnnd', 'dnnnnnnnnnnd', 'dnnnnnnnnnnd', '.dddddddddd.']);
defineSprite('chest_open', ['.dddddddddd.', 'd5555555555d', 'd55yy55y555d', 'dNNNNNNNNNNd', 'dnnnnnnnnnnd', 'dnnnnnnnnnnd', 'dnnnnnnnnnnd', '.dddddddddd.']);
defineSprite('chest_big', ['.PPPPPPPPPPPP.', 'PppppppppppppP', 'PppppppppppppP', 'PyyyyyyyyyyyyP', 'PPPPPPyyPPPPPP', 'PpppppyYpppppP', 'PppppppppppppP', 'PppppppppppppP', 'PppppppppppppP', '.PPPPPPPPPPPP.']);
defineSprite('chest_big_open', ['.PPPPPPPPPPPP.', 'P555555555555P', 'P5y5yy55y5y55P', 'PyyyyyyyyyyyyP', 'PppppppppppppP', 'PppppppppppppP', 'PppppppppppppP', 'PppppppppppppP', '.PPPPPPPPPPPP.']);
defineSprite('crate', ['NNNNNNNNNNNN', 'NnnnnnnnnnnN', 'NnNnnnnnnNnN', 'NnnNnnnnNnnN', 'NnnnNnnNnnnN', 'NnnnnNNnnnnN', 'NnnnnNNnnnnN', 'NnnnNnnNnnnN', 'NnnNnnnnNnnN', 'NnNnnnnnnNnN', 'NnnnnnnnnnnN', 'NNNNNNNNNNNN']);
defineSprite('barrel', ['..RRRRRR..', '.RrrrrrrR.', 'RrrrrrrrrR', '4444444444', 'RrryyyyrrR', 'RrryrryrrR', 'RrryyyyrrR', 'RrrrrrrrrR', '4444444444', 'RrrrrrrrrR', '.RrrrrrrR.', '..RRRRRR..']);
const PORTAL = [
  '....pppppp....', '..ppPPPPPPpp..', '.pPPbbbbbbPPp.', '.pPbbccccbbPp.', 'pPPbcc11ccbPPp', 'pPbbc1cc1cbbPp', 'pPbcc1cccccbPp', 'pPbccccc1ccbPp',
  'pPbcc1cccccbPp', 'pPbccccc1ccbPp', 'pPbbcc1cccbbPp', 'pPPbcc11ccbPPp', '.pPbbccccbbPp.', '.pPPbbbbbbPPp.', '..ppPPPPPPpp..', '....pppppp....',
];
defineSprite('portal', PORTAL, { frames: [PORTAL.map((r) => r.split('').reverse().join('')), [...PORTAL].reverse()] });
defineSprite('statue', [
  '....3333....', '...322223...', '...32cc23...', '...322223...', '....3333....', '..33322333..', '.3322222233.', '.3232222323.', '.3232222323.',
  '.33.3223.33.', '....3223....', '....3223....', '...332233...', '..44444444..', '.4433333344.', '.4333333334.', '.4444444444.',
]);

// ------------------------------------------------------------------ PNJ (même gabarit, capuches de couleurs différentes)
const NPC = [
  '....HHHH....', '...HHHHHH...', '..HHssssHH..', '..Hs0ss0sH..', '..HssssssH..', '...HssssH...', '..hHHHHHHh..', '.hHHHHHHHHh.',
  '.hHHHyyHHHh.', '.hHHHHHHHHh.', '.hHHHHHHHHh.', '..hHHHHHHh..', '..hh....hh..', '..00....00..',
];
defineSprite('npc_merchant', NPC, { pal: { H: '#58d858', h: '#2c8a44' } });
defineSprite('npc_smith', NPC, { pal: { H: '#f08030', h: '#b04a18' } });
defineSprite('npc_keeper', NPC, { pal: { H: '#48a8ff', h: '#2858c8' } });
defineSprite('npc_scribe', NPC, { pal: { H: '#c070ff', h: '#7038b8' } });

// ------------------------------------------------------------------ balles de base (les armes peuvent en définir d'autres)
defineSprite('b_round', ['.yy.', 'y11y', 'y11y', '.yy.']);
defineSprite('b_small', ['.y.', 'y1y', '.y.']);
defineSprite('b_long', ['.yyyy.', 'y11111', '.yyyy.']);
defineSprite('b_big', ['.oooo.', 'oyyyyo', 'oy11yo', 'oy11yo', 'oyyyyo', '.oooo.']);
defineSprite('b_arrow', ['......2..', 'nnnnnn222', '......2..']);
defineSprite('b_rocket', ['..444...', '.4aaaar.', 'v4aaaarr', '.4aaaar.', '..444...']);
defineSprite('b_energy', ['.ccc.', 'c111c', 'c111c', 'c111c', '.ccc.']);
defineSprite('b_white', ['.11.', '1111', '1111', '.11.'], { outline: false });
defineSprite('eb_round', ['.eeee.', 'ee11ee', 'e1111e', 'e1111e', 'ee11ee', '.eeee.'], { outline: '#5a0a1e' });
defineSprite('eb_orb', ['..EEEE..', '.EeeeeE.', 'Eee11eeE', 'Ee1111eE', 'Ee1111eE', 'Eee11eeE', '.EeeeeE.', '..EEEE..'], { outline: '#5a0a1e' });
defineSprite('eb_shard', ['.eeeee.', 'e11111e', '.eeeee.'], { outline: '#5a0a1e' });
defineSprite('eb_small', ['.ee.', 'e11e', 'e11e', '.ee.'], { outline: '#5a0a1e' });

// ------------------------------------------------------------------ entités spéciales
defineSprite('mimic', ['.NNNNNNNNNN.', 'NnnnnnnnnnnN', 'Nnr0nnnnr0nN', 'NyyyyyyyyyyN', 'dw0w0w0w0w0d', 'd0RRRRRRRR0d', 'd0w0w0w0w0wd', 'dnnnnnnnnnnd', '.dddddddddd.']);
defineEnemy({
  id: 'mimic', name: 'Mimic', world: 0, sprite: 'mimic', hp: 70, speed: 70, radius: 7, contact: 2, coins: [6, 12], energy: 3, noChampion: true,
  move: { kind: 'hop', period: 0.5, mult: 2.6 },
  attacks: [{ pattern: 'spread', cooldown: 2.2, params: { count: 5, spread: 1.1, speed: 120 } }],
});
defineSprite('dummy', ['...nnnn...', '..nwwwwn..', '..nw00wn..', '..nwwwwn..', '...nnnn...', '.NNNnnNNN.', '...nrrn...', '...nrrn...', '...nnnn...', '....NN....', '....NN....', '..dddddd..']);
defineEnemy({
  id: 'dummy', name: 'Mannequin', world: 0, sprite: 'dummy', hp: 100000, speed: 0, radius: 6, contact: 0, coins: [0, 0], energy: 0, knockbackResist: 1, noChampion: true,
  immune: ['burn', 'poison', 'freeze', 'shock', 'slow'],
  move: { kind: 'stationary' },
  onHurt: (_ctx, e) => { e.hp = e.maxHp; },
});

// ------------------------------------------------------------------ thèmes des trois mondes
defineTheme({
  world: 1, name: 'Sylve Murmurante',
  floor: ['#2f5a3a', '#346241', '#2a5235'], floorDeco: '#4f8a52',
  wallTop: '#6a5238', wallTopLight: '#8a6e4a', wallFace: '#463424', wallFaceDark: '#2c2018',
  voidColor: '#0c140f', hazard: ['#3a2a4a', '#9a5ac8'], slick: ['#3a6a8a', '#6aa0c8'], door: '#c8901c',
  ambient: 0xffffff, music: { bpm: 104, root: 45, scale: [0, 2, 3, 5, 7, 8, 10] }, hazardRate: 0.3, slickRate: 0,
});
defineTheme({
  world: 2, name: 'Glacier Fendu',
  floor: ['#5a7a9a', '#62829f', '#527290'], floorDeco: '#8ab0d0',
  wallTop: '#b8d8f0', wallTopLight: '#e8f8ff', wallFace: '#6a90b8', wallFaceDark: '#4a6a90',
  voidColor: '#0a1020', hazard: ['#28405a', '#4a80b0'], slick: ['#9ad0f0', '#d8f0ff'], door: '#48a8ff',
  ambient: 0xffffff, music: { bpm: 116, root: 50, scale: [0, 2, 4, 7, 9] }, hazardRate: 0.2, slickRate: 0.5,
});
defineTheme({
  world: 3, name: 'Forge Abyssale',
  floor: ['#3a2a2e', '#423034', '#33252a'], floorDeco: '#5a3a3a',
  wallTop: '#6a4048', wallTopLight: '#9a5a58', wallFace: '#3a242c', wallFaceDark: '#20141a',
  voidColor: '#140608', hazard: ['#d83a20', '#ffb030'], slick: ['#4a3a4a', '#6a5a6a'], door: '#e0404a',
  ambient: 0xffffff, music: { bpm: 132, root: 43, scale: [0, 1, 3, 5, 7, 8, 10] }, hazardRate: 0.55, slickRate: 0.1,
});
