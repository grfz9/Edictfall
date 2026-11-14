// LASERS (rayons instantanés : continus à cooldown court ou impulsions)
// id               | rareté | DPS                          | énergie/s
// laser_pointer    | 0      | 20.0                         | 0
// laser_cutter     | 1      | 30.0                         | 5.0
// laser_pulse      | 2      | 42.0 (impulsion ×3)          | 8.0
// laser_ricochet   | 3      | 56.3 (3 rebonds)             | 12.5
// laser_sunspear   | 4      | 80 nominal (60 → 100 chauffé) | 20.0
import { defineWeapon } from '../../core/registry';
import { spr } from './_helpers';

spr('w_laser_pointer', ['.33333333', '3222222mr', '.33333333', '..4......'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'laser_pointer', name: 'Pointeur de conférence', desc: 'Diapositive suivante : votre défaite.', rarity: 0, type: 'laser',
  sprite: 'w_laser_pointer', energy: 0, cooldown: 0.15, damage: 3, recoil: 0.5, shake: 0, sfx: 'zap',
  bullet: { kind: 'beam', damage: 3, width: 1.5, length: 150, color: 0xff3050 },
});

spr('w_laser_cutter', ['..yyyyy....', '4yY4444aaa1', '4YY444aaaa.', '.4.4.......', '...4.......'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'laser_cutter', name: 'Découpe-tôle', desc: 'Garantie deux ans, sauf usage sur des gens.', rarity: 1, type: 'laser',
  sprite: 'w_laser_cutter', energy: 1, cooldown: 0.2, damage: 6, recoil: 1, shake: 0.3,
  bullet: { kind: 'beam', damage: 6, width: 2.5, length: 180, color: 0xffd23a },
});

spr('w_laser_pulse', ['..BBBBBBB..', '.BbbbbbbBcc', 'B5ccc5bBc11', '.B5BBBBBBcc', '..5........'], { ox: 2, oy: 3 });
defineWeapon({
  id: 'laser_pulse', name: 'Impulseur', desc: 'Trois éclairs bleus, zéro remords.', rarity: 2, type: 'laser',
  sprite: 'w_laser_pulse', energy: 4, cooldown: 0.5, damage: 7, burst: { count: 3, interval: 0.06 }, recoil: 2, shake: 1, sfx: 'laser',
  bullet: { kind: 'beam', damage: 7, width: 4, length: 220, color: 0x48a8ff },
});

spr('w_laser_ricochet', ['...tttttt..', '.ttTTTTTTc1', 'tT5tttttTc.', 'tT5........', '.T5........'], { ox: 2, oy: 3 });
defineWeapon({
  id: 'laser_ricochet', name: 'Rayon ricochet', desc: 'La géométrie, c\'est de la violence avec des angles.', rarity: 3, type: 'laser',
  sprite: 'w_laser_ricochet', energy: 2, cooldown: 0.16, damage: 9, recoil: 1, shake: 0.4, sfx: 'laser',
  bullet: { kind: 'beam', damage: 9, width: 3, length: 300, bounces: 3, color: 0x30c0b0 },
  unlock: 45,
});

spr('w_laser_sunspear', ['......yy......', '..YYYyy1yyvv..', 'nnYyy111yyyvvo', '..YYYyy1yyvv..', '......yy......'], { ox: 1, oy: 2 });
defineWeapon({
  id: 'laser_sunspear', name: 'Lance-Soleil', desc: 'Plus vous maintenez, plus il fait chaud. Beaucoup plus chaud.', rarity: 4, type: 'laser',
  sprite: 'w_laser_sunspear', energy: 2, cooldown: 0.1, damage: 8, recoil: 1, shake: 0.4, sfx: 'fire',
  bullet: { kind: 'beam', damage: 8, width: 3, length: 240, color: 0xffb030, status: { kind: 'burn', dur: 1 } },
  // signature : la chaleur monte tant qu'on tire sans pause (0 → 1 en ~1 s) : rayon plus large et dégâts ×0,75 → ×1,25
  onFire: (ctx, ev) => {
    const d = ev.player.data;
    const last = d.sunspearT ?? -1;
    d.sunspearHeat = ctx.time - last < 0.25 ? Math.min(1, (d.sunspearHeat ?? 0) + 0.1) : 0;
    d.sunspearT = ctx.time;
    const h = d.sunspearHeat;
    for (const s of ev.specs) {
      s.damage *= 0.75 + 0.5 * h;
      s.width = 3 + 6 * h;
      s.color = h >= 1 ? 0xffffff : h > 0.5 ? 0xffe060 : 0xffb030;
    }
    if (h >= 1 && ctx.rng.chance(0.3)) ctx.shake(1.5);
  },
  unlock: 100,
});
