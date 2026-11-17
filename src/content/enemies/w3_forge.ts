// Monde 3 « Forge Abyssale » — bestiaire (22 ennemis + 2 invocations).
import { defineEnemy, defineSprite } from '../../core/registry';
import { swapPx, flipPx, emberPuddle, gapRing, bombUpdate, bombDeath } from './w3_patterns';
import { R } from '../../core/registry';
import { up1, rallyAllies, wardAllies } from './w1_patterns';

const LAVA = { v: 'o', o: 'v' };
const GLOW = { v: 'y', y: 'v' };

// =================================================================== étage 1
// --- Diablotin marteleur : fonce et cogne.
const IMP = ['..V......V..', '..VV....VV..', '...vvvvvv...', '..vvvvvvvv..', '..v1kvv1kv..', '..vvvvvvvv..', '...vV00Vv...', '.4.OOOOOO...', '444OooooO...', '.4.OOOOOO...', '....d..d....', '...dd..dd...'];
defineSprite('e_w3_imp', IMP, { frames: [[...IMP.slice(0, 7), '444OOOOOO...', '.4.OooooO...', '.4.OOOOOO...', '...d....d...', '..dd....dd..']] });
defineEnemy({
  id: 'w3_imp', name: 'Diablotin marteleur', world: 3, minFloor: 1, cost: 1, sprite: 'e_w3_imp', hp: 36, speed: 64, radius: 6, contact: 1, coins: [0, 2],
  move: { kind: 'chase', range: 14 },
  attacks: [{ pattern: 'melee', cooldown: 1.5, telegraph: 0.45, range: 32, stop: 0.3, params: { range: 24, arc: 1.9, damage: 1, color: 0xff8030 } }],
});

// --- Chauve-braise : zigzague, éclate en escarbilles à sa mort.
const BAT = ['V............V', 'VV..VVVVVV..VV', 'VVVVVvvvvVVVVV', '.VVVv1vv1vVVV.', '..VVvyyyyvVV..', '...VVvkkvVV...', '....VV..VV....'];
defineSprite('e_w3_bat', BAT, { frames: [['..............', '....VVVVVV....', '..VVVvvvvVVV..', '.VVVv1vv1vVVV.', 'VVVVvyyyyvVVVV', 'VV.VVvkkvVV.VV', 'V...VV..VV...V']] });
defineEnemy({
  id: 'w3_ember_bat', name: 'Chauve-braise', world: 3, minFloor: 1, cost: 1, sprite: 'e_w3_bat', hp: 31, speed: 88, radius: 5, contact: 1, coins: [0, 1], phasing: true,
  move: { kind: 'zigzag' },
  onDeath: (ctx, e) => gapRing(ctx, e, { count: 5, gap: 0, speed: 95, life: 1.2 }),
});

// --- Salamandre : garde ses distances, rafales incendiaires (brûlure courte).
const SAL = ['.........oooo.', '........oo1koo', 'V.....oooooooo', 'VV.ooOoOoOoRRo', '.VooyoyoyooRo.', '..ooooooooo...', '..VV..VV..VV..', '..V...V...V...'];
const SAL2 = [...SAL.slice(0, 6), '...VV..VV..VV.', '....V...V...V.'];
defineSprite('e_w3_salamander', SAL, { frames: [SAL2, swapPx(SAL, { y: 'v', R: 'V' }), swapPx(SAL2, { y: 'v', V: 'y' })] });
defineEnemy({
  id: 'w3_salamander', name: 'Salamandre des soufflets', world: 3, minFloor: 1, cost: 1, sprite: 'e_w3_salamander', hp: 41, speed: 58, radius: 6, contact: 1, coins: [0, 2],
  immune: ['burn'],
  move: { kind: 'keepDistance', range: 100 },
  attacks: [
    { pattern: 'burst', cooldown: 2.8, telegraph: 0.4, params: { shots: 3, interval: 0.16, speed: 128, sprite: 'eb_w3_ember', bullet: { status: { kind: 'burn', dur: 1.5 } } } },
    { pattern: 'predictif', cooldown: 3.2, telegraph: 0.4, params: { shots: 3, interval: 0.16, speed: 135, sprite: 'eb_w3_ember', mix: true } },
  ],
});

