// Outils de sprites pour les héros (aucun enregistrement de contenu ici).
//
// Convention v2 (14×16, ligne 0 vide pour laisser respirer) :
//   hero_<id>       : frame 0 = pose neutre (affichée à l'arrêt), frames 1..3 = cycle de marche.
//   hero_<id>_idle  : 4 frames de repos (neutre, inspire, neutre, clignement) pour un renderer qui sait les lire.
import { defineSprite } from '../../core/registry';

/** Remplacements de lignes : index de ligne → nouvelle ligne. */
export type RowEdits = Record<number, string>;

export interface HeroArt {
  /** Pose neutre. La ligne 0 doit être vide (on y étire le buste à l'inspiration). */
  base: string[];
  /** 3 frames de marche, décrites comme des remplacements de lignes par rapport à `base`. */
  walk: [RowEdits, RowEdits, RowEdits];
  /** Pour chaque frame de marche : true = le buste monte d'1 px (rebond au passage du pied). */
  bob?: [boolean, boolean, boolean];
  /** Dernière ligne du buste (incluse) : tout ce qui est au-dessus monte à l'inspiration / au rebond. */
  waist: number;
  /** Remplacements pour le clignement d'yeux (frame d'attente). */
  blink?: RowEdits;
  pal?: Record<string, string>;
  outline?: string | false;
}

export const edit = (rows: string[], e: RowEdits): string[] => rows.map((r, i) => e[i] ?? r);

/** Fait monter d'1 px tout ce qui est au-dessus de `waist` (la ligne `waist` est dupliquée : le buste s'étire). */
export function lift(rows: string[], waist: number): string[] {
  return rows.map((r, i) => (i < waist ? rows[i + 1] : r));
}

/**
 * Cycle de marche standard pour deux jambes (lignes 13-15) : `L` = jambe, `F` = pied.
 * `x` = colonne de la jambe gauche à l'arrêt (la droite est 4 colonnes plus loin).
 */
export function legs(L: string, F: string, x = 4, extra: [RowEdits, RowEdits, RowEdits] = [{}, {}, {}]): [RowEdits, RowEdits, RowEdits] {
  const row = (parts: [number, string][]) => {
    const r = '.'.repeat(14).split('');
    for (const [c, s] of parts) for (let i = 0; i < s.length; i++) if (s[i] !== '.') r[c + i] = s[i];
    return r.join('');
  };
  const LL = L + L, FF = F + F;
  return [
    { 13: row([[x - 1, LL], [x + 5, LL]]), 14: row([[x - 2, LL], [x + 6, LL]]), 15: row([[x - 2, FF], [x + 6, FF + F]]), ...extra[0] },
    { 13: row([[x + 1, LL + LL]]), 14: row([[x + 1, LL], [x + 4, L]]), 15: row([[x + 1, FF + F], [x + 4, FF]]), ...extra[1] },
    { 13: row([[x - 1, LL], [x + 5, LL]]), 14: row([[x - 1, LL], [x + 4, LL]]), 15: row([[x - 2, FF + F], [x + 5, FF]]), ...extra[2] },
  ];
}

/** Enregistre `hero_<id>` (neutre + 3 frames de marche) et `hero_<id>_idle` (respiration + clignement). */
export function heroArt(id: string, a: HeroArt): string {
  const walk = a.walk.map((e, i) => {
    const f = edit(a.base, e);
    return a.bob?.[i] ? lift(f, a.waist) : f;
  });
  const opts = { pal: a.pal, outline: a.outline };
  const inhale = lift(a.base, a.waist - 2);
  const blink = edit(a.base, a.blink ?? {});
  defineSprite(`hero_${id}_idle`, a.base, { ...opts, frames: [inhale, a.base, blink] });
  return defineSprite(`hero_${id}`, a.base, { ...opts, frames: walk });
}
