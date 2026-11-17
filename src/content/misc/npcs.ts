// PNJ et décor du Hall des Ratures + Wassim Hadmi, le marchand le moins fiable des trois mondes.
// Sprites ASCII (palette : src/render/palette.ts) et répliques. Aucun DOM ici.
import { defineSprite } from '../../core/registry';
import type { DialogLine } from '../../core/types';

// ------------------------------------------------------------------ Wassim Hadmi
// Haut-de-forme violet à plume, lunettes noires, moustache, manteau orange plein de poches.
export const WASSIM_SPRITE = defineSprite('npc_wassim', [
  '......pppp..y.',
  '.....pPPPPp.y.',
  '.....pPPPPpyy.',
  '.....pPPPPpy..',
  '....yyyyyyyy..',
  '...pppppppppp.',
  '.....ssssss...',
  '....s00ss00s..',
  '....s01ss01s..',
  '....ssssssss..',
  '....sNNNNNNs..',
  '.....sNmmNs...',
  '...ooOOyyOOoo.',
  '..oooooyyooooo',
  '..oSooooooooSo',
  '..oSoyooooyoSo',
  '...oooooooooo.',
  '...OOOOOOOOOO.',
  '....dd....dd..',
  '...ddd....ddd.',
]);

// ------------------------------------------------------------------ PNJ du hall (gabarit capuche, couleurs propres)
export const HOOD = [
  '....HHHH....', '...HHHHHH...', '..HHssssHH..', '..Hs0ss0sH..', '..HssssssH..', '...HssssH...', '..hHHHHHHh..', '.hHHHHHHHHh.',
  '.hHHHyyHHHh.', '.hHHHHHHHHh.', '.hHHHHHHHHh.', '..hHHHHHHh..', '..hh....hh..', '..00....00..',
];
export const BEARD = [
  '....HHHH....', '...HHHHHH...', '..HHssssHH..', '..Hs0ss0sH..', '..HswwwwsH..', '...wwwwww...', '..hHwwwwHh..', '.hHHHwwHHHh.',
  '.hHHHHHHHHh.', '.hHHHHHHHHh.', '.hHHHHHHHHh.', '..hHHHHHHh..', '..hh....hh..', '..00....00..',
];
defineSprite('npc_teller', HOOD, { pal: { H: '#ff70b8', h: '#b83878', y: '#ffd23a' } });
defineSprite('npc_old', BEARD, { pal: { H: '#8a93a8', h: '#555c70' } });
defineSprite('npc_herald', HOOD, { pal: { H: '#ffd23a', h: '#c8901c', y: '#e0404a' } });
defineSprite('npc_kid', [
  '...HHHH...', '..HHHHHH..', '..HssssH..', '..H0ss0H..', '..HssmsH..', '...hhhh...', '..hHHHHh..', '.shHHHHhs.', '..hHHHHh..',
  '...h..h...', '...0..0...',
], { pal: { H: '#30c0b0', h: '#1a7880' } });

/** Portrait de la « Voix du Registre » : un livre ouvert. */
defineSprite('npc_book', [
  '..wwwww..wwwww..',
  '.w22222ww22222w.',
  '.w23332ww23332w.',
  '.w22222ww22222w.',
  '.w23332ww23332w.',
  '.w22222ww22222w.',
  'NNNNNNNyyNNNNNNN',
  '.dNNNNNNNNNNNNd.',
]);

