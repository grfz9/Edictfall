// PISTOLETS
// id               | rareté | DPS                       | énergie/s
// pistol_pebble    | 0      | 18.2                      | 0
// pistol_twin      | 0      | 20.0                      | 3.3
// pistol_revolver  | 1      | 27.5                      | 5.0
// pistol_ricochet  | 1      | 27.3                      | 4.5
// pistol_frost     | 2      | 36.0 (+ gel)              | 8.0
// pistol_magnum    | 3      | 57.8 (perce 2)            | 11.1
// pistol_echo      | 4      | 55 + écho 50 % = 82.5     | 15.0
import { defineWeapon } from '../../core/registry';
import { spr } from './_helpers';

// ------------------------------------------------------------------ balles
spr('b_ice', ['.ii..', 'iI1ic', '.ii..']);
spr('b_echo', ['.pp.', 'p11p', 'p11p', '.pp.'], { outline: '#3a1a5a' });
spr('b_magnum', ['.yyy..', 'yY111y', '.yyy..']);

// ------------------------------------------------------------------ armes
spr('w_pistol_pebble', ['.3333333', '3a2222a.', '3aa.....', '.N......'], { ox: 1, oy: 2 });
defineWeapon({
  id: 'pistol_pebble', name: 'Pétoire de poche', desc: 'Petite, nerveuse, et persuadée d\'être une grande.', rarity: 0, type: 'pistol',
  sprite: 'w_pistol_pebble', energy: 0, cooldown: 0.22, damage: 4, jitter: 0.06, recoil: 2, shake: 0.5, sfx: 'pew', muzzle: 0xfff0a0,
  bullet: { speed: 250, sprite: 'b_small', life: 0.9 },
});

spr('w_pistol_twin', ['.YYYYYY.', 'Ynnnnnn.', 'YYYYYYY.', 'Ynnnnnn.', '.NN.....', '.N......'], { ox: 1, oy: 3 });
defineWeapon({
  id: 'pistol_twin', name: 'Jumelles de cuivre', desc: 'Deux canons, un seul cerveau. Le vôtre.', rarity: 0, type: 'pistol',
  sprite: 'w_pistol_twin', energy: 1, cooldown: 0.3, damage: 3, count: 2, spread: 0.12, recoil: 3, shake: 0.6, muzzle: 0xffd23a,
  bullet: { speed: 240, sprite: 'b_small', life: 1 },
});

spr('w_pistol_revolver', ['..44444444a', '.4aaaaaaaa4', '4aYYa444444', '4nnN.......', '.nn........', '.NN........'], { ox: 2, oy: 3 });
defineWeapon({
  id: 'pistol_revolver', name: 'Barillet grincheux', desc: 'Un coup par clic, et il râle à chaque fois.', rarity: 1, type: 'pistol',
  sprite: 'w_pistol_revolver', energy: 2, cooldown: 0.4, damage: 11, crit: 0.15, auto: false, recoil: 5, kick: 15, shake: 1.6, muzzle: 0xffe070,
  bullet: { speed: 320, sprite: 'b_round', life: 1.1, knockback: 60 },
});

spr('w_pistol_ricochet', ['..tttttt.', '.tTccccTt', 'tT2TTTT..', 'tN.......', '.N.......'], { ox: 1, oy: 3 });
defineWeapon({
  id: 'pistol_ricochet', name: 'Ricocheuse', desc: 'Vise le mur. Le mur visera pour vous.', rarity: 1, type: 'pistol',
  sprite: 'w_pistol_ricochet', energy: 1, cooldown: 0.22, damage: 6, recoil: 3, shake: 0.7, sfx: 'boing', muzzle: 0x9ae8ff,
  bullet: { speed: 230, sprite: 'b_round', color: 0x9ae8ff, life: 1.6, bounces: 3, trail: 0x58c0e8 },
});

spr('w_pistol_frost', ['..IIIIIII.', '.Iiiiiiiic', 'IiCCCCCC..', 'I44.......', '.44.......'], { ox: 1, oy: 3 });
defineWeapon({
  id: 'pistol_frost', name: 'Derringer givré', desc: 'Calme les ardeurs, à commencer par celles des genoux.', rarity: 2, type: 'pistol',
  sprite: 'w_pistol_frost', energy: 2, cooldown: 0.25, damage: 9, recoil: 3, shake: 0.8, sfx: 'ice', muzzle: 0xd8f0ff, casing: false,
  bullet: { speed: 240, sprite: 'b_ice', life: 1.1, status: { kind: 'freeze', dur: 0.6 }, trail: 0xd8f0ff },
});

spr('w_pistol_magnum', ['...44444444444', '..4aaaaaaaaaa4', '.4a1aaaaaaaaa4', '4aRRa444444444', '4ddd..........', '4dd...........', '.dd...........'], { ox: 2, oy: 4 });
defineWeapon({
  id: 'pistol_magnum', name: 'Magnum du Notaire', desc: 'Chaque balle est un acte authentique, signé et tamponné.', rarity: 3, type: 'pistol',
  sprite: 'w_pistol_magnum', energy: 5, cooldown: 0.45, damage: 26, crit: 0.15, auto: false, recoil: 7, kick: 40, shake: 3, sfx: 'thud', muzzle: 0xffc04a,
  bullet: { speed: 380, sprite: 'b_magnum', life: 1.2, pierce: 2, knockback: 120 },
  unlock: 40,
});

spr('w_pistol_echo', ['...pppppppp.', '..pPmmmmmmPp', '.pP1PPPPPP..', 'pPPm........', 'pPP.........', '.PP.........'], { ox: 2, oy: 4 });
defineWeapon({
  id: 'pistol_echo', name: 'Écho-Pistolet', desc: 'Il tire, puis il se répète. Comme votre oncle au réveillon.', rarity: 4, type: 'pistol',
  sprite: 'w_pistol_echo', energy: 3, cooldown: 0.2, damage: 11, crit: 0.1, recoil: 3, shake: 1, sfx: 'pew', muzzle: 0xc070ff,
  bullet: { speed: 280, sprite: 'b_round', color: 0xffd0ff, life: 1.1 },
  // signature : 0,25 s après chaque tir, un écho violet rejoue le même tir (50 % des dégâts) depuis la position du joueur
  onFire: (ctx, ev) => {
    const p = ev.player;
    const specs = ev.specs;
    ctx.after(0.25, () => {
      if (p.downed) return;
      const a = p.aim;
      for (const s of specs) {
        if (s.kind && s.kind !== 'shot') continue;
        const b = ctx.spawnBullet({ ...s, damage: s.damage * 0.5, sprite: 'b_echo', color: 0xffffff, trail: 0xc070ff }, p.x + Math.cos(a) * 9, p.y + Math.sin(a) * 9, a, 'player', p);
        if (b) b.weaponId = 'pistol_echo';
      }
      ctx.sfx('pew', 0.4);
    }, p);
  },
  unlock: 90,
});
