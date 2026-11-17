// Écrans plein cadre : titre, pause, options, comment jouer, fin de run, panneaux du hall, confirmation.
// Un seul jeu d'écouteurs délégués sur #overlay (aucune fuite quand on rouvre un menu).
import type { Game } from '../main';
import type { ModifierDef, RunMode } from '../core/types';
import { R, allRules, allSynergies } from '../core/registry';
import { RARITY_COLORS, RARITY_NAMES } from '../core/damage';
import { storeSave, wipeSave } from '../core/save';
import { WORLD_NAMES, MODE_NAMES } from '../sim/world';
import type { PadAction } from './padnav';
import { $, $$, esc, fillIcons, pix, copyText, replay, weaponStats, fmt, modKindLabel, modColor, CATEGORY, CATEGORY_ORDER, FLAVOR, WEAPON_TYPES } from './dom';
import { drawLogo } from './logo';
import { uiOpts } from './hud';

type Screen = 'none' | 'title' | 'pause' | 'options' | 'howto' | 'end' | 'panel';
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex="0"]';

export class Menus {
  readonly el: HTMLElement;
  screen: Screen = 'none';
  panel: string | null = null;
  private back: (() => void) | null = null;
  private modal: { yes: () => void } | null = null;
  private gem = { on: false, t: 0, to: 0 };
  private codexFilter = 'all';
  private howtoTab = '';

