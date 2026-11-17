// Le Salon de Monsieur Coâ : un clin d'œil à la grenouille en cravate (héros du lot Persos).
import { defineSprite } from '../../core/registry';
import { defineSpecialRoom } from './_kit';
import { frogHeroId } from '../story/wassim';

defineSprite('npc_frog', [
  '..ggg..ggg..', '.gw0gggg0wg.', '.gggggggggg.', 'gggggggggggg', 'ggGGGGGGGGgg', '.gggg11gggg.', '..gggrrggg..', '.G444rr444G.',
  '.G444rr444G.', '.G4444r444G.', '..44444444..', '..gg....gg..', '.ggg....ggg.',
]);
const IN = [
  '555555555555', '55gg5555gg55', '5gw0g55g0wg5', '5gggggggggg5', '5ggGGGGGGgg5', '55gggggggg55', '555g1rr1g555', '55444rr44455',
  '54444rr44445', '54444r444445', '555555555555',
];
defineSprite('room_frog_portrait', ['Y'.repeat(16), 'Y' + 'y'.repeat(14) + 'Y', ...IN.map((r) => 'Yy' + r + 'yY'), 'Y' + 'y'.repeat(14) + 'Y', 'Y'.repeat(16)]);

const COA = { who: 'Monsieur Coâ, PDG', portrait: 'npc_frog', color: '#58d858' };

defineSpecialRoom({
  id: 'frog_lounge', name: 'Salon de Monsieur Coâ', weight: 0.9,
  build(k) {
    const { cx, cy, ctx } = k;
    k.deco('room_frog_portrait', cx, cy - 60);
    k.deco('deco_plant', cx - 60, cy - 50); k.deco('deco_plant', cx + 60, cy - 50);
    k.npc(cx, cy - 18, {
      sprite: 'npc_frog', label: 'Monsieur Coâ', sub: 'PDG d\'une mare', radius: 20,
      greet: 'Coâ. Pardon. Bonjour.',
      lines: ['La cravate fait le batracien.', 'Réunion à 15 h sur le nénuphar.', 'J\'ai un cousin qui fait l\'aventurier.'],
      use: (_c, p) => {
        const frog = frogHeroId();
        if (frog && p.hero.id === frog) {
          k.dialog({
            lines: [{ ...COA, text: 'COUSIN ?! Toi aussi tu portes la cravate en donjon ! La famille est fière. Tiens, l\'argent de poche.' }],
            onClose: () => { if (k.once('cousin')) ctx.addCoins(40); },
          });
          return;
        }
        k.dialog({
          lines: [
            { ...COA, text: 'Bienvenue dans mon salon. Ici, on respecte trois règles : la cravate, la ponctualité, et ne jamais dire « crapaud ».' },
            { ...COA, text: 'Vous avez l\'air sérieux. Prenez donc une de mes cravates : les marchands vous feront des prix.' },
          ],
          options: [
            { label: 'Accepter la cravate', act: () => {
              if (!k.once('tie')) { k.dialog({ lines: [{ ...COA, text: 'Une seule cravate par client. On n\'est pas des bêtes. Enfin si, mais avec classe.' }] }); return; }
              ctx.addPact({ id: 'frog_tie', name: 'Cravate de Monsieur Coâ', desc: 'Prix des marchands −20 %.', modify: (m) => { m.shopPrice *= 0.8; } });
            } },
            { label: 'Dire « crapaud »', act: () => {
              ctx.damagePlayer(p, 1, 'rule');
              k.dialog({ lines: [{ ...COA, text: 'COÂ ?! Dehors ! …Non, restez, mais vous l\'avez mérité.' }] });
            } },
            { label: 'Partir poliment', cancel: true },
          ],
        });
      },
    });
  },
});