// --- Scorie rampante : erre et sème des braises.
const SLAG = ['....4444....', '..44555544..', '.4555v55554.', '45y1555y1554', '4555v555v554', '455555v55554', '.4444444444.', '..o...o...o.'];
defineSprite('e_w3_slag', SLAG, { frames: [['............', '...444444...', '.445555v544.', '45y1555y1554', '4555v555v554', '455555v55554', '.4444444444.', '...o...o...o']] });
defineEnemy({
  id: 'w3_slag_crawler', name: 'Scorie rampante', world: 3, minFloor: 1, cost: 1, sprite: 'e_w3_slag', hp: 48, speed: 40, radius: 6, contact: 1, coins: [0, 2],
  immune: ['burn'],
  move: { kind: 'wander', period: 1.4 },
  attacks: [
    { pattern: 'mines', cooldown: 3.2, telegraph: 0.4, params: { count: 3, scatter: 22, life: 4, sprite: 'eb_w3_slag', radius: 4 } },
    { pattern: 'aimed', cooldown: 2.4, telegraph: 0.35, params: { speed: 105, sprite: 'eb_w3_ember' } },
  ],
});

// --- Canon-mortier : tourelle, obus en cloche qui éclatent.
const MORT = ['.....4444.....', '....455554....', '....4kkkk4....', '.....4554.....', '....aa44aa....', '...aaaaaaaa...', '..aa1y44y1aa..', '..aaaaaaaaaa..', '.NNNNNNNNNNNN.', 'NnnnnnnnnnnnnN', 'NNNNNNNNNNNNNN', '.dd........dd.'];
defineSprite('e_w3_mortar', MORT, { frames: [swapPx(MORT, { k: 'v', '1': 'y', y: '1' })] });
defineEnemy({
  id: 'w3_mortar', name: 'Canon-mortier', world: 3, minFloor: 1, cost: 2, sprite: 'e_w3_mortar', hp: 72, speed: 0, radius: 7, contact: 0, coins: [1, 3], knockbackResist: 1,
  move: { kind: 'stationary' },
  attacks: [{ pattern: 'w3_mortar', cooldown: 3, telegraph: 0.6, range: 320, params: { count: 1, scatter: 14, radius: 22, shards: 6, shardSpeed: 100, time: 1.15 } }],
});

// --- Feu-follet de forge : fuit et lâche des têtes chercheuses lentes.
const WISP = ['....y.....', '...yvy....', '..yvvvy...', '..vvyvv...', '.vv1v1vv..', '.vvvvvvv..', '.vvvkvvv..', '..vvvvv...', '..VvvvV...', '...VvV....', '....V.....'];
defineSprite('e_w3_wisp', WISP, { frames: [['.....y....', '....yvy...', '..yvvvy...', ...WISP.slice(3, 10), '...V......']] });
defineEnemy({
  id: 'w3_wisp', name: 'Feu-follet de forge', world: 3, minFloor: 1, cost: 1, sprite: 'e_w3_wisp', hp: 31, speed: 70, radius: 5, contact: 0, coins: [0, 2], phasing: true,
  immune: ['burn'],
  move: { kind: 'flee', range: 95 },
  attacks: [
    { pattern: 'homing', cooldown: 3, telegraph: 0.45, params: { count: 2, speed: 95, turn: 1.5, life: 3, sprite: 'eb_w3_ember' } },
    { pattern: 'predictif', cooldown: 2.4, telegraph: 0.35, params: { speed: 130, sprite: 'eb_w3_ember' } },
  ],
});

// --- Crapaud de cendre : saute et crache en éventail.
const TOAD = ['...55..55...', '..51y55y15..', '.5555555555.', '555vvvvvv555', '5555RRRR5555', '.5vvvvvvvv5.', '.5555555555.', '55.5....5.55', '4..........4'];
defineSprite('e_w3_toad', TOAD, { frames: [['............', '...55..55...', '..51y55y15..', '.5555555555.', '555vvvvvv555', '5555RRRR5555', '.5vvvvvvvv5.', '.5555555555.', '.55......55.']] });
defineEnemy({
  id: 'w3_ash_toad', name: 'Crapaud de cendre', world: 3, minFloor: 1, cost: 1, sprite: 'e_w3_toad', hp: 38, speed: 52, radius: 6, contact: 1, coins: [0, 2],
  move: { kind: 'hop', period: 1.1, mult: 2.6, dur: 0.32 },
  attacks: [{ pattern: 'spread', cooldown: 2.2, telegraph: 0.4, params: { count: 5, spread: 0.9, speed: 115, sprite: 'eb_w3_ember' } }],
});

