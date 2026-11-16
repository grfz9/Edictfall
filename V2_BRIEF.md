# Edictfall v2 — brief commun aux agents

Le jeu tourne (TypeScript + Vite + PixiJS, déployé sur GitHub Pages). Lis d'abord `CONTENT_GUIDE.md` (règles, formats, sprites ASCII)
et `PLAN.md`. Demande du joueur pour la v2 : un jeu plus **vivant, stylé et difficile**, avec une vraie direction artistique.

## Règles communes
- Reste STRICTEMENT dans les fichiers de ton lot (tableau ci-dessous). D'autres agents travaillent en même temps dans le même dossier.
  Si tu as besoin d'un changement hors de ton lot, contourne et note-le dans « DEMANDES » de ton rapport.
- Tout est original. On peut **s'inspirer** d'un trope (ex. « gant d'un héros chauve qui tue en un coup », « grenouille en costume »)
  mais jamais reprendre un nom, un personnage, un logo ou un design existant. Textes en français, drôles et courts.
- Pixel art ASCII (voir guide). Plus de détails qu'en v1 : ombrage 2-3 tons, reflets, contours, silhouettes lisibles, 2 à 4 frames.
- Pas de Math.random dans la simulation (`ctx.rng`), pas de DOM dans `src/content`, pas de npm install, pas de git, pas de serveur.
  Seul l'agent « Modes & UI » utilise le navigateur (serveur déjà lancé par la session principale sur http://localhost:5173, sinon
  outil preview_start nom « edictfall »).
- Avant de finir : `npx tsc --noEmit` sans erreur dans tes fichiers, et `npx vitest run` doit rester vert (les tests existants
  peuvent être adaptés s'ils sont dans ton lot). Rapport final COURT (≤ 25 lignes) : ce que tu as fait, résultats, DEMANDES.

## Lots
| Lot | Fichiers autorisés |
|---|---|
| Boss | `src/content/enemies/w1_core.ts`, `w2_boss.ts`, `w3_boss.ts`, nouveaux `src/content/enemies/boss_*.ts`, tests `tests/world1|2|3.test.ts` (parties boss) |
| Armes | `src/content/weapons/**`, `tests/weapons.test.ts` |
| Persos | `src/content/heroes/**`, `src/content/misc/pets.ts`, `tests/heroes.test.ts` |
| Ennemis | `src/content/enemies/w1_forest.ts`, `w1_deep.ts`, `w1_patterns.ts`, `w2_bestiaire.ts`, `w3_forge.ts`, `w3_patterns.ts`, nouveaux `src/content/enemies/elite_*.ts` |
| DA & animations | `src/render/**`, `src/content/misc/core.ts` (thèmes, décor, sprites système) |
| Modes & UI | `src/sim/world.ts`, `src/sim/dungeon.ts`, `src/sim/ctx.ts`, `src/main.ts`, `src/ui/**`, `src/core/types.ts` (ajouts seulement), `src/core/save.ts`, nouveaux `src/content/story/**`, `src/content/misc/npcs.ts`, `src/content/rooms/**`, nouveaux tests `tests/modes.test.ts` |

Support moteur déjà ajouté : `BossPhase.sprite / scale / tint / aura` (apparence par phase, le renderer bascule tout seul).
