// Le lore d'Edictfall : cinématique d'introduction, scènes entre les mondes, fin narrative.
// Données pures (aucun DOM) : l'interface (src/ui/cinematic.ts) dessine les scènes nommées ici.
import type { DialogLine } from '../../core/types';

/*
 * LE MONDE
 * Au commencement était le Grand Registre : un livre dont chaque page est une loi du monde
 * (« le feu brûle », « l'eau mouille », « les gobelins détestent les lundis »). Ceux qui l'écrivaient
 * s'appelaient les Scribes de l'Aube. Le dernier d'entre eux, l'Archiviste Ascelin, eut peur : un monde
 * qu'on peut réécrire est un monde qui peut mal tourner. Alors il arracha les pages et scella chaque loi
 * dans le cœur d'une créature immense — les Seigneurs — pour que plus personne ne change jamais rien.
 * Le monde se figea : la Sylve murmure la même phrase depuis mille ans, le Glacier est fendu sur un instant
 * qui ne passe pas, la Forge brûle sans charbon.
 *
 * POURQUOI LES ÉDITS TOMBENT
 * Une loi ne meurt pas : quand un Seigneur (ou un Gardien) tombe, la page qu'il gardait se détache — un Édit
 * tombe — et quiconque la ramasse peut la réécrire. C'est l'« Edictfall ».
 *
 * LE HÉROS
 * Les Ratures : des gens que le Registre a oublié d'écrire. Aucune loi ne les retient, ils sont les seuls à
 * pouvoir porter des Édits sans être figés. Ils vivent au Hall des Ratures, un refuge hors des pages.
 * Le but : descendre à travers les trois mondes, réunir les Édits et atteindre la Reliure, au fond de la Forge
 * Abyssale, pour y écrire la dernière page : « Le monde a le droit de changer. »
 */

export interface CinePanel {
  /** Scène dessinée par l'interface (voir ui/cinematic.ts). */
  scene: 'book' | 'pages' | 'archivist' | 'frozen' | 'edictfall' | 'rature' | 'descent' | 'reliure' | 'dawn' | 'loop' | 'world2' | 'world3';
  /** Texte tapé façon machine à écrire. */
  text: string;
  /** Petit titre au-dessus (facultatif). */
  kicker?: string;
}

export const INTRO: CinePanel[] = [
  { scene: 'book', kicker: 'Il y a très longtemps', text: 'Au commencement était le Grand Registre. Chaque page, une loi du monde.' },
  { scene: 'pages', text: '« Le feu brûle. » « L\'eau mouille. » « Les gobelins détestent les lundis. » Les Scribes de l\'Aube écrivaient, et le monde obéissait.' },
  { scene: 'archivist', text: 'Puis l\'Archiviste Ascelin eut peur du changement. Il arracha les pages et les scella dans le cœur de bêtes immenses : les Seigneurs.' },
  { scene: 'frozen', text: 'Le monde se figea. La Sylve murmure la même phrase depuis mille ans. Le Glacier est fendu sur un instant qui ne passe pas. La Forge brûle sans charbon.' },
  { scene: 'edictfall', kicker: 'Edictfall', text: 'Mais une loi ne meurt jamais. Quand un Seigneur tombe, sa page tombe avec lui : un Édit. Et celui qui le ramasse peut réécrire le monde.' },
  { scene: 'rature', text: 'Toi, tu es une Rature : quelqu\'un que le Registre a oublié d\'écrire. Aucune loi ne te retient. Tu es la seule main capable de tenir un Édit.' },
  { scene: 'descent', kicker: 'Ta mission', text: 'Descends. Ramasse les Édits. Atteins la Reliure au fond de la Forge Abyssale… et écris la dernière page.' },
];

export const ENDING: CinePanel[] = [
  { scene: 'reliure', kicker: 'La Reliure', text: 'Au fond de la Forge, la Reliure du Grand Registre t\'attendait, vide. Toutes ses pages tenaient dans ta poche.' },
  { scene: 'dawn', text: 'Tu as pris la plume. Tu as écrit, en tout petit : « Le monde a le droit de changer. » Quelque part, la Sylve a enfin fini sa phrase.' },
  { scene: 'loop', kicker: 'Épilogue', text: 'Ton nom, lui, n\'est toujours écrit nulle part. Alors, puisqu\'aucune règle ne t\'en empêche… tu peux recommencer.' },
];

const VOICE = { who: 'Voix du Registre', portrait: 'npc_book', color: '#ffd23a' };
const CONTEUSE = { who: 'Mirelle la Conteuse', portrait: 'npc_teller', color: '#ff9ad0' };
const WASSIM = { who: 'Wassim Hadmi', portrait: 'npc_wassim', color: '#ffb040' };
const ME = { who: 'Toi', portrait: '', color: '#9ad8ff' };

/** Scènes jouées entre deux mondes (mode Histoire). Clé = monde qu'on vient de terminer. */
export const INTERLUDES: Record<number, DialogLine[]> = {
  1: [
    { ...VOICE, text: 'La Sylve a fini sa phrase. Elle disait : « …et c\'est pour ça qu\'on ne prête jamais son parapluie. » Personne n\'a compris.' },
    { ...ME, text: 'Ça valait mille ans d\'attente ?' },
    { ...VOICE, text: 'Non. Mais maintenant elle peut en commencer une autre. Le Glacier t\'attend, Rature. Il a froid depuis un instant… très long.' },
    { ...WASSIM, text: 'PSST. Le Glacier ? J\'y vends des glaces. Enfin, de la glace. Enfin, je la montre du doigt et je demande de l\'argent.' },
  ],
  2: [
    { ...VOICE, text: 'L\'instant du Glacier est enfin passé. Il s\'est fendu jusqu\'au bout et, franchement, il a l\'air soulagé.' },
    { ...CONTEUSE, text: 'Tu entends ? En bas, la Forge cogne. C\'est là qu\'Ascelin a caché la Reliure. Ce qui t\'attend y est plus vieux que la peur.' },
    { ...ME, text: 'Et plus dur, j\'imagine.' },
    { ...CONTEUSE, text: 'Bien plus dur. Chaque Édit que tu portes y pèse le double. Ne meurs pas, ça gâcherait l\'histoire.' },
  ],
};

/** Répliques du narrateur pour le mode Infini (tous les 5 étages). */
export const ENDLESS_QUIPS = [
  'Le Registre a des pages en trop. Tu continues ?',
  'Plus bas, les lois sont écrites en tout petit. Et en colère.',
  'Ascelin n\'avait pas prévu quelqu\'un d\'aussi têtu.',
  'Ici, même les murs ont des édits contre toi.',
  'Tu es descendu si bas que le haut a oublié ton nom.',
];