// --- Nuée d'escarbilles : essaim zigzaguant qui postillonne.
const CIND = ['...y........', '..yvy....v..', '.yv0vy..vyv.', '..yvy..vy0yv', '...v....vyv.', '.....v...v..', '....vyv.....', '...vy0yv....', '....vyv.....', '.....v......'];
const CIND2 = up1(swapPx(CIND, { y: 'v', v: 'y' }));
defineSprite('e_w3_cinders', CIND, { frames: [flipPx(CIND), CIND2, flipPx(CIND2)], outline: '#3a0a10' });
defineEnemy({
  id: 'w3_cinder_swarm', name: "Nuée d'escarbilles", world: 3, minFloor: 1, cost: 1, sprite: 'e_w3_cinders', hp: 31, speed: 66, radius: 5, contact: 1, coins: [0, 1], phasing: true,
  immune: ['burn'],
  move: { kind: 'zigzag' },
  attacks: [{ pattern: 'spray', cooldown: 2.7, telegraph: 0.45, params: { shots: 7, arc: 0.8, interval: 0.08, speed: 120, sprite: 'eb_w3_ember' } }],
});

// =================================================================== étage 2
// --- Soufflet vivant : fuit, puis souffle — repousse le joueur vers la lave.
const BEL = ['.....aa.....', '.....aa.....', '....NNNN....', '...NnnnnN...', '..NnnnnnnN..', '.Nn1knn1knN.', '.NnnnnnnnnN.', '.NdNdNdNdNN.', '..NnnnnnnN..', '...NNNNNN...', '...dd..dd...'];
defineSprite('e_w3_bellows', BEL, { frames: [[...BEL.slice(0, 4), '..NNnnnnNN..', '.Nn1knn1knN.', '.NNNNNNNNNN.', '.NdNdNdNdNN.', '..NnnnnnnN..', '...NNNNNN...', '..dd....dd..']] });
defineEnemy({
  id: 'w3_bellows', name: 'Soufflet vivant', world: 3, minFloor: 2, cost: 2, sprite: 'e_w3_bellows', hp: 53, speed: 56, radius: 6, contact: 0, coins: [1, 2],
  move: { kind: 'flee', range: 60 },
  attacks: [
    { pattern: 'w3_bellows', cooldown: 2.8, telegraph: 0.6, range: 110, stop: 0.5, params: { range: 100, push: 330, count: 7, speed: 120 } },
    { pattern: 'aimed', cooldown: 2.2, telegraph: 0.35, params: { count: 2, spread: 0.3, speed: 110, sprite: 'eb_w3_ember' } },
  ],
});

// --- Enclume vivante : sautille lourdement ; chaque atterrissage fait une onde ; onde de choc qui s'emballe.
const ANV = ['..aaaaaaaaaaaa..', 'aaa2222222222aaa', '.aaaaaaaaaaaaaa.', '...a4y1aa4y1a...', '....aaaaaaaa....', '.....a4kk4a.....', '.....aaaaaa.....', '....aaaaaaaa....', '...a44444444a...', '..a4444444444a..', '..aaaaaaaaaaaa..', '..vv........vv..'];
defineSprite('e_w3_anvil', ANV, { frames: [[...swapPx(ANV.slice(0, 11), { y: 'v', '1': 'y' }), '...vv......vv...']] });
defineEnemy({
  id: 'w3_living_anvil', name: 'Enclume vivante', world: 3, minFloor: 2, cost: 3, sprite: 'e_w3_anvil', hp: 180, speed: 46, radius: 8, contact: 2, coins: [2, 4], knockbackResist: 0.8,
  move: { kind: 'hop', period: 1.5, mult: 2.2, dur: 0.38 },
  attacks: [{ pattern: 'w3_gapring', cooldown: 3.4, telegraph: 0.55, stop: 0.6, params: { count: 16, gap: 3, speed: 45, accel: 50, life: 2.2, shake: 3 } }],
  onUpdate: (ctx, e) => {
    if (e.data.ms === 1 && e.moveState === 0) {
      gapRing(ctx, e, { count: 8, gap: 1, speed: 95, life: 1.1 });
      ctx.shake(2);
    }
    e.data.ms = e.moveState;
  },
});

