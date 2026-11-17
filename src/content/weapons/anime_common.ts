// ARMES « ANIMÉ » — communes (blanc) et peu communes (vert). Tropes de lycée, de club et de quartier, jamais de vrais noms.
// id                   | rareté | DPS                              | énergie/s
// sword_chopsticks     | 0      | 20.0 (coups éclair)              | 0
// pistol_chalk         | 0      | 20.0 (craie précise, nuage)      | 0
// sword_broom          | 0      | 18.8 (arc large, gros recul)     | 0
// launcher_onigiri     | 0      | 20.0 (souffle de riz)            | 3.3
// staff_cranes         | 0      | 16.1 (grues chercheuses)         | 3.6
// rifle_marble         | 0      | 19.4 (bille rebondissante)       | 0
// staff_heartwand      | 1      | 27.3 (étoiles ondulantes)        | 4.5
// pistol_spiritfinger  | 1      | 28.6 (orbe perçant)              | 5.7
// sword_shinai         | 1      | 27.8 (crit 20 %)                 | 0
// weird_kunai_trio     | 1      | 26.7 (éventail de 3)             | 5.6
// weird_rocketpunch    | 1      | 25.5 (énorme recul)              | 5.5
// weird_volley         | 1      | 26.2 (3 rebonds, smash)          | 4.8
import { defineWeapon } from '../../core/registry';
import { spr, muzzleFx, aimLob } from './_helpers';

// ------------------------------------------------------------------ balles
spr('b_chalk', ['.w111', 'w1112', '.w222']);
spr('b_onigiri', ['..ww..', '.w1ww.', 'wwwwww', 'w5555w', '.5555.']);
spr('b_crane', ['..1....', '.w1w..w', 'wwwwwwI', '...I...'], { outline: '#4a5878' });
spr('b_marble', ['.cc.', 'c1cC', 'cCCT', '.TT.']);
spr('b_starlet', ['..y..', '.y1y.', 'yy1yy', '.yyy.', 'yY.Yy'], { frames: [['..1..', '.y1y.', 'y111y', '.yyy.', 'yY.Yy']] });
spr('b_spirit', ['..cc...', '.c11cc.', 'c1111cC', '.c11cc.', '..cc...'], { outline: '#1a4a6a' });
spr('b_kunai_s', ['...a..', 'dNaA21', '...a..']);
spr('b_volley', ['.wwyy.', 'w1wyyY', 'wbbbyY', 'bwwbbB', 'Bwwwbb', '.BBBB.']);

// ------------------------------------------------------------------ blanc
spr('w_sword_chopsticks', [
  '.dNnnnnnnnnnnnS.',
  '................',
  'dNNnnnnnnnnnnnnS',
], { ox: 2, oy: 1 });
defineWeapon({
  id: 'sword_chopsticks', name: 'Baguettes de cantine', desc: 'Attrape les mouches. Et les yeux, si on insiste.', rarity: 0, type: 'sword',
  sprite: 'w_sword_chopsticks', energy: 0, cooldown: 0.25, damage: 5, crit: 0.12, sfx: 'swing', recoil: 2,
  bullet: { kind: 'slash', range: 26, arc: 0.8, knockback: 40, color: 0xe0c090 },
});

spr('w_pistol_chalk', [
  '..wwwwwww.',
  'nnw1wwwwwI',
  'NNw22222w.',
  '.N........',
], { ox: 2, oy: 2 });
defineWeapon({
  id: 'pistol_chalk', name: 'Craie du prof excédé', desc: 'Lancée depuis le bureau sans même lever les yeux. Toujours au front.', rarity: 0, type: 'pistol',
  sprite: 'w_pistol_chalk', energy: 0, cooldown: 0.3, damage: 6, jitter: 0.01, recoil: 2, shake: 0.4, sfx: 'pew', muzzle: 0xf4f0e0, casing: false,
  bullet: {
    speed: 340, sprite: 'b_chalk', life: 1, trail: 0xf4f0e0, spin: 0,
    onEnd: (ctx, b) => ctx.burst(b.x, b.y, 0xf4f0e0, 4, 35, 0.4, 2),
    onHit: (ctx, _b, t) => { if (t.team === 'enemy' && ctx.rng.chance(0.08)) ctx.text(t.x, t.y - 14, 'AU TABLEAU !', 0xf4f0e0); },
  },
});

