// ARMES ABSURDES (type 'weird')
// id                | rareté | DPS                                   | énergie/s
// weird_herring     | 0      | 20.0 (gifle, gros recul)              | 0
// weird_baguette    | 0      | 20.0 (longue portée de mie)           | 0
// weird_bubbles     | 0      | 20.0 (bulles lentes, 4 rebonds)       | 1.7
// weird_duck        | 0      | 17.9 (rebondit, couine)               | 0
// weird_stopsign    | 1      | 28.0 (+ ralenti)                      | 0
// weird_toaster     | 1      | 28.0 (2 tartines, brûlure)            | 4.0
// weird_watering    | 1      | 32.0 (jet court, ralenti)             | 5.0
// weird_banana      | 2      | 35.0 (boomerang perçant)              | 7.5
// weird_horn        | 2      | 37.5 (onde de choc, efface les balles) | 7.5
// weird_magnet      | 3      | 57.1 (attire les voisins)             | 11.4
// weird_gnome       | 3      | 54.5 (+ 4 éclats de céramique)        | 10.9
// weird_accordion   | 4      | 80.0 (3 « notes » en alternance)      | 18.0
import { defineWeapon } from '../../core/registry';
import type { BulletSpec } from '../../core/types';
import { spr, aimLob, dist } from './_helpers';

spr('b_bubble', ['.cc.', 'c1.c', 'c..c', '.cc.'], { outline: false });
spr('b_duck', ['..yy..', '.y0yo.', 'yyyyy.', '.yyY..'], { ox: 3, oy: 2 });
spr('b_toast', ['.nnnn.', 'nssssn', 'nsSSsn', 'nssssn', '.nnnn.']);
spr('b_drop', ['.b.', 'bcb', '.b.'], { outline: false });
spr('b_banana', ['y.....', 'yy....', '.yy...', '..yyyY', '...YYd']);
spr('b_magnet', ['rr.aa', 'r..1a', 'rr.aa']);
spr('b_gnome', ['..r..', '.rrr.', '.sss.', '.www.', 'bbbbb', '.dd.d']);
spr('b_note', ['...1', '...1', '...1', '111.', '11..']);

spr('w_weird_herring', ['.......aa..', '..aaaaAaa.a', 'aa21aaaaaAa', '..aaaaaaa.a', '.....AA....'], { ox: 9, oy: 2 });
defineWeapon({
  id: 'weird_herring', name: 'Hareng giflant', desc: 'Une claque iodée qui ne s\'oublie pas.', rarity: 0, type: 'weird',
  sprite: 'w_weird_herring', energy: 0, cooldown: 0.5, damage: 10, sfx: 'splash', shake: 0.6,
  bullet: { kind: 'slash', range: 28, arc: 1.6, knockback: 230, color: 0xa0c8e0 },
});

spr('w_weird_baguette', ['.nnnnnnnnnnnnnn.', 'nSnSSnSSnSSnSSnn', '.nnnnnnnnnnnnnn.'], { ox: 2, oy: 1 });
defineWeapon({
  id: 'weird_baguette', name: 'Baguette rassise', desc: 'De la veille. Dure comme la justice.', rarity: 0, type: 'weird',
  sprite: 'w_weird_baguette', energy: 0, cooldown: 0.45, damage: 9, sfx: 'thud',
  bullet: {
    kind: 'slash', range: 38, arc: 1.2, knockback: 110, color: 0xd8a060,
    onHit: (ctx, _b, t) => ctx.burst(t.x, t.y, 0xd8a060, 4, 50, 0.3, 1),
  },
});

spr('w_weird_bubbles', ['.........cc', 'mmmmmmmmc..', 'MMMMMMMMc..', '.........cc'], { ox: 2, oy: 1 });
defineWeapon({
  id: 'weird_bubbles', name: 'Souffleur de bulles', desc: 'Lentes, rebondissantes, et étrangement vexantes.', rarity: 0, type: 'weird',
  sprite: 'w_weird_bubbles', energy: 1, cooldown: 0.6, damage: 6, count: 2, spread: 0.4, jitter: 0.1, recoil: 1, shake: 0, sfx: 'bubble', muzzle: 0x9ae8ff, casing: false,
  bullet: { speed: 70, sprite: 'b_bubble', life: 4, bounces: 4, radius: 4, wave: { amp: 4, freq: 5 }, knockback: 10 },
});