// --- Pétard-follet : poursuit, s'arme au contact, explose (0.7 s d'annonce).
const BOMB = ['......y...', '.....yv...', '....d.....', '..55d555..', '.55555555.', '5515555155', '5555RR5555', '.55555555.', '..555555..', '...d..d...'];
defineSprite('e_w3_bomb', BOMB, { frames: [['.....y....', '.....vy...', ...BOMB.slice(2, 9), '..d....d..']] });
defineEnemy({
  id: 'w3_fuse_imp', name: 'Pétard-follet', world: 3, minFloor: 2, cost: 1, sprite: 'e_w3_bomb', hp: 31, speed: 98, radius: 5, contact: 0, coins: [0, 2],
  move: { kind: 'chase' },
  onUpdate: (ctx, e, dt) => {
    if (e.data.base === undefined) e.data.base = e.speed;
    const t = e.target;
    if (e.data.fuse === undefined) e.speed = e.data.base * (t && Math.hypot(t.x - e.x, t.y - e.y) < 90 ? 1.35 : 1);
    bombUpdate(ctx, e, dt, 30, 2);
  },
  onDeath: bombDeath,
});

// --- Orbe-fournaise : tourne autour du joueur en spirale.
const ORB = ['....OOOO....', '..OOvvvvOO..', '.OvvyyyyvvO.', '.Ovy1111yvO.', 'Ovy11kk11yvO', 'Ovy1k11k1yvO', 'Ovy111111yvO', 'Ovy11RR11yvO', '.Ovy1111yvO.', '.OvvyyyyvvO.', '..OOvvvvOO..', '....OOOO....'];
defineSprite('e_w3_orb', ORB, { frames: [swapPx(ORB, GLOW)] });
defineEnemy({
  id: 'w3_furnace_orb', name: 'Orbe-fournaise', world: 3, minFloor: 2, cost: 2, sprite: 'e_w3_orb', hp: 55, speed: 60, radius: 6, contact: 1, coins: [1, 2], phasing: true,
  immune: ['burn'],
  move: { kind: 'orbit', range: 85 },
  attacks: [{ pattern: 'spiral', cooldown: 4, telegraph: 0.5, stop: 1, params: { arms: 2, shots: 12, interval: 0.09, step: 0.4, speed: 100, sprite: 'eb_w3_ember' } }],
});

// --- Geyser de magma : fixe, anneaux successifs décalés.
const GEY = ['.....yy.....', '....yvvy....', '....vvvv....', '...4vVVv4...', '..44vVVv44..', '..45y11y54..', '.4455555544.', '.4555vv5554.', '445555555544', '455v5555v554', '444444444444'];
defineSprite('e_w3_geyser', GEY, { frames: [['....y..y....', ...swapPx(GEY.slice(1), LAVA)]] });
defineEnemy({
  id: 'w3_geyser', name: 'Geyser de magma', world: 3, minFloor: 2, cost: 2, sprite: 'e_w3_geyser', hp: 62, speed: 0, radius: 7, contact: 1, coins: [1, 3], knockbackResist: 1,
  immune: ['burn'],
  move: { kind: 'stationary' },
  attacks: [{ pattern: 'rings', cooldown: 3.6, telegraph: 0.55, range: 300, params: { waves: 3, count: 10, interval: 0.4, speed: 100, sprite: 'eb_w3_ember' } }],
});

