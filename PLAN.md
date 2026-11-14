# EDICTFALL — Game Design Doc & Architecture

> Roguelike shooter en pixel art, vue de dessus. **Chaque boss vaincu fait tomber un Édit : une règle permanente
> qui réécrit le jeu pour le reste de la run.** Les édits s'empilent, se combinent, et certains duos cachent des synergies.

## 1. Game design

### Boucle d'une run
1. **Le Hall** : petit hub jouable. On marche vers un héros pour le choisir (ou le débloquer avec des gemmes),
   on consulte l'Arsenal (déblocage d'armes/familiers), puis on entre dans le portail.
2. **3 mondes × 5 étages** (1-1 … 3-5). Chaque étage = un donjon de salles reliées par des couloirs.
   - Étage 3 de chaque monde : un **Gardien** (mini-boss, version championne d'un ennemi) → 1 Édit.
   - Étage 5 : un **Seigneur** (boss multi-phases) → 1 Édit.
   - Un **Édit fondateur** est aussi choisi au tout début de la run. Une run complète = jusqu'à 7 édits.
   - Après le 3ᵉ Seigneur : victoire, puis possibilité de continuer en **boucle** (ennemis renforcés, toujours plus d'édits).
3. **Fin de run** : récapitulatif (édits accumulés, synergies découvertes, stats), gain de **gemmes** → déblocages permanents.

### Combat (inspiration : twin-stick roguelikes à salles)
- **Vie** (petits nombres, ~6), **Armure** (bouclier, se recharge seule après ~3,5 s sans dégât), **Énergie** (munitions universelles, orbes bleus).
- Visée auto vers l'ennemi visible le plus proche (désactivable), visée manuelle souris / stick droit.
- 2 armes portées, échange rapide, ramassage au sol. Compétence active de héros avec recharge.
- Les portes se verrouillent en entrant dans une salle de combat ; vagues d'ennemis ; coffre de récompense à la fin.
- Familier qui suit le joueur et attaque.

### Salles
`start`, `combat`, `chest` (coffre d'arme), `shop` (marchand, or), `statue` (choix d'un passif), `secret` (mur fissuré à casser),
`guardian` (mini-boss), `boss`.

### Édits (règles)
Choix de 1 parmi 3. Trois saveurs : **bénédiction**, **malédiction** (toujours compensée par une récompense), **mixte**.
Catégories : armes, héros, ennemis, salles, visuel, économie, méta (règles qui modifient les règles).
Les **synergies cachées** s'activent automatiquement quand leurs édits requis sont réunis.

### Progression méta
Gemmes gagnées à chaque run → héros, plans d'armes (ajoutées au pool de loot), familiers. Sauvegarde `localStorage`.

## 2. Architecture

Stack : **TypeScript + Vite + PixiJS v8**, zéro backend, zéro asset externe (sprites ASCII → atlas, sons Web Audio).

```
src/
  core/        Types, registres, RNG seedé, moteur de modificateurs, calcul des dégâts, sauvegarde   (pur, sans DOM)
  sim/         Simulation : World, joueurs, ennemis, balles, donjon, patterns, API ctx              (pur, sans DOM)
  render/      PixiJS : atlas de sprites, tuiles, vues d'entités, particules, caméra, post-effets
  input/       Clavier/souris, manette(s), tactile (2 joysticks virtuels)
  audio/       Synthé SFX + musique adaptative (intensité = nombre d'édits)
  ui/          HUD + menus en DOM (titre, hall, pause, options, choix d'édit, fin de run)
  content/     DONNÉES : armes, ennemis, boss, héros, règles, passifs, familiers, thèmes, sprites
tests/         Vitest : moteur de règles, dégâts, donjon, « fuzz » de combinaisons de règles en simulation headless
```

### Principes
- **La simulation est pure** (`core/` + `sim/` n'importent ni Pixi ni DOM). Elle émet des événements d'effets
  (`world.fx`: shake, particules, sons, textes…) que le rendu et l'audio consomment. → testable en headless.
- **Tout le contenu est déclaratif** et s'auto-enregistre : un fichier dans `src/content/**` appelle
  `defineWeapon / defineEnemy / defineHero / defineRule / definePassive / defineSynergy / definePet / defineSprite / defineTheme`.
  `import.meta.glob` charge tout le dossier : **ajouter un fichier suffit, jamais besoin de toucher le moteur.**
- **Pas de temps réel caché** : pas de `Math.random()` dans la sim (RNG seedé → mode seed), pas de `Date.now()`.

### Le moteur de modificateurs (règles, passifs, synergies)
Une règle est un `ModifierDef` : des métadonnées + des **hooks** optionnels (voir `src/core/types.ts`) :

| Hook | Rôle |
|---|---|
| `modify(m, ctx, self)` | Modifie la structure `Mods` (stats joueur, armes, ennemis, économie, monde, visuel). Recalculée **à chaque frame** → les règles dynamiques sont triviales. |
| `onTick`, `onShoot`, `onBulletSpawn`, `onBulletHitWall`, `onBulletHit` | Tir et projectiles |
| `onDealDamage`, `onDamage`, `onEnemySpawn`, `onEnemyDeath`, `onPlayerDeath` | Combat |
| `onRoomEnter`, `onRoomClear`, `onFloorPlan`, `onFloorStart`, `onChestOpen`, `onPickup`, `onWeaponPickup`, `onSkill` | Salles, loot |
| `onRuleOffer`, `onRuleAcquired`, `modifyPower` | Méta : agir sur les autres règles |
| `render(ctx, g, self)` | Dessin libre par-dessus le monde |

**Ordre d'application & conflits**
1. Les instances sont triées par `priority` croissante, puis par ordre d'acquisition. Convention :
   `0-99` additif · `100-199` multiplicatif (défaut 100) · `200-299` plafonds/overrides (« l'énergie est infinie ») · `900+` méta.
2. `modify` repart d'un `Mods` neuf à chaque frame : pas d'état qui dérive, cumul toujours cohérent.
3. Chaque instance a une `power` (défaut = `stacks`). Les règles méta la modifient via `modifyPower`. Les règles lisent `self.power` pour doser leurs effets.
4. `excludes: [ids]` empêche d'offrir deux règles contradictoires. Les overrides booléens se résolvent par priorité.
5. Les événements sont des objets **mutables** (`ev.amount`, `ev.cancel`, `ev.specs`…) qui traversent la chaîne dans l'ordre.
6. Un hook qui lève une exception est isolé (journalisé, la règle est mise en sourdine) : une règle boguée ne casse pas la run.
7. Garde-fous moteur : plafonds de balles/ennemis, profondeur de récursion des explosions/éclats, clamp des `Mods`.

### Données de gameplay (résumé — la référence est `src/core/types.ts`)
- **Arme** = `WeaponDef` : coût énergie, cadence, dégâts, `count/spread/jitter/burst/charge`, et un `BulletSpec`
  (`kind: shot | slash | beam | lob`, perçage, rebonds, homing, explosion, éclats, statuts, callbacks). `onFire` pour les armes absurdes.
- **Ennemi** = `EnemyDef` : stats + `move` (chase, keepDistance, wander, charge, orbit, hop, teleport…) + `attacks[]` qui référencent des
  **patterns** nommés (`aimed, spread, ring, spiral, burst, lob, laser, summon, dash, …`, registre extensible `definePattern`).
  Un boss est un `EnemyDef` avec `boss.phases[]` (seuils de PV → nouveaux déplacements/attaques).
- **Héros** = `HeroDef` : stats, arme de départ, `skill { cooldown, duration, use, tick, end, modify }`.
- **Sprites** = grilles ASCII + palette partagée (`src/render/palette.ts`), contour auto, version « flash blanc » auto.

### Boucle & rendu
Pas fixe 60 Hz (accumulateur), rendu interpolé simple. Sol pré-rendu dans une texture par étage ; entités = sprites poolés
triés en Y ; balles et particules poolées. Zoom entier en pixels écran. HUD/menus en DOM par-dessus le canvas.

## 3. Plan de production
1. **Cœur** (fait en premier, seul) : moteur, 1 héros, 2 armes, salle verrouillée, 3 ennemis, 1 boss, 1 règle, HUD minimal. Test navigateur.
2. **Contenu en parallèle** (agents, fichiers disjoints) : armes · ennemis+boss par monde (×3) · règles+synergies+tests · héros/passifs/familiers · audio · UI/menus.
3. **Intégration** : typecheck, tests, fuzz de combinaisons de règles, test navigateur de chaque écran.
4. **Finition** : équilibrage, perf (60 FPS mobile), README + captures, build statique.