// ------------------------------------------------------------------ décor du hall
defineSprite('deco_torch', ['..y..', '.yoy.', '.ovo.', '..o..', 'NNNNN', '.NnN.', '..N..', '..N..', '..N..', '..N..']);
defineSprite('deco_shelf', [
  'NNNNNNNNNNNNNNNN',
  'NddddddddddddddN',
  'NdrrbbgyyRpBgrdN',
  'NdrrbbgyyRpBgrdN',
  'NdrrbbgyyRpBgrdN',
  'NNNNNNNNNNNNNNNN',
  'NddddddddddddddN',
  'NdBBpggdrryytbdN',
  'NdBBpggdrryytbdN',
  'NdBBpggdrryytbdN',
  'NNNNNNNNNNNNNNNN',
  'NddddddddddddddN',
  'Nd2222dgGgddyydN',
  'NddddddddddddddN',
  'NNNNNNNNNNNNNNNN',
  '.dd..........dd.',
]);
defineSprite('deco_banner', [
  'yyyyyyyyyy', '.pppppppp.', '.pPPPPPPp.', '.pPyyyyPp.', '.pPywwyPp.', '.pPywwyPp.', '.pPyyyyPp.', '.pPPPPPPp.',
  '.pppppppp.', '.pppppppp.', '.ppp..ppp.', '.pp....pp.', '.p......p.',
]);
defineSprite('deco_plant', [
  '...g..g...', '..ggg.gg..', '.gglgggg..', 'ggggglggg.', '.gGggggGg.', '..GgGGgG..', '...NNNN...', '..NnnnnN..', '..NnnnnN..',
  '..NNNNNN..', '...dddd...',
]);
defineSprite('deco_board', [
  'NNNNNNNNNNNNNNNNNN',
  'NnnnnnnnnnnnnnnnnN',
  'Nn2222n2222n2222nN',
  'Nn2r22n2b22n2y22nN',
  'Nn2222n2222n2222nN',
  'Nn2332n2332n2332nN',
  'Nn2222n2222n2222nN',
  'NnnnnnnnnnnnnnnnnN',
  'NNNNNNNNNNNNNNNNNN',
  '.....NN....NN.....',
  '.....NN....NN.....',
  '.....NN....NN.....',
  '....dddd..dddd....',
]);
defineSprite('deco_trophy', [
  '.yyyyyyyyyy.', 'yyy1yyyyyYyy', 'y.yy1yyyyY.y', 'y.yy1yyyyY.y', '.yyyyyyyyyY.', '..yyyyyyYY..', '....yyYY....', '.....yY.....',
  '.....yY.....', '...yyyyYY...', '..NNNNNNNN..', '..NnnyynnN..', '..NNNNNNNN..',
]);
defineSprite('deco_sign', ['NNNNNNNNNN', 'NnnnnnnnnN', 'Nn33n333nN', 'NnnnnnnnnN', 'Nn333n33nN', 'NNNNNNNNNN', '....NN....', '....NN....', '...dddd...']);
defineSprite('deco_fountain', [
  '...........cc...........',
  '..........c11c..........',
  '.........c.cc.c.........',
  '........c..22..c........',
  '.......c..2332..c.......',
  '..........2332..........',
  '..........2332..........',
  '...' + '2'.repeat(18) + '...',
  '..23' + 'c'.repeat(16) + '32..',
  '.23' + 'ccbccccccccccccbcc' + '32.',
  '.23' + 'cccccbccccccbccccc' + '32.',
  '..23' + 'c'.repeat(16) + '32..',
  '...' + '2'.repeat(18) + '...',
  '...' + '3'.repeat(18) + '...',
  '....' + '4'.repeat(16) + '....',
]);
defineSprite('deco_crystal', ['..c..', '.cic.', 'cciCc', 'ciiCC', '.cCC.', '..C..', '.444.', '44444']);

// ------------------------------------------------------------------ PNJ du hall : répliques
const SMITH = { who: 'Forgeronne Brasque', portrait: 'npc_smith', color: '#f08030' };
const KEEPER = { who: 'Ludo du Chenil', portrait: 'npc_keeper', color: '#48a8ff' };
const SCRIBE = { who: 'Scribe Plumeau', portrait: 'npc_scribe', color: '#c070ff' };
const TELLER = { who: 'Mirelle la Conteuse', portrait: 'npc_teller', color: '#ff9ad0' };
const OLD = { who: 'Vieux Tobrac', portrait: 'npc_old', color: '#c8d0e0' };
const KID = { who: 'Brindille', portrait: 'npc_kid', color: '#30c0b0' };
const HERALD = { who: 'Héraut des Défis', portrait: 'npc_herald', color: '#ffd23a' };

export interface HubNpc {
  id: string;
  sprite: string;
  label: string;
  sub: string;
  /** Répliques ambiantes (bulles). */
  lines: string[];
  /** Réplique quand on s'approche. */
  greet: string;
  /** Conversation (boîte de dialogue) ; si absent, ouvre directement `panel`. */
  talk?: DialogLine[];
  /** Panneau d'interface ouvert à l'interaction ('arsenal', 'pets', 'codex', 'modes', 'records', 'intro'). */
  panel?: string;
  /** Libellé du bouton qui ouvre le panneau depuis la conversation. */
  panelLabel?: string;
  /** Position relative au centre du hall (px) ; wander = fait les cent pas horizontalement sur ± n px. */
  dx: number;
  dy: number;
  wander?: number;
}