// =================================================================== étage 3
// --- Golem de scories : lent, laisse une traînée de flaques, jette des rochers.
const GOL = ['......444444......', '.....45555554.....', '.....5y155y15.....', '....4555vv5554....', '..44455555555444..', '.4555v55555555v54.', '45555v555v55555554', '455555v5555v555554', '.4554555555554554.', '.44..4555v5554..44', '.....455555554....', '.....4554.4554....', '....4554...4554...', '....vvvv...vvvv...'];
defineSprite('e_w3_golem', GOL, { frames: [[...swapPx(GOL.slice(0, 11), LAVA), '.....4554..4554...', '.....4554..4554...', '.....oooo..oooo...']] });
defineEnemy({
  id: 'w3_slag_golem', name: 'Golem de scories', world: 3, minFloor: 3, cost: 4, sprite: 'e_w3_golem', hp: 215, speed: 28, radius: 9, contact: 2, coins: [3, 6], knockbackResist: 0.9, energy: 2,
  immune: ['burn'],
  move: { kind: 'chase' },
  attacks: [
    { pattern: 'lob', cooldown: 3.2, telegraph: 0.5, params: { count: 3, scatter: 40, radius: 22, time: 1.1, color: 0xff9040 } },
    { pattern: 'melee', cooldown: 2.2, telegraph: 0.6, range: 40, stop: 0.5, params: { range: 32, arc: 2.2, damage: 2, color: 0xff7030 } },
  ],
  onUpdate: (ctx, e, dt) => {
    e.data.pt = (e.data.pt ?? 1) - dt;
    if (e.data.pt <= 0) { e.data.pt = 1.1; emberPuddle(ctx, e, e.x, e.y + 5, 3); }
  },
});

// --- Automate en fusion : charges ; sous 50 % PV, entre en surchauffe (plus rapide, tire plus).
const AUT = ['....aaaa....', '...a2222a...', '...a1yy1a...', '...aaaaaa...', '.aaavvvvaaa.', 'aa.avyyva.aa', '4a.avvvva.a4', '4..aaaaaa..4', '...a4..4a...', '...a4..4a...', '..aa....aa..'];
defineSprite('e_w3_automaton', AUT, { frames: [[...swapPx(AUT.slice(0, 10), { v: 'o', y: '1' }), '...aa..aa...']] });
defineEnemy({
  id: 'w3_molten_automaton', name: 'Automate en fusion', world: 3, minFloor: 3, cost: 2, sprite: 'e_w3_automaton', hp: 86, speed: 50, radius: 6, contact: 1, coins: [1, 3],
  move: { kind: 'charge', range: 170, mult: 3, dur: 0.45, period: 1.9 },
  attacks: [{ pattern: 'cross', cooldown: 3.2, telegraph: 0.5, params: { arms: 4, perArm: 3, speed: 95, sprite: 'eb_w3_ember' } }],
  onHurt: (ctx, e, ev) => {
    const left = e.hp - ev.amount;
    if (!e.data.rage && left > 0 && left < e.maxHp * 0.5) {
      e.data.rage = true;
      e.speed *= 1.45;
      e.attacks = e.attacks.map((a) => ({ ...a, cooldown: a.cooldown * 0.6, params: { ...a.params, arms: 6 } }));
      ctx.text(e.x, e.y - 14, 'SURCHAUFFE !', 0xff7030, true);
      ctx.burst(e.x, e.y, 0xff7030, 12, 90, 0.5);
    }
  },
});

// --- Ver de lave : surgit près du joueur (blink) et éclate en anneau.
const WORM = ['....vvvv......', '...vy1vvv.....', '..vvvvVvvv....', '..vRRvvVVvv...', '...vvv..vVvv..', '.........vVv..', '..OO.....vvv..', '.OOOO...vVv...', 'OOOOOOOOOOOO..'];
defineSprite('e_w3_worm', WORM, { frames: [swapPx(WORM, { y: '1', '1': 'y', V: 'R' })] });
defineEnemy({
  id: 'w3_lava_worm', name: 'Ver de lave', world: 3, minFloor: 3, cost: 2, sprite: 'e_w3_worm', hp: 67, speed: 34, radius: 6, contact: 1, coins: [1, 3],
  immune: ['burn'],
  move: { kind: 'wander', period: 1.6 },
  attacks: [
    { pattern: 'blink', cooldown: 3.6, telegraph: 0.5, range: 300, params: { min: 50, max: 85, delay: 0.45, then: { count: 9, speed: 100, sprite: 'eb_w3_ember' } } },
    { pattern: 'predictif', cooldown: 2.2, telegraph: 0.35, params: { count: 3, spread: 0.3, speed: 120, sprite: 'eb_w3_ember', lead: 0.85 } },
  ],
});

