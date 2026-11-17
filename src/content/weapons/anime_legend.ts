// ARMES « ANIMÉ » — légendaires (orange). Effets uniques très forts, donc très rares et à débloquer.
// id                 | rareté | DPS                                                | énergie/s
// weird_plain_glove  | 4      | 87.5 (un seul coup de 140 toutes les 1,6 s)        | 0 (mêlée, 1/coup)
// sword_rift         | 4      | 48 + fissure différée 60 % = 76.8                  | 0 (mêlée, 1/coup)
// weird_kunai_blink  | 4      | 80.0 (22 + souffle 22) + téléportation             | 14.5
// laser_soul_cannon  | 4      | 69.2 à pleine charge (rayon 90 sur 1,3 s)          | 13.8
// launcher_mecha     | 4      | (poing 22 + souffle 22 + 4 missiles × 5.5) / 0.9 = 73.3 | 17.8
import { defineWeapon } from '../../core/registry';
import type { Player } from '../../core/types';
import { spr, muzzleFx } from './_helpers';

// ------------------------------------------------------------------ balles
spr('b_kunai', ['.....a2..', 'dNdaA2211', '.....A2..']);

// ------------------------------------------------------------------ le gant du héros qui s'ennuie
spr('w_weird_plain_glove', [
  '......yyyy....',
  '....yy1yyyyy..',
  'RRRyy1yyOyyyy.',
  'RrRyyyyyOyyyyY',
  'RrRyyyyyyOyyyY',
  'RrRYyyyyyyOyYY',
  'RRR.YYyyyyyYY.',
  '.....YYYYYY...',
], { ox: 2, oy: 4 });
defineWeapon({
  id: 'weird_plain_glove', name: 'Gant du coup banal', desc: 'Un gant jaune de héros blasé. Ce n\'est qu\'un coup normal. Tout s\'envole quand même.', rarity: 4, type: 'weird',
  sprite: 'w_weird_plain_glove', energy: 1, cooldown: 1.6, damage: 140, crit: 0, kick: -70, shake: 3, sfx: 'thud',
  bullet: {
    kind: 'slash', range: 30, arc: 1.2, knockback: 700, color: 0xffd23a,
    // signature : le premier ennemi touché déclenche l'onde de choc (gel de l'image, écran qui tremble, tout est soufflé)
    onHit: (ctx, b, t) => {
      if (t.team !== 'enemy' || b.hit.size !== 1) return;
      ctx.hitstop(0.14);
      ctx.shake(10);
      ctx.flash(0xffffff, 0.35);
      ctx.ring(t.x, t.y, 34, 0xffd23a);
      ctx.ring(t.x, t.y, 60, 0xffffff);
      ctx.burst(t.x, t.y, 0xffd23a, 16, 160, 0.5, 2);
      ctx.sfx('explode', 0.8);
      const a = b.dir;
      for (const e of ctx.enemiesIn(t.x, t.y, 70)) {
        if (e === t) continue;
        const k = 420 * (1 - (e.def.knockbackResist ?? 0));
        e.kx += Math.cos(a) * k;
        e.ky += Math.sin(a) * k;
      }
      if (ctx.rng.chance(0.35)) ctx.text(t.x, t.y - 18, 'coup normal.', 0xffffff);
    },
  },
  unlock: 100,
});

