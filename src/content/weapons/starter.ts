// Armes de départ du cœur. Modèle à suivre pour les autres armes.
// Sprite d'arme : dessiné pointant vers la DROITE ; ox/oy = position de la poignée (pivot).
import { defineWeapon, defineSprite } from '../../core/registry';
import { muzzleFx } from './_helpers';

defineSprite('w_pistol_rusty', ['..4444444444', '.4a2222222a3', '.4aaOaaaOa4.', '.4a4NN4444..', '.4Nn4.......', '.4nN........', '..44........'], { ox: 2, oy: 3 });
defineWeapon({
  id: 'pistol_rusty', name: 'Pistolet rouillé', desc: 'Fiable. Ne coûte rien. Ne promet rien.', rarity: 0, type: 'pistol', sprite: 'w_pistol_rusty',
  energy: 0, cooldown: 0.34, damage: 5, jitter: 0.04, recoil: 3, kick: 4, shake: 0.8, muzzle: 0xffd070,
  bullet: { speed: 260, sprite: 'b_slug', life: 1.1, trail: 0xffe0a0 },
  onFire: (ctx, ev) => muzzleFx(ctx, ev, 0xffd070, 2),
});

defineSprite('w_sword_iron', ['...YY............', 'dNdYa2222222222..', 'NdNY11111111111a1', 'dNdYaAAAAAAAAAAa.', '...YY............'], { ox: 1, oy: 2 });
defineWeapon({
  id: 'sword_iron', name: 'Épée de fer', desc: 'Tranche large, coupe les balles. Sans énergie.', rarity: 0, type: 'sword', sprite: 'w_sword_iron',
  energy: 0, cooldown: 0.5, damage: 11, crit: 0.1, shake: 0.6,
  bullet: { kind: 'slash', range: 30, arc: 2.2, knockback: 110, color: 0xe8f0ff },
});
