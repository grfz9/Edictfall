// Boîte de dialogue avec portrait : texte tapé à la machine, choix au clavier / souris / manette / toucher.
// Affiche world.dialog (PNJ, Wassim, salles spéciales) ou une scène locale (intermèdes du mode Histoire).
import type { Game } from '../main';
import type { Dialog } from '../core/types';
import { $, $$, esc, spriteFit } from './dom';
import type { PadAction } from './padnav';

const CPS = 60; // caractères par seconde

export class DialogView {
  readonly el: HTMLElement;
  private cur: Dialog | null = null;
  private local: { d: Dialog; done: () => void } | null = null;
  private idx = 0;
  private shown = 0;
  private sel = 0;
  private armT = 0;
  private textEl: HTMLElement | null = null;

  constructor(private game: Game, private onChange: () => void) {
    const el = (this.el = document.createElement('div'));
    el.id = 'dialog';
    el.setAttribute('role', 'dialog');
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-o]') as HTMLElement | null;
      if (b) { this.choose(Number(b.dataset.o)); return; }
      if ((e.target as HTMLElement).closest('.dlg-box')) this.advance();
    });
    el.addEventListener('pointermove', (e) => {
      const b = (e.target as HTMLElement).closest('[data-o]') as HTMLElement | null;
      if (b && e.pointerType === 'mouse') this.select(Number(b.dataset.o));
    });
  }

  get open(): boolean { return !!this.cur; }

  /** Joue une scène locale (n'utilise pas la simulation). */
  play(d: Dialog, done: () => void = () => {}): void {
    this.local = { d, done };
  }

  private source(): Dialog | null {
    if (this.local) return this.local.d;
    const g = this.game;
    return g.state === 'play' ? g.world.dialog : null;
  }

  update(dt: number): void {
    const d = this.source();
    if (d !== this.cur) {
      const was = !!this.cur;
      this.cur = d;
      this.idx = 0; this.sel = 0; this.shown = 0; this.armT = 0.25;
      if (d) this.render(); else { this.el.className = ''; this.el.innerHTML = ''; }
      if (was !== !!d) this.onChange();
    }
    if (!this.cur) return;
    if (this.armT > 0) this.armT -= dt;
    const line = this.cur.lines[this.idx];
    if (line && this.textEl && this.shown < line.text.length) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(line.text.length, this.shown + dt * CPS);
      const n = Math.floor(this.shown);
      if (n !== before) {
        this.textEl.textContent = line.text.slice(0, n);
        if (n % 3 === 0 && line.text[n - 1] !== ' ') this.game.audio.sfx('select', 0.08);
        if (n >= line.text.length) this.render();
      }
    }
  }

  private get typing(): boolean {
    const line = this.cur?.lines[this.idx];
    return !!line && this.shown < line.text.length;
  }
  private get onLast(): boolean { return !!this.cur && this.idx >= this.cur.lines.length - 1; }
  private get options() { return (this.onLast && !this.typing && this.cur?.options) || []; }

  private render(): void {
    const d = this.cur!;
    const line = d.lines[this.idx] ?? d.lines[d.lines.length - 1];
    const g = this.game, dev = g.input.device;
    const portrait = line?.portrait || (line?.who === 'Toi' ? g.world.players[0]?.hero.sprite : '') || '';
    const opts = this.options;
    const done = !this.typing;
    const ok = dev === 'pad' ? '<kbd class="pad">A</kbd>' : dev === 'touch' ? 'Touche' : '<kbd>Entrée</kbd>';
    const back = dev === 'pad' ? '<kbd class="pad">B</kbd>' : dev === 'touch' ? '' : '<kbd>Échap</kbd>';
    this.el.className = 'on' + (opts.length ? ' has-opts' : '');
    this.el.innerHTML = `<div class="dlg-box" style="--nc:${line?.color ?? '#ffd23a'}">
      <div class="dlg-portrait">${portrait ? '' : '<span class="q">?</span>'}</div>
      <div class="dlg-body">
        <b class="dlg-name">${esc(line?.who ?? '')}</b>
        <p class="dlg-text">${esc(done ? line?.text ?? '' : (line?.text ?? '').slice(0, Math.floor(this.shown)))}</p>
        ${opts.length ? `<div class="dlg-opts" role="listbox">${opts.map((o, i) => `<button class="dlg-opt ${i === this.sel ? 'sel' : ''} ${o.cancel ? 'cancel' : ''}" data-o="${i}" role="option"><b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`).join('')}</div>` : ''}
        <div class="dlg-hint">${opts.length ? `${dev === 'pad' ? '▲▼' : dev === 'touch' ? '' : '<kbd>↑</kbd><kbd>↓</kbd>'} choisir · ${ok} valider${back ? ' · ' + back + ' refuser' : ''}` : `${ok} ${done ? (this.onLast ? 'fermer' : 'suite') : 'accélérer'}${back ? ' · ' + back + ' passer' : ''}`}</div>
      </div>
      ${!opts.length && done ? '<span class="dlg-next">▼</span>' : ''}
    </div>`;
    if (portrait) {
      try { $('.dlg-portrait', this.el).appendChild(spriteFit(portrait, 72)); } catch { /* sprite manquant */ }
    }
    this.textEl = $('.dlg-text', this.el);
  }

  private select(i: number): void {
    const n = this.options.length;
    if (!n) return;
    const j = (i + n) % n;
    if (j !== this.sel) { this.sel = j; this.game.audio.sfx('select', 0.3); }
    $$('.dlg-opt', this.el).forEach((b, k) => b.classList.toggle('sel', k === this.sel));
  }

  /** Valider : accélère, passe à la ligne suivante, ou choisit l'option sélectionnée. */
  advance(): void {
    if (!this.cur || this.armT > 0) return;
    if (this.typing) { this.shown = this.cur.lines[this.idx].text.length; this.render(); return; }
    if (this.options.length) { this.choose(this.sel); return; }
    if (!this.onLast) { this.idx++; this.shown = 0; this.render(); return; }
    this.finish(-1);
  }
  /** Retour / Échap : refuse (option d'annulation) ou passe toute la scène. */
  back(): void {
    if (!this.cur || this.armT > 0) return;
    if (this.cur.options?.length) {
      if (!this.onLast || this.typing) { this.idx = this.cur.lines.length - 1; this.shown = this.cur.lines[this.idx].text.length; this.render(); return; }
      this.finish(-1);
      return;
    }
    this.finish(-1);
  }
  private choose(i: number): void {
    if (!this.cur || this.armT > 0) return;
    if (!this.options[i]) return;
    this.game.audio.sfx('select', 0.6);
    this.finish(i);
  }
  private finish(i: number): void {
    if (this.local) {
      const l = this.local;
      this.local = null;
      const opt = i >= 0 ? l.d.options?.[i] : l.d.options?.find((o) => o.cancel);
      try { opt?.act?.(); l.d.onClose?.(); } finally { l.done(); }
    } else this.game.world.dialogChoose(i);
    this.update(0);
  }

  key(e: KeyboardEvent): boolean {
    if (!this.cur) return false;
    const c = e.code;
    if (c === 'Escape' || c === 'Backspace') { this.back(); return true; }
    if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space' || c === 'KeyE' || c === 'KeyF') { if (!e.repeat) this.advance(); return true; }
    if (c === 'ArrowUp' || c === 'KeyW' || c === 'ArrowLeft') { this.select(this.sel - 1); return true; }
    if (c === 'ArrowDown' || c === 'KeyS' || c === 'ArrowRight' || c === 'Tab') { this.select(this.sel + 1); return true; }
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(c);
    if (n >= 0 && this.options[n]) { this.select(n); this.choose(n); return true; }
    return true; // la boîte est modale : rien ne passe au jeu
  }
  pad(a: PadAction): void {
    if (a === 'ok') this.advance();
    else if (a === 'back') this.back();
    else if (a === 'up' || a === 'left') this.select(this.sel - 1);
    else if (a === 'down' || a === 'right') this.select(this.sel + 1);
  }
}