// ------------------------------------------------------------------ la lame qui coupe l'espace
spr('w_sword_rift', [
  '...PP...............',
  'dNdPp2222222222221..',
  'NdNP5111111111111111',
  'dNdPpPPPPPPPPPPPpp..',
  '...PP...............',
], { ox: 1, oy: 2, frames: [[
  '...PP...............',
  'dNdPp2222222222221..',
  'NdNP5p1111111111111p',
  'dNdPpPPPPPPPPPPPpp..',
  '...PP...............',
]] });
defineWeapon({
  id: 'sword_rift', name: 'Lame fend-espace', desc: 'Elle ne coupe pas l\'ennemi : elle coupe l\'endroit où il se tient. Le réel suit avec un temps de retard.', rarity: 4, type: 'sword',
  sprite: 'w_sword_rift', energy: 1, cooldown: 0.5, damage: 24, crit: 0.12, shake: 1.2, sfx: 'swing',
  bullet: { kind: 'slash', range: 36, arc: 2.0, knockback: 90, reflect: true, color: 0xc070ff },
  // signature : 0,28 s après chaque coup, une fissure dimensionnelle (rayon 110 px qui traverse les murs) inflige 60 %
  onFire: (ctx, ev) => {
    const p = ev.player, base = ev.specs[0];
    if (!base) return;
    const a = ev.angle, x = p.x, y = p.y, dmg = base.damage * 0.6, crit = base.critChance;
    for (let i = 1; i <= 4; i++) ctx.burst(x + Math.cos(a) * i * 26, y + Math.sin(a) * i * 26, 0x7038b8, 2, 20, 0.3, 1);
    ctx.after(0.28, () => {
      const b = ctx.spawnBullet({ kind: 'beam', damage: dmg, width: 5, length: 110, ghost: true, life: 0.25, color: 0xe0b0ff, critChance: crit }, x, y, a, 'player', p);
      if (b) b.weaponId = 'sword_rift';
      for (let i = 1; i <= 4; i++) ctx.burst(x + Math.cos(a) * i * 26, y + Math.sin(a) * i * 26, 0xffffff, 3, 70, 0.25, 2);
      ctx.flash(0x7038b8, 0.1);
      ctx.shake(3);
      ctx.sfx('laser', 0.6);
    }, p);
  },
  unlock: 110,
});

// ------------------------------------------------------------------ le kunaï de téléportation
spr('w_weird_kunai_blink', [
  '..........a...',
  '.aa.ddd.aaa2..',
  'a..aNdNdA22211',
  '.aa.ddd.AAA2..',
  '..........A...',
], { ox: 4, oy: 2 });
defineWeapon({
  id: 'weird_kunai_blink', name: 'Kunaï du saut-éclair', desc: 'Lancez-le. Vous êtes déjà là-bas. L\'ennemi, lui, n\'a pas compris.', rarity: 4, type: 'weird',
  sprite: 'w_weird_kunai_blink', energy: 8, cooldown: 0.55, damage: 22, crit: 0.15, auto: false, recoil: 3, shake: 1, sfx: 'swing', muzzle: 0xffe060, casing: false,
  bullet: {
    speed: 360, sprite: 'b_kunai', life: 0.42, radius: 4, explode: { radius: 24 }, trail: 0xffe060,
    // signature : là où le kunaï s'arrête, le lanceur apparaît (s'il y a la place), brièvement invulnérable
    onEnd: (ctx, b) => {
      const p = b.owner as Player | null;
      if (!p || p.team !== 'player' || p.downed || b.gen > 0) return;
      const x = b.x - Math.cos(b.dir) * 6, y = b.y - Math.sin(b.dir) * 6;
      if (!ctx.isFree(x, y, 5) || !ctx.los(p.x, p.y, x, y)) return;
      ctx.burst(p.x, p.y, 0xffe060, 8, 50, 0.35, 2);
      p.x = x;
      p.y = y;
      p.vx = 0;
      p.vy = 0;
      p.invuln = Math.max(p.invuln, 0.35);
      ctx.ring(x, y, 22, 0xffe060);
      ctx.burst(x, y, 0xffffff, 10, 110, 0.3, 2);
      ctx.sfx('zap', 0.6);
    },
  },
  unlock: 90,
});

