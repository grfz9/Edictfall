# Guide de contenu Edictfall (à lire avant d'ajouter quoi que ce soit)

Le jeu tourne déjà. Le moteur est **figé** : tu ajoutes du contenu sous forme de fichiers de données dans `src/content/**`.
Chaque fichier s'auto-enregistre (`import.meta.glob`), il n'y a **aucun index à modifier**.

## À lire d'abord (dans cet ordre)
1. `PLAN.md` — design + architecture + ordre d'application des règles.
2. `src/core/types.ts` — **tous** les contrats (`WeaponDef`, `BulletSpec`, `EnemyDef`, `HeroDef`, `ModifierDef`/`Hooks`, `Mods`, événements…).
3. `src/sim/ctx.ts` — l'API `ctx` passée à tous les scripts (spawnBullet, explode, damageEnemy, after, burst, sfx…).
4. `src/sim/patterns.ts` — patterns d'attaque ennemis disponibles (aimed, spread, burst, ring, rings, spiral, spray, wall, cross, homing, lob, rain, laser, summon, dash, melee, mines, blink).
5. `src/render/palette.ts` — palette de caractères pour les sprites.
6. Les exemples : `src/content/weapons/starter.ts`, `enemies/w1_core.ts`, `heroes/brann.ts`, `rules/core.ts`, `misc/core.ts`.
   Pour comprendre un comportement précis du moteur : `src/sim/combat.ts`, `enemies.ts`, `world.ts`, `src/core/mods.ts`.

## Règles impératives
- **Ne modifie pas** `src/core`, `src/sim`, `src/render`, `src/input`, `src/main.ts`, ni les fichiers d'un autre lot. D'autres agents
  travaillent en parallèle dans le même dossier : reste **strictement** dans les fichiers de ton lot.
- S'il te manque une capacité moteur : contourne avec les hooks/callbacks existants (`onFire`, `onHit`, `onTick`, `onUpdate`, `ctx.after`, `data`…)
  et **signale-le** dans ton rapport final, section « DEMANDES MOTEUR » (précis : fichier, champ, comportement voulu).
- Jamais de `Math.random()` ni de `Date.now()` dans le gameplay : utilise `ctx.rng` (ou `ctx.lootRng`). La run doit être rejouable par seed.
- Pas de dépendance npm, pas d'asset externe, pas d'accès DOM/`window` dans le contenu (la simulation tourne aussi en headless sous Vitest).
- Tout est **original** : noms, personnages, armes, textes. Aucune référence à un jeu existant. Textes joueur en **français**, ton malicieux et concis.
- IDs uniques en `snake_case`. Préfixes de sprites : armes `w_`, balles `b_`/`eb_`, ennemis `e_`, boss `boss_`, héros `hero_`, familiers `pet_`,
  icônes de règle `ic_`, icônes de passif `ip_`.
- Robustesse : un hook ne doit jamais lever d'exception ni boucler (attention aux cascades : une explosion qui tue qui explose… le moteur plafonne,
  mais reste raisonnable). Ne garde pas d'état dans des variables de module : utilise `self.state` (règles), `e.data`, `p.data`, `b.data`.

## Sprites (pixel art en ASCII)
```ts
defineSprite('e_truc', ['..gg..', '.g11g.', ...], { frames: [[...]], pal: { X: '#123456' }, outline: '#1b1326' | false, ox, oy });
```
- 1 caractère = 1 pixel ; `.` = transparent ; **toutes les lignes ont la même largeur** (sinon avertissement).
- Un contour sombre 1 px est ajouté automatiquement (désactivable avec `outline: false`). Une version « flash blanc » est générée seule.
- `frames` = frames d'animation supplémentaires (même taille). 2 frames suffisent (marche / battement). Le moteur ajoute rebond, écrasement, retournement.
- Tailles indicatives : ennemi normal 10–14 px, gros 16–20, boss 22–30 ; héros 12×14 ; arme 8–18 × 4–8 **pointant à droite**, `ox/oy` = poignée ;
  balle 3–8 px pointant à droite ; icône de règle/passif **10×10**.
- Style : coloré, lisible, silhouettes distinctes, 3–5 couleurs par sprite, reflets clairs en haut à gauche, yeux visibles. Les balles ennemies
  restent dans les rouges/roses (`e`, `E`, `m`, `r`) pour être lisibles ; teinte possible via `color` (multiplicatif).
- Vérifie tes sprites : mêmes largeurs de lignes, caractères présents dans la palette (un caractère inconnu = rose fluo).

## Échelles d'équilibrage (à respecter pour que les lots s'emboîtent)
- Joueur : ~6 PV, ~5 armure, ~180 énergie, vitesse ~92 px/s. Un orbe d'énergie rend 4.
- **Armes** (DPS soutenu = dégâts × projectiles / cooldown) : blanc 14–24 · vert 22–34 · bleu 30–48 · violet 44–68 · orange 62–100.
  Coût en énergie par seconde de tir : blanc 0–4 · vert 3–7 · bleu 5–10 · violet 8–15 · orange 12–22. La mêlée coûte 0–1 mais oblige à s'approcher.
- **Dégâts ennemis** : exprimés en PV joueur, **entiers 1–3** (`damage` des balles ennemies, `contact`). Monde 1 : 1. Monde 2 : 1 (2 pour les gros coups annoncés). Monde 3 : 1–2 (3 = coup très annoncé).
- **PV ennemis** : monde 1 : 8–40 (gros 60–90) · monde 2 : 16–60 (gros 90–140) · monde 3 : 26–90 (gros 140–220). `cost` : 1 normal, 2 costaud, 3 lourd, 4 mini-tank.
- Vitesse des balles ennemies : monde 1 : 70–120 · monde 2 : 85–140 · monde 3 : 95–165. Toujours esquivable : annonce (`telegraph`) ≥ 0.3 s, trous dans les murs de balles.
- Boss : PV ≈ 620 (monde 1) · 1000 (monde 2) · 1500 (monde 3), 3 phases, patterns variés mais lisibles.

## Vérifier ton travail
- `npx tsc --noEmit` doit passer **pour tes fichiers** (ignore les erreurs situées dans les fichiers d'autres lots en cours d'écriture).
- Écris un test Vitest dans `tests/<ton-lot>.test.ts` (voir `tests/helpers.ts` : `makeWorld`, `runBot`) et lance `npx vitest run tests/<ton-lot>.test.ts`.
  Le test doit au minimum instancier/exécuter tout ton contenu en simulation headless sans exception.
- **N'utilise pas le navigateur et ne lance pas de serveur** (un seul agent y a droit), ne fais pas de `npm install`, pas de `git`.

## Rapport final attendu (court)
Liste de ce que tu as créé (ids + une ligne), résultat de `tsc` et de tes tests, « DEMANDES MOTEUR » éventuelles, points d'équilibrage douteux.