// --- Maître-forgeron : reste en retrait et « retrempe » ses voisins (soin périodique visible).
const SMITH = ['....dddd....', '...dsssssd..', '...s1ks1ks..', '...sssssss..', '...SdddddS..', '..VVVnnnVVV.', '.VVnnnnnnnVV', '.s.nnnnnnn.a', '.s.nnnynnn.a', '...nnnnnnn.a', '...NN...NN.a', '...dd...dd..'];
defineSprite('e_w3_smith', SMITH, { frames: [[...swapPx(SMITH.slice(0, 11), { y: 'v' }), '..dd.....dd.']] });
defineEnemy({
  id: 'w3_forge_master', name: 'Maître-forgeron', world: 3, minFloor: 3, cost: 3, sprite: 'e_w3_smith', hp: 77, speed: 46, radius: 6, contact: 1, coins: [2, 4],
  move: { kind: 'keepDistance', range: 115 },
  attacks: [
    { pattern: 'aimed', cooldown: 2.2, telegraph: 0.4, params: { count: 3, spread: 0.5, speed: 120, sprite: 'eb_w3_ember' } },
    { pattern: 'combo', cooldown: 3.4, telegraph: 0.4, params: { steps: [
      { pattern: 'predictif', params: { speed: 135, sprite: 'eb_w3_ember' } },
      { pattern: 'predictif', at: 0.25, params: { count: 2, spread: 0.3, speed: 135, sprite: 'eb_w3_ember' } },
    ] } },
  ],
  onUpdate: (ctx, e, dt) => {
    wardAllies(ctx, e, dt, { radius: 100, hits: 7, recharge: 5, color: 0xffb040 });
    e.data.bt = (e.data.bt ?? 2.5) - dt;
    if (e.data.bt > 0) return;
    e.data.bt = 4.5;
    let any = false;
    for (const o of ctx.enemiesIn(e.x, e.y, 85)) {
      if (o === e || o.def.boss || o.hp >= o.maxHp) continue;
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.15);
      ctx.burst(o.x, o.y, 0xffb040, 5, 40, 0.4);
      any = true;
    }
    if (any) { ctx.ring(e.x, e.y, 85, 0xffb040); ctx.text(e.x, e.y - 12, 'Retrempe !', 0xffb040); }
  },
});

// =================================================================== étage 4
// --- Fondeur à creuset : verse des murs de métal (avec trou).
const FOUND = ['....5555....', '...555555...', '...5y55y5...', '...555555...', '..O.5555.O..', '.OO555555OO.', '.4OOOOOOOO4.', '.4OvvvvvvO4.', '..4OvvvvO4..', '...4OOOO4...', '....5555....', '...55..55...', '...44..44...'];
defineSprite('e_w3_founder', FOUND, { frames: [[...swapPx(FOUND.slice(0, 11), { v: 'y' }), '..55....55..', '..44....44..']] });
defineEnemy({
  id: 'w3_crucible_founder', name: 'Fondeur à creuset', world: 3, minFloor: 4, cost: 2, sprite: 'e_w3_founder', hp: 79, speed: 44, radius: 6, contact: 1, coins: [1, 3],
  move: { kind: 'keepDistance', range: 110 },
  attacks: [
    { pattern: 'wall', cooldown: 3.4, telegraph: 0.55, stop: 0.4, params: { count: 11, spacing: 14, gapWidth: 3, speed: 95, sprite: 'eb_w3_ember' } },
    // mur, puis une coulée anticipée : la brèche n'est plus un abri sûr
    { pattern: 'combo', cooldown: 4.4, telegraph: 0.55, stop: 0.6, params: { steps: [
      { pattern: 'wall', params: { count: 11, spacing: 14, gapWidth: 3, speed: 90, sprite: 'eb_w3_ember' } },
      { pattern: 'predictif', at: 0.45, params: { speed: 120, sprite: 'eb_w3_ember' } },
    ] } },
  ],
});

