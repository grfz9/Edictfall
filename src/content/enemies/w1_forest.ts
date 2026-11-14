// Monde 1 « Sylve Murmurante » — lisière (étages 1-2).
import { defineEnemy, defineSprite } from '../../core/registry';
import { sym, sporeRing } from './w1_patterns';

// ------------------------------------------------------------------ Mousseron (champignon, spores à la mort)
defineSprite('e_mousseron', sym(['....RR', '..RRrr', '.Rr1rr', 'Rrrrr1', 'R1rrrr', 'RRRRRR', '..wwww', '..w0ww', '..wwww', '...ss.']), {
  frames: [sym(['......', '...RRR', '.RRrrr', 'Rr1rrr', 'Rrrrr1', 'RRRRRR', '..wwww', '..w0ww', '..wwww', '..ss..'])],
});
defineEnemy({
  id: 'mousseron', name: 'Mousseron grincheux', world: 1, sprite: 'e_mousseron', hp: 16, speed: 30, radius: 6, contact: 1, cost: 1, minFloor: 1, coins: [0, 2],
  move: { kind: 'wander', period: 1.4 },
  attacks: [{ pattern: 'spread', cooldown: 2.6, telegraph: 0.4, params: { count: 3, spread: 0.6, speed: 90 } }],
  onDeath: (ctx, e) => sporeRing(ctx, e, 6, 45),
});

// ------------------------------------------------------------------ Scarabée-bélier (ruée annoncée)
defineSprite('e_scarabee', sym(['.....a', '....aa', '..TTTT', '.Ttc1t', 'TtttTt', 'Ttt0tt', 'TtttTt', '.TTTTT', '.0..0.']), {
  frames: [sym(['.....a', '....aa', '..TTTT', '.Ttc1t', 'TtttTt', 'Ttt0tt', 'TtttTt', '.TTTTT', '0..0..'])],
});
defineEnemy({
  id: 'scarabee', name: 'Scarabée-bélier', world: 1, sprite: 'e_scarabee', hp: 22, speed: 42, radius: 6, contact: 1, cost: 1, minFloor: 1, coins: [0, 2],
  knockbackResist: 0.4,
  move: { kind: 'charge', period: 1.8, mult: 3.4, dur: 0.45, range: 160 },
});

// ------------------------------------------------------------------ Feu follet (orbite + rafale)
defineSprite('e_feu_follet', sym(['....c', '...cc', '..cic', '.cii1', '.ci0i', 'cciii', '.Cccc', '..CCc', '...CC']), {
  frames: [sym(['...c.', '....c', '..ccc', '.cii1', '.ci0i', 'cciii', '.Cccc', '..CCc', '....C'])],
  outline: '#1a3050',
});
defineEnemy({
  id: 'feu_follet', name: 'Feu follet farceur', world: 1, sprite: 'e_feu_follet', hp: 10, speed: 62, radius: 5, contact: 0, cost: 1, minFloor: 1, coins: [0, 2],
  phasing: true,
  move: { kind: 'orbit', range: 75 },
  attacks: [{ pattern: 'burst', cooldown: 2.8, telegraph: 0.4, params: { shots: 3, interval: 0.18, speed: 100, sprite: 'eb_small' } }],
});

// ------------------------------------------------------------------ Luciole fuyarde (fuit + tête chercheuse)
defineSprite('e_luciole', sym(['cc...', 'ccc..', '.cddd', '..d1d', '..ddd', '..yyy', '..y1y', '...yy', '....y']), {
  frames: [sym(['.....', 'cc...', 'cccdd', '..d1d', '..ddd', '..yyy', '..y1y', '...yy', '....y'])],
});
defineEnemy({
  id: 'luciole', name: 'Luciole fuyarde', world: 1, sprite: 'e_luciole', hp: 9, speed: 58, radius: 5, contact: 0, cost: 1, minFloor: 1, coins: [1, 3],
  phasing: true,
  move: { kind: 'flee', range: 95 },
  attacks: [{ pattern: 'homing', cooldown: 3.2, telegraph: 0.45, params: { count: 1, speed: 70, turn: 1.3, life: 3.2, sprite: 'eb_orb' } }],
});

