// Sprites et entités « système » dont le moteur a besoin : butin, coffres, décor, PNJ, balles de base.
import { defineSprite, defineEnemy, defineTheme } from '../../core/registry';

// ------------------------------------------------------------------ butin (frames : pièce qui tourne, cœur qui bat…)
defineSprite('pk_coin', ['.yyy.', 'y1yyY', 'yyYyY', 'yyyYY', '.YYY.'], {
  frames: [['..y..', '.y1Y.', '.yYY.', '.yyY.', '..Y..'], ['..y..', '..1..', '..y..', '..Y..', '..Y..'], ['..y..', '.y1Y.', '.yYY.', '.yyY.', '..Y..']],
});
defineSprite('pk_energy', ['..c..', '.c1c.', 'cc1cb', '.cbb.', '..b..'], { frames: [['..c..', '.cic.', 'c1ccb', '.cbB.', '..b..'], ['..i..', '.c1c.', 'c11cb', '.cbb.', '..B..']] });
defineSprite('pk_hp', ['.rr.rr.', 'r1rrrrR', 'r1rrrrR', '.rrrrR.', '..rrR..', '...R...'], {
  frames: [['.......', '.rr.rr.', 'r1rrrrR', '.rrrrR.', '..rrR..', '...R...']],
});
defineSprite('pk_gem', ['..p..', '.p1p.', 'p1ppP', '.ppP.', '..P..'], { frames: [['..p..', '.ppp.', 'pp1pP', '.p1P.', '..P..'], ['..1..', '.p1p.', 'ppppP', '.pPP.', '..P..']] });
defineSprite('potion_hp', ['..NN..', '..22..', '.2112.', '2r1rr2', '2rrrr2', '2rRRR2', '.2222.']);
defineSprite('potion_en', ['..NN..', '..22..', '.2112.', '2b1bb2', '2bbbb2', '2bBBB2', '.2222.']);

// ------------------------------------------------------------------ coffres & décor
// coffre : bois cerclé de fer, serrure dorée
defineSprite('chest', ['.4NNNNNNNN4.', '43nnwnnnnn34', '4NnnnnnnnnN4', '4NNNNNNNNNN4', '4433yyyy3344', 'dNnnyy0ynnNd', 'dNnnnyYnnnNd', 'dNnnnnnnnnNd', 'd4NNNNNNNN4d', '.dddddddddd.']);
defineSprite('chest_open', ['.4NNNNNNNN4.', '4NnnnnnnnnN4', '4dddddddddd4', '4d55555555d4', '443333333344', 'dNnnnnnnnnNd', 'dNnnnyYnnnNd', 'dNnnnnnnnnNd', 'd4NNNNNNNN4d', '.dddddddddd.']);
// grand coffre : violet, liseré d'or, gemme
defineSprite('chest_big', [
  '.YyyyyyyyyyyY.', 'YPpp1pppppppPY', 'YPppppppppppPY', 'YPPPPPPPPPPPPY', 'yYYYYYccYYYYYy', 'PpppppcCpppppP', 'PpppppyYpppppP', 'PppppppppppppP', 'PppppppppppppP', 'YPPPPPPPPPPPPY', '.YYYYYYYYYYYY.',
]);
defineSprite('chest_big_open', [
  '.YyyyyyyyyyyY.', 'YPppppppppppPY', 'YP0000000000PY', 'YP0555555550PY', 'yYYYYYYYYYYYYy', 'PppppppppppppP', 'PppppppppppppP', 'PppppppppppppP', 'PppppppppppppP', 'YPPPPPPPPPPPPY', '.YYYYYYYYYYYY.',
]);
// caisse : planches, entretoise en diagonale, clous
defineSprite('crate', ['4NNNNNNNNNN4', 'N2wnnnnnnn2N', 'NnNnnnnnnndN', 'NnnNnnnnnndN', 'NdddNddddddN', 'NnnnnNnnnndN', 'NnnnnnNnnndN', 'NddddddNdddN', 'NnnnnnnnNndN', 'NnnnnnnnnNdN', 'N2nnnnnnnn2N', '4NNNNNNNNNN4']);
// baril explosif : cerclages, symbole de flamme
defineSprite('barrel', ['..RRRRRR..', '.RrrwrrrR.', 'RrrrrrrrRR', '3444444443', 'RrrryyrrRR', 'Rrryy0yrRR', 'RrryyyyrRR', 'RrrryyrrRR', '3444444443', 'RrrrrrrrRR', '.RRrrrrRR.', '..RRRRRR..']);
const PORTAL = [
  '....pppppp....', '..ppPPPPPPpp..', '.pPPbbbbbbPPp.', '.pPbbccccbbPp.', 'pPPbcc11ccbPPp', 'pPbbc1cc1cbbPp', 'pPbcc1cccccbPp', 'pPbccccc1ccbPp',
  'pPbcc1cccccbPp', 'pPbccccc1ccbPp', 'pPbbcc1cccbbPp', 'pPPbcc11ccbPPp', '.pPbbccccbbPp.', '.pPPbbbbbbPPp.', '..ppPPPPPPpp..', '....pppppp....',
];
const flipH = (rows: string[]) => rows.map((r) => r.split('').reverse().join(''));
defineSprite('portal', PORTAL, { frames: [flipH(PORTAL), [...PORTAL].reverse(), flipH([...PORTAL].reverse())] });
// statue des Anciens : pierre ombrée, yeux qui luisent, socle doré (frame 2 : les yeux s'allument)
const STATUE = [
  '....3333....', '...322223...', '...2c22c3...', '...322234...', '....3334....', '..33322333..', '.3222222334.', '.3232222434.', '.3232222434.',
  '.33.3224.34.', '....3224....', '....3224....', '...332244...', '..yYYYYYYY..', '.4433333344.', '.4333333334.', '.4444444444.',
];
defineSprite('statue', STATUE, { frames: [STATUE.map((r, i) => (i === 2 ? '...2i22i3...' : r))] });

