// Salle du développeur : une salle « pas finie », un PNJ qui sait qu'il est dans un jeu, un terminal bavard.
import { defineSprite } from '../../core/registry';
import { defineSpecialRoom } from './_kit';

defineSprite('npc_dev', [
  '....4444....', '...444444...', '..44ssss44..', '..4s0ss0s4..', '..4ssssss4..', '...4sNNs4...', '..54444445..', '.5444cc4445.',
  '.54aaaaaa45.', '.54acccca45.', '.5aaaaaaaa5.', '..55555555..', '..55....55..', '..00....00..',
]);
defineSprite('room_terminal', [
  '.444444444444.', '.455555555554.', '.45gg5g5ggg54.', '.455g5gg5g554.', '.45ggg55g5g54.', '.455555555554.', '.444444444444.',
  '.....4444.....', '...33333333...', '..3232323232..', '..3333333333..',
]);
defineSprite('room_mug', ['.1.1..', '..1...', '22222.', '2nnn22', '2nnn2.', '22222.']);

const DEV = { who: 'Le Développeur', portrait: 'npc_dev', color: '#9ae8ff' };

defineSpecialRoom({
  id: 'dev_room', name: 'Salle du développeur', weight: 0.8,
  build(k) {
    const { cx, cy } = k;
    k.deco('room_terminal', cx - 40, cy - 46);
    k.deco('room_terminal', cx + 40, cy - 46);
    k.deco('room_mug', cx + 62, cy - 40);
    k.npc(cx - 40, cy - 30, {
      sprite: 'room_terminal', label: 'Terminal', sub: 'Lire l\'écran', radius: 16, kind: 'altar',
      use: () => k.dialog({ lines: [
        { who: 'Terminal', portrait: 'room_terminal', color: '#58d858', text: '> git log --oneline\n a1b2c3 « Wassim est équilibré » (non)\n d4e5f6 « fix : la grenouille porte enfin sa cravate »' },
        { who: 'Terminal', portrait: 'room_terminal', color: '#58d858', text: '// TODO : si tu lis ceci, toi aussi tu es une Rature. Personne ne t\'a écrit. Fais ce que tu veux.' },
      ] }),
    });
    k.npc(cx + 10, cy - 8, {
      sprite: 'npc_dev', label: 'Le Développeur', sub: 'Il a l\'air surpris', radius: 20,
      greet: 'Hein ?! Tu n\'es pas censé être là !',
      lines: ['Cette salle n\'est pas finie.', 'Ne regarde pas les murs, c\'est du placeholder.', 'Ça marchait sur ma machine.', 'Il est 3 h du matin, non ?'],
      use: (ctx, p) => k.dialog({
        lines: [
          { ...DEV, text: 'Oh non. Un joueur. Dans la salle de debug. Bon… ne dis rien au chef de projet. C\'est moi, le chef de projet.' },
          { ...DEV, text: 'Tu sais que tu es dans un jeu, hein ? Les Édits, c\'est juste des fonctions. Toi aussi. Désolé.' },
        ],
        options: [
          { label: 'Un petit bonus de debug ?', act: () => {
            if (!k.once('bonus')) { k.dialog({ lines: [{ ...DEV, text: 'Un seul par run. Sinon c\'est de la triche. Enfin, encore plus.' }] }); return; }
            ctx.heal(p, 99); ctx.addGems(3); ctx.addEnergy(p, 999);
            k.dialog({ lines: [{ ...DEV, text: 'Voilà : PV pleins, énergie pleine, 3 gemmes. J\'ai mis « TODO : retirer » en commentaire, donc c\'est légal.' }] });
          } },
          { label: 'Signaler un bug', act: () => k.dialog({ lines: [{ ...DEV, text: 'Merci ! Je l\'ajoute dans un ticket. Le ticket rejoindra les 400 autres. Ils sont heureux ensemble.' }] }) },
          { label: 'Partir sur la pointe des pieds', cancel: true },
        ],
      }),
    });
    k.npc(cx + 62, cy + 30, {
      sprite: 'room_mug', label: 'Café froid', sub: 'Rend 1 PV (il est froid, mais il est là)', radius: 14,
      use: (ctx, p, self) => { ctx.heal(p, 1); self.dead = true; k.say(self, 'Glou.', 1.5); },
    });
  },
  enter(k) {
    k.ctx.text(k.cx, k.cy - 70, 'ZONE NON TERMINÉE', 0x9ae8ff, true);
  },
});
