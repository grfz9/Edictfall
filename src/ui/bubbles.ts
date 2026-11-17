// Bulles de dialogue au-dessus des PNJ (positionnées sur l'écran à partir des coordonnées monde).
import type { Game } from '../main';

export class Bubbles {
  readonly el: HTMLElement;
  private els = new Map<number, HTMLElement>();

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.id = 'bubbles';
    this.el.setAttribute('aria-live', 'polite');
  }

  update(visible: boolean): void {
    const g = this.game, w = g.world;
    const seen = new Set<number>();
    if (visible) {
      const r = g.renderer;
      const zoom = Math.abs(r.cam?.zoom ?? 2);
      for (const b of w.bubbles) {
        seen.add(b.id);
        let el = this.els.get(b.id);
        if (!el) {
          el = document.createElement('div');
          el.className = 'bubble';
          this.el.appendChild(el);
          this.els.set(b.id, el);
        }
        if (el.textContent !== b.text) { el.textContent = b.text; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
        const s = r.worldToScreen(b.x, b.y - 14);
        el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y - zoom * 4)}px) translate(-50%, -100%)`;
        el.style.opacity = String(Math.min(1, b.t / 0.3, (b.max - b.t) / 0.12 + 0.2));
      }
    }
    for (const [id, el] of this.els) if (!seen.has(id)) { el.remove(); this.els.delete(id); }
  }
}
