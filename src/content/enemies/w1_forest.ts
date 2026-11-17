// Monde 1 « Sylve Murmurante » — lisière (étages 1-2). v2 : sprites redessinés (4 frames), IA plus maligne.
import { defineEnemy, defineSprite } from '../../core/registry';
import { sym, sporeRing, rep, swapCh, up1, down1 } from './w1_patterns';

// ------------------------------------------------------------------ Mousseron (champignon ronchon, crache des spores quand on le tape)
const MOUSS = sym([
  '...RRR', '.RRrrr', 'Rrr1rr', 'Rr11rr', 'Rrrrr1', 'RRrrrr', '.RRRRR',
  '..2www', '..2kww', '..2wkw', '..2w0w', '..2www', '..2wwk', '..2wkw', '...ss.',
]);
defineSprite('e_mousseron', MOUSS, {
  frames: [
    rep(MOUSS, { 14: '..ss....ss..' }),
    up1(swapCh(MOUSS, { '0': '2' })),
    rep(MOUSS, { 14: '....ssss....' }),
  ],
});
defineEnemy({
  id: 'mousseron', name: 'Mousseron grincheux', world: 1, sprite: 'e_mousseron', hp: 20, speed: 34, radius: 6, contact: 1, cost: 1, minFloor: 1, coins: [0, 2],
  move: { kind: 'wander', period: 1.2 },
  attacks: [{ pattern: 'spread', cooldown: 2.3, telegraph: 0.4, params: { count: 3, spread: 0.6, speed: 92 } }],
  // Vexé, il recrache une bouffée de spores (une fois par seconde au plus).
  onHurt: (ctx, e) => {
    if (e.age - (e.data.puff ?? -9) < 1.3 || e.hp < 2) return;
    e.data.puff = e.age;
    ctx.after(0.15, () => sporeRing(ctx, e, 4, 40, 1.5), e);
  },
  onDeath: (ctx, e) => sporeRing(ctx, e, 7, 48),
});

// ------------------------------------------------------------------ Scarabée-bélier (ruée annoncée + éclats de carapace au freinage)
const SCARAB = [
  '...TTTTTT.....', '..TcccttTT....', '.TcctttttTT.a.', 'TtcttttTttT5aa', 'TttttttTtt55aA',
  'TttttttTt5r5A.', 'TTtttttTt555..', '.TTTTTTTTT5...', '..0.0..0.0....', '.0...0..0..0..',
];
defineSprite('e_scarabee', SCARAB, {
  frames: [
    rep(SCARAB, { 8: '...00...00....', 9: '..0..0..0..0..' }),
    swapCh(SCARAB, { c: 'i', r: 'e' }),
    rep(SCARAB, { 8: '..0..0..0..0..', 9: '.0..0...0...0.' }),
  ],
});
defineEnemy({
  id: 'scarabee', name: 'Scarabée-bélier', world: 1, sprite: 'e_scarabee', hp: 27, speed: 46, radius: 6, contact: 1, cost: 1, minFloor: 1, coins: [0, 2],
  knockbackResist: 0.5,
  move: { kind: 'charge', period: 1.5, mult: 3.8, dur: 0.45, range: 170 },
  // En fin de ruée, il secoue sa carapace : trois éclats vers le joueur.
  onUpdate: (ctx, e) => {
    if (e.data.ms === 2 && e.moveState === 0) {
      const t = e.target;
      if (t) {
        const a = Math.atan2(t.y - e.y, t.x - e.x);
        for (const o of [-0.35, 0, 0.35]) ctx.spawnBullet({ damage: 1, speed: 88, sprite: 'eb_shard', radius: 3, life: 2 }, e.x, e.y, a + o, 'enemy', e);
        ctx.sfx('eshoot', 0.35);
      }
    }
    e.data.ms = e.moveState;
  },
});

