// Interface DOM : orchestre HUD, bannières, choix d'édits, menus, dialogues, bulles et cinématiques.
// Lit l'état du jeu, n'écrit que via Game/World.
import type { Game } from '../main';
import type { DialogLine } from '../core/types';
import { Hud } from './hud';
import { Banners } from './banners';
import { ChoiceView } from './choice';
import { Menus } from './menus';
import { DialogView } from './dialog';
import { Bubbles } from './bubbles';
import { Cinematic } from './cinematic';
import { PadNav, type PadAction } from './padnav';
import { INTRO, ENDING, INTERLUDES } from '../content/story/lore';

export class UI {
  private root: HTMLElement;
  private hud: Hud;
  private banners: Banners;
  private choice: ChoiceView;
  private menus: Menus;
  readonly dialog: DialogView;
  private bubbles: Bubbles;
  readonly cine: Cinematic;
  private padnav = new PadNav();
  private tip: HTMLElement;
  private tipFor: HTMLElement | null = null;
  private touchDev = false;

  constructor(private game: Game) {
    this.root = document.getElementById('ui')!;
    this.root.innerHTML = '';
    this.hud = new Hud(game);
    this.banners = new Banners();
    this.choice = new ChoiceView(game, () => this.sync());
    this.menus = new Menus(game, () => this.sync());
    this.dialog = new DialogView(game, () => this.sync());
    this.bubbles = new Bubbles(game);
    this.cine = new Cinematic(game, () => this.sync());
    this.tip = document.createElement('div');
    this.tip.id = 'tip';
    this.tip.setAttribute('role', 'tooltip');
    const rotate = document.createElement('div');
    rotate.id = 'rotate';
    rotate.innerHTML = '<span class="ph-ic" aria-hidden="true"></span>Tourne ton téléphone pour jouer en paysage';
    this.root.append(this.hud.el, this.bubbles.el, this.banners.el, this.choice.el, this.dialog.el, this.menus.el, this.cine.el, this.tip, rotate);

    // Écouteur en capture : passe avant celui de input.ts pour les menus, dialogues et le choix d'édit.
    window.addEventListener('keydown', (e) => this.onKey(e), true);
    // Infobulles : survol à la souris, tap au toucher (tap ailleurs pour fermer).
    this.root.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement | null;
      if (el) this.showTip(el); else this.hideTip();
    });
    this.root.addEventListener('pointerout', (e) => {
      if (e.pointerType !== 'mouse') return;
      const to = (e.relatedTarget as HTMLElement | null)?.closest?.('[data-tip]');
      if (!to) this.hideTip();
    });
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const el = (e.target as HTMLElement).closest?.('[data-tip]') as HTMLElement | null;
      if (el && this.root.contains(el)) { if (this.tipFor === el) this.hideTip(); else this.showTip(el); }
      else this.hideTip();
    }, true);
    // pas de menu contextuel / sélection parasite sur l'interface
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ------------------------------------------------------------------ API utilisée par main.ts
  banner(title: string, sub?: string, color?: string): void { this.banners.push(title, sub, color); }

  onState(s: Game['state']): void {
    const prev = this.root.dataset.state;
    // bannières d'une run précédente : on les jette (sauf simple reprise après pause)
    if (s !== 'pause' && !(prev === 'pause' && s === 'play')) this.banners.clear();
    this.root.dataset.state = s;
    this.hideTip();
    if (s !== 'play') this.hud.reset();
    // victoire en mode Histoire : la fin narrative passe avant le récapitulatif
    const sum = this.game.world.summary as (NonNullable<Game['world']['summary']> & { played?: boolean }) | null;
    if (s === 'end' && sum?.ending && !sum.played) {
      sum.played = true;
      this.menus.show('play');
      this.cine.play(ENDING, () => { if (this.game.state === 'end') { this.menus.show('end'); this.sync(); } });
      this.sync();
      return;
    }
    this.menus.show(s);
    this.sync();
    this.padnav.sync();
  }

  openPanel(type: string): void {
    this.hideTip();
    if (type === 'intro') { this.playIntro(); return; }
    this.menus.openPanel(type);
    this.sync();
    this.padnav.sync();
  }

  /** Cinématique d'introduction (premier lancement, ou rejouée depuis le hall / le titre). */
  playIntro(done: () => void = () => {}): void {
    this.cine.play(INTRO, () => {
      const f = (this.game.save.flags ??= {});
      f.introSeen = true;
      this.game.world.persist();
      done();
    });
    this.padnav.sync();
  }
  /** Intermède entre deux mondes (mode Histoire). */
  playScene(id: number): void {
    const lines: DialogLine[] | undefined = INTERLUDES[id];
    if (lines) this.dialog.play({ lines });
  }

  /** Un écran recouvre le jeu : la simulation doit ignorer les entrées. */
  get blocking(): boolean { return !!this.menus.panel || this.dialog.open || this.cine.open; }

  frame(dt: number): void {
    const g = this.game;
    this.menus.update(dt);
    const touch = g.input.device === 'touch';
    if (touch !== this.touchDev) { this.touchDev = touch; this.root.classList.toggle('touch-dev', touch); }
    this.pad(dt);
    this.cine.update(dt);
    this.dialog.update(dt);
    const covered = !!this.menus.panel || this.cine.open;
    this.choice.update(dt, covered || this.dialog.open);
    this.banners.update(dt, g.state === 'play' && !this.choice.open && !covered && !this.dialog.open);
    this.bubbles.update((g.state === 'play' || g.state === 'pause') && !covered);
    if (g.state === 'play' || g.state === 'pause') this.hud.update(dt);
    if (this.tipFor && !this.tipFor.isConnected) this.hideTip();
  }

  // ------------------------------------------------------------------ manette dans l'interface
  private pad(dt: number): void {
    const acts = this.padnav.poll(dt);
    if (!acts.length) return;
    const g = this.game;
    for (const a of acts) {
      if (this.cine.open) { this.cine.pad(a); continue; }
      if (this.menus.modalOpen || this.menus.panel || (this.menus.active && g.state !== 'play')) { this.menus.pad(a); continue; }
      if (this.dialog.open) { this.dialog.pad(a); continue; }
      // en jeu : B / Start passent par input.ts (compétence, pause), rien à faire ici
      if (a === 'start' && g.state === 'pause') g.setState('play');
    }
    if (acts.length) { g.input.device = 'pad'; this.padnav.sync(); }
  }

  // ------------------------------------------------------------------ interne
  /** Synchronise classes d'état et capture tactile avec l'écran affiché. */
  private sync(): void {
    const g = this.game;
    this.root.classList.toggle('choice-open', this.choice.open);
    this.root.classList.toggle('panel-open', !!this.menus.panel || this.cine.open);
    this.root.classList.toggle('dialog-open', this.dialog.open);
    this.root.classList.toggle('menu-open', this.menus.active);
    this.root.classList.toggle('cine-open', this.cine.open);
    g.input?.setTouchActive(g.state === 'play' && !this.choice.open && !this.blocking);
  }

  private onKey(e: KeyboardEvent): void {
    const g = this.game;
    const eat = () => { e.preventDefault(); e.stopPropagation(); };
    if (this.cine.open) { if (this.cine.key(e)) eat(); return; }
    if (this.menus.modalOpen) { if (e.code === 'Escape' ? this.menus.escape() : this.menus.key(e)) eat(); return; }
    if (this.dialog.open && !this.menus.panel && (g.state === 'play' || !this.menus.active)) { if (this.dialog.key(e)) eat(); return; }
    if (this.choice.open && g.state === 'play' && !this.menus.panel) {
      if (this.choice.key(e)) eat();
      return;
    }
    if (e.code === 'Escape') {
      if (this.menus.escape()) eat();
      return;
    }
    if (this.menus.active) {
      if (this.menus.key(e)) eat();
      return;
    }
    const tag = (e.target as HTMLElement)?.tagName;
    if (g.state === 'play' && g.world.mode === 'hub' && e.code === 'KeyC' && !e.repeat && tag !== 'INPUT') g.toggleCoop();
  }

  private showTip(el: HTMLElement): void {
    const tip = this.tip;
    this.tipFor = el;
    tip.innerHTML = el.dataset.tip!;
    tip.classList.add('on');
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(vw - tw - 8, x));
    let y = r.bottom + 8;
    if (y + th > vh - 8) y = Math.max(8, r.top - th - 8);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  private hideTip(): void {
    this.tipFor = null;
    this.tip.classList.remove('on');
  }
}