export const HUB_NPCS: HubNpc[] = [
  {
    id: 'smith', sprite: 'npc_smith', label: 'Arsenal', sub: 'Forgeronne Brasque · débloquer des armes', panel: 'arsenal', dx: -232, dy: -40,
    greet: 'Une arme neuve ? J\'ai des plans. Et des brûlures.',
    lines: ['Celle-ci tire des clous. Celle-là tire la tronche.', 'Je forge, tu casses, c\'est l\'économie.', 'Une gemme = une idée dangereuse.'],
  },
  {
    id: 'keeper', sprite: 'npc_keeper', label: 'Chenil', sub: 'Ludo · choisir un familier', panel: 'pets', dx: 232, dy: 88,
    greet: 'Ils mordent, mais seulement les méchants. Promis.',
    lines: ['Qui c\'est le bon monstre ? C\'est toi !', 'Le chat refuse d\'être un familier. Il est « consultant ».', 'Ne nourrissez pas le familier après minuit.'],
  },
  {
    id: 'scribe', sprite: 'npc_scribe', label: 'Codex', sub: 'Scribe Plumeau · édits découverts', panel: 'codex', dx: -232, dy: 88,
    greet: 'Chaque Édit ramassé, je le recopie. En plus petit.',
    lines: ['J\'ai une crampe depuis l\'an 312.', 'Certains édits s\'aiment. Ça s\'appelle une synergie.', 'Le Registre avait une faute d\'orthographe page 4.'],
  },
  {
    id: 'herald', sprite: 'npc_herald', label: 'Tableau des défis', sub: 'Choisir le mode de jeu', panel: 'modes', dx: -70, dy: 150,
    greet: 'Histoire, Infini ou Défi du jour ? Choisis ton supplice !',
    lines: ['Le Défi du jour change à minuit. Comme moi.', 'En Infini, personne ne t\'entend crier. Sauf moi.', 'Les records, c\'est fait pour être battus. Ou encadrés.'],
  },
  {
    id: 'teller', sprite: 'npc_teller', label: 'Mirelle la Conteuse', sub: 'Écouter l\'histoire', panel: 'intro', panelLabel: 'Revoir l\'histoire', dx: 150, dy: 150,
    greet: 'Approche, Rature. Je connais une histoire où tu gagnes.',
    lines: ['Il était une fois… non, attends, c\'est toi l\'histoire.', 'Ascelin avait peur de tout. Même des virgules.', 'Les Ratures n\'ont pas de nom. Choisis-en un beau.'],
    talk: [
      { ...TELLER, text: 'Tu veux savoir pourquoi les Édits tombent ? Parce qu\'une loi ne meurt jamais : elle change seulement de main.' },
      { ...TELLER, text: 'Ascelin a scellé les pages du Grand Registre dans les Seigneurs. Abats-les, et les règles sont à toi.' },
    ],
  },
  {
    id: 'old', sprite: 'npc_old', label: 'Vieux Tobrac', sub: 'Ancien aventurier', dx: 70, dy: 150,
    greet: 'De mon temps, les boss avaient une seule phase !',
    lines: ['J\'ai perdu une run en 1-1. Contre une caisse.', 'Le secret ? Ne pas se faire toucher.', 'Un mur sonne creux ? Tire dessus.', 'Les gardiens tombent aussi. Leurs édits, pareil.'],
    talk: [
      { ...OLD, text: 'Écoute un vieux : les murs fissurés cachent des salles secrètes. Tire dessus, ils adorent ça.' },
      { ...OLD, text: 'Et si tu croises un marchand avec un chapeau ridicule, ne signe RIEN. …Bon, signe un truc. C\'est drôle.' },
    ],
  },
  {
    id: 'kid', sprite: 'npc_kid', label: 'Brindille', sub: 'Elle court partout', dx: 0, dy: 118, wander: 90,
    greet: 'T\'as déjà vu une grenouille en cravate ? Moi oui !',
    lines: ['Chat perché !', 'Plus tard je serai un Édit.', 'Le mannequin m\'a regardée.', 'Wassim m\'a vendu un caillou. Il est très beau.'],
    talk: [
      { ...KID, text: 'Psst ! Il paraît qu\'il existe des salles bizarres en bas : une avec des statues qui bougent, une où on tombe vers le haut…' },
      { ...KID, text: '…et une avec un ordinateur ! C\'est quoi un ordinateur ?' },
    ],
  },
];

export const TRAINING = {
  sign: 'Entraînement : frappe les mannequins, ils ne se plaignent jamais.',
  lines: ['Aïe. Enfin, je crois.', 'Encore !', 'C\'est tout ?', 'Je suis rembourré de courage.'],
};
export const WASSIM_HUB_SIGN = 'Wassim Hadmi est en tournée. Il apparaît au début de chaque run.';

export { SMITH, KEEPER, SCRIBE, TELLER, OLD, KID, HERALD };
