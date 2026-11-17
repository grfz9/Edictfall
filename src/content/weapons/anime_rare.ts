// ARMES « ANIMÉ » — rares (bleu) et épiques (violet). Tropes de rivaux, de ninjas et de joueurs de cartes.
// id              | rareté | DPS                                            | énergie/s
// spear_cloud     | 2      | 37.5 + nuage tous les 3 coups ≈ 41.3           | 0 (mêlée, 1/coup)
// weird_stormfan  | 2      | 31.1 + lame de vent 35 % ≈ 42.0                | 0 (mêlée, 1/coup)
// rifle_parasol   | 2      | 40.0                                           | 9.1
// sword_kusari    | 2      | 35.6 (attire la cible)                         | 0
// weird_yoyo      | 2      | 36.0 (aller-retour, frappe 2 fois) ≈ 36        | 6.7
// sword_ronin     | 3      | 37.5 + coupe différée 60 % à pleine charge = 60 | 0 (mêlée, 1/coup)
// weird_cards     | 3      | 56.5 (3 cartes × (8 + souffle 8))              | 10.6
// spear_return    | 3      | 26 × 2 passages = 52                           | 10.0
import { defineWeapon } from '../../core/registry';
import type { Player } from '../../core/types';
import { spr, dist, muzzleFx } from './_helpers';

// ------------------------------------------------------------------ balles
spr('b_nimbus', ['..ii.i..', '.i1iiii.', 'iiiiIiii', '.IIIIII.'], { outline: '#4a5878', frames: [['...i.ii.', '.iiii1i.', 'iiIiiiii', '.IIIIII.']] });
spr('b_wind', ['.cc..', '...c.', '...c1', '...c.', '.cc..'], { outline: false });
spr('b_petal', ['.pp.', 'p11p', '.pP.']);
spr('b_yoyo', ['.bBb.', 'b1bbB', 'BbybB', 'BbbbB', '.BBB.']);
spr('b_card', ['1wwww2', '1wRww2', '1wwBw2', '222222'], { frames: [['1wwww2', '1wwRw2', '1wBww2', '222222']] });
spr('b_spear_ret', ['..........c.', 'nNnNnNnYtc11', '..........c.']);

// ------------------------------------------------------------------ bleu
spr('w_spear_cloud', [
  '.yY..............yY.',
  'yY1VvVvVvVvVvVvVvY1y',
  '.YY..............YY.',
], { ox: 4, oy: 1 });
defineWeapon({
  id: 'spear_cloud', name: 'Bâton-nuage extensible', desc: 'S\'allonge à volonté. Tous les trois coups, un petit nuage part faire des siennes.', rarity: 2, type: 'spear',
  sprite: 'w_spear_cloud', energy: 1, cooldown: 0.4, damage: 15, crit: 0.1, shake: 0.8, sfx: 'swing',
  bullet: { kind: 'slash', range: 72, arc: 0.4, knockback: 130, color: 0xffd23a },
  // signature : un coup sur trois libère un nuage perçant (30 % des dégâts) qui dérive en électrisant
  onFire: (ctx, ev) => {
    const d = ev.weapon.data;
    d.n = (d.n ?? 0) + 1;
    const base = ev.specs[0];
    if (!base || d.n % 3 !== 0) return;
    ev.specs.push({ kind: 'shot', sprite: 'b_nimbus', damage: base.damage * 0.3, speed: 85, life: 1.6, radius: 6, pierce: 99, knockback: 20, wave: { amp: 3, freq: 4 }, status: { kind: 'shock', dur: 0.3 }, trail: 0xd8f0ff, angle: base.angle });
    ctx.burst(ev.player.x, ev.player.y - 4, 0xffffff, 5, 40, 0.4, 2);
  },
});

spr('w_weird_stormfan', [
  '.....ttt..',
  '...ttT1Tt.',
  '..tTtTtTtt',
  'NNdtTtTt1t',
  '..tTtTtTtt',
  '...ttT1Tt.',
  '.....ttt..',
], { ox: 1, oy: 3 });
defineWeapon({
  id: 'weird_stormfan', name: 'Éventail de tempête', desc: 'Un battement d\'éventail, et la cour entière change d\'avis.', rarity: 2, type: 'weird',
  sprite: 'w_weird_stormfan', energy: 1, cooldown: 0.45, damage: 14, shake: 1, sfx: 'swing',
  bullet: { kind: 'slash', range: 50, arc: 1.6, knockback: 260, color: 0x9ae8ff },
  // signature : chaque battement envoie aussi une lame de vent perçante (35 %)
  onFire: (_ctx, ev) => {
    const base = ev.specs[0];
    if (!base) return;
    ev.specs.push({ kind: 'shot', sprite: 'b_wind', damage: base.damage * 0.35, speed: 250, life: 0.6, radius: 5, pierce: 99, knockback: 140, scale: 1.6, color: 0xd8f0ff, trail: 0x9ae8ff, angle: base.angle, critChance: base.critChance });
  },
});

