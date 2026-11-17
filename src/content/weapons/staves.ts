// BÂTONS MAGIQUES (homing, wave, split, statuts)
// id               | rareté | DPS                                   | énergie/s
// staff_twig       | 0      | 16.7 (homing)                         | 3.3
// staff_ember      | 0      | 17.1 (+ brûlure)                      | 2.9
// staff_swamp      | 1      | 23.3 (ondule, poison)                 | 6.7
// staff_frost      | 2      | 34.3 (+ 4 éclats gelants bonus)       | 8.6
// staff_storm      | 2      | 40.0 (2 orbes chercheurs, choc)       | 7.5
// staff_hex        | 3      | 53.3 (gerbe de 8)                     | 10.0
// staff_void       | 4      | 30 formule ; ≈ 85 avec le champ       | 16.7
import { defineWeapon } from '../../core/registry';
import type { Player } from '../../core/types';
import { spr, dist } from './_helpers';

spr('b_orb_green', ['.gg.', 'gllg', 'glGg', '.gg.']);
spr('b_ember', ['.vv.', 'vyyo', 'voyo', '.oo.']);
spr('b_venom', ['.ll.', 'lggl', 'lgGl', '.GG.']);
spr('b_spark', ['..y..', '.yby.', 'yb1by', '.yby.', '..y..']);
spr('b_hex', ['.pp.', 'pmmp', 'pmPp', '.pp.']);
spr('b_void', ['..PPP..', '.P555P.', 'P55k55P', 'P5kkk5P', 'P55k55P', '.P555P.', '..PPP..'], { outline: '#c070ff' });

const SHADE: Record<string, string> = { n: 'N', F: 'f', I: 'C', B: 'b', '5': '4' };
/** Bâton : hampe bicolore avec ligature près de la main + tête 5×5 (ligne 2 = jonction). */
const STAFF = (shaft: string, head: string[]) => {
  const s2 = SHADE[shaft] ?? shaft;
  const pole = `${shaft}${s2}${shaft}dd${shaft}${s2}${shaft}${s2}`;
  return head.map((h, i) => (i === 2 ? pole : '.........') + h);
};

spr('w_staff_twig', ['.........gl.', 'nNnNnNnNdNg.', '......N...gl', '.......l....'], { ox: 3, oy: 1 });
defineWeapon({
  id: 'staff_twig', name: 'Brindille magique', desc: 'Trouvée par terre. Elle aussi vous a trouvé.', rarity: 0, type: 'staff',
  sprite: 'w_staff_twig', energy: 1, cooldown: 0.3, damage: 5, recoil: 1, shake: 0.2, muzzle: 0xa8f070, casing: false,
  bullet: { speed: 150, sprite: 'b_orb_green', life: 1.4, homing: 2.2, trail: 0x58d858 },
});

spr('w_staff_ember', STAFF('n', ['..v..', '.vyv.', 'vy1yo', '.oyo.', '..O..']), { ox: 3, oy: 2 });
defineWeapon({
  id: 'staff_ember', name: 'Sceptre-Braise', desc: 'Idéal pour les marshmallows et les ennemis mous.', rarity: 0, type: 'staff',
  sprite: 'w_staff_ember', energy: 1, cooldown: 0.35, damage: 6, recoil: 1, shake: 0.3, sfx: 'fire', muzzle: 0xff9a30, casing: false,
  bullet: { speed: 190, sprite: 'b_ember', life: 1.1, status: { kind: 'burn', dur: 1.5 }, trail: 0xff8030 },
});

spr('w_staff_swamp', STAFF('F', ['.lg..', 'gGlg.', 'Gg1gG', '.gGg.', '..G..']), { ox: 3, oy: 2 });
defineWeapon({
  id: 'staff_swamp', name: 'Bâton du marais', desc: 'Sent la vase et le mauvais présage.', rarity: 1, type: 'staff',
  sprite: 'w_staff_swamp', energy: 2, cooldown: 0.3, damage: 7, recoil: 1, shake: 0.3, sfx: 'splash', muzzle: 0x70d840, casing: false,
  bullet: { speed: 170, sprite: 'b_venom', life: 1.3, wave: { amp: 10, freq: 12 }, status: { kind: 'poison', dur: 2 }, trail: 0x3a7a3a },
});