// --- Marteau-pilon : ruée puis coup lourd (2) bien annoncé.
const PIST = ['...aaaaaaaa...', '...a222222a...', '...aaaaaaaa...', '......44......', '......44......', '....444444....', '..4455555544..', '.455y1551y554.', '.455555555554.', '.45vvvvvvvv54.', '..4555555554..', '...44....44...', '..444....444..', '..vvv....vvv..'];
defineSprite('e_w3_piston', PIST, { frames: [['..............', ...PIST.slice(0, 3), ...PIST.slice(4)]] });
defineEnemy({
  id: 'w3_drop_hammer', name: 'Marteau-pilon', world: 3, minFloor: 4, cost: 2, sprite: 'e_w3_piston', hp: 100, speed: 46, radius: 7, contact: 1, coins: [1, 3], knockbackResist: 0.5,
  move: { kind: 'chase', range: 18 },
  attacks: [
    { pattern: 'dash', cooldown: 3.6, telegraph: 0.55, range: 170, params: { speed: 240, dur: 0.4, trail: true, sprite: 'eb_w3_slag', trailLife: 1.6 } },
    { pattern: 'melee', cooldown: 2, telegraph: 0.6, range: 36, stop: 0.5, params: { range: 28, arc: 2, damage: 2, color: 0xffa040 } },
  ],
});

// --- Lanterne à scories : se téléporte et trace un rayon annoncé.
const LANT = ['....44....', '...4..4...', '..444444..', '.4yyyyyy4.', '.4y1vv1y4.', '.4yvVVvy4.', '.4yvVVvy4.', '.4yyvvyy4.', '..444444..', '...4444...', '....44....', '...5..5...', '..5....5..'];
defineSprite('e_w3_lantern', LANT, { frames: [swapPx(LANT, GLOW)] });
defineEnemy({
  id: 'w3_slag_lantern', name: 'Lanterne à scories', world: 3, minFloor: 4, cost: 2, sprite: 'e_w3_lantern', hp: 60, speed: 30, radius: 6, contact: 0, coins: [1, 3], phasing: true,
  move: { kind: 'teleport', period: 2.6, range: 120 },
  attacks: [{ pattern: 'laser', cooldown: 3, telegraph: 0.4, stop: 1, params: { warn: 0.75, width: 5, damage: 1, length: 240, color: 0xff7030 } }],
});

// =================================================================== étage 5
// --- Héraut des Édits : orbite, croix de rayons tournante + salves.
const HER = ['....yYYy....', '...yYvvYy...', '..yYv11vYy..', '..Yv1kk1vY..', '..yYvvvvYy..', '...yYYYYy...', '.wwwwwwwwww.', 'w2wRwRwRw2ww', '.wwwwwwwwww.', '..w2w2w2w2..', '.wwwwwwwwww.', '..R......R..', '..R......R..'];
defineSprite('e_w3_herald', HER, { frames: [swapPx(HER, GLOW)] });
defineEnemy({
  id: 'w3_edict_herald', name: 'Héraut des Édits', world: 3, minFloor: 5, cost: 3, sprite: 'e_w3_herald', hp: 98, speed: 54, radius: 6, contact: 1, coins: [2, 4], phasing: true,
  move: { kind: 'orbit', range: 100 },
  attacks: [
    { pattern: 'w3_edict_cross', cooldown: 4.8, telegraph: 0.5, stop: 2, params: { arms: 2, steps: 3, rot: 0.5, warn: 0.7, damage: 1, length: 200, width: 5 } },
    { pattern: 'predictif', cooldown: 2.2, telegraph: 0.35, params: { count: 3, spread: 0.45, speed: 135, sprite: 'eb_w3_ember', mix: true } },
  ],
  // « Oyez ! » : les alliés proches rechargent leurs attaques.
  onUpdate: (ctx, e, dt) => {
    e.data.oyez = (e.data.oyez ?? 3) - dt;
    if (e.data.oyez > 0) return;
    e.data.oyez = 5.5;
    if (rallyAllies(ctx, e, 130, 1.3, 0xffd23a)) ctx.text(e.x, e.y - 16, 'OYEZ !', 0xffd23a, true);
  },
});

