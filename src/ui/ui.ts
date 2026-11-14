// Interface DOM : orchestre HUD, bannières, choix d'édits et menus. Lit l'état du jeu, n'écrit que via Game/World.
import type { Game } from '../main';
import { Hud } from './hud';
import { Banners } from './banners';
import { ChoiceView } from './choice';
import { Menus } from './menus';

export class UI {
  private root: HTMLElement;
  private hud: Hud;
  private banners: Banners;
  private choice: ChoiceView;
  private menus: Menus;
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
    this.tip = document.createElement('div');
    this.tip.id = 'tip';
    this.tip.setAttribute('role', 'tooltip');
    const rotate = document.createElement('div');
    rotate.id = 'rotate';
    rotate.innerHTML = '<span class="ph-ic" aria-hidden="true"></span>Tourne ton téléphone pour jouer en paysage';
    this.root.append(this.hud.el, this.banners.el, this.choice.el, this.menus.el, this.tip, rotate);

    // Écouteur en capture : passe avant celui de input.ts pour les menus et le choix d'édit.
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
    this.menus.show(s);
    this.sync();
  }

  openPanel(type: string): void {
    this.hideTip();
    this.menus.openPanel(type);
    this.sync();
  }

  /** Un panneau est ouvert : la simulation doit ignorer les entrées. */
  get blocking(): boolean { return !!this.menus.panel; }

  frame(dt: number): void {
    const g = this.game;
    this.menus.update(dt);
    const touch = g.input.device === 'touch';
    if (touch !== this.touchDev) { this.touchDev = touch; this.root.classList.toggle('touch-dev', touch); }
    this.choice.update(dt, !!this.menus.panel);
    this.banners.update(dt, g.state === 'play' && !this.choice.open && !this.menus.panel);
    if (g.state === 'play' || g.state === 'pause') this.hud.update(dt);
    if (this.tipFor && !this.tipFor.isConnected) this.hideTip();
  }

  // ------------------------------------------------------------------ interne
  /** Synchronise classes d'état et capture tactile avec l'écran affiché. */
  private sync(): void {
    const g = this.game;
    this.root.classList.toggle('choice-open', this.choice.open);
    this.root.classList.toggle('panel-open', !!this.menus.panel);
    this.root.classList.toggle('menu-open', this.menus.active);
    g.input?.setTouchActive(g.state === 'play' && !this.choice.open && !this.menus.panel);
  }

  private onKey(e: KeyboardEvent): void {
    const g = this.game;
    if (this.choice.open && g.state === 'play' && !this.menus.panel) {
      if (this.choice.key(e)) { e.preventDefault(); e.stopPropagation(); }
      return;
    }
    if (e.code === 'Escape') {
      if (this.menus.escape()) { e.preventDefault(); e.stopPropagation(); }
      return;
    }
    if (this.menus.active) {
      if (this.menus.key(e)) { e.preventDefault(); e.stopPropagation(); }
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


