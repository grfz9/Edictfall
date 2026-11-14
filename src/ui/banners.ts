// Bannières : file d'attente, entrée/sortie animées, jamais affichées par-dessus un choix ou un menu.
import { $ } from './dom';

interface Item { title: string; sub?: string; color?: string }

export class Banners {
  readonly el: HTMLElement;
  private queue: Item[] = [];
  private t = 0;
  private phase: 'idle' | 'in' | 'out' = 'idle';
  private current: Item | null = null;

  constructor() {
    const el = (this.el = document.createElement('div'));
    el.id = 'banner';
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="bn-line"></div><div class="t"></div><div class="s"></div><div class="bn-line"></div>';
  }
  push(title: string, sub?: string, color?: string): void {
    const last = this.queue[this.queue.length - 1] ?? this.current;
    if (last && last.title === title && last.sub === sub) return;
    this.queue.push({ title, sub, color });
    if (this.queue.length > 4) this.queue.shift();
  }
  clear(): void {
    this.queue.length = 0;
    if (this.phase === 'in') this.leave();
  }

  /** canShow : false pendant un choix, un menu ou un panneau (la bannière en cours se retire). */
  update(dt: number, canShow: boolean): void {
    if (this.phase === 'in') {
      // interrompue par un choix/menu : elle repassera ensuite si elle n'a presque pas été vue
      if (!canShow) { if (this.t > 1 && this.current) this.queue.unshift(this.current); this.leave(); return; }
      this.t -= dt;
      if (this.t <= 0) this.leave();
    } else if (this.phase === 'out') {
      this.t -= dt;
      if (this.t <= 0) { this.phase = 'idle'; this.el.className = ''; this.current = null; }
    } else if (canShow && this.queue.length) {
      const b = (this.current = this.queue.shift()!);
      $('.t', this.el).textContent = b.title;
      $('.s', this.el).textContent = b.sub ?? '';
      this.el.style.setProperty('--c', b.color ?? '#ffd23a');
      this.el.className = 'in' + (b.sub && b.sub.length > 60 ? ' long' : '');
      this.phase = 'in';
      const len = (b.sub?.length ?? 0) + b.title.length;
      this.t = Math.min(4.2, 1.9 + len * 0.025) * (this.queue.length > 1 ? 0.75 : 1);
    }
  }
  private leave(): void {
    this.phase = 'out';
    this.t = 0.35;
    this.el.className = 'out';
  }
}
