// Édits « visuels » : ils changent ce que tu vois… et paient pour la gêne.
import { defineRule } from '../../core/registry';
import { icon, pw } from './_kit';

defineRule({
  id: 'black_night', name: 'Nuit noire', category: 'visual', flavor: 'curse', priority: 200,
  desc: 'Les salles sont plongées dans le noir (tu ne vois qu\'autour de toi), mais tu infliges 25 % de dégâts en plus et 10 % de coups critiques en plus.',
  icon: icon('ic_black_night', 'moon', 'B', '5', 'b'),
  modify: (m, _c, s) => {
    m.darkness = m.darkness > 0 ? Math.min(m.darkness, 95) : 95;
    m.damage *= 1 + 0.25 * pw(s, 3);
    m.crit += 0.1;
  },
});

defineRule({
  id: 'mirror_world', name: 'Monde miroir', category: 'visual', flavor: 'curse',
  desc: 'L\'écran est inversé gauche-droite, mais l\'or et les gemmes rapportent 50 % de plus.',
  icon: icon('ic_mirror_world', 'twin', 'c', 'P'),
  modify: (m, _c, s) => {
    m.mirror = true;
    const k = Math.min(2, pw(s, 2));
    m.coinMult *= 1 + 0.5 * k;
    m.gemMult *= 1 + 0.5 * k;
  },
});

defineRule({
  id: 'monochrome', name: 'Monochrome', category: 'visual', flavor: 'curse',
  desc: 'Le monde perd ses couleurs, mais tes coups critiques sont plus fréquents (+15 %) et plus violents (+50 %).',
  icon: icon('ic_monochrome', 'eye', '3', '4'),
  modify: (m, _c, s) => {
    m.grayscale = 1;
    const k = pw(s, 3);
    m.crit += 0.15 * k;
    m.critMult += 0.5 * k;
  },
});

defineRule({
  id: 'eagle_eye', name: 'Œil d\'aigle', category: 'visual', flavor: 'mixed',
  desc: 'La caméra recule pour tout voir et tes balles portent 25 % plus loin, mais les balles ennemies vont 12 % plus vite.',
  icon: icon('ic_eagle_eye', 'target', 'y', 'O', 'r'),
  modify: (m) => {
    m.zoom *= 0.72;
    m.bulletRange *= 1.25;
    m.enemyBulletSpeed *= 1.12;
  },
});

defineRule({
  id: 'quake', name: 'Séisme', category: 'visual', flavor: 'mixed',
  desc: 'L\'écran tremble trois fois plus fort, mais toutes les explosions sont 40 % plus larges.',
  icon: icon('ic_quake', 'cross', 'o', 'O', 'y'),
  modify: (m, _c, s) => {
    m.shake *= 3;
    m.explosionSize *= 1 + 0.4 * Math.min(2, pw(s, 2));
  },
});

defineRule({
  id: 'blood_moon', name: 'Lune de sang', category: 'visual', flavor: 'mixed',
  desc: 'Le monde vire au rouge et les ennemis vont 20 % plus vite, mais tu infliges 15 % de dégâts en plus et chaque victime a 5 % de chances de te soigner.',
  icon: icon('ic_blood_moon', 'moon', 'r', 'R'),
  modify: (m, _c, s) => {
    m.tint = 0xff9a9a;
    m.enemySpeed *= 1.2;
    m.damage *= 1 + 0.15 * pw(s, 3);
    m.lifeSteal += 0.05;
  },
});

defineRule({
  id: 'lilliput', name: 'Lilliput', category: 'visual', flavor: 'mixed',
  desc: 'Tu rétrécis à 60 % de ta taille et cours 15 % plus vite, mais tes coups font 10 % de dégâts en moins.',
  icon: icon('ic_lilliput', 'arrow', 's', 'S'),
  modify: (m) => {
    m.playerScale *= 0.6;
    m.speed *= 1.15;
    m.damage *= 0.9;
  },
});