spr('w_sword_broom', [
  '..............YyY.',
  'nnnnnnnnnnnnnYyYyY',
  'NNNNNNNNNNNNdYyYyY',
  '..............YYY.',
], { ox: 3, oy: 1 });
defineWeapon({
  id: 'sword_broom', name: 'Balai du délégué de classe', desc: 'Le couloir sera propre. Vous aussi, d\'une certaine manière.', rarity: 0, type: 'sword',
  sprite: 'w_sword_broom', energy: 0, cooldown: 0.48, damage: 9, sfx: 'swing', shake: 0.6,
  bullet: { kind: 'slash', range: 32, arc: 2.6, knockback: 150, color: 0xffd23a, onHit: (ctx, _b, t) => ctx.burst(t.x, t.y + 3, 0xb98a52, 3, 40, 0.35, 1) },
});

spr('w_launcher_onigiri', [
  '.OOOOOOOOO.',
  'OowwwOwwwoO',
  'Oow55Ow55oO',
  'Oowww1wwwoO',
  '.OOOOOOOOO.',
  '..d.....d..',
], { ox: 2, oy: 3 });
defineWeapon({
  id: 'launcher_onigiri', name: 'Bentō balistique', desc: 'Maman a préparé le déjeuner. Il explose à l\'impact.', rarity: 0, type: 'launcher',
  sprite: 'w_launcher_onigiri', energy: 2, cooldown: 0.6, damage: 12, recoil: 3, kick: 10, shake: 1.2, sfx: 'launch', casing: false,
  bullet: { kind: 'lob', sprite: 'b_onigiri', explode: { radius: 16 }, spin: 6, onEnd: (ctx, b) => ctx.burst(b.x, b.y, 0xf4f0e0, 6, 60, 0.4, 1) },
  onFire: (ctx, ev) => aimLob(ctx, ev, 110),
});

spr('w_staff_cranes', [
  '..wwwww...',
  '.w1wwwwI..',
  'w2w2w2wIII',
  '.IIIIIIII.',
  '..d.d.....',
], { ox: 2, oy: 2 });
defineWeapon({
  id: 'staff_cranes', name: 'Mille grues de papier', desc: 'Il en manque encore 997 pour le vœu. En attendant, elles piquent.', rarity: 0, type: 'staff',
  sprite: 'w_staff_cranes', energy: 1, cooldown: 0.28, damage: 4.5, recoil: 1, shake: 0.2, sfx: 'magic', muzzle: 0xf4f0e0, casing: false,
  bullet: { speed: 140, sprite: 'b_crane', life: 1.6, homing: 2.6, wave: { amp: 3, freq: 6 }, trail: 0xd8f0ff },
});

spr('w_rifle_marble', [
  '..cccccccc....',
  'TTC1cccccccCcc',
  'TTCCCCCCCCCcc.',
  '..T...........',
], { ox: 2, oy: 1 });
defineWeapon({
  id: 'rifle_marble', name: 'Sarbacane à billes de limonade', desc: 'On a vidé la bouteille pour la bille. Ça valait le coup.', rarity: 0, type: 'rifle',
  sprite: 'w_rifle_marble', energy: 0, cooldown: 0.18, damage: 3.5, jitter: 0.05, recoil: 1.5, shake: 0.3, sfx: 'boing', muzzle: 0x9ae8ff, casing: false,
  bullet: { speed: 280, sprite: 'b_marble', life: 1, bounces: 1, trail: 0x58c0e8 },
});

// ------------------------------------------------------------------ vert
spr('w_staff_heartwand', [
  '...........y...',
  '..........yYy..',
  'wMwMwMwMwyyy1yy',
  '..........yYy..',
  '..........y.y..',
], { ox: 3, oy: 2, frames: [[
  '...........1...',
  '..........yyy..',
  'wMwMwMwMwyy111y',
  '..........yyy..',
  '..........y.y..',
]] });
defineWeapon({
  id: 'staff_heartwand', name: 'Sceptre Cœur-Scintillant', desc: 'Transformation ! Paillettes, rubans et justice à tête chercheuse.', rarity: 1, type: 'staff',
  sprite: 'w_staff_heartwand', energy: 1, cooldown: 0.22, damage: 6, recoil: 1, shake: 0.3, sfx: 'magic', muzzle: 0xffd23a, casing: false,
  bullet: { speed: 190, sprite: 'b_starlet', life: 1.2, wave: { amp: 6, freq: 10 }, homing: 1, spin: 6, trail: 0xffd23a },
  onFire: (ctx, ev) => { if (ctx.rng.chance(0.25)) muzzleFx(ctx, ev, 0xffe8a0, 4); },
});

