// Armes de départ du cœur. Modèle à suivre pour les autres armes.
// Sprite d'arme : dessiné pointant vers la DROITE ; ox/oy = position de la poignée (pivot).
import { defineWeapon, defineSprite } from '../../core/registry';

defineSprite('w_pistol_rusty', ['..4444444.', '.4aaaaaaa4', '.4a444444.', '.4N4......', '.4N4......', '..4.......'], { ox: 2, oy: 3 });
defineWeapon({
  id: 'pistol_rusty', name: 'Pistolet rouillé', desc: 'Fiable. Ne coûte rien. Ne promet rien.', rarity: 0, type: 'pistol', sprite: 'w_pistol_rusty',
  energy: 0, cooldown: 0.34, damage: 5, jitter: 0.04, recoil: 3, shake: 0.8,
  bullet: { speed: 260, sprite: 'b_round', life: 1.1 },
});

defineSprite('w_sword_iron', ['...y..........', 'NN.y222222222.', 'NNNy1111111112', 'NN.y222222222.', '...y..........'], { ox: 1, oy: 2 });
defineWeapon({
  id: 'sword_iron', name: 'Épée de fer', desc: 'Tranche large, coupe les balles. Sans énergie.', rarity: 0, type: 'sword', sprite: 'w_sword_iron',
  energy: 0, cooldown: 0.42, damage: 11, crit: 0.1,
  bullet: { kind: 'slash', range: 30, arc: 2.2, knockback: 110 },
});