spr('w_rifle_parasol', [
  '...pPPPPPPPPpp....',
  'NNNP1pppppppppp222',
  'N..pPPPPPPPPpp....',
  'NN................',
], { ox: 1, oy: 1 });
defineWeapon({
  id: 'rifle_parasol', name: 'Ombrelle-mitrailleuse', desc: 'La gouvernante range une sulfateuse dans son ombrelle. Le thé est servi.', rarity: 2, type: 'rifle',
  sprite: 'w_rifle_parasol', energy: 1, cooldown: 0.11, damage: 4.4, jitter: 0.08, recoil: 1.5, shake: 0.4, sfx: 'rifle', muzzle: 0xc070ff,
  bullet: { speed: 340, sprite: 'b_petal', life: 0.8, trail: 0x7038b8 },
});

spr('w_sword_kusari', [
  '...........aaa..',
  '..........a2211a',
  '3.3.3.3NNNa.....',
  '.3.3.3.NNN......',
], { ox: 8, oy: 2 });
defineWeapon({
  id: 'sword_kusari', name: 'Faucille à chaîne', desc: 'La chaîne fait le tour, la faucille fait le reste. Ramène les fuyards.', rarity: 2, type: 'sword',
  sprite: 'w_sword_kusari', energy: 0, cooldown: 0.45, damage: 16, crit: 0.1, shake: 0.8, sfx: 'swing',
  bullet: {
    kind: 'slash', range: 56, arc: 2.6, knockback: 0, color: 0xc8d0e0,
    onHit: (_ctx, b, t) => {
      const o = b.owner;
      if (!o || t.team !== 'enemy') return;
      const d = dist(t.x, t.y, o.x, o.y);
      if (d < 20) return;
      const k = 160 * (1 - (t.def.knockbackResist ?? 0));
      t.kx += ((o.x - t.x) / d) * k;
      t.ky += ((o.y - t.y) / d) * k;
    },
  },
});

spr('w_weird_yoyo', [
  '..........bBb.',
  '.........b1bbB',
  'ss3333333BbybB',
  '.........BbbbB',
  '..........BBB.',
], { ox: 1, oy: 2 });
defineWeapon({
  id: 'weird_yoyo', name: 'Yo-yo de la terreur', desc: 'Le délinquant au manteau long a ses méthodes. Tour du monde, retour à l\'envoyeur.', rarity: 2, type: 'weird',
  sprite: 'w_weird_yoyo', energy: 3, cooldown: 0.45, damage: 8.1, recoil: 2, shake: 0.6, sfx: 'boing', muzzle: 0x48a8ff, casing: false,
  // le yo-yo frappe à l'aller puis au retour : 8.1 × 2 / 0.45 = 36
  bullet: {
    speed: 260, sprite: 'b_yoyo', life: 0.7, boomerang: true, pierce: 99, ghost: true, radius: 5, spin: 18, knockback: 60, trail: 0x48a8ff,
    onTick: (_ctx, b) => { if (b.age > b.life * 0.45 && !b.data?.ret) { b.data = { ret: true }; b.hit.clear(); } },
  },
});