// ------------------------------------------------------------------ le canon d'âme à deux mains
spr('w_laser_soul_cannon', [
  '....BBBBBBBBBB....',
  '..BBbbbbbbbbbbBcc.',
  'nnB5bcccccccccbc11',
  'NNB5bc1111111cbc11',
  'nnB5bcccccccccbc11',
  '..BBbbbbbbbbbbBcc.',
  '....BB.dd.BBBB....',
], { ox: 3, oy: 3, frames: [[
  '....BBBBBBBBBB....',
  '..BBbbbbbbbbbbBc1.',
  'nnB5bc1c1c1c1cbc11',
  'NNB5bc1111111cbc11',
  'nnB5bc1c1c1c1cbc11',
  '..BBbbbbbbbbbbBc1.',
  '....BB.dd.BBBB....',
]] });
defineWeapon({
  id: 'laser_soul_cannon', name: 'Canon d\'âme à deux mains', desc: 'Joindre les mains, crier très fort, maintenir. Le décor se souviendra de vous.', rarity: 4, type: 'laser',
  sprite: 'w_laser_soul_cannon', energy: 18, cooldown: 0.3, damage: 90, charge: { time: 1.0, minMult: 0.25 }, recoil: 6, kick: 90, shake: 2, sfx: 'laser',
  bullet: { kind: 'beam', damage: 90, width: 12, length: 320, life: 0.35, color: 0x48a8ff },
  // signature : rayon en deux couches (halo bleu 70 % + cœur blanc 30 %), épaisseur selon la charge ; pleine charge = l'écran tremble
  onFire: (ctx, ev) => {
    const base = ev.specs[0];
    if (!base) return;
    const c = ev.chargeMult;
    ev.specs.length = 0;
    ev.specs.push({ ...base, damage: base.damage * 0.7, width: 4 + 12 * c, color: 0x48a8ff });
    ev.specs.push({ ...base, damage: base.damage * 0.3, width: 2 + 4 * c, color: 0xffffff });
    muzzleFx(ctx, ev, 0x9ae8ff, 6 + Math.round(8 * c), 6 + 10 * c, 12);
    if (c >= 0.97) {
      ctx.shake(7);
      ctx.flash(0x9ae8ff, 0.25);
      ctx.hitstop(0.05);
      ctx.burst(ev.player.x, ev.player.y, 0xffffff, 10, 90, 0.4, 2);
    }
  },
  unlock: 105,
});

// ------------------------------------------------------------------ le bras de méca géant
spr('w_launcher_mecha', [
  '....BBBBBBBB4444....',
  '...Bbbbbbbbb4aa24...',
  'nnBb1bbbbbbb4a2224..',
  'NNBbbbbbbbbB4aaaa244',
  'nnBbbyybbbbB4a2a2a24',
  'NNBbbbbbbbbB4aaaa244',
  '..BBbbbbbbbb4a2224..',
  '...BBBBBBBBB4aa24...',
  '....dd..dd..4444....',
], { ox: 3, oy: 4 });
defineWeapon({
  id: 'launcher_mecha', name: 'Bras du méca titan', desc: 'Le pilote a quatorze ans et beaucoup d\'émotions. Le poing part, les missiles suivent.', rarity: 4, type: 'launcher',
  sprite: 'w_launcher_mecha', energy: 16, cooldown: 0.9, damage: 22, recoil: 8, kick: 70, shake: 4, sfx: 'launch', muzzle: 0xff9a30, casing: false,
  bullet: { speed: 230, accel: 140, sprite: 'b_fist', scale: 1.6, life: 1.1, radius: 6, knockback: 320, explode: { radius: 30 }, trail: 0xff9a30 },
  // signature : le poing-fusée est escorté par 4 mini-missiles chercheurs (25 % chacun)
  onFire: (ctx, ev) => {
    const base = ev.specs[0];
    if (!base) return;
    for (const off of [-0.9, -0.45, 0.45, 0.9]) {
      ev.specs.push({ kind: 'shot', sprite: 'b_rocket', scale: 0.6, damage: base.damage * 0.25, speed: 150, accel: 120, homing: 6, life: 1.3, radius: 3, trail: 0xffa040, angle: (base.angle ?? 0) + off, critChance: base.critChance });
    }
    muzzleFx(ctx, ev, 0xff9a30, 10, 12, 16);
    ctx.burst(ev.player.x, ev.player.y + 4, 0xa0a8c0, 6, 50, 0.4, 2);
  },
  unlock: 120,
});
