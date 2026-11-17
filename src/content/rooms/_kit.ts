// Salles spéciales (rares, easter eggs) : registre + API. Le moteur (sim/world.ts) en place au plus une par étage.
// Ajouter une salle = un fichier dans ce dossier qui appelle defineSpecialRoom(). Aucun DOM ici.
import type { Ctx } from '../../sim/ctx';
import type { Room, Interactable, Mods, Dialog, Enemy, Player } from '../../core/types';

export interface NpcOpts {
  sprite: string;
  label: string;
  sub?: string;
  /** Rayon d'interaction (0 = décor non interactif). */
  radius?: number;
  use?: (ctx: Ctx, p: Player, self: Interactable) => void | boolean;
  /** Répliques lancées en bulle de temps en temps. */
  lines?: string[];
  /** Réplique dite quand le joueur approche. */
  greet?: string;
  bob?: boolean;
  tint?: number;
  kind?: Interactable['kind'];
}

/** Boîte à outils passée aux salles spéciales. Coordonnées en pixels. */
export interface RoomKit {
  ctx: Ctx;
  room: Room;
  /** Centre de la salle (px). */
  cx: number;
  cy: number;
  /** État libre propre à cette salle (persiste pendant l'étage). */
  data: Record<string, any>;
  /** Pose un PNJ / objet interactif. */
  npc(x: number, y: number, o: NpcOpts): Interactable;
  /** Pose un élément de décor (non interactif). */
  deco(sprite: string, x: number, y: number, tint?: number): Interactable;
  /** Bulle de dialogue au-dessus d'un objet / d'un point. */
  say(target: Interactable | Enemy | { x: number; y: number }, text: string, dur?: number): void;
  /** Ouvre la boîte de dialogue (avec portrait et choix). */
  dialog(d: Dialog): void;
  /** Verrouille la salle et lance un combat ; la salle se déverrouille quand tout est mort. */
  fight(spawn: () => Enemy | null | void): void;
  /** Remplace une tuile (tx, ty en tuiles ; t = valeur de T). */
  setTile(tx: number, ty: number, t: number): void;
  /** Vrai la première fois seulement pour cette clé (dans cette salle). */
  once(key: string): boolean;
  /** Le joueur principal. */
  player: Player;
}

export interface SpecialRoomDef {
  id: string;
  name: string;
  /** Poids de tirage (défaut 1). */
  weight?: number;
  /** Profondeur minimale (0 = 1-1). */
  minDepth?: number;
  /** Construit la salle à la génération de l'étage. */
  build(k: RoomKit): void;
  /** Première entrée dans la salle. */
  enter?(k: RoomKit): void;
  /** Chaque pas de simulation pendant que le joueur est dans la salle. */
  tick?(k: RoomKit, dt: number): void;
  /** Modifie les Mods pendant que le joueur est dans la salle. */
  modify?(m: Mods, k: RoomKit): void;
}

export const SPECIAL_ROOMS = new Map<string, SpecialRoomDef>();
export function defineSpecialRoom(d: SpecialRoomDef): SpecialRoomDef {
  SPECIAL_ROOMS.set(d.id, d);
  return d;
}