// --- Chaudron colosse : pluie de braises + étincelles invoquées.
const CAUL = ['.....y..y..y......', '....yvyyvyyvy.....', '...vvvvvvvvvvvv...', '..44444444444444..', '.4555555555555554.', '45555y15555y155554', '455555555555555554', '4555555RRRR5555554', '455555555555555554', '.4555555555555554.', '..45555555555554..', '...444444444444...', '...44........44...', '..444........444..'];
defineSprite('e_w3_cauldron', CAUL, { frames: [['......y..y..y.....', ...swapPx(CAUL.slice(1), GLOW)]] });
defineEnemy({
  id: 'w3_cauldron_colossus', name: 'Chaudron colosse', world: 3, minFloor: 5, cost: 4, sprite: 'e_w3_cauldron', hp: 220, speed: 26, radius: 9, contact: 2, coins: [3, 6], knockbackResist: 0.9, energy: 2,
  immune: ['burn'],
  move: { kind: 'wander', period: 2 },
  attacks: [
    { pattern: 'rain', cooldown: 3.6, telegraph: 0.5, params: { count: 6, area: 70, interval: 0.14, radius: 20, time: 1.15, color: 0xff9040 } },
    { pattern: 'summon', cooldown: 7, telegraph: 0.6, first: 3, params: { id: 'w3_spark', count: 3, max: 6 } },
    { pattern: 'ring', cooldown: 4, telegraph: 0.5, params: { count: 14, speed: 98, sprite: 'eb_w3_ember' } },
  ],
});

// =================================================================== invocations (hors pool)
const SPARK = ['...yy...', '..yvvy..', '.yv11vy.', 'yv1kk1vy', 'yv1111vy', '.yvvvvy.', '..yVVy..', '...VV...'];
defineSprite('e_w3_spark', SPARK, { frames: [swapPx(SPARK, GLOW)] });
defineEnemy({
  id: 'w3_spark', name: 'Étincelle', world: 0, sprite: 'e_w3_spark', hp: 14, speed: 86, radius: 4, contact: 1, coins: [0, 0], energy: 0, noChampion: true, phasing: true,
  move: { kind: 'chase' },
});
defineEnemy({
  id: 'w3_bomb_minion', name: 'Pétard du Primat', world: 0, sprite: 'e_w3_bomb', hp: 19, speed: 95, radius: 5, contact: 0, coins: [0, 0], energy: 0, noChampion: true,
  move: { kind: 'chase' },
  onUpdate: (ctx, e, dt) => bombUpdate(ctx, e, dt, 28, 1),
  onDeath: bombDeath,
});

// =================================================================== v2 : frames supplémentaires (lueurs qui pulsent, yeux qui s'allument)
const EXTRA: [string, Record<string, string>][] = [
  ['e_w3_imp', { '1': 'y', v: 'o' }], ['e_w3_bat', { y: 'v', '1': 'y' }], ['e_w3_slag', { v: 'y', y: 'v' }], ['e_w3_mortar', { k: 'y' }],
  ['e_w3_wisp', { v: 'y', y: 'v' }], ['e_w3_toad', { v: 'y', y: 'r' }], ['e_w3_bellows', { k: 'v' }], ['e_w3_anvil', { y: 'v' }],
  ['e_w3_bomb', { y: 'v', '1': 'y' }], ['e_w3_orb', { k: 'R' }], ['e_w3_geyser', { y: 'v', v: 'y' }], ['e_w3_golem', { v: 'y', y: 'v' }],
  ['e_w3_automaton', { y: 'r' }], ['e_w3_worm', { v: 'o' }], ['e_w3_smith', { k: 'r' }], ['e_w3_founder', { v: 'o', y: 'v' }],
  ['e_w3_piston', { v: 'y', y: 'r' }], ['e_w3_lantern', { V: 'v' }], ['e_w3_herald', { k: 'r' }], ['e_w3_cauldron', { R: 'v', y: 'v' }],
  ['e_w3_spark', { k: 'R' }],
];
for (const [id, m] of EXTRA) {
  const sp = R.sprites.get(id);
  if (!sp || (sp.frames?.length ?? 0) >= 3) continue;
  const f1 = sp.frames?.[0] ?? sp.px;
  sp.frames = [f1, swapPx(sp.px, m), swapPx(f1, m)];
}