spr('w_weird_duck', ['....yy...', '...y0yoo.', 'nn.yyyy..', 'nnyyyyyY.', '...yYYY..'], { ox: 1, oy: 3 });
defineWeapon({
  id: 'weird_duck', name: 'Canard couineur', desc: 'Couic. Couic. COUIC. Il ne s\'arrête jamais.', rarity: 0, type: 'weird',
  sprite: 'w_weird_duck', energy: 0, cooldown: 0.28, damage: 5, jitter: 0.08, recoil: 2, shake: 0.3, sfx: 'boing', muzzle: 0xffd23a, casing: false,
  bullet: { speed: 200, sprite: 'b_duck', life: 1.3, bounces: 2, spin: 10 },
  unlock: 15,
});

spr('w_weird_stopsign', ['....rrrr', '...r1111', '...rr11r', 'nnnr1111', '...rrrrr', '....rrrr'], { ox: 1, oy: 3 });
defineWeapon({
  id: 'weird_stopsign', name: 'Panneau STOP', desc: 'Ils s\'arrêtent. C\'est la loi.', rarity: 1, type: 'weird',
  sprite: 'w_weird_stopsign', energy: 0, cooldown: 0.5, damage: 14, shake: 1, sfx: 'thud',
  bullet: {
    kind: 'slash', range: 30, arc: 1.8, knockback: 40, status: { kind: 'slow', dur: 1.5 }, color: 0xe0404a,
    onHit: (ctx, _b, t) => { if (t.team === 'enemy' && ctx.rng.chance(0.25)) ctx.text(t.x, t.y - 14, 'STOP!', 0xff4455); },
  },
});

spr('w_weird_toaster', ['.aaaaaaa..', 'a1nn.nn2a.', 'a22222222a', 'a2a2222Ra.', '.aaaaaaa..'], { ox: 2, oy: 3 });
defineWeapon({
  id: 'weird_toaster', name: 'Grille-pain de combat', desc: 'Petit-déjeuner servi à 200 km/h.', rarity: 1, type: 'weird',
  sprite: 'w_weird_toaster', energy: 2, cooldown: 0.5, damage: 7, count: 2, spread: 0.2, recoil: 3, kick: 10, shake: 0.8, sfx: 'boing', muzzle: 0xff9a30, casing: false,
  bullet: { speed: 180, sprite: 'b_toast', life: 1.1, spin: 7, status: { kind: 'burn', dur: 1 }, onEnd: (ctx, b) => ctx.burst(b.x, b.y, 0xe0a078, 3, 40, 0.25, 1) },
});

spr('w_weird_watering', ['......gg..b', '.ggggggggg.', 'gG.gggggg..', 'gG.GGGGGG..', '.ggggggg...'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'weird_watering', name: 'Arrosoir à pression', desc: 'Les ennemis poussent moins bien quand on les arrose.', rarity: 1, type: 'weird',
  sprite: 'w_weird_watering', energy: 1, cooldown: 0.2, damage: 1.6, count: 4, spread: 0.3, jitter: 0.08, recoil: 1, shake: 0, sfx: 'splash', muzzle: 0x48a8ff, casing: false,
  bullet: { speed: 240, sprite: 'b_drop', life: 0.45, drag: 2, knockback: 60, status: { kind: 'slow', dur: 0.6 } },
});

spr('w_weird_banana', ['y.......', 'yy......', '.yyy....', '..yyyyY.', '...YYYdd'], { ox: 2, oy: 3 });
defineWeapon({
  id: 'weird_banana', name: 'Banane-boomerang', desc: 'Revient toujours. Comme les remords.', rarity: 2, type: 'weird',
  sprite: 'w_weird_banana', energy: 3, cooldown: 0.4, damage: 14, recoil: 2, shake: 0.5, sfx: 'weird', muzzle: 0xffd23a, casing: false,
  bullet: { speed: 230, sprite: 'b_banana', life: 1.4, boomerang: true, pierce: 99, radius: 5, spin: 14, ghost: true, knockback: 50 },
  unlock: 20,
});

spr('w_weird_horn', ['.......yyy', 'rr...yyY11', 'rrrryyyY11', 'rr...yyY11', '.......yyy'], { ox: 1, oy: 2 });
defineWeapon({
  id: 'weird_horn', name: 'Klaxon de livreur', desc: 'POUÊT. Tout le monde recule, balles comprises.', rarity: 2, type: 'weird',
  sprite: 'w_weird_horn', energy: 3, cooldown: 0.4, damage: 15, recoil: 3, shake: 1.5, sfx: 'honk',
  bullet: { kind: 'slash', range: 60, arc: 1.4, knockback: 260, color: 0xffe080 },
  unlock: 25,
});

