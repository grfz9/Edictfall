# EDICTFALL

**Roguelike shooter en pixel art, vue de dessus, où chaque boss vaincu réécrit les règles du jeu.**

Des donjons en salles qui se verrouillent, des dizaines d'armes, des héros à compétences, un rythme nerveux…
et une mécanique unique : à chaque Gardien ou Seigneur abattu, un **Édit** tombe. Tu choisis 1 règle parmi 3
(bénédiction, malédiction ou pacte) et elle reste **jusqu'à la fin de la run**. Les édits s'empilent, se combinent,
et certaines combinaisons réveillent des **synergies cachées**.

Jouable au clavier/souris, à la manette, et sur téléphone (deux joysticks virtuels). Tout est généré par le code :
pixel art, sons, musique. Aucun asset externe, aucun backend.

## Lancer le jeu

```bash
npm install
```

```bash
npm run dev
```

Puis ouvre l'adresse affichée (sur téléphone : l'adresse réseau, même Wi-Fi).

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (rechargement à chaud) |
| `npm run build` | Build statique dans `dist/` (≈ 0,9 Mo, chemins relatifs) |
| `npm run preview` | Sert le build de production |
| `npm test` | Tests (moteur de règles, dégâts, donjons, contenu, fuzz de combinaisons, audio) |
| `npm run docs` | Régénère [docs/CONTENU.md](docs/CONTENU.md) depuis les données du jeu |

### Déployer
- **GitHub Pages** : pousse sur `main`, le workflow [.github/workflows/pages.yml](.github/workflows/pages.yml) teste, construit et publie (activer Pages → source « GitHub Actions »).
- **Netlify** : [netlify.toml](netlify.toml) est prêt (`npm run build`, dossier `dist`). Ou glisse-dépose `dist/` sur app.netlify.com/drop.
- Tout hébergeur statique (itch.io compris) : le contenu de `dist/` suffit.

## Contrôles

| Action | Clavier / souris | Manette | Tactile |
|---|---|---|---|
| Bouger | ZQSD / WASD / flèches | Stick gauche | Joystick gauche |
| Viser | Souris (visée auto par défaut) | Stick droit | Joystick droit |
| Tirer | Clic gauche / J | RT, RB ou A | Joystick droit (maintenu) |
| Compétence | Espace / clic droit / K | B, LB ou LT | Bouton ★ |
| Changer d'arme | A (AZERTY) / Q / Tab / molette | Y | Bouton ⇄ |
| Interagir (armes, boutique, portail) | E / F | X | Toucher le tir près de l'objet |
| Choisir un édit | 1-2-3, flèches + Entrée, clic | Gauche/droite + A | Toucher deux fois |
| Pause | Échap / P | Start | Bouton II |

**Coop locale à 2** : dans le Hall, touche **C** (ou bouton « + Joueur 2 »). J2 joue aux flèches + Entrée / Ctrl droit / Maj droite, ou avec une deuxième manette.

**Seed** : tape une seed sur l'écran titre pour rejouer (et partager) exactement le même donjon. Elle est affichée en pause et en fin de run.

## Multijoueur en ligne

2 à 4 joueurs, chacun sur son appareil (PC, mobile, manette), sans compte ni serveur à nous.

