// LANCES (slash à arc étroit et longue portée, ou projectile perçant court)
// id               | rareté | DPS                          | énergie/s
// spear_pitchfork  | 0      | 20.0                         | 0
// spear_javelin    | 1      | 26.7 (perce 3)               | 4.4
// spear_harpoon    | 1      | 28.0 (attire la cible)       | 6.0
// spear_halberd    | 2      | 40.0                         | 1.8
// spear_storm      | 3      | 57.8 (+ choc)                | 2.2
import { defineWeapon } from '../../core/registry';
import { spr, dist } from './_helpers';

spr('b_javelin', ['.........2.', 'nnnnnnnnn22', '.........2.']);
spr('b_harpoon', ['.......a.a', 'NNNNNNNaa1', '.......a.a']);

spr('w_spear_pitchfork', ['............a22..', '............a....', 'NnNnNnNnNnNnaa221', '............a....', '............a22..'], { ox: 3, oy: 2 });
defineWeapon({
  id: 'spear_pitchfork', name: 'Fourche de fermier', desc: 'Trois dents, aucune pitié, foin compris.', rarity: 0, type: 'spear',
  sprite: 'w_spear_pitchfork', energy: 0, cooldown: 0.45, damage: 9, sfx: 'swing',
  bullet: { kind: 'slash', range: 42, arc: 0.5, knockback: 70, color: 0xd8c090 },
});

spr('w_spear_javelin', ['.............22..', 'nNnNnNnNnNnNa2221', '.............22..'], { ox: 5, oy: 1 });
defineWeapon({
  id: 'spear_javelin', name: 'Javelot d\'entraînement', desc: 'Lancer, ramasser, recommencer. Surtout lancer.', rarity: 1, type: 'spear',
  sprite: 'w_spear_javelin', energy: 2, cooldown: 0.45, damage: 12, recoil: 4, shake: 0.6, sfx: 'swing', casing: false, muzzle: 0,
  bullet: { speed: 320, sprite: 'b_javelin', life: 0.35, pierce: 3, knockback: 60 },
});

spr('w_spear_harpoon', ['..........a.a', 'NNNNaaaaaaaa1', 'N..N......a.a'], { ox: 2, oy: 1 });
defineWeapon({
  id: 'spear_harpoon', name: 'Harpon de quai', desc: 'Ramène tout ce qu\'il touche. Même ce qu\'on ne voulait pas.', rarity: 1, type: 'spear',
  sprite: 'w_spear_harpoon', energy: 3, cooldown: 0.5, damage: 14, recoil: 4, shake: 0.8, sfx: 'thud', casing: false, muzzle: 0,
  bullet: {
    speed: 300, sprite: 'b_harpoon', life: 0.45, pierce: 1, knockback: 0,
    onHit: (_ctx, b, t) => {
      const o = b.owner;
      if (!o || t.team !== 'enemy') return;
      const d = dist(t.x, t.y, o.x, o.y);
      const k = 260 * (1 - (t.def.knockbackResist ?? 0));
      t.kx += ((o.x - t.x) / d) * k;
      t.ky += ((o.y - t.y) / d) * k;
    },
  },
});

spr('w_spear_halberd', ['..............aa.', 'nnnnnnnnnnnnaa22a', 'NNNNNNNNNNNNa111a', '..............aa.'], { ox: 3, oy: 2 });
defineWeapon({
  id: 'spear_halberd', name: 'Hallebarde du veilleur', desc: 'Garde la porte, la tour, et votre distance.', rarity: 2, type: 'spear',
  sprite: 'w_spear_halberd', energy: 1, cooldown: 0.55, damage: 22, crit: 0.1, shake: 1, sfx: 'swing',
  bullet: { kind: 'slash', range: 46, arc: 1.0, knockback: 160, color: 0xe0e8f0 },
});

spr('w_spear_storm', ['..............y.', 'bbbbbbbbbbbbbyy1', 'BBBBBBBBBBBBByyy', '..............y.'], { ox: 3, oy: 2 });
defineWeapon({
  id: 'spear_storm', name: 'Pique d\'orage', desc: 'Un pas en avant, et l\'électricité fait le reste.', rarity: 3, type: 'spear',
  sprite: 'w_spear_storm', energy: 1, cooldown: 0.45, damage: 26, crit: 0.1, shake: 1.2, sfx: 'zap',
  bullet: { kind: 'slash', range: 50, arc: 0.6, knockback: 90, status: { kind: 'shock', dur: 0.4 }, color: 0xffe060 },
  unlock: 30,
});
