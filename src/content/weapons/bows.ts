// ARCS (maintenir pour charger ; DPS calculé à charge pleine sur un cycle cooldown + charge)
// id            | rareté | DPS                                   | énergie/s
// bow_recess    | 0      | 20.0                                  | 0
// bow_poacher   | 1      | 27.5 (perce 1)                        | 3.75
// bow_trident   | 2      | 41.3 (3 flèches)                      | 6.25
// bow_frost     | 2      | 34.7 (+ gel)                          | 6.7
// bow_thunder   | 3      | 50.0 (perce 3, choc)                  | 10.0
// bow_comet     | 4      | 66.7 (30 + souffle 30 ; + étoiles ≈ 93) | 16.7
import { defineWeapon } from '../../core/registry';
import type { Player } from '../../core/types';
import { spr } from './_helpers';

spr('b_arrow_ice', ['......i..', 'IIIIIIcii', '......i..']);
spr('b_arrow_bolt', ['.....y...', 'yyyyyy1yy', '.....y...']);
spr('b_arrow_comet', ['.......yy.', 'pPpPyyy11y', '.......yy.']);
spr('b_star', ['..y..', '.yyy.', 'yy1yy', '.yyy.', '.y.y.']);

const BOW = (c: string, s: string) => ['.' + c + c + '...', c + '..' + c + '..', c + '...' + c + '.', c + 'nnnn' + c + s + s, c + '...' + c + '.', c + '..' + c + '..', '.' + c + c + '...'];

spr('w_bow_recess', BOW('n', '2'), { ox: 1, oy: 3 });
defineWeapon({
  id: 'bow_recess', name: 'Arc de récré', desc: 'Ventouses retirées. Règlement de cour piétiné.', rarity: 0, type: 'bow',
  sprite: 'w_bow_recess', energy: 0, cooldown: 0.15, damage: 9, charge: { time: 0.3, minMult: 0.4 }, recoil: 2, shake: 0.3, casing: false,
  bullet: { speed: 300, sprite: 'b_arrow', life: 1 },
});

spr('w_bow_poacher', BOW('N', 'f'), { ox: 1, oy: 3 });
defineWeapon({
  id: 'bow_poacher', name: 'Arc long du braconnier', desc: 'Silencieux, patient, et pas très en règle.', rarity: 1, type: 'bow',
  sprite: 'w_bow_poacher', energy: 3, cooldown: 0.2, damage: 22, crit: 0.12, charge: { time: 0.6, minMult: 0.3 }, recoil: 3, shake: 0.6, casing: false,
  bullet: { speed: 380, sprite: 'b_arrow', life: 1, pierce: 1 },
});

spr('w_bow_trident', ['.tt....', 't..t...', 't...t.y', 't...2ty', 't...t.y', 't..t...', '.tt....'], { ox: 1, oy: 3 });
defineWeapon({
  id: 'bow_trident', name: 'Arc trident', desc: 'Trois flèches, parce que deux, c\'est mesquin.', rarity: 2, type: 'bow',
  sprite: 'w_bow_trident', energy: 5, cooldown: 0.2, damage: 11, count: 3, spread: 0.25, charge: { time: 0.6, minMult: 0.35 }, recoil: 3, shake: 0.6, casing: false,
  bullet: { speed: 340, sprite: 'b_arrow', life: 1 },
});

spr('w_bow_frost', BOW('I', 'c'), { ox: 1, oy: 3 });
defineWeapon({
  id: 'bow_frost', name: 'Arc de givre', desc: 'Les cibles restent figées d\'admiration. Littéralement.', rarity: 2, type: 'bow',
  sprite: 'w_bow_frost', energy: 5, cooldown: 0.2, damage: 26, charge: { time: 0.55, minMult: 0.35 }, recoil: 3, shake: 0.6, sfx: 'ice', casing: false,
  bullet: { speed: 340, sprite: 'b_arrow_ice', life: 1, status: { kind: 'freeze', dur: 1.2 }, trail: 0xd8f0ff },
});

spr('w_bow_thunder', BOW('y', 'b'), { ox: 1, oy: 3 });
defineWeapon({
  id: 'bow_thunder', name: 'Arc-Tonnerre', desc: 'Il gronde avant de tirer. Vous aussi, désormais.', rarity: 3, type: 'bow',
  sprite: 'w_bow_thunder', energy: 8, cooldown: 0.2, damage: 40, charge: { time: 0.6, minMult: 0.3 }, recoil: 4, shake: 1.5, sfx: 'zap', casing: false,
  bullet: { speed: 460, sprite: 'b_arrow_bolt', life: 0.9, pierce: 3, status: { kind: 'shock', dur: 0.5 }, trail: 0xffd23a },
  unlock: 50,
});

spr('w_bow_comet', ['.pp.....', 'p..pp...', 'p....p.y', 'p....1yy', 'p....p.y', 'p..pp...', '.pp.....'], { ox: 1, oy: 3 });
defineWeapon({
  id: 'bow_comet', name: 'Arc des Comètes', desc: 'Chargé à fond, il fait pleuvoir le ciel sur la cible.', rarity: 4, type: 'bow',
  sprite: 'w_bow_comet', energy: 15, cooldown: 0.25, damage: 30, charge: { time: 0.65, minMult: 0.3 }, recoil: 5, kick: 30, shake: 2, sfx: 'charge', casing: false,
  bullet: {
    speed: 400, sprite: 'b_arrow_comet', life: 0.9, explode: { radius: 22 }, trail: 0xc070ff,
    // signature : à charge pleine, l'impact appelle 4 étoiles filantes autour du point de chute
    onEnd: (ctx, b) => {
      if (!b.data?.comet || b.gen > 0) return;
      const owner = b.owner as Player | null;
      for (let i = 0; i < 4; i++) {
        const a = ctx.rng.range(0, Math.PI * 2), r = ctx.rng.range(6, 26);
        const tx = b.x + Math.cos(a) * r, ty = b.y + Math.sin(a) * r;
        ctx.spawnBullet({ kind: 'lob', sprite: 'b_star', damage: 6, tx, ty, life: 0.35 + i * 0.08, explode: { radius: 14 }, spin: 10 }, tx - 30, ty - 80, 0, 'player', owner);
      }
      ctx.sfx('magic', 0.6);
    },
  },
  onFire: (_ctx, ev) => {
    if (ev.chargeMult >= 0.97) for (const s of ev.specs) s.data = { comet: true };
  },
  unlock: 110,
});