// ------------------------------------------------------------------ Feu follet (orbite + rafale prédictive)
const FOLLET = sym(['....c', '...cc', '..cic', '.cii1', 'ciiii', 'ci0ii', 'ciiii', '.ciik', '.Ccii', '..CCc', '...C.']);
defineSprite('e_feu_follet', FOLLET, {
  frames: [
    rep(FOLLET, { 0: '.....c....', 1: '....ccc...' }),
    swapCh(rep(FOLLET, { 10: '....C.....' }), { '0': 'i' }),
    rep(FOLLET, { 0: '...c......', 1: '...ccc....' }),
  ],
  outline: '#1a3050',
});
defineEnemy({
  id: 'feu_follet', name: 'Feu follet farceur', world: 1, sprite: 'e_feu_follet', hp: 12, speed: 70, radius: 5, contact: 0, cost: 1, minFloor: 1, coins: [0, 2],
  phasing: true,
  move: { kind: 'orbit', range: 75 },
  // Une balle sur deux vise où vous ALLEZ : l'esquive en ligne droite ne suffit plus.
  attacks: [
    { pattern: 'burst', cooldown: 2.6, telegraph: 0.4, params: { shots: 3, interval: 0.18, speed: 100, sprite: 'eb_small' } },
    { pattern: 'predictif', cooldown: 3.2, telegraph: 0.4, params: { shots: 3, interval: 0.18, speed: 100, sprite: 'eb_small', mix: true } },
  ],
});

// ------------------------------------------------------------------ Luciole fuyarde (fuit + tête chercheuse + tir anticipé)
const LUCI = ['...cc.cc...', '..ciIciIc.d', '...cc.cc.d.', '..yyNNNddd.', '.yy1NnNd10.', 'yyyyNNNdddd', '.yyYNNNdkd.', '..YY.0.0...'];
const LUCI_UP = rep(LUCI, { 0: '...........', 1: '...cc.cc..d', 2: '..ciIciIcd.' });
defineSprite('e_luciole', LUCI, { frames: [LUCI_UP, swapCh(LUCI, { y: 'w', Y: 'y' }), swapCh(LUCI_UP, { y: 'w', Y: 'y' })] });
defineEnemy({
  id: 'luciole', name: 'Luciole fuyarde', world: 1, sprite: 'e_luciole', hp: 11, speed: 66, radius: 5, contact: 0, cost: 1, minFloor: 1, coins: [1, 3],
  phasing: true,
  move: { kind: 'flee', range: 100 },
  attacks: [
    { pattern: 'homing', cooldown: 3, telegraph: 0.45, params: { count: 1, speed: 72, turn: 1.4, life: 3.2, sprite: 'eb_orb' } },
    { pattern: 'predictif', cooldown: 2.4, telegraph: 0.35, params: { speed: 105, sprite: 'eb_small' } },
  ],
});

// ------------------------------------------------------------------ Fleur-tourelle (immobile, spirale + pétales anticipés)
const FLEUR = sym(['...mm.m', '..mmmmm', '.mmmyyy', 'mmmyy0y', '.mmyyyy', '..mmmmy', '...mm.f', '......f', '....gff', '...gg.f', '....nnn', '...NNNN', '....NNN']);
const FLEUR2 = sym(['..m.mm.', '..mmmmm', 'mmmmyyy', '.mmyy0y', 'mmmyyyy', '..mmmmy', '..mm..f', '......f', '...ggff', '....g.f', '....nnn', '...NNNN', '....NNN']);
defineSprite('e_tourelle', FLEUR, { frames: [FLEUR2, swapCh(FLEUR, { m: 'M', y: 'o' }), swapCh(FLEUR2, { '0': 'y' })] });
defineEnemy({
  id: 'fleur_tourelle', name: 'Pétale-canon', world: 1, sprite: 'e_tourelle', hp: 31, speed: 0, radius: 7, contact: 0, cost: 2, minFloor: 2, coins: [1, 3],
  knockbackResist: 1, immune: ['slow'],
  move: { kind: 'stationary' },
  attacks: [
    { pattern: 'spiral', cooldown: 4.2, telegraph: 0.5, params: { arms: 2, shots: 14, interval: 0.11, step: 0.38, speed: 78 } },
    // pétales ondulants puis une graine visée sur la trajectoire du joueur
    { pattern: 'combo', cooldown: 2.6, telegraph: 0.4, params: { steps: [
      { pattern: 'w1_petales', params: { count: 3, spread: 0.5, speed: 90 } },
      { pattern: 'predictif', at: 0.35, params: { speed: 110, sprite: 'eb_shard' } },
    ] } },
  ],
});