- **Créer un salon** : écran titre ou Hall → **Multijoueur en ligne** → pseudo → **Créer un salon**. Un code de 5 caractères s'affiche (ex. `K7QRM`), avec **Copier** et **Copier le lien**.
- **Rejoindre** : même panneau → saisir le code → **Rejoindre**. Ou ouvrir directement le lien `…/?salon=CODE`.
- **Dans le Hall** : chacun choisit son héros en marchant vers une statue ; la liste des joueurs (pseudo, héros, ping) est dans le panneau et en haut à droite. L'hôte choisit le mode (Histoire, Infini, Défi) et lance la partie (bouton **Lancer la partie** ou portail).
- **En partie** : chaque caméra suit son propre joueur, pseudos au-dessus des personnages. Choix d'édit : l'hôte valide, les invités votent (leur pseudo s'affiche sur la carte). Mort / réanimation comme en coop locale. Le menu (Échap / Start) ne met **pas** la partie en pause.
- **Déconnexions** : un invité qui part est retiré proprement ; si l'hôte part, les invités sont prévenus et reviennent au Hall. On ne peut rejoindre que pendant que l'hôte est au Hall.
- Les gemmes gagnées pendant une partie en ligne sont créditées à chaque joueur.

Technique : WebRTC pair-à-pair via [PeerJS](https://peerjs.com/) (son serveur de signalisation public sert seulement à mettre les appareils en relation). **Hôte autoritaire** : la simulation tourne chez l'hôte, les invités envoient leurs commandes et reçoivent ~20 instantanés/s (delta-encodés, positions interpolées). Seuls le pseudo, les commandes et l'état du jeu circulent. Code dans `src/net/` ; `?net=local` remplace WebRTC par un `BroadcastChannel` pour tester à deux onglets du même navigateur sans Internet.

## Ce qu'il y a dedans

| | |
|---|---|
| Héros | **10** (dont Croâsimir, grenouille cadre sup' en cravate), chacun avec stats, trait passif et compétence active (double tir, bouclier, tourelle, dash invincible, ralenti du temps, soin de zone) |
| Armes | **93**, 5 raretés : plus une arme est forte, plus elle est rare. Dont 25 armes inspirées des animés (gant du coup banal, kunaï de téléportation, dégaine du rōnin…) : pistolets, fusils, pompes, lasers, arcs à charge, lance-roquettes, épées, lances, bâtons magiques, et 12 armes absurdes (hareng, panneau stop, lanceur de bulles, grille-pain, accordéon…) |
| Édits | **56** règles en 7 catégories (armes, héros, ennemis, salles, visuel, économie, méta) + **14 synergies cachées** |
| Ennemis | **75+** dont 6 élites rares, **3 boss** qui changent d'apparence à chaque phase + un **boss secret**, et un Gardien à mi-monde |
| Mondes | Sylve Murmurante (forêt), Glacier Fendu (sol glissant), Forge Abyssale (lave) — 3 × 5 étages, puis mode boucle |
| Salles | combat, coffre, boutique, statue de bénédiction, salle secrète (mur fissuré à casser), gardien, boss |
| Modes | **Histoire** (lore + cinématique d'intro qu'on peut passer), **Infini** (score, boss en rotation), **Défi quotidien** ; difficulté qui monte en continu |
| Hub | Hall vivant : PNJ, mannequins d'entraînement, choix du héros et du mode ; **Wassim Hadmi** propose des marchés démesurés en début de partie |
| Salles spéciales | 7 salles à easter eggs (développeur, casino, statues qui bougent, salle du Sceau…) |
| Progression | 22 passifs, 7 familiers, gemmes pour débloquer héros, plans d'armes (Arsenal) et familiers ; Codex des édits et synergies découverts ; sauvegarde locale |

👉 La liste complète et détaillée (stats de chaque héros, chaque arme, chaque édit, chaque synergie) est dans **[docs/CONTENU.md](docs/CONTENU.md)**.

Quelques édits : *Morts volatiles* (les ennemis explosent), *Murs de caoutchouc* (tes balles rebondissent, mais les murs te blessent),
*Source intarissable* (énergie infinie, l'armure ne se recharge plus), *Lame unique* (tout devient orange, une seule arme),
*Singeries* (les ennemis copient ton dernier tir), *Sablier immobile* (le temps ralentit quand tu es immobile), *Coffres à dents* (mimics),
*Gravité dorée* (l'or et les balles ennemies sont attirés vers toi), *Nuée minuscule* (ennemis minuscules et deux fois plus nombreux),
*Amplificateur* (méta : toutes les autres règles ×1,5), *Mutation* (méta : une règle change à chaque étage)…

## Architecture

TypeScript + Vite + PixiJS v8. Détails et choix de conception : [PLAN.md](PLAN.md). Pour ajouter du contenu : [CONTENT_GUIDE.md](CONTENT_GUIDE.md).

```
src/core/     types (contrats de données), registres, moteur de règles (ModStack), dégâts, RNG seedé, sauvegarde
src/sim/      simulation pure (sans DOM) : monde, combat, IA ennemie, patterns de balles, donjons, API ctx
src/render/   PixiJS : atlas de sprites ASCII, tuiles, caméra, particules, juice
src/input/    clavier/souris, manettes, tactile
src/audio/    effets synthétisés + musique procédurale adaptative (Web Audio)
src/ui/       HUD, minimap, choix d'édits, menus (DOM)
src/content/  DONNÉES : armes, ennemis, boss, héros, édits, synergies, passifs, familiers, thèmes
```

- **100 % data-driven** : chaque arme / ennemi / héros / règle est un objet déclaré dans `src/content/**`, chargé automatiquement.
  Ajouter un fichier suffit, le moteur ne change jamais.
- **Règles = modules à hooks** : `modify` (stats recalculées à chaque frame, donc aucun état qui dérive), `onTick`, `onShoot`,
  `onBulletSpawn`, `onEnemyDeath`, `onDamage`, `onRoomEnter`, `onChestOpen`, `onFloorPlan`, `onRuleOffer`, `modifyPower` (méta), `render`…
- **Cumul sans bug** : ordre par priorité puis acquisition, `power` modulable par les règles méta, `excludes` pour les contradictions,
  bornes de sécurité sur toutes les stats, plafonds de balles/ennemis/explosions, et une règle qui lève une exception est isolée puis mise en sourdine.
- **Simulation déterministe et testable sans navigateur** : un pilote automatique joue des runs entières dans les tests,
  dont un fuzz de 60 seeds × 6 à 10 édits aléatoires, et un test avec tous les édits compatibles actifs à la fois.

Tout le contenu (noms, personnages, sprites, armes, musique) est original.