// ------------------------------------------------------------------ violet
spr('w_sword_ronin', [
  '...YY...............',
  'dNdNY5555555555555..',
  'NdNdY54444Y44444445.',
  '...YY...............',
], { ox: 1, oy: 2 });
defineWeapon({
  id: 'sword_ronin', name: 'Dégaine du rōnin errant', desc: 'Maintenir pour rengainer. Relâcher : on ne voit rien, puis tout tombe.', rarity: 3, type: 'sword',
  sprite: 'w_sword_ronin', energy: 1, cooldown: 0.25, damage: 30, crit: 0.3, charge: { time: 0.55, minMult: 0.3 }, shake: 1.5, sfx: 'swing',
  bullet: { kind: 'slash', range: 46, arc: 1.1, knockback: 120, color: 0xffffff },
  // signature : à pleine charge, ruée instantanée vers l'avant, puis la vraie coupure tombe 0,18 s plus tard (60 %)
  onFire: (ctx, ev) => {
    const p = ev.player, base = ev.specs[0];
    if (!base || ev.chargeMult < 0.95) return;
    const a = ev.angle;
    ctx.burst(p.x, p.y, 0xffffff, 6, 40, 0.3, 1);
    p.kx += Math.cos(a) * 380;
    p.ky += Math.sin(a) * 380;
    p.invuln = Math.max(p.invuln, 0.3);
    const dmg = base.damage * 0.6, crit = base.critChance;
    ctx.after(0.18, () => {
      if (p.downed) return;
      const b = ctx.spawnBullet({ kind: 'slash', damage: dmg, range: 54, arc: 2.4, knockback: 160, color: 0xff5a7a, critChance: crit }, p.x, p.y, a + Math.PI, 'player', p);
      if (b) b.weaponId = 'sword_ronin';
      ctx.shake(4);
      ctx.hitstop(0.05);
      ctx.sfx('thud', 0.7);
      ctx.text(p.x, p.y - 16, '…tchac.', 0xffffff);
    }, p);
  },
  unlock: 55,
});

spr('w_weird_cards', [
  '..1wwww..',
  '.1wRwwww.',
  '1wRRRwwww',
  '1wwRwwBww',
  '1wwwwBBBw',
  '.2wwwwBw.',
  '..2222...',
], { ox: 1, oy: 4 });
defineWeapon({
  id: 'weird_cards', name: 'Brelan explosif', desc: 'Le joueur en manteau violet abat ses cartes. Elles abattent le reste.', rarity: 3, type: 'weird',
  sprite: 'w_weird_cards', energy: 9, cooldown: 0.85, damage: 8, count: 3, spread: 0.35, recoil: 3, shake: 1.2, sfx: 'swing', muzzle: 0xc070ff, casing: false,
  bullet: { speed: 270, drag: 0.8, sprite: 'b_card', life: 0.75, radius: 4, spin: 16, explode: { radius: 18 }, trail: 0xc070ff },
  // signature : une main sur cinq contient un Joker (carte géante qui éclate en six petites cartes)
  onFire: (ctx, ev) => {
    const d = ev.weapon.data;
    d.n = (d.n ?? 0) + 1;
    muzzleFx(ctx, ev, 0xc070ff, 4);
    if (d.n % 5 !== 0) return;
    const mid = ev.specs[Math.floor(ev.specs.length / 2)];
    if (!mid) return;
    mid.scale = 1.8;
    mid.radius = 6;
    mid.explode = { radius: 26 };
    mid.split = { count: 6, spec: { damage: 2, speed: 150, life: 0.3, sprite: 'b_card', scale: 0.6 } };
    ctx.text(ev.player.x, ev.player.y - 16, 'JOKER !', 0xc070ff);
  },
  unlock: 45,
});

spr('w_spear_return', [
  '.................c..',
  'nNnNnNnNnNnNnYtTcc1.',
  'NnNnNnNnNnNnNYTTTc11',
  'nNnNnNnNnNnNnYtTcc1.',
  '.................c..',
], { ox: 4, oy: 2 });
defineWeapon({
  id: 'spear_return', name: 'Lance du serment', desc: 'Elle a juré de revenir dans votre main. Elle traverse tout pour tenir parole.', rarity: 3, type: 'spear',
  sprite: 'w_spear_return', energy: 5, cooldown: 0.5, damage: 13, crit: 0.1, recoil: 4, kick: 15, shake: 1, sfx: 'swing', muzzle: 0x30c0b0, casing: false,
  // frappe à l'aller ET au retour : 13 × 2 / 0.5 = 52
  bullet: {
    speed: 320, sprite: 'b_spear_ret', life: 0.9, boomerang: true, pierce: 99, ghost: true, radius: 5, knockback: 70, trail: 0x30c0b0,
    onTick: (ctx, b) => {
      if (b.age > b.life * 0.45 && !b.data?.ret) {
        b.data = { ret: true };
        b.hit.clear();
        ctx.burst(b.x, b.y, 0x9ae8ff, 5, 60, 0.25, 1);
      }
    },
    onEnd: (ctx, b) => { const o = b.owner as Player | null; if (o && dist(o.x, o.y, b.x, b.y) < 16) ctx.burst(o.x, o.y, 0x30c0b0, 4, 30, 0.2, 1); },
  },
  unlock: 40,
});