spr('w_staff_frost', STAFF('I', ['..i..', '.iCi.', 'iC1Ci', '.iCi.', '..i..']), { ox: 3, oy: 2 });
defineWeapon({
  id: 'staff_frost', name: 'Crosse de givre', desc: 'Chaque sort se brise en flocons vexés.', rarity: 2, type: 'staff',
  sprite: 'w_staff_frost', energy: 3, cooldown: 0.35, damage: 12, recoil: 1.5, shake: 0.4, sfx: 'ice', muzzle: 0xd8f0ff, casing: false,
  bullet: { speed: 200, sprite: 'b_ice', life: 1.1, status: { kind: 'freeze', dur: 0.8 }, split: { count: 4, spec: { damage: 3, speed: 150, life: 0.3, sprite: 'b_small', color: 0xd8f0ff, status: { kind: 'slow', dur: 1 } } } },
});

spr('w_staff_storm', STAFF('B', ['..y..', '.ybB.', 'yb1by', '.Bby.', '..y..']), { ox: 3, oy: 2 });
defineWeapon({
  id: 'staff_storm', name: 'Bâton-Orage', desc: 'Deux étincelles qui savent où vous habitez.', rarity: 2, type: 'staff',
  sprite: 'w_staff_storm', energy: 3, cooldown: 0.4, damage: 8, count: 2, spread: 0.3, recoil: 1.5, shake: 0.5, sfx: 'zap', muzzle: 0xffe060, casing: false,
  bullet: { speed: 210, sprite: 'b_spark', life: 1.3, homing: 3, status: { kind: 'shock', dur: 0.3 }, spin: 12 },
});

spr('w_staff_hex', ['..PPPPPP..', '.Pmmmmmm1P', 'PpppppppP.', 'PPmmmmmmP.', '.PPPPPPP..'], { ox: 2, oy: 2 });
defineWeapon({
  id: 'staff_hex', name: 'Grimoire claqué', desc: 'On l\'ouvre, il crache huit malédictions et se referme vexé.', rarity: 3, type: 'staff',
  sprite: 'w_staff_hex', energy: 6, cooldown: 0.6, damage: 4, count: 8, spread: 5.5, recoil: 2, shake: 1, sfx: 'magic', muzzle: 0xff70b8, casing: false,
  bullet: { speed: 150, sprite: 'b_hex', life: 1.5, homing: 4, trail: 0xb83878 },
  unlock: 45,
});

spr('w_staff_void', STAFF('5', ['.P5P.', 'P5k5P', '5kpk5', 'P5k5P', '.P5P.']), { ox: 3, oy: 2 });
defineWeapon({
  id: 'staff_void', name: 'Sceptre du Néant Poli', desc: 'Un petit trou noir de poche. Attention aux clés.', rarity: 4, type: 'staff',
  sprite: 'w_staff_void', energy: 20, cooldown: 1.2, damage: 6, recoil: 3, kick: 20, shake: 1.5, sfx: 'magic', muzzle: 0x7038b8, casing: false,
  bullet: {
    speed: 55, sprite: 'b_void', life: 3, radius: 6, pierce: 99, knockback: 0, spin: 4,
    // signature : l'orbe aspire les ennemis proches et les ronge (dégâts de base toutes les 0,25 s), puis implose (×5)
    onTick: (ctx, b, dt) => {
      if (!b.data) b.data = { t: 0.25 };
      for (const e of ctx.enemiesIn(b.x, b.y, 56)) {
        const d = dist(e.x, e.y, b.x, b.y);
        const k = 260 * dt * (1 - (e.def.knockbackResist ?? 0));
        e.kx += ((b.x - e.x) / d) * k * 4;
        e.ky += ((b.y - e.y) / d) * k * 4;
      }
      b.data.t -= dt;
      if (b.data.t <= 0) {
        b.data.t += 0.25;
        for (const e of ctx.enemiesIn(b.x, b.y, 30)) ctx.damageEnemy(e, b.damage, { source: b, cause: 'bullet' });
      }
    },
    onEnd: (ctx, b) => {
      ctx.explode(b.x, b.y, 40, b.damage * 5, 'player', { owner: b.owner as Player | null });
      ctx.flash(0x7038b8, 0.12);
    },
  },
  unlock: 115,
});