spr('w_weird_magnet', ['.rrrrrrr..', 'rRRRRRRRaa', 'rR.....11.', 'rRRRRRRRaa', '.rrrrrrr..'], { ox: 1, oy: 2 });
defineWeapon({
  id: 'weird_magnet', name: 'Aimant de frigo géant', desc: 'Attire les ennemis, les factures et les ennuis.', rarity: 3, type: 'weird',
  sprite: 'w_weird_magnet', energy: 4, cooldown: 0.35, damage: 10, count: 2, spread: 0.5, recoil: 2, shake: 0.6, sfx: 'zap', muzzle: 0xe0404a, casing: false,
  bullet: {
    speed: 150, sprite: 'b_magnet', life: 1.5, homing: 5, knockback: 0, trail: 0xa0a8c0,
    onHit: (ctx, b, t) => {
      for (const e of ctx.enemiesIn(b.x, b.y, 50)) {
        if (e === t) continue;
        const d = dist(e.x, e.y, b.x, b.y);
        const k = 150 * (1 - (e.def.knockbackResist ?? 0));
        e.kx += ((b.x - e.x) / d) * k;
        e.ky += ((b.y - e.y) / d) * k;
      }
    },
  },
  unlock: 30,
});

spr('w_weird_gnome', ['...ffffff..', 'nnfFFFFFFf.', 'NNfr.....rf', 'NNfFFFFFFf.', '...ffffff..'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'weird_gnome', name: 'Lance-Nains de jardin', desc: 'Ils volent, ils explosent, ils gardent le sourire.', rarity: 3, type: 'weird',
  sprite: 'w_weird_gnome', energy: 6, cooldown: 0.55, damage: 30, recoil: 4, kick: 20, shake: 2, sfx: 'thud', casing: false,
  bullet: { kind: 'lob', sprite: 'b_gnome', explode: { radius: 24 }, spin: 8, split: { count: 4, spec: { damage: 5, speed: 160, life: 0.3, sprite: 'b_small', color: 0xe0404a } } },
  onFire: (ctx, ev) => aimLob(ctx, ev, 120),
  unlock: 25,
});

spr('w_weird_accordion', ['.mmmmmmmmmm.', 'mM1M1M1M1M1m', 'm0M0M0M0M0Mm', 'mM1M1M1M1M1m', '.mmmmmmmmmm.'], { ox: 1, oy: 2 });
defineWeapon({
  id: 'weird_accordion', name: 'Accordéon du Chaos', desc: 'Trois airs au répertoire, tous interdits par la convention.', rarity: 4, type: 'weird',
  sprite: 'w_weird_accordion', energy: 9, cooldown: 0.5, damage: 5, count: 8, spread: 5.5, recoil: 3, shake: 1.2, sfx: 'honk', muzzle: 0xff70b8, casing: false,
  bullet: { speed: 170, sprite: 'b_note', color: 0xff70b8, life: 1.2, spin: 3 },
  // signature : alterne trois « airs » de même puissance (40 dégâts par tir) :
  //   1) couronne de 8 notes ; 2) duo de notes chercheuses ; 3) grosse note rebondissante et perçante
  onFire: (ctx, ev) => {
    const d = ev.player.data;
    const i = (d.accordionTune ?? 0) % 3;
    d.accordionTune = i + 1;
    const base = ev.specs[0];
    if (!base || i === 0) return;
    const total = base.damage * 8;
    const mk = (extra: Partial<BulletSpec>): BulletSpec => ({ ...base, ...extra, damage: extra.damage ?? base.damage });
    ev.specs.length = 0;
    if (i === 1) {
      for (const a of [-0.25, 0.25]) ev.specs.push(mk({ angle: a, damage: total / 2, homing: 6, speed: 200, color: 0x58d858, scale: 1.4, radius: 4 }));
      ctx.sfx('boing', 0.5);
    } else {
      ev.specs.push(mk({ angle: 0, damage: total, bounces: 3, pierce: 2, speed: 150, scale: 2.2, radius: 7, color: 0xffd23a, life: 1.6 }));
      ctx.sfx('honk', 0.6);
    }
  },
  unlock: 80,
});
