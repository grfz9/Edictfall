// ÉPÉES (mêlée : coût 0–1 par coup, détruisent les balles ennemies dans l'arc ; `reflect` les renvoie)
// id              | rareté | DPS                           | énergie/s
// sword_crate     | 0      | 21.1                          | 0
// sword_rapier    | 1      | 29.2 (arc étroit, crit 20 %)  | 0
// sword_cleaver   | 1      | 28.6 (gros recul)             | 0
// sword_mirror    | 2      | 40.0 (renvoie les balles)     | 2.5
// sword_flambe    | 3      | 55.0 (+ brûlure)              | 2.5
// sword_eclipse   | 4      | 65 + croissant 38 % = 89.7    | 2.5
import { defineWeapon } from '../../core/registry';
import { spr } from './_helpers';

spr('b_crescent', ['.pp...', '..pp..', '...p1.', '...p1.', '..pp..', '.pp...']);

spr('w_sword_crate', ['..n..........', 'NNnnnnnnnnnn.', 'dNnSnnnSnnnnn', 'NNNNNNNNNNNN.', '..N..........'], { ox: 1, oy: 2 });
defineWeapon({
  id: 'sword_crate', name: 'Épée en bois de cagette', desc: 'Échardes offertes avec chaque coup.', rarity: 0, type: 'sword',
  sprite: 'w_sword_crate', energy: 0, cooldown: 0.38, damage: 8, sfx: 'swing',
  bullet: { kind: 'slash', range: 26, arc: 2.0, knockback: 90, color: 0xd8b080, onHit: (ctx, _b, t) => ctx.burst(t.x, t.y, 0xb98a52, 2, 40, 0.3, 1) },
});

spr('w_sword_rapier', ['..YY..............', 'NNY.Y22222222222..', 'dNYY11111111111111', 'NNY.Y2222222222...', '..YY..............'], { ox: 1, oy: 2 });
defineWeapon({
  id: 'sword_rapier', name: 'Rapière de l\'escrimeur pressé', desc: 'Touché ! Et touché. Et retouché.', rarity: 1, type: 'sword',
  sprite: 'w_sword_rapier', energy: 0, cooldown: 0.24, damage: 7, crit: 0.2, sfx: 'swing',
  bullet: { kind: 'slash', range: 34, arc: 0.9, knockback: 40, color: 0xe8f0ff },
});

spr('w_sword_cleaver', ['....aaaaaaa.', 'NN.a2222222a', 'NNNa2222222a', 'NN.a1111111a', '....aaaaaaa.'], { ox: 1, oy: 2 });
defineWeapon({
  id: 'sword_cleaver', name: 'Fendoir de boucherie', desc: 'Le boucher ne l\'a pas prêté. Le boucher ne sait pas.', rarity: 1, type: 'sword',
  sprite: 'w_sword_cleaver', energy: 0, cooldown: 0.7, damage: 20, crit: 0.08, shake: 2, kick: -30, sfx: 'thud',
  bullet: { kind: 'slash', range: 28, arc: 2.6, knockback: 190, color: 0xffffff },
});

spr('w_sword_mirror', ['...c...........', 'NN.cIiiiiiiiii.', 'NNNc1111111111c', 'NN.cIiiiiiiiii.', '...c...........'], { ox: 1, oy: 2 });
defineWeapon({
  id: 'sword_mirror', name: 'Lame-Miroir', desc: 'Retour à l\'envoyeur, avec accusé de réception.', rarity: 2, type: 'sword',
  sprite: 'w_sword_mirror', energy: 1, cooldown: 0.4, damage: 16, crit: 0.1, sfx: 'swing',
  bullet: { kind: 'slash', range: 30, arc: 2.4, knockback: 100, reflect: true, color: 0x9ae8ff },
});

spr('w_sword_flambe', ['...V.....o.....', 'NN.Vovvovvvo....', 'NNNVyyyyyyyyyyo', 'NN.Vovvvovvvo..', '...V....o......'], { ox: 1, oy: 2 });
defineWeapon({
  id: 'sword_flambe', name: 'Épée-flambée', desc: 'Servie bien chaude, arrosée de cris.', rarity: 3, type: 'sword',
  sprite: 'w_sword_flambe', energy: 1, cooldown: 0.4, damage: 22, crit: 0.1, sfx: 'fire',
  bullet: { kind: 'slash', range: 32, arc: 2.2, knockback: 100, status: { kind: 'burn', dur: 2 }, color: 0xff9a30 },
  unlock: 40,
});

spr('w_sword_eclipse', ['...P.......pp...', 'NN.Pppppppp11p..', 'NNNP5555555551pp', 'NN.Pppppppp11p..', '...P.......pp...'], { ox: 1, oy: 2 });
defineWeapon({
  id: 'sword_eclipse', name: 'Fauche-Éclipse', desc: 'Un coup de lame, et la nuit continue le travail.', rarity: 4, type: 'sword',
  sprite: 'w_sword_eclipse', energy: 1, cooldown: 0.4, damage: 26, crit: 0.12, shake: 1, sfx: 'swing',
  bullet: { kind: 'slash', range: 34, arc: 3.0, knockback: 120, reflect: true, color: 0xc070ff },
  // signature : chaque coup lance aussi un croissant d'ombre perçant (≈ 38 % des dégâts)
  onFire: (_ctx, ev) => {
    const base = ev.specs[0];
    if (!base) return;
    ev.specs.push({ kind: 'shot', sprite: 'b_crescent', damage: base.damage * 0.38, speed: 250, life: 0.5, radius: 6, pierce: 99, knockback: 50, critChance: base.critChance, trail: 0x7038b8, angle: base.angle });
  },
  unlock: 95,
});
