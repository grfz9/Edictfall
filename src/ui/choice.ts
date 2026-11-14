// Choix d'édit / de passif : cartes, sélection souris, clavier, manette et toucher, animation de confirmation.
import type { Game } from '../main';
import type { ModifierDef } from '../core/types';
import { allSynergies } from '../core/registry';
import { $, $$, esc, fillIcons, FLAVOR, CATEGORY, modColor, modKindLabel } from './dom';

const ARM_DELAY = 0.45; // s : évite de valider par erreur un clic de tir en cours

export class ChoiceView {
  readonly el: HTMLElement;
  private ckey = '';
  private sel = 0;
  private armedT = 0;
  private busy = false;
  private pointer = 'mouse';
  private touchArmed = -1;
  private pad = { l: false, r: false, a: false };
  private count = 0;
  /** Le choix en cours demande plusieurs cartes (reste vrai jusqu'à sa fermeture). */
  private multi: object | null = null;

  constructor(private game: Game, private onOpen: (open: boolean) => void) {
    const el = (this.el = document.createElement('div'));
    el.id = 'choice';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.addEventListener('pointerdown', (e) => { this.pointer = e.pointerType || 'mouse'; });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || this.busy) return;
      const card = (e.target as HTMLElement).closest('.rcard') as HTMLElement | null;
      if (card) this.select(Number(card.dataset.i), false);
    });
    el.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.rcard') as HTMLElement | null;
      if (!card) return;
      const i = Number(card.dataset.i);
      if (this.pointer === 'touch' || this.pointer === 'pen') {
        // au toucher : 1er tap = sélection, 2e tap = validation
        if (this.touchArmed !== i) { this.select(i, false); this.touchArmed = i; el.classList.add('armed'); return; }
      }
      this.confirm(i);
    });
  }

  get open(): boolean { return this.ckey !== ''; }

  update(dt: number, blocked: boolean): void {
    const g = this.game, c = g.world.choice;
    const show = g.state === 'play' && !!c && !blocked;
    const key = show && c ? c.kind + ':' + c.options.map((o) => o.id).join(',') + ':' + c.picks : '';
    if (key !== this.ckey) {
      const wasOpen = this.ckey !== '';
      this.ckey = key;
      if (key && c) this.render();
      else { this.el.className = ''; this.el.innerHTML = ''; this.multi = null; }
      if (wasOpen !== !!key) this.onOpen(!!key);
    }
    if (!show) return;
    if (this.armedT > 0) { this.armedT -= dt; if (this.armedT <= 0) this.el.classList.add('ready'); }
    this.pollPad();
  }

  private render(): void {
    const g = this.game, w = g.world, c = w.choice!;
    const seen = g.save.seenRules;
    const active = w.rules.order();
    const activeIds = new Set(active.map((i) => i.def.id));
    const synHint = (d: ModifierDef) => {
      if (d.kind !== 'rule') return '';
      for (const s of allSynergies()) {
        const req = s.requires ?? [];
        if (!req.includes(d.id) || activeIds.has(s.id)) continue;
        if (req.every((r) => r === d.id || activeIds.has(r))) {
          return g.save.seenSynergies.includes(s.id) ? `<span class="rc-syn">✦ Active « ${esc(s.name)} »</span>` : '<span class="rc-syn">✦ Synergie possible…</span>';
        }
      }
      return '';
    };
    this.count = c.options.length;
    this.sel = Math.min(this.sel, this.count - 1);
    if (this.sel < 0) this.sel = 0;
    const isRule = c.kind === 'rule';
    if (c.picks > 1) this.multi = c;
    const took = active.filter((i) => i.def.kind !== 'passive' || !isRule);
    const touch = g.input.device === 'touch';
    const help = touch ? 'Touche une carte, puis touche-la de nouveau pour valider'
      : g.input.device === 'pad' ? '◀ ▶ pour choisir · Ⓐ pour valider'
      : `<kbd>1</kbd>–<kbd>${this.count}</kbd> ou <kbd>←</kbd> <kbd>→</kbd> puis <kbd>Entrée</kbd> · clic pour valider`;
    this.el.className = `on ${c.kind}`;
    this.el.innerHTML = `
      <div class="ch-head"><h2>${esc(c.title)}</h2><div class="sub">${esc(c.sub)}${this.multi === c ? ` <b class="picks">Encore ${c.picks} à choisir</b>` : ''}</div></div>
      <div class="cards n${this.count}">${c.options.map((d, i) => {
        const fresh = d.kind === 'rule' && !seen.includes(d.id);
        const fl = d.kind === 'rule' ? (d.flavor ?? 'mixed') : d.kind;
        return `<button class="rcard ${d.kind} ${fl}" data-i="${i}" style="--fc:${modColor(d)};--d:${i * 0.09}s" aria-label="${esc(d.name)} : ${esc(d.desc)}">
          ${fresh ? '<span class="rc-new">Nouveau !</span>' : ''}
          <span class="rc-flavor">${d.kind === 'rule' ? FLAVOR[fl] : 'Passif'}</span>
          <span class="rc-ic" data-icon="${d.icon}" data-fit="60"></span>
          <b class="rc-name">${esc(d.name)}</b>
          ${d.kind === 'rule' ? `<span class="rc-cat">${esc(CATEGORY[d.category ?? ''] ?? 'Édit')}</span>` : ''}
          <p>${esc(d.desc)}</p>${synHint(d)}
          <kbd>${i + 1}</kbd></button>`;
      }).join('')}</div>
      ${took.length ? `<div class="ch-active"><span class="lbl">${isRule ? 'Déjà actifs' : 'Actifs'}</span>${took.map((i) => `<span class="ric ${i.def.kind} ${i.def.flavor ?? ''}" data-tip="${esc(`<b>${esc(i.def.name)}</b>${i.stacks > 1 ? ' ×' + i.stacks : ''}<br>${esc(i.def.desc)}<br><i>${esc(modKindLabel(i.def))}</i>`)}"><span data-icon="${i.def.icon}" data-fit="18"></span>${i.stacks > 1 ? `<i>×${i.stacks}</i>` : ''}</span>`).join('')}</div>` : ''}
      <div class="ch-help">${help}</div>`;
    fillIcons(this.el);
    this.busy = false;
    this.touchArmed = -1;
    this.armedT = ARM_DELAY;
    this.el.classList.remove('ready', 'armed');
    this.highlight();
    // la manette ne doit pas valider avec un bouton déjà enfoncé
    const s = this.padState();
    this.pad = s;
  }

  private highlight(): void {
    $$('.rcard', this.el).forEach((b, i) => b.classList.toggle('sel', i === this.sel));
  }
  private select(i: number, focus = true): void {
    if (i < 0 || i >= this.count) return;
    if (i !== this.sel) { this.sel = i; this.touchArmed = -1; this.el.classList.remove('armed'); this.game.audio.sfx('select', 0.35); }
    this.highlight();
    if (focus) ($(`.rcard[data-i="${i}"]`, this.el) as HTMLElement | null)?.focus({ preventScroll: true });
  }
  private confirm(i: number): void {
    const w = this.game.world, c = w.choice;
    if (!c || this.busy || this.armedT > 0 || !c.options[i]) return;
    this.busy = true;
    this.sel = i;
    $$('.rcard', this.el).forEach((b, j) => b.classList.add(j === i ? 'picked' : 'dismiss'));
    window.setTimeout(() => {
      this.busy = false;
      if (w.choice === c && c.options[i]) w.pick(i);
    }, 480);
  }

  /** Clavier ; retourne true si la touche est consommée. */
  key(e: KeyboardEvent): boolean {
    if (!this.open) return false;
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);
    const np = ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5'].indexOf(e.code);
    const idx = n >= 0 ? n : np;
    if (idx >= 0) { if (idx < this.count) { this.select(idx); this.confirm(idx); } return true; }
    if (['ArrowLeft', 'KeyA', 'ArrowUp'].includes(e.code)) { this.select((this.sel - 1 + this.count) % this.count); return true; }
    if (['ArrowRight', 'KeyD', 'ArrowDown', 'Tab'].includes(e.code)) { this.select((this.sel + 1) % this.count); return true; }
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { this.confirm(this.sel); return true; }
    return false;
  }

  private padState(): { l: boolean; r: boolean; a: boolean } {
    const s = { l: false, r: false, a: false };
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const x = p.axes[0] ?? 0;
      const b = (i: number) => !!p.buttons[i]?.pressed;
      s.l ||= x < -0.5 || b(14) || b(4);
      s.r ||= x > 0.5 || b(15) || b(5);
      s.a ||= b(0);
    }
    return s;
  }
  private pollPad(): void {
    if (!navigator.getGamepads) return;
    const s = this.padState(), p = this.pad;
    if (s.l && !p.l) this.select((this.sel - 1 + this.count) % this.count);
    if (s.r && !p.r) this.select((this.sel + 1) % this.count);
    if (s.a && !p.a) this.confirm(this.sel);
    this.pad = s;
  }
}