// ------------------------------------------------------------------ Crapaud-mortier (sauts + mortier qui ANTICIPE)
const CRAP = [
  '.........gg...', '........g1kg..', '...gggggggggg.', '..gGgggggggggg', '.gGGgggggggggg',
  '.gGlllllkkkkk.', 'GGGllllllllll.', 'GG.Gllllll.G..', '.GGG.GGG..GG..', 'GG..GG...GG...',
];
defineSprite('e_crapaud', CRAP, {
  frames: [down1(CRAP), up1(rep(CRAP, { 9: '.G..G....G....' })), rep(CRAP, { 1: '........gggg..' })],
});
defineEnemy({
  id: 'crapaud', name: 'Crapaud-mortier', world: 1, sprite: 'e_crapaud', hp: 27, speed: 50, radius: 6, contact: 1, cost: 1, minFloor: 2, coins: [0, 3],
  move: { kind: 'hop', period: 1.15, mult: 2.3, dur: 0.35 },
  attacks: [
    { pattern: 'lobPredictif', cooldown: 2.6, telegraph: 0.45, stop: 0.3, params: { count: 1, radius: 20, time: 1, lead: 0.9, mark: 0xb98a52 } },
    { pattern: 'lob', cooldown: 3.6, telegraph: 0.45, stop: 0.3, params: { count: 2, scatter: 30, radius: 18, time: 1.1 } },
  ],
});

// ------------------------------------------------------------------ Farfadet clignotant (téléportation + tir surprise + croix)
const FARF = sym(['.....y', '....pp', '...pPp', '..pppP', '.ppppp', 'PPPPPP', '.ssSss', '.s0sss', '.Sksss', '..Skkk', '..pPPp', '.ppPPp', '..d...']);
defineSprite('e_farfadet', FARF, {
  frames: [
    rep(FARF, { 12: '...d....d...' }),
    swapCh(FARF, { '0': 'y' }),
    rep(FARF, { 0: '......y.....', 1: '.....ppp....' }),
  ],
});
defineEnemy({
  id: 'farfadet', name: 'Farfadet clignotant', world: 1, sprite: 'e_farfadet', hp: 17, speed: 32, radius: 5, contact: 0, cost: 1, minFloor: 2, coins: [1, 3],
  move: { kind: 'teleport', period: 2.5, range: 110 },
  attacks: [{ pattern: 'cross', cooldown: 2.6, telegraph: 0.45, params: { arms: 4, perArm: 2, speed: 74, sprite: 'eb_small' } }],
  // Coucou ! Chaque réapparition est suivie d'une petite salve anticipée.
  onUpdate: (ctx, e) => {
    const lx = e.data.lx ?? e.x, ly = e.data.ly ?? e.y;
    e.data.lx = e.x; e.data.ly = e.y;
    if (Math.hypot(e.x - lx, e.y - ly) > 24 && e.target) {
      ctx.text(e.x, e.y - 12, 'Coucou !', 0xc070ff);
      ctx.after(0.35, () => {
        const fn = ctx.world.reg.patterns.get('predictif');
        if (fn && e.target) fn(ctx, e, { count: 2, spread: 0.22, speed: 100, sprite: 'eb_small' }, e.target);
      }, e);
    }
  },
});

// ------------------------------------------------------------------ Guêpe-dard (zigzag, ruée, dard anticipé)
const GUEPE = ['....cc..cc...', '...ciIccIc...', '....ccccc....', '..ykykyyddd..', '.yykykyydd10.', 'kyykykyydddd.', '.yykykyyddkd.', '..ykykyy.0.0.', '.........0..0'];
const GUEPE_W = rep(GUEPE, { 0: '.............', 1: '....cc..cc...', 2: '...ciIccIc...' });
defineSprite('e_guepe', GUEPE, { frames: [GUEPE_W, rep(GUEPE, { 4: '.yykykyydd1r.' }), GUEPE_W] });
defineEnemy({
  id: 'guepe', name: 'Guêpe-dard', world: 1, sprite: 'e_guepe', hp: 15, speed: 76, radius: 5, contact: 1, cost: 1, minFloor: 2, coins: [0, 2],
  phasing: true,
  move: { kind: 'zigzag' },
  attacks: [
    { pattern: 'dash', cooldown: 3, telegraph: 0.45, range: 130, params: { speed: 235, dur: 0.3 } },
    { pattern: 'predictif', cooldown: 2, telegraph: 0.35, params: { speed: 112, sprite: 'eb_shard', lead: 0.9 } },
  ],
});