spr('w_pistol_spiritfinger', [
  '..sssssss1',
  '.sSSSSSs..',
  'sSsSs.....',
  'sSsSs.....',
  '.sSSs.....',
  '..ss......',
], { ox: 2, oy: 3 });
defineWeapon({
  id: 'pistol_spiritfinger', name: 'Index spectral', desc: 'Le doigt-pistolet, mais en vrai. Ne visez pas votre reflet.', rarity: 1, type: 'pistol',
  sprite: 'w_pistol_spiritfinger', energy: 2, cooldown: 0.35, damage: 10, auto: false, recoil: 3, kick: 12, shake: 1.4, sfx: 'zap', muzzle: 0x9ae8ff, casing: false,
  bullet: { speed: 300, sprite: 'b_spirit', life: 1.1, radius: 4, pierce: 1, trail: 0x58c0e8, knockback: 70 },
  onFire: (ctx, ev) => muzzleFx(ctx, ev, 0x9ae8ff, 6, 6, 12),
});

spr('w_sword_shinai', [
  '...Y..............',
  'SwSYnnnYnnnnYnnnn1',
  '...Y..............',
], { ox: 1, oy: 1 });
defineWeapon({
  id: 'sword_shinai', name: 'Shinaï du club', desc: 'MEN ! Le capitaine du club l\'a laissé traîner. Erreur.', rarity: 1, type: 'sword',
  sprite: 'w_sword_shinai', energy: 0, cooldown: 0.36, damage: 10, crit: 0.2, sfx: 'swing', shake: 0.5,
  bullet: {
    kind: 'slash', range: 34, arc: 1.3, knockback: 80, color: 0xffe0b0,
    onHit: (ctx, b, t) => { if (t.team === 'enemy' && b.hit.size === 1 && ctx.rng.chance(0.12)) ctx.text(t.x, t.y - 14, 'MEN !', 0xffe0b0); },
  },
});

spr('w_weird_kunai_trio', [
  '......a2..',
  '....dNa.a2',
  'dNdNaA2211',
  '....dNa.a2',
  '......a2..',
], { ox: 1, oy: 2 });
defineWeapon({
  id: 'weird_kunai_trio', name: 'Kunaïs d\'entraînement', desc: 'Trois lames émoussées. L\'académie ne les a jamais réclamées.', rarity: 1, type: 'weird',
  sprite: 'w_weird_kunai_trio', energy: 2, cooldown: 0.36, damage: 3.2, count: 3, spread: 0.3, recoil: 2, shake: 0.4, sfx: 'swing', muzzle: 0xa0a8c0, casing: false,
  bullet: { speed: 330, sprite: 'b_kunai_s', life: 0.7, pierce: 1, trail: 0xa0a8c0 },
});

spr('w_weird_rocketpunch', [
  '....aaaaa...',
  'oO4a22222a..',
  'vO4a2a2a2aa.',
  'oO4a22222aa.',
  '....aaaaa...',
], { ox: 2, oy: 2 });
defineWeapon({
  id: 'weird_rocketpunch', name: 'Poing-fusée de poche', desc: 'Le bras part. Le bras revient ? Le bras ne revient pas. On en a d\'autres.', rarity: 1, type: 'weird',
  sprite: 'w_weird_rocketpunch', energy: 3, cooldown: 0.55, damage: 14, recoil: 6, kick: 40, shake: 2, sfx: 'launch', muzzle: 0xff9a30, casing: false,
  bullet: { speed: 260, accel: 120, sprite: 'b_fist', scale: 0.8, life: 0.9, radius: 4, knockback: 210, trail: 0xff9a30 },
  onFire: (ctx, ev) => muzzleFx(ctx, ev, 0xff9a30, 6, 0, 6),
});

spr('w_weird_volley', [
  '..wwyy..',
  '.w1wyyy.',
  'w1wbbyyY',
  'wwbbbbyY',
  'bbbwwbbB',
  'Bbwwwwbb',
  '.BwwwwB.',
  '..BBBB..',
], { ox: 0, oy: 4 });
defineWeapon({
  id: 'weird_volley', name: 'Smash du club de volley', desc: 'Service, réception, attaque. Surtout attaque. La finale régionale vous regarde.', rarity: 1, type: 'weird',
  sprite: 'w_weird_volley', energy: 2, cooldown: 0.42, damage: 11, recoil: 3, kick: 8, shake: 1.2, sfx: 'boing', muzzle: 0xffd23a, casing: false,
  bullet: {
    speed: 250, sprite: 'b_volley', life: 1.4, bounces: 3, radius: 4, spin: 14, knockback: 150, trail: 0xffd23a,
    onHit: (ctx, _b, t) => { if (t.team === 'enemy') { ctx.burst(t.x, t.y, 0xffffff, 4, 70, 0.2, 1); if (ctx.rng.chance(0.15)) ctx.text(t.x, t.y - 14, 'SMASH !', 0xffd23a); } },
  },
});