// ------------------------------------------------------------------ Fleur-tourelle (immobile, spirale)
defineSprite('e_tourelle', sym(['...mm.m', '..mmmmm', '.mmmyyy', 'mmmyy0y', '.mmyyyy', '..mmmmy', '...mm.f', '......f', '....gff', '...gg.f', '....nnn', '...NNNN', '....NNN']), {
  frames: [sym(['..m.mm.', '..mmmmm', 'mmmmyyy', '.mmyy0y', 'mmmyyyy', '..mmmmy', '..mm..f', '......f', '...ggff', '....g.f', '....nnn', '...NNNN', '....NNN'])],
});
defineEnemy({
  id: 'fleur_tourelle', name: 'Pétale-canon', world: 1, sprite: 'e_tourelle', hp: 26, speed: 0, radius: 7, contact: 0, cost: 2, minFloor: 2, coins: [1, 3],
  knockbackResist: 1, immune: ['slow'],
  move: { kind: 'stationary' },
  attacks: [
    { pattern: 'spiral', cooldown: 4.6, telegraph: 0.5, params: { arms: 2, shots: 12, interval: 0.12, step: 0.38, speed: 75 } },
    { pattern: 'w1_petales', cooldown: 2.6, telegraph: 0.4, params: { count: 3, spread: 0.5, speed: 90 } },
  ],
});

// ------------------------------------------------------------------ Crapaud-mortier (sauts + tir en cloche)
defineSprite('e_crapaud', sym(['......', '..ggg.', '.g1kgg', 'gggggg', 'Gllggg', 'Gllllg', 'GGllll', '.GGGGG', '.Gg..G']), {
  frames: [sym(['..ggg.', '.g1kgg', 'gggggg', 'Gllggg', 'Gllllg', 'GGllll', '.GGGGG', 'G.....', '......'])],
});
defineEnemy({
  id: 'crapaud', name: 'Crapaud-mortier', world: 1, sprite: 'e_crapaud', hp: 22, speed: 46, radius: 6, contact: 1, cost: 1, minFloor: 2, coins: [0, 3],
  move: { kind: 'hop', period: 1.3, mult: 2.2, dur: 0.35 },
  attacks: [{ pattern: 'lob', cooldown: 2.8, telegraph: 0.45, stop: 0.3, params: { count: 1, radius: 20, time: 1 } }],
});

// ------------------------------------------------------------------ Farfadet clignotant (téléportation + croix)
defineSprite('e_farfadet', sym(['....p', '...pp', '..ppp', '.ppPP', '.Psys', '..sss', '.pppp', 'ppPpp', '.pPpp', '..d.d']), {
  frames: [sym(['....p', '...pp', '..ppp', '.ppPP', '.Psys', '..sss', 'ppppp', '.pPpp', '.pPpp', '.d..d'])],
});
defineEnemy({
  id: 'farfadet', name: 'Farfadet clignotant', world: 1, sprite: 'e_farfadet', hp: 14, speed: 30, radius: 5, contact: 0, cost: 1, minFloor: 2, coins: [1, 3],
  move: { kind: 'teleport', period: 2.8, range: 110 },
  attacks: [{ pattern: 'cross', cooldown: 2.9, telegraph: 0.45, params: { arms: 4, perArm: 2, speed: 72, sprite: 'eb_small' } }],
});

// ------------------------------------------------------------------ Guêpe-dard (zigzag, ruée, dard)
defineSprite('e_guepe', sym(['.cc...', 'cccc..', '.ccyyy', '..y0yy', '..yyyy', '..kkkk', '..yyyy', '..kkkk', '...yyy', '.....k']), {
  frames: [sym(['......', '.c....', 'cccyyy', '.cy0yy', '..yyyy', '..kkkk', '..yyyy', '..kkkk', '...yyy', '.....k'])],
});
defineEnemy({
  id: 'guepe', name: 'Guêpe-dard', world: 1, sprite: 'e_guepe', hp: 12, speed: 70, radius: 5, contact: 1, cost: 1, minFloor: 2, coins: [0, 2],
  phasing: true,
  move: { kind: 'zigzag' },
  attacks: [
    { pattern: 'dash', cooldown: 3.4, telegraph: 0.45, range: 120, params: { speed: 200, dur: 0.3 } },
    { pattern: 'aimed', cooldown: 2.2, telegraph: 0.35, params: { speed: 110, sprite: 'eb_shard' } },
  ],
});
