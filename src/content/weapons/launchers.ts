// LANCE-ROQUETTES / GRENADES (DPS = impact direct + explosion ; tirs en cloche : explosion seule)
// id                    | rareté | DPS                                       | énergie/s
// launcher_firecracker  | 0      | 17.5                                      | 3.75
// launcher_fair         | 1      | 26.7 (10 impact + 10 souffle)             | 5.3
// launcher_cluster      | 2      | 40.0 (+ 6 éclats bonus)                   | 6.7
// launcher_mines        | 2      | 42.2 (19 + 19)                            | 5.6
// launcher_napalm       | 3      | 56.7 (+ brûlure)                          | 10.0
// launcher_requiem      | 4      | 42.4 si impact précoce ; ≈ 76 en 3 têtes  | 16.5
import { defineWeapon } from '../../core/registry';
import type { Player } from '../../core/types';
import { spr, aimLob } from './_helpers';

spr('b_grenade', ['.GG.', 'GgfG', 'GffG', '.GG.']);
spr('b_cracker', ['..y', 'rrR', 'rrR']);
spr('b_mine', ['.444.', '4rRr4', '4RrR4', '.444.']);
spr('b_molotov', ['..w.', '.nnv', 'nddn', '.nn.']);

spr('w_launcher_firecracker', ['.rrrrrrr.', 'rRyRRyRRy', 'rrrrrrrr.', '.N..N....'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'launcher_firecracker', name: 'Pétard mouillé', desc: 'Fait « pof ». Parfois « POF ».', rarity: 0, type: 'launcher',
  sprite: 'w_launcher_firecracker', energy: 3, cooldown: 0.8, damage: 14, recoil: 4, kick: 15, shake: 1.5, sfx: 'launch', casing: false,
  bullet: { kind: 'lob', sprite: 'b_cracker', explode: { radius: 18 }, spin: 9 },
  onFire: (ctx, ev) => aimLob(ctx, ev, 110),
});

spr('w_launcher_fair', ['...mmmmmmmmm.', 'nnmyyyyyyyymm', 'NNmmmmmmmmmm.', 'N..NN........'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'launcher_fair', name: 'Fusée de kermesse', desc: 'Premier prix au chamboule-tout. Et au chamboule-tous.', rarity: 1, type: 'launcher',
  sprite: 'w_launcher_fair', energy: 4, cooldown: 0.75, damage: 10, recoil: 5, kick: 30, shake: 2, sfx: 'launch', muzzle: 0xff9a30, casing: false,
  bullet: { speed: 200, accel: 160, sprite: 'b_rocket', life: 1.3, explode: { radius: 22 }, trail: 0xffa040 },
});

spr('w_launcher_cluster', ['.FFFFFFFF..', 'FfffffffffG', 'FfGGGGGGffG', 'FFFFFFFFFF.', '.d..d......'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'launcher_cluster', name: 'Grappe-Grêle', desc: 'Une grenade, puis six petites qui veulent faire comme la grande.', rarity: 2, type: 'launcher',
  sprite: 'w_launcher_cluster', energy: 6, cooldown: 0.9, damage: 36, recoil: 5, kick: 25, shake: 2, sfx: 'launch', casing: false,
  bullet: { kind: 'lob', sprite: 'b_grenade', explode: { radius: 24 }, spin: 6, split: { count: 6, spec: { damage: 4, speed: 150, life: 0.35, sprite: 'b_small' } } },
  onFire: (ctx, ev) => aimLob(ctx, ev, 130),
});

spr('w_launcher_mines', ['..44444444.', '.4aaaaaaaa4', '4aRRaa4444.', '4dd........', '.dd........'], { ox: 2, oy: 3 });
defineWeapon({
  id: 'launcher_mines', name: 'Semeuse de mines', desc: 'Jardinage explosif : plantez, attendez, récoltez.', rarity: 2, type: 'launcher',
  sprite: 'w_launcher_mines', energy: 5, cooldown: 0.9, damage: 19, recoil: 3, shake: 1, sfx: 'thud', casing: false, muzzle: 0,
  bullet: { speed: 170, drag: 3.2, life: 5, radius: 5, sprite: 'b_mine', explode: { radius: 28 } },
});

spr('w_launcher_napalm', ['..VVVVVVVV.', '.VvvvvvvvvV', 'nVoooooooo.', 'nNVVVVVVVV.', '.N.........'], { ox: 1, oy: 3 });
defineWeapon({
  id: 'launcher_napalm', name: 'Cocktail du cuisinier', desc: 'Recette secrète : flamber, puis flamber encore.', rarity: 3, type: 'launcher',
  sprite: 'w_launcher_napalm', energy: 6, cooldown: 0.6, damage: 34, recoil: 4, kick: 20, shake: 2, sfx: 'fire', casing: false,
  bullet: { kind: 'lob', sprite: 'b_molotov', explode: { radius: 26, status: { kind: 'burn', dur: 3 } }, spin: 12 },
  onFire: (ctx, ev) => aimLob(ctx, ev, 120),
  unlock: 35,
});

spr('w_launcher_requiem', ['...PPPPPPPPPPP', '..PpppppppppppP', 'nnP5555555555rv', 'NNPppppppppppP', 'N..PPPPPPPPPPP', '...d.d.........'], { ox: 2, oy: 3 });
defineWeapon({
  id: 'launcher_requiem', name: 'Requiem en Do', desc: 'Une roquette, trois couplets, aucun survivant au refrain.', rarity: 4, type: 'launcher',
  sprite: 'w_launcher_requiem', energy: 14, cooldown: 0.85, damage: 18, recoil: 7, kick: 60, shake: 3.5, sfx: 'launch', muzzle: 0xc070ff, casing: false,
  bullet: {
    speed: 190, sprite: 'b_rocket', life: 1.4, homing: 1.5, explode: { radius: 30 }, trail: 0xc070ff,
    // signature : à 0,35 s de vol, la roquette se divise en trois têtes chercheuses (≈ 11 + souffle 11 chacune)
    onTick: (ctx, b) => {
      if (b.dead || b.gen > 0 || b.age < 0.35) return;
      b.dead = true;
      const owner = b.owner as Player | null;
      const dmg = (b.damage / (owner?.mods?.damage || 1)) * 0.6; // ≈ 11 par tête (rareté/charge conservées)
      for (let i = -1; i <= 1; i++) {
        const nb = ctx.spawnBullet({ speed: 210, sprite: 'b_rocket', scale: 0.7, life: 1.3, homing: 5, damage: dmg, explode: { radius: 18 }, trail: 0xff70b8 }, b.x, b.y, b.dir + i * 0.5, 'player', owner);
        if (nb) { nb.gen = 1; nb.weaponId = b.weaponId; }
      }
      ctx.burst(b.x, b.y, 0xc070ff, 8, 70, 0.3, 2);
      ctx.sfx('launch', 0.5);
    },
  },
  unlock: 120,
});