// ------------------------------------------------------------------ PNJ (même gabarit, capuches de couleurs différentes)
// 4 frames : repos, mains visibles, repos, clignement
const NPC = [
  '....HHHH....', '...HLHHHH...', '..HLssssHH..', '..Hs0ss0sH..', '..HssSSssH..', '...HssssH...', '..hHHyHHHh..', '.hHLHHHHHHh.',
  '.hHLHyyHHHh.', '.hHHHHHHHhh.', '.hHHHHHHhhh.', '..hHHHHHhh..', '..hh....hh..', '..00....00..',
];
const NPC_HANDS = NPC.map((r, i) => (i === 8 ? '.hsLHyyHHsh.' : r));
const NPC_BLINK = NPC.map((r, i) => (i === 3 ? '..HsSssSsH..' : r));
const npc = (id: string, H: string, h: string, L: string) => defineSprite(id, NPC, { frames: [NPC_HANDS, NPC, NPC_BLINK], pal: { H, h, L } });
npc('npc_merchant', '#58d858', '#2c8a44', '#a8f070');
npc('npc_smith', '#f08030', '#b04a18', '#ffc070');
npc('npc_keeper', '#48a8ff', '#2858c8', '#9ae8ff');
npc('npc_scribe', '#c070ff', '#7038b8', '#e8b8ff');
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
defineSprite('mimic', ['.NNNNNNNNNN.', 'NnnnnnnnnnnN', 'Nnr0nnnnr0nN', 'NyyyyyyyyyyN', 'dw0w0w0w0w0d', 'd0RRRRRRRR0d', 'd0w0w0w0w0wd', 'dnnnnnnnnnnd', '.dddddddddd.'], {
  frames: [['.NNNNNNNNNN.', 'NnnnnnnnnnnN', 'Nnr0nnnnr0nN', 'NyyyyyyyyyyN', 'd0000000000d', 'dw0w0w0w0w0d', 'd0RRRRRRRR0d', 'dnnnnnnnnnnd', '.dddddddddd.']],
});
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
  floor: ['#2f5a3a', '#37643f', '#294f33'], floorDeco: '#5a9a58',
  wallTop: '#6a5238', wallTopLight: '#8a6e4a', wallFace: '#463424', wallFaceDark: '#2c2018',
  voidColor: '#0c140f', hazard: ['#3e2a3e', '#c06aa8'], slick: ['#2f5f80', '#78b0d8'], door: '#c8901c',
  ambient: 0xffffff, music: { bpm: 104, root: 45, scale: [0, 2, 3, 5, 7, 8, 10] }, hazardRate: 0.3, slickRate: 0,
});
defineTheme({
  world: 2, name: 'Glacier Fendu',
  floor: ['#7290ae', '#7c9ab8', '#6886a4'], floorDeco: '#b4d0e8',
  wallTop: '#c8e0f4', wallTopLight: '#eef9ff', wallFace: '#6a90b8', wallFaceDark: '#4a6a90',
  voidColor: '#0a1020', hazard: ['#28405a', '#4a80b0'], slick: ['#9ad0f0', '#d8f0ff'], door: '#48a8ff',
  ambient: 0xffffff, music: { bpm: 116, root: 50, scale: [0, 2, 4, 7, 9] }, hazardRate: 0.2, slickRate: 0.5,
});
defineTheme({
  world: 3, name: 'Forge Abyssale',
  floor: ['#3a2a2e', '#44302f', '#32242a'], floorDeco: '#5e3c38',
  wallTop: '#6a4048', wallTopLight: '#a86058', wallFace: '#3a242c', wallFaceDark: '#20141a',
  voidColor: '#140608', hazard: ['#c8341c', '#ffb030'], slick: ['#4a3a4a', '#6a5a6a'], door: '#e0404a',
  ambient: 0xffffff, music: { bpm: 132, root: 43, scale: [0, 1, 3, 5, 7, 8, 10] }, hazardRate: 0.55, slickRate: 0.1,
});