  constructor(private game: Game, private onChange: () => void) {
    const el = (this.el = document.createElement('div'));
    el.id = 'overlay';
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
      if (b && el.contains(b)) this.act(b.dataset.a!, b);
      else if (e.target === el && this.screen === 'panel') this.closePanel();
    });
    el.addEventListener('input', (e) => this.onInput(e.target as HTMLInputElement));
    el.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).id === 'seed' && e.code === 'Enter') { e.preventDefault(); this.act('play', e.target as HTMLElement); }
    });
  }

  get active(): boolean { return this.screen !== 'none'; }
  get modalOpen(): boolean { return !!this.modal; }

  // ------------------------------------------------------------------ routage
  show(state: Game['state']): void {
    this.closeModal();
    this.panel = null;
    if (state === 'title') this.title();
    else if (state === 'pause') this.pause();
    else if (state === 'end') this.end();
    else this.clear();
  }
  private clear(): void {
    this.screen = 'none';
    this.back = null;
    this.el.className = '';
    this.el.innerHTML = '';
    this.onChange();
  }
  private mount(screen: Screen, cls: string, html: string, back: (() => void) | null = null): void {
    this.screen = screen;
    this.back = back;
    this.el.className = `on ${cls}`;
    this.el.innerHTML = html;
    fillIcons(this.el);
    this.el.scrollTop = 0;
    this.onChange();
    this.autofocus();
  }
  private autofocus(): void {
    const t = ($('[data-autofocus]', this.el) ?? $('.btn', this.el)) as HTMLElement | null;
    if (t && this.game.input.device !== 'touch') t.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------ titre
  private title(): void {
    const s = this.game.save;
    const embers = Array.from({ length: 14 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i * 0.83) % 9}s;--s:${7 + (i % 5) * 1.7}s"></i>`).join('');
    this.mount('title', 'title', `
      <div class="embers" aria-hidden="true">${embers}</div>
      <div class="title-wrap">
        <div class="logo"></div>
        <div class="tag">Chaque boss vaincu réécrit les règles.</div>
        <div class="title-menu">
          <button class="btn big" data-a="play" data-autofocus>Jouer</button>
          <label class="seed"><span>Seed</span><input id="seed" maxlength="12" placeholder="aléatoire" autocomplete="off" spellcheck="false" value="${esc(this.game.seedText)}"></label>
          <div class="row">
            <button class="btn" data-a="options">Options</button>
            <button class="btn" data-a="howto">Comment jouer</button>
            <button class="btn" data-a="intro">L'histoire</button>
          </div>
        </div>
        ${s.stats.runs || s.gems ? `<div class="title-stats">${pix('gem', 1)} ${s.gems} · Runs : ${s.stats.runs} · Victoires : ${s.stats.wins}${s.stats.best ? ` · Record : ${esc(s.stats.best)}` : ''}${s.records?.endless ? ` · Infini : ${s.records.endless.score}` : ''}</div>` : ''}
      </div>
      <div class="credit">Edictfall · un roguelike où les règles changent · TypeScript + PixiJS</div>`);
    $('.logo', this.el).appendChild(drawLogo());
  }

  // ------------------------------------------------------------------ pause
  private pause(): void {
    const w = this.game.world, run = w.mode === 'run';
    const acq = (k: ModifierDef['kind']) => w.rules.list.filter((i) => i.def.kind === k).sort((a, b) => a.order - b.order);
    const rules = acq('rule'), syn = acq('synergy'), pas = acq('passive');
    const total = rules.length + syn.length + pas.length;
    this.mount('pause', 'pause', `
      <div class="box pause-box">
        <div class="bh"><h2>Pause</h2>${run ? `<div class="sub">${w.worldNum}-${w.floorNum} · ${esc(WORLD_NAMES[w.worldNum] ?? '')}${w.loop ? ` · Boucle ${w.loop + 1}` : ''}</div>` : '<div class="sub">Le Hall</div>'}</div>
        <div class="pause-cols">
          <div class="menu-col">
            <button class="btn big" data-a="resume" data-autofocus>Reprendre</button>
            <button class="btn" data-a="options">Options</button>
            <button class="btn" data-a="howto">Comment jouer</button>
            ${run ? '<button class="btn danger" data-a="abandon">Abandonner la run</button>' : '<button class="btn" data-a="title">Écran titre</button>'}
            ${run ? `<div class="seedrow">Seed <b class="seedv">${esc(w.seed)}</b><button class="btn mini" data-a="copy" data-v="${esc(w.seed)}">Copier</button></div>` : ''}
          </div>
          <div class="rules-col">
            <h3>Règles actives${total ? ` (${total})` : ''}</h3>
            ${total ? `<div class="rlist">${this.rows(rules.map((i) => i.def), 'rule', true, rules.map((i) => i.stacks))}${this.rows(syn.map((i) => i.def), 'syn')}${this.rows(pas.map((i) => i.def), 'pas', false, pas.map((i) => i.stacks))}</div>`
              : `<div class="empty">${run ? 'Aucun édit pour l\'instant. Bats un boss pour réécrire les règles.' : 'Les édits s\'accumulent pendant une run.'}</div>`}
          </div>
        </div>
      </div>`);
  }
  private rows(defs: ModifierDef[], cls: string, numbered = false, stacks: number[] = []): string {
    return defs.map((d, i) => `<div class="rrow ${cls} ${d.flavor ?? ''}" style="--fc:${modColor(d)}">
      <span class="ic" data-icon="${d.icon}" data-fit="26"></span>
      <div><b>${numbered ? `<span class="num">${i + 1}.</span>` : ''}${esc(d.name)}${(stacks[i] ?? 1) > 1 ? ` <span class="tx">×${stacks[i]}</span>` : ''}</b><em>${esc(modKindLabel(d))}</em><small>${esc(d.desc)}</small></div></div>`).join('');
  }

  // ------------------------------------------------------------------ options
  private options(): void {
    const o = uiOpts(this.game);
    const prev = this.screen === 'pause' ? () => this.pause() : () => this.title();
    const tog = (k: string, label: string, on: boolean) =>
      `<div class="opt"><span>${label}</span><button class="tog ${on ? 'on' : ''}" data-a="opt" data-k="${k}" role="switch" aria-checked="${on}">${on ? 'Oui' : 'Non'}</button></div>`;
    const rng = (k: string, label: string, v: number, max: number) =>
      `<div class="opt"><label for="o-${k}">${label}</label><span class="rng"><input type="range" id="o-${k}" data-k="${k}" min="0" max="${max}" step="0.05" value="${v}"><output>${Math.round(v * 100)} %</output></span></div>`;
    const seg = `<div class="opt"><span>Contrôles tactiles</span><span class="seg" role="radiogroup">${(['auto', 'on', 'off'] as const).map((v) =>
      `<button class="${o.touch === v ? 'on' : ''}" data-a="touch" data-v="${v}" role="radio" aria-checked="${o.touch === v}">${{ auto: 'Auto', on: 'Toujours', off: 'Jamais' }[v]}</button>`).join('')}</span></div>`;
    this.mount('options', 'pause', `
      <div class="box wide opt-box">
        <div class="bh"><h2>Options</h2></div>
        <div class="optgrid">
          ${tog('autoAim', 'Visée automatique', o.autoAim)}
          ${tog('damageNumbers', 'Chiffres de dégâts', o.damageNumbers)}
          ${rng('sfx', 'Sons', o.sfx, 1)}
          ${rng('music', 'Musique', o.music, 1)}
          ${rng('shake', 'Tremblement d\'écran', o.shake, 1.5)}
          ${tog('showFps', 'Afficher les FPS', !!o.showFps)}
          <div class="opt"><span>Mode performance</span><span class="seg" role="radiogroup">${(['auto', 'on', 'off'] as const).map((v) =>
            `<button class="${(o.perf ?? 'auto') === v ? 'on' : ''}" data-a="perf" data-v="${v}" role="radio" aria-checked="${(o.perf ?? 'auto') === v}">${{ auto: 'Auto', on: 'Oui', off: 'Non' }[v]}</button>`).join('')}</span></div>
          ${seg}
          <div class="opt"><span>Sauvegarde</span><button class="btn mini danger" data-a="reset">Réinitialiser…</button></div>
        </div>
        <button class="btn big" data-a="back" data-autofocus>Retour</button>
      </div>`, prev);
  }
  private onInput(el: HTMLInputElement): void {
    if (el.type !== 'range') return;
    const o = this.game.save.options as any;
    o[el.dataset.k!] = Number(el.value);
    const out = el.parentElement?.querySelector('output');
    if (out) out.textContent = Math.round(Number(el.value) * 100) + ' %';
    this.game.applyOptions();
    if (el.dataset.k === 'sfx') this.game.audio.sfx('select', 0.6);
  }

  // ------------------------------------------------------------------ comment jouer
  private howto(tab?: string): void {
    const prevScreen = this.screen === 'howto' ? (this.back ?? (() => this.title())) : this.screen === 'pause' ? () => this.pause() : () => this.title();
    const dev = this.game.input.device;
    this.howtoTab = tab ?? (this.howtoTab || (dev === 'touch' ? 'touch' : dev === 'pad' ? 'pad' : 'kb'));
    const t = this.howtoTab;
    const tabs = [['kb', 'Clavier & souris'], ['pad', 'Manette'], ['touch', 'Tactile'], ['edicts', 'Les édits']];
    const table = (rows: [string, string][]) => `<div class="keys">${rows.map(([k, v]) => `<div class="krow"><span class="k">${k}</span><span>${v}</span></div>`).join('')}</div>`;
    const body: Record<string, string> = {
      kb: table([
        ['<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>', 'Se déplacer (ou les flèches)'],
        ['Souris', 'Viser'], ['Clic gauche / <kbd>J</kbd>', 'Tirer'],
        ['<kbd>Espace</kbd> / clic droit / <kbd>K</kbd>', 'Compétence du héros'],
        ['<kbd>Tab</kbd> / molette / <kbd>L</kbd>', 'Changer d\'arme (aussi <kbd>A</kbd> en AZERTY)'],
        ['<kbd>E</kbd> / <kbd>F</kbd>', 'Interagir : ramasser, acheter, entrer'],
        ['<kbd>Échap</kbd> / <kbd>P</kbd>', 'Pause'], ['<kbd>C</kbd> (dans le hall)', 'Ajouter / retirer le joueur 2'],
        ['J2 au clavier', 'Flèches · <kbd>Ctrl</kbd> droit tirer · <kbd>Maj</kbd> droite compétence · <kbd>/</kbd> arme · <kbd>Entrée</kbd> interagir'],
      ]),
      pad: table([
        ['Stick gauche / croix', 'Se déplacer'], ['Stick droit', 'Viser et tirer'], ['<kbd>RT</kbd> / <kbd>RB</kbd> / <kbd>A</kbd>', 'Tirer'],
        ['<kbd>B</kbd> / <kbd>LB</kbd> / <kbd>LT</kbd>', 'Compétence'], ['<kbd>Y</kbd>', 'Changer d\'arme'], ['<kbd>X</kbd>', 'Interagir'],
        ['<kbd>Start</kbd>', 'Pause'], ['Choix d\'édit', '◀ ▶ puis <kbd>A</kbd>'], ['Deux manettes', 'Une par joueur en coop locale'],
      ]),
      touch: table([
        ['Pouce gauche', 'Joystick de déplacement : il apparaît où tu poses le doigt'],
        ['Pouce droit', 'Joystick de visée : maintenir pour tirer, toucher pour interagir'],
        ['★', 'Compétence (l\'anneau montre la recharge)'], ['⇄', 'Changer d\'arme'],
        ['II (en haut)', 'Pause'], ['Icônes de règles', 'Touche une icône pour lire sa description'],
      ]),
      edicts: `<div class="edict-help">
        <p>Chaque <b>boss</b> vaincu t'offre un <b>Édit</b> : une règle permanente, choisie parmi plusieurs, qui reste active <b>jusqu'à la fin de la run</b>. Les édits s'empilent et se combinent.</p>
        <p class="legend"><span class="fl boon">${FLAVOR.boon}</span> pur avantage · <span class="fl curse">${FLAVOR.curse}</span> une contrainte… souvent payante · <span class="fl mixed">${FLAVOR.mixed}</span> un marché : un gain contre un prix.</p>
        <p>Certains duos d'édits cachent une <b class="gold">synergie</b> qui se révèle d'elle-même quand ils sont réunis. Les <b class="blue">passifs</b> sont des bonus plus modestes trouvés en chemin.</p>
        <p>Les armes ont une rareté : <span style="color:${RARITY_COLORS[0]}">commune</span>, <span style="color:${RARITY_COLORS[1]}">peu commune</span>, <span style="color:${RARITY_COLORS[2]}">rare</span>, <span style="color:${RARITY_COLORS[3]}">épique</span>, <span style="color:${RARITY_COLORS[4]}">légendaire</span>. Tirer coûte de l'énergie ; l'armure se recharge si tu évites les coups.</p>
        <p>Au hall, le <b>Codex</b> garde la trace de tout ce que tu as découvert ; l'<b>Arsenal</b> et le <b>Chenil</b> s'achètent avec les gemmes gagnées en run.</p></div>`,
    };
    this.mount('howto', 'pause', `
      <div class="box wide howto-box">
        <div class="bh"><h2>Comment jouer</h2></div>
        <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab ${k === t ? 'on' : ''}" data-a="tab" data-v="${k}" role="tab" aria-selected="${k === t}">${l}</button>`).join('')}</div>
        <div class="tabbody">${body[t]}</div>
        <button class="btn big" data-a="back">Retour</button>
      </div>`, prevScreen);
    if (tab) ($(`.tab[data-v="${tab}"]`, this.el) as HTMLElement | null)?.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------ fin de run
  private end(): void {
    const g = this.game, w = g.world, s = w.summary;
    if (!s) { this.clear(); return; }
    const mm = Math.floor(s.time / 60), ss = Math.floor(s.time % 60).toString().padStart(2, '0');
    // ordre d'acquisition (l'ordre de s.rules suit la priorité d'application)
    const byOrder = (ids: string[]) => {
      const inst = w.rules.list.filter((i) => ids.includes(i.def.id)).sort((a, b) => a.order - b.order);
      return (inst.length === ids.length ? inst.map((i) => i.def) : ids.map((id) => R.mods.get(id)!)).filter(Boolean);
    };
    const rules = byOrder(s.rules), syn = byOrder(s.synergies), pas = byOrder(s.passives);
    const hero = R.heroes.get(s.hero);
    const where = s.win ? 'Donjon vaincu' : s.mode === 'endless' ? `Tombé à l'étage ${s.stage} · ${esc(WORLD_NAMES[s.world] ?? '')}` : `Tombé en ${s.world}-${s.floor} · ${esc(WORLD_NAMES[s.world] ?? '')}`;
    this.mount('end', `end ${s.win ? 'win' : 'lose'}`, `
      <div class="box wide end-box">
        <div class="bh"><h2>${s.win ? 'Victoire !' : 'Tu es tombé'}</h2>
          <div class="sub">${hero ? `<span class="ic" data-icon="${hero.sprite}" data-fit="22"></span>${esc(hero.name)} · ` : ''}${where}${s.loop ? ` · Boucle ${s.loop + 1}` : ''}</div></div>
        <div class="end-cols">
          <div class="end-left">
            <div class="score-box ${s.newRecord ? 'rec' : ''}"><small>${esc(MODE_NAMES[s.mode] ?? '')}${s.mode === 'endless' ? ` · étage ${s.stage}` : ''}</small><b>${s.score.toLocaleString('fr-FR')}</b>
              <em>${s.newRecord ? '★ Nouveau record !' : s.best ? `Record : ${s.best.toLocaleString('fr-FR')}` : ''}</em></div>
            <div class="stats">
              <div><b>${mm}:${ss}</b><small>Temps</small></div><div><b>${s.kills}</b><small>Ennemis</small></div>
              <div><b>${s.rooms}</b><small>Salles</small></div><div><b>${s.bosses}</b><small>Boss</small></div>
              <div><b>${s.damage >= 10000 ? Math.round(s.damage / 1000) + ' k' : s.damage}</b><small>Dégâts</small></div><div><b>${s.coins}</b><small>Or</small></div>
            </div>
            <div class="gemgain">${pix('gem', 3)}<b id="gemcount">+0</b><small>gemmes · solde <span id="gemtotal">${g.save.gems - s.gems}</span></small></div>
            <div class="seedrow">Seed <b class="seedv">${esc(s.seed)}</b><button class="btn mini" data-a="copy" data-v="${esc(s.seed)}">Copier</button></div>
          </div>
          <div class="end-right">
            <h3>Édits de la run (${rules.length})</h3>
            ${rules.length ? `<div class="chain">${rules.map((d, i) => `<span class="chip" style="--fc:${modColor(d)}" data-tip="${esc(`<b>${esc(d.name)}</b><br>${esc(d.desc)}<br><i>${esc(modKindLabel(d))}</i>`)}"><i>${i + 1}</i><span data-icon="${d.icon}" data-fit="18"></span>${esc(d.name)}</span>`).join('<span class="arrow">›</span>')}</div>` : '<div class="empty">Aucun édit cette fois-ci.</div>'}
            ${syn.length ? `<h3 class="gold">Synergies (${syn.length})</h3><div class="chain">${syn.map((d) => `<span class="chip syn" data-tip="${esc(`<b>${esc(d.name)}</b><br>${esc(d.desc)}`)}"><span data-icon="${d.icon}" data-fit="18"></span>${esc(d.name)}</span>`).join('')}</div>` : ''}
            ${pas.length ? `<h3 class="blue">Passifs (${pas.length})</h3><div class="chain">${pas.map((d) => `<span class="chip pas" data-tip="${esc(`<b>${esc(d.name)}</b><br>${esc(d.desc)}`)}"><span data-icon="${d.icon}" data-fit="18"></span>${esc(d.name)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
        <div class="row end-actions">
          ${s.win && s.mode !== 'endless' ? '<button class="btn big" data-a="loop" data-autofocus>Continuer en boucle</button>' : ''}
          <button class="btn ${s.win ? '' : 'big'}" data-a="hub" ${s.win ? '' : 'data-autofocus'}>Retour au hall</button>
          <button class="btn" data-a="retry">Rejouer la seed</button>
        </div>
      </div>`);
    this.gem = { on: true, t: 0, to: s.gems };
  }

  update(dt: number): void {
    if (!this.gem.on || this.screen !== 'end') return;
    this.gem.t += dt;
    const k = Math.min(1, Math.max(0, (this.gem.t - 0.5) / 1.3));
    const e = 1 - Math.pow(1 - k, 3);
    const n = Math.round(this.gem.to * e);
    const c = $('#gemcount', this.el), tot = $('#gemtotal', this.el);
    if (c) c.textContent = '+' + n;
    if (tot) tot.textContent = String(this.game.save.gems - this.gem.to + n);
    if (k >= 1) { this.gem.on = false; if (c) replay(c.parentElement!, 'done'); }
  }

  // ------------------------------------------------------------------ panneaux du hall
  openPanel(type: string): void {
    this.panel = type;
    const g = this.game, s = g.save;
    const head = (title: string, sub: string) => `<div class="ph"><h2>${title}</h2><span class="bal" title="Gemmes">${pix('gem', 2)}<b>${s.gems}</b></span><button class="x" data-a="close" aria-label="Fermer">✕</button></div><div class="sub">${sub}</div>`;
    let body = '';
    if (type === 'arsenal') {
      const list = [...R.weapons.values()].filter((d) => d.unlock !== undefined);
      const owned = list.filter((d) => s.weapons.includes(d.id)).length;
      body = head('Arsenal', 'Achète des plans : ces armes rejoindront le butin de tes prochaines runs.') + '<div class="pscroll">' +
        ([0, 1, 2, 3, 4].map((r) => {
          const items = list.filter((d) => d.rarity === r).sort((a, b) => a.unlock! - b.unlock!);
          if (!items.length) return '';
          return `<h3 style="color:${RARITY_COLORS[r]}">${RARITY_NAMES[r]}</h3><div class="grid">${items.map((d) => {
            const own = s.weapons.includes(d.id), poor = !own && s.gems < d.unlock!;
            const st = weaponStats(d);
            return `<button class="card ${own ? 'own' : ''} ${poor ? 'poor' : ''}" data-a="buy" data-id="${d.id}" style="--rc:${RARITY_COLORS[d.rarity]}">
              <span class="ic" data-icon="${d.sprite}" data-fit="40"></span><b>${esc(d.name)}</b><span class="type">${esc(WEAPON_TYPES[d.type] ?? '')}</span>
              <span class="wst"><span>⚔ ${fmt(st.dmg)}${st.count > 1 ? '×' + st.count : ''}</span><span>${pix('bolt', 1)}${st.energy}</span><span>◷ ${fmt(st.rate)}/s</span></span>
              ${d.desc ? `<small>${esc(d.desc)}</small>` : ''}<em>${own ? '✔ Acquis' : `${pix('gem', 1)} ${d.unlock}`}</em></button>`;
          }).join('')}</div>`;
        }).join('') || '<div class="empty">Aucune arme à débloquer pour l\'instant.</div>') +
        `</div><div class="pfoot">${owned}/${list.length} plans acquis<span class="kbd-hint"> · <kbd>Échap</kbd> pour fermer</span></div>`;
    } else if (type === 'pets') {
      const pets = [...R.pets.values()].sort((a, b) => a.cost - b.cost);
      body = head('Chenil', 'Un familier t\'accompagne dans le donjon et attaque à tes côtés.') + '<div class="pscroll"><div class="grid">' +
        (pets.map((d) => {
          const own = d.cost === 0 || s.pets.includes(d.id), sel = s.pet === d.id, poor = !own && s.gems < d.cost;
          return `<button class="card ${own ? 'own' : ''} ${sel ? 'sel' : ''} ${poor ? 'poor' : ''}" data-a="pet" data-id="${d.id}">
            <span class="ic" data-icon="${d.sprite}" data-fit="44"></span><b>${esc(d.name)}</b><small>${esc(d.desc)}</small>
            <em>${sel ? '★ Actif' : own ? 'Choisir' : `${pix('gem', 1)} ${d.cost}`}</em></button>`;
        }).join('') || '<div class="empty">Aucun familier disponible.</div>') +
        `</div></div><div class="pfoot">${s.pet ? 'Touche le familier actif pour le laisser au chenil.' : 'Aucun familier actif.'}<span class="kbd-hint"> · <kbd>Échap</kbd> pour fermer</span></div>`;
    } else if (type === 'codex') {
      body = head('Codex', '') + this.codexBody();
    } else if (type === 'modes') {
      body = head('Tableau des défis', 'Choisis ton mode, puis entre dans le portail.') + this.modesBody();
    }
    const keepFocus = (document.activeElement as HTMLElement | null)?.dataset?.id;
    this.mount('panel', `panel panel-${type}`, `<div class="box wide panel-box" role="dialog" aria-label="${type}">${body}</div>`, () => this.closePanel());
    if (keepFocus) ($(`[data-id="${keepFocus}"]`, this.el) as HTMLElement | null)?.focus({ preventScroll: true });
    else if (g.input.device !== 'touch') (($('.panel-box [data-autofocus]', this.el) ?? $('.card, .filt, .x', this.el)) as HTMLElement | null)?.focus({ preventScroll: true });
  }
  private modesBody(): string {
    const g = this.game, s = g.save, rec = s.records ?? {}, cur = g.world.hubMode;
    const today = g.dailySeed();
    const daily = rec.daily?.seed === today ? rec.daily : null;
    const edicts = g.dailyPreview().map((d) => `<span class="chip" style="--fc:${modColor(d)}"><span data-icon="${d.icon}" data-fit="16"></span>${esc(d.name)}</span>`).join('');
    const card = (m: RunMode, icon: string, title: string, desc: string, extra: string) =>
      `<button class="card mode-card ${cur === m ? 'sel' : ''}" data-a="mode" data-v="${m}" ${cur === m ? 'data-autofocus' : ''}>
        ${pix(icon, 3)}<b>${title}</b><small>${desc}</small><span class="mrec">${extra}</span><em>${cur === m ? '★ Choisi' : 'Choisir'}</em></button>`;
    return `<div class="pscroll"><div class="grid modes">
      ${card('story', 'crown', 'Histoire', 'Trois mondes, trois Seigneurs, une Reliure à réécrire. Scènes entre les mondes et vraie fin.', `Victoires : ${rec.storyWins ?? 0}`)}
      ${card('endless', 'loop', 'Infini', 'Des étages sans fin. La difficulté grimpe sans arrêt, un Seigneur tous les 5 étages. Score et record.', rec.endless ? `Record : <b>${rec.endless.score.toLocaleString('fr-FR')}</b> · étage ${rec.endless.stage}` : 'Aucun record')}
      ${card('daily', 'hourglass', 'Défi quotidien', `Seed du jour <b>${esc(today)}</b>, la même pour tout le monde, et 3 édits imposés.`, daily ? `Aujourd'hui : <b>${daily.score.toLocaleString('fr-FR')}</b>` : 'Pas encore joué aujourd\'hui')}
      </div>${edicts ? `<h3>Édits imposés aujourd'hui</h3><div class="chain">${edicts}</div>` : ''}</div>
      <div class="pfoot">Mode actuel : <b>${esc(MODE_NAMES[cur])}</b><span class="kbd-hint"> · <kbd>Échap</kbd> pour fermer</span></div>`;
  }
  private codexBody(): string {
    const s = this.game.save;
    const seenFirst = (a: ModifierDef, b: ModifierDef, seen: string[]) => (seen.includes(a.id) ? 0 : 1) - (seen.includes(b.id) ? 0 : 1)
      || CATEGORY_ORDER.indexOf(a.category ?? '') - CATEGORY_ORDER.indexOf(b.category ?? '');
    const rules = allRules().sort((a, b) => seenFirst(a, b, s.seenRules)), syn = allSynergies().sort((a, b) => seenFirst(a, b, s.seenSynergies));
    const seenR = rules.filter((r) => s.seenRules.includes(r.id)).length, seenS = syn.filter((r) => s.seenSynergies.includes(r.id)).length;
    const pct = rules.length + syn.length ? Math.round(((seenR + seenS) / (rules.length + syn.length)) * 100) : 0;
    const f = this.codexFilter;
    const cats = CATEGORY_ORDER.filter((c) => rules.some((r) => r.category === c));
    const filt = (k: string, label: string, n: string) => `<button class="filt ${f === k ? 'on' : ''}" data-a="filter" data-v="${k}" aria-pressed="${f === k}">${label}<small>${n}</small></button>`;
    const shown = f === 'syn' ? [] : rules.filter((r) => f === 'all' || r.category === f);
    const row = (d: ModifierDef) => s.seenRules.includes(d.id)
      ? `<div class="rrow rule ${d.flavor}" style="--fc:${modColor(d)}"><span class="ic" data-icon="${d.icon}" data-fit="26"></span><div><b>${esc(d.name)}</b><em>${esc(modKindLabel(d))}</em><small>${esc(d.desc)}</small></div></div>`
      : `<div class="rrow unk"><span class="ic q">?</span><div><b>???</b><em>${esc(CATEGORY[d.category ?? ''] ?? 'Édit')}</em><small>Pas encore rencontré.</small></div></div>`;
    const srow = (d: ModifierDef) => {
      const req = (d.requires ?? []).map((id) => R.mods.get(id)).filter(Boolean) as ModifierDef[];
      return s.seenSynergies.includes(d.id)
        ? `<div class="rrow syn"><span class="ic" data-icon="${d.icon}" data-fit="26"></span><div><b>${esc(d.name)}</b><em>${req.map((r) => esc(s.seenRules.includes(r.id) ? r.name : '???')).join(' + ')}</em><small>${esc(d.desc)}</small></div></div>`
        : `<div class="rrow unk"><span class="ic q">✦</span><div><b>Synergie cachée</b><em>Synergie</em><small>Réunis les bons édits pour la révéler.</small></div></div>`;
    };
    return `<div class="codex-top"><div class="prog"><i style="width:${pct}%"></i></div><span>${pct} % découvert · Édits ${seenR}/${rules.length} · Synergies ${seenS}/${syn.length}</span></div>
      <div class="filters">${filt('all', 'Tous', `${seenR}/${rules.length}`)}${cats.map((c) => filt(c, CATEGORY[c], `${rules.filter((r) => r.category === c && s.seenRules.includes(r.id)).length}/${rules.filter((r) => r.category === c).length}`)).join('')}${filt('syn', 'Synergies', `${seenS}/${syn.length}`)}</div>
      <div class="pscroll"><div class="rlist">${f === 'syn' ? syn.map(srow).join('') : shown.map(row).join('')}${f === 'all' ? syn.map(srow).join('') : ''}</div>
      ${(f === 'syn' ? syn.length : shown.length) ? '' : '<div class="empty">Rien ici pour l\'instant.</div>'}</div>
      <div class="pfoot kbd-hint"><kbd>Échap</kbd> pour fermer</div>`;
  }
  closePanel(): void {
    if (!this.panel) return;
    this.panel = null;
    this.clear();
  }

  // ------------------------------------------------------------------ confirmation
  private confirm(title: string, text: string, yesLabel: string, yes: () => void): void {
    this.closeModal();
    this.modal = { yes };
    const m = document.createElement('div');
    m.className = 'modal';
    m.setAttribute('role', 'alertdialog');
    m.innerHTML = `<div class="box modal-box"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="row"><button class="btn danger" data-a="yes">${esc(yesLabel)}</button><button class="btn" data-a="no" data-autofocus>Annuler</button></div></div>`;
    this.el.appendChild(m);
    if (this.game.input.device !== 'touch') ($('[data-a="no"]', m) as HTMLElement).focus();
  }
  private closeModal(): void {
    this.modal = null;
    $('.modal', this.el)?.remove();
  }

  // ------------------------------------------------------------------ actions
  private act(a: string, b: HTMLElement): void {
    const g = this.game, w = g.world, s = g.save;
    switch (a) {
      case 'play': g.seedText = (($('#seed', this.el) as HTMLInputElement | null)?.value ?? '').trim().toUpperCase(); g.audio.unlock(); g.toHub(); break;
      case 'options': this.options(); break;
      case 'howto': this.howto(); break;
      case 'tab': this.howto(b.dataset.v); break;
      case 'back': this.back?.(); break;
      case 'resume': g.setState('play'); break;
      case 'title': w.startHub(); g.setState('title'); break;
      case 'abandon':
        this.confirm('Abandonner la run ?', 'La run se termine ici. Les gemmes déjà méritées te seront créditées.', 'Abandonner', () => { w.finish(false); g.setState('end'); });
        break;
      case 'hub': g.toHub(); break;
      case 'loop': w.continueLoop(); g.setState('play'); break;
      case 'retry': { const seed = w.summary?.seed, mode = w.summary?.mode; w.startHub(); g.startRun(seed, mode); break; }
      case 'copy':
        copyText(b.dataset.v ?? '').then((ok) => { b.textContent = ok ? 'Copié !' : 'Échec'; replay(b, 'flash'); window.setTimeout(() => { if (b.isConnected) b.textContent = 'Copier'; }, 1400); });
        break;
      case 'opt': {
        const o = s.options as any, k = b.dataset.k!;
        o[k] = !o[k];
        b.classList.toggle('on', !!o[k]); b.textContent = o[k] ? 'Oui' : 'Non'; b.setAttribute('aria-checked', String(!!o[k]));
        g.applyOptions(); g.audio.sfx('select', 0.5);
        break;
      }
      case 'perf':
        (s.options as any).perf = b.dataset.v;
        $$('[data-a="perf"]', this.el).forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
        g.applyOptions();
        break;
      case 'intro': g.ui.playIntro(); break;
      case 'mode': g.setMode(b.dataset.v as RunMode); this.closePanel(); break;
      case 'touch':
        s.options.touch = b.dataset.v as 'auto' | 'on' | 'off';
        $$('[data-a="touch"]', this.el).forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
        g.applyOptions();
        break;
      case 'reset':
        this.confirm('Réinitialiser la sauvegarde ?', 'Gemmes, héros, armes, familiers, codex et options seront effacés définitivement.', 'Tout effacer', () => { wipeSave(); location.reload(); });
        break;
      case 'yes': { const m = this.modal; this.closeModal(); m?.yes(); break; }
      case 'no': this.closeModal(); this.autofocus(); break;
      case 'close': this.closePanel(); break;
      case 'filter': this.codexFilter = b.dataset.v ?? 'all'; this.openPanel('codex'); ($(`.filt[data-v="${this.codexFilter}"]`, this.el) as HTMLElement | null)?.focus({ preventScroll: true }); break;
      case 'buy': this.buy(b); break;
      case 'pet': this.pet(b); break;
    }
  }
  private buy(b: HTMLElement): void {
    const g = this.game, s = g.save, d = R.weapons.get(b.dataset.id!);
    if (!d || s.weapons.includes(d.id)) return;
    if (s.gems < d.unlock!) { g.audio.sfx('deny'); replay(b, 'nope'); return; }
    s.gems -= d.unlock!; s.weapons.push(d.id); storeSave(s); g.audio.sfx('unlock');
    b.focus();
    this.openPanel('arsenal');
    const nb = $(`[data-id="${d.id}"]`, this.el);
    if (nb) replay(nb, 'bought');
  }
  private pet(b: HTMLElement): void {
    const g = this.game, s = g.save, d = R.pets.get(b.dataset.id!);
    if (!d) return;
    const own = d.cost === 0 || s.pets.includes(d.id);
    if (!own) {
      if (s.gems < d.cost) { g.audio.sfx('deny'); replay(b, 'nope'); return; }
      s.gems -= d.cost; s.pets.push(d.id); g.audio.sfx('unlock');
    } else g.audio.sfx('select');
    s.pet = s.pet === d.id ? null : d.id;
    storeSave(s);
    const w = g.world;
    w.pets = [];
    const def = R.pets.get(s.pet ?? '');
    if (def) for (const p of w.players) w.pets.push({ def, x: p.x - 12, y: p.y + 6, cd: 1, facing: 1, owner: p, data: {} });
    b.focus();
    this.openPanel('pets');
    const nb = $(`[data-id="${d.id}"]`, this.el);
    if (nb) replay(nb, 'bought');
  }

  // ------------------------------------------------------------------ clavier
  /** Échap : retour/fermeture. true = consommé (la pause ne doit pas basculer). */
  escape(): boolean {
    if (this.modal) { this.closeModal(); this.autofocus(); return true; }
    if (this.screen === 'panel') { this.closePanel(); return true; }
    if ((this.screen === 'options' || this.screen === 'howto') && this.back) { this.back(); return true; }
    return false;
  }
  /** Navigation clavier dans l'écran courant. true = consommé. */
  key(e: KeyboardEvent): boolean {
    const ae = document.activeElement as HTMLElement | null;
    const inText = ae?.tagName === 'INPUT' && (ae as HTMLInputElement).type === 'text';
    const inRange = ae?.tagName === 'INPUT' && (ae as HTMLInputElement).type === 'range';
    if (e.code === 'Tab') { e.stopPropagation(); return false; } // tabulation native (input.ts l'empêche sinon)
    if (e.code === 'Space' && ae?.tagName === 'BUTTON' && this.el.contains(ae)) { ae.click(); return true; }
    if ((e.code === 'Enter' || e.code === 'Space') && this.screen === 'title' && (!ae || ae === document.body)) { this.act('play', this.el); return true; }
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.code] as [number, number] | undefined;
    if (!dir) return false;
    if ((inText || inRange) && dir[0] !== 0) return false;
    this.nav(dir[0], dir[1]);
    return true;
  }
  /** Manette : croix/stick = navigation, A = valider, B = retour, Start = jouer / reprendre. */
  pad(a: PadAction): void {
    const g = this.game;
    if (a === 'back') {
      if (this.escape()) return;
      if (this.screen === 'pause') g.setState('play');
      return;
    }
    if (a === 'start') {
      if (this.modal) return;
      if (this.screen === 'title') this.act('play', this.el);
      else if (this.screen === 'pause') g.setState('play');
      else if (this.screen === 'panel') this.closePanel();
      return;
    }
    if (a === 'ok') {
      const root = ($('.modal', this.el) as HTMLElement | null) ?? this.el;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && root.contains(ae) && (ae.tagName === 'BUTTON' || ae.dataset.a)) { ae.click(); return; }
      if (this.screen === 'title') { this.act('play', this.el); return; }
      const first = $<HTMLElement>(FOCUSABLE, root);
      first?.focus();
      return;
    }
    const ae = document.activeElement as HTMLInputElement | null;
    if (ae?.type === 'range' && (a === 'left' || a === 'right')) {
      const st = Number(ae.step) || 0.05;
      ae.value = String(Math.max(Number(ae.min), Math.min(Number(ae.max), Number(ae.value) + (a === 'left' ? -st : st))));
      this.onInput(ae);
      return;
    }
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[a] as [number, number];
    this.nav(d[0], d[1]);
  }
  private nav(dx: number, dy: number): void {
    const root = ($('.modal', this.el) as HTMLElement | null) ?? this.el;
    const items = $$<HTMLElement>(FOCUSABLE, root).filter((x) => x.offsetParent !== null);
    if (!items.length) return;
    const cur = document.activeElement as HTMLElement | null;
    if (!cur || !items.includes(cur)) { items[0].focus(); return; }
    const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best: HTMLElement | null = null, bestScore = Infinity;
    for (const it of items) {
      if (it === cur) continue;
      const q = it.getBoundingClientRect(), qx = q.left + q.width / 2, qy = q.top + q.height / 2;
      const ax = qx - cx, ay = qy - cy;
      const along = ax * dx + ay * dy;
      if (along <= 4) continue;
      const across = Math.abs(ax * dy) + Math.abs(ay * dx);
      const score = along + across * 2.2;
      if (score < bestScore) { bestScore = score; best = it; }
    }
    if (!best) { // boucle verticale
      if (dy !== 0) best = dy > 0 ? items[0] : items[items.length - 1];
    }
    best?.focus();
    best?.scrollIntoView({ block: 'nearest' });
  }
}
