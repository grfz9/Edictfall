// Cinématique : panneaux en pixel art dessinés à la main (canvas 320×180) + texte tapé à la machine.
// « Passer » visible tout de suite (Échap / B / Start / bouton) ; Entrée / A / Espace / tap : suite.
import type { Game } from '../main';
import type { CinePanel } from '../content/story/lore';
import { R } from '../core/registry';
import { spriteCanvas } from '../render/sprites';
import type { PadAction } from './padnav';

const W = 320, H = 180, CPS = 38;

export class Cinematic {
  readonly el: HTMLElement;
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private panels: CinePanel[] = [];
  private i = 0;
  private t = 0;
  private shown = 0;
  private done: (() => void) | null = null;
  private textEl!: HTMLElement;
  private kickEl!: HTMLElement;
  private dots!: HTMLElement;
  private cache = new Map<string, HTMLCanvasElement>();
  private seed = 1;

  constructor(private game: Game, private onChange: () => void) {
    const el = (this.el = document.createElement('div'));
    el.id = 'cine';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Cinématique');
    el.innerHTML = `<div class="cine-frame"><canvas width="${W}" height="${H}"></canvas><div class="cine-bars"></div></div>
      <div class="cine-txt"><em class="cine-kick"></em><p></p></div>
      <div class="cine-dots"></div>
      <button class="btn mini cine-skip" data-c="skip">Passer ⏭ <kbd class="k-kb">Échap</kbd></button>
      <div class="cine-hint"></div>`;
    this.cv = el.querySelector('canvas')!;
    this.g = this.cv.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.textEl = el.querySelector('.cine-txt p')!;
    this.kickEl = el.querySelector('.cine-kick')!;
    this.dots = el.querySelector('.cine-dots')!;
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-c="skip"]')) this.skip();
      else this.next();
    });
  }

  get open(): boolean { return this.done !== null; }

  play(panels: CinePanel[], done: () => void = () => {}): void {
    if (!panels.length) { done(); return; }
    this.panels = panels; this.i = 0; this.t = 0; this.shown = 0; this.done = done;
    this.el.className = 'on';
    this.enter();
    this.onChange();
    this.game.audio.unlock?.();
  }
  private enter(): void {
    const p = this.panels[this.i];
    this.kickEl.textContent = p.kicker ?? '';
    this.textEl.textContent = '';
    this.shown = 0; this.t = 0;
    this.dots.innerHTML = this.panels.map((_, k) => `<i class="${k === this.i ? 'on' : k < this.i ? 'past' : ''}"></i>`).join('');
    const dev = this.game.input.device;
    this.el.querySelector('.cine-hint')!.innerHTML = dev === 'pad' ? '<kbd class="pad">A</kbd> suite · <kbd class="pad">B</kbd> passer' : dev === 'touch' ? 'Touche pour continuer' : '<kbd>Entrée</kbd> suite · <kbd>Échap</kbd> passer';
    this.el.classList.remove('fade'); void this.el.offsetWidth; this.el.classList.add('fade');
  }
  next(): void {
    if (!this.open) return;
    const p = this.panels[this.i];
    if (this.shown < p.text.length) { this.shown = p.text.length; this.textEl.textContent = p.text; return; }
    if (++this.i >= this.panels.length) { this.skip(); return; }
    this.game.audio.sfx('select', 0.4);
    this.enter();
  }
  skip(): void {
    if (!this.open) return;
    const d = this.done!;
    this.done = null;
    this.el.className = '';
    this.onChange();
    d();
  }

  update(dt: number): void {
    if (!this.open) return;
    this.t += dt;
    const p = this.panels[this.i];
    if (this.shown < p.text.length && this.t > 0.35) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(p.text.length, this.shown + dt * CPS);
      const n = Math.floor(this.shown);
      if (n !== before) {
        this.textEl.textContent = p.text.slice(0, n);
        if (n % 2 === 0 && /\S/.test(p.text[n - 1] ?? '')) this.game.audio.sfx('select', 0.06);
      }
    }
    this.draw(p.scene, this.t);
  }

  key(e: KeyboardEvent): boolean {
    if (!this.open) return false;
    if (e.code === 'Escape') this.skip();
    else if (!e.repeat && ['Enter', 'NumpadEnter', 'Space', 'KeyE', 'ArrowRight'].includes(e.code)) this.next();
    return true;
  }
  pad(a: PadAction): void {
    if (a === 'ok' || a === 'right') this.next();
    else if (a === 'back' || a === 'start') this.skip();
  }

  // ------------------------------------------------------------------ dessin
  private spr(id: string, scale = 1): HTMLCanvasElement | null {
    const k = id + '@' + scale;
    let c = this.cache.get(k);
    if (!c) {
      if (!R.sprites.has(id)) return null;
      try { c = spriteCanvas(id, scale); } catch { return null; }
      this.cache.set(k, c);
    }
    return c;
  }
  private rnd(): number { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; }
  private stars(t: number, n = 60, col = '#ffffff'): void {
    const g = this.g;
    this.seed = 7;
    for (let i = 0; i < n; i++) {
      const x = this.rnd() * W, y = this.rnd() * H * 0.8, ph = this.rnd() * 6;
      g.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + ph));
      g.fillStyle = col;
      g.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
    g.globalAlpha = 1;
  }
  private sky(top: string, bottom: string): void {
    const gr = this.g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    this.g.fillStyle = gr;
    this.g.fillRect(0, 0, W, H);
  }
  private book(cx: number, cy: number, s: number, glow: number, empty = false): void {
    const g = this.g;
    g.fillStyle = `rgba(255,210,58,${0.12 + glow * 0.18})`;
    g.beginPath(); g.ellipse(cx, cy, 70 * s, 40 * s, 0, 0, 6.29); g.fill();
    g.fillStyle = '#4a3020'; g.fillRect(cx - 52 * s, cy - 4 * s, 104 * s, 30 * s);
    g.fillStyle = '#7a5030'; g.fillRect(cx - 50 * s, cy - 6 * s, 100 * s, 28 * s);
    for (const side of [-1, 1]) {
      g.fillStyle = '#f4f0e0';
      g.fillRect(cx + (side < 0 ? -48 : 2) * s, cy - 10 * s, 46 * s, 30 * s);
      g.fillStyle = '#c8d0e0';
      g.fillRect(cx + (side < 0 ? -48 : 2) * s, cy + 16 * s, 46 * s, 4 * s);
      if (!empty) {
        g.fillStyle = '#8a93a8';
        for (let l = 0; l < 6; l++) g.fillRect(cx + (side < 0 ? -44 : 6) * s, cy + (-6 + l * 4) * s, (30 + ((l * 7) % 9)) * s, 1 * s || 1);
      }
    }
    g.fillStyle = '#ffd23a'; g.fillRect(cx - 2 * s, cy - 10 * s, 4 * s, 32 * s);
  }
  private page(x: number, y: number, rot: number, a = 1): void {
    const g = this.g;
    g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a;
    g.fillStyle = '#f4f0e0'; g.fillRect(-6, -8, 12, 16);
    g.fillStyle = '#8a93a8'; for (let l = 0; l < 4; l++) g.fillRect(-4, -5 + l * 3, 8 - (l % 2) * 2, 1);
    g.restore(); g.globalAlpha = 1;
  }
  private bosses(): string[] {
    return [...R.enemies.values()].filter((d) => d.boss && d.world > 0).sort((a, b) => a.world - b.world).map((d) => d.sprite).slice(0, 3);
  }
  private silhouette(id: string, x: number, y: number, scale: number, color: string, eyes = true): void {
    const s = this.spr(id, scale);
    if (!s) return;
    const g = this.g;
    const tmp = document.createElement('canvas');
    tmp.width = s.width; tmp.height = s.height;
    const t = tmp.getContext('2d')!;
    t.drawImage(s, 0, 0);
    t.globalCompositeOperation = 'source-atop';
    t.fillStyle = color; t.fillRect(0, 0, tmp.width, tmp.height);
    g.drawImage(tmp, Math.round(x - tmp.width / 2), Math.round(y - tmp.height));
    if (eyes) { g.fillStyle = '#ff3355'; g.fillRect(Math.round(x - 3 * scale), Math.round(y - tmp.height * 0.7), scale, scale); g.fillRect(Math.round(x + 2 * scale), Math.round(y - tmp.height * 0.7), scale, scale); }
  }
  private ground(color: string, y = 150): void { this.g.fillStyle = color; this.g.fillRect(0, y, W, H - y); }

  private draw(scene: CinePanel['scene'], t: number): void {
    const g = this.g;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    switch (scene) {
      case 'book': {
        this.sky('#0b0812', '#2a1848'); this.stars(t);
        this.book(160, 100 + Math.sin(t) * 2, 1, (Math.sin(t * 2) + 1) / 2);
        for (let i = 0; i < 14; i++) { const k = (t * 0.25 + i / 14) % 1; g.fillStyle = '#ffd23a'; g.globalAlpha = 1 - k; g.fillRect(110 + ((i * 37) % 100), 100 - k * 80, 1, 2); }
        g.globalAlpha = 1;
        break;
      }
      case 'pages': {
        this.sky('#120c22', '#3a2460'); this.stars(t, 40);
        this.book(160, 150, 0.8, 0.6);
        for (let i = 0; i < 12; i++) {
          const k = (t * 0.18 + i / 12) % 1;
          this.page(160 + Math.sin(k * 6 + i) * (40 + i * 8), 140 - k * 150, Math.sin(t * 2 + i) * 0.6, Math.min(1, (1 - k) * 2));
        }
        break;
      }
      case 'archivist': {
        this.sky('#08060e', '#2a0c1c'); this.stars(t, 30, '#ff8a9a');
        this.ground('#1b1326', 148);
        const bs = this.bosses();
        bs.slice(0, 2).forEach((id, i) => this.silhouette(id, 62 + i * 196, 148, 2, '#2c1a3a'));
        // l'Archiviste : silhouette en robe au centre, bras levés
        g.fillStyle = '#4a2c6a';
        g.fillRect(152, 96, 16, 52); g.fillRect(148, 120, 24, 28); g.fillRect(155, 86, 10, 12);
        g.fillStyle = '#ffd23a'; g.fillRect(157, 90, 2, 2); g.fillRect(161, 90, 2, 2);
        g.fillStyle = '#4a2c6a'; g.fillRect(140 - Math.sin(t * 3) * 2, 92, 12, 4); g.fillRect(168 + Math.sin(t * 3) * 2, 92, 12, 4);
        for (let i = 0; i < 9; i++) {
          const k = (t * 0.35 + i / 9) % 1, tgt = i % 2;
          const x = 160 + (62 + tgt * 196 - 160) * k, y = 90 + Math.sin(k * 3.14) * -40 + k * 30;
          this.page(x, y, k * 6, 1 - k * 0.6);
        }
        break;
      }
      case 'frozen': {
        const cols = [['#1e4a2a', '#58d858'], ['#2858c8', '#d8f0ff'], ['#5a0a1e', '#ff9a30']];
        cols.forEach(([a, b], i) => {
          const x0 = i * 107;
          const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, a); gr.addColorStop(1, '#0b0812');
          g.fillStyle = gr; g.fillRect(x0, 0, 107, H);
          g.fillStyle = b;
          if (i === 0) for (let k = 0; k < 5; k++) { const tx = x0 + 12 + k * 20; g.beginPath(); g.moveTo(tx, 150); g.lineTo(tx + 9, 95 + (k % 2) * 12); g.lineTo(tx + 18, 150); g.fill(); }
          if (i === 1) { g.fillRect(x0 + 10, 110, 87, 40); g.fillStyle = '#0b0812'; for (let k = 0; k < 40; k++) g.fillRect(x0 + 52 + Math.round(Math.sin(k * 0.7) * 4), 110 + k, 2, 1); }
          if (i === 2) { g.fillRect(x0 + 8, 140, 91, 10); g.globalAlpha = 0.4 + 0.3 * Math.sin(t * 6); g.fillRect(x0 + 30, 100, 47, 40); g.globalAlpha = 1; }
          g.fillStyle = '#0b0812'; g.fillRect(x0 + 106, 0, 1, H);
        });
        // tout est figé : une horloge arrêtée et un léger tremblé
        g.fillStyle = 'rgba(200,208,224,.85)'; g.beginPath(); g.arc(160, 40, 14, 0, 6.29); g.fill();
        g.fillStyle = '#1b1326'; g.fillRect(159, 30, 2, 11); g.fillRect(160, 39, 7, 2);
        if (Math.floor(t * 2) % 2) { g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, 0, W, H); }
        break;
      }
      case 'edictfall': {
        this.sky('#0b0812', '#3a1848'); this.stars(t, 50);
        this.ground('#1b1326', 150);
        const bs = this.bosses();
        const k = Math.min(1, t / 2.5);
        if (bs[0]) { g.globalAlpha = 1 - k; this.silhouette(bs[0], 160, 150, 3, '#2c1a3a', false); g.globalAlpha = 1; }
        for (let i = 0; i < 20; i++) { const a = i * 0.9 + t, r = k * 60 + i; g.fillStyle = i % 2 ? '#ffd23a' : '#c070ff'; g.globalAlpha = 1 - k * 0.7; g.fillRect(160 + Math.cos(a) * r, 120 + Math.sin(a) * r * 0.5, 2, 2); }
        g.globalAlpha = 1;
        const y = 20 + Math.min(1, t / 3) * 85 + Math.sin(t * 2) * 2;
        g.fillStyle = 'rgba(255,210,58,.25)'; g.beginPath(); g.ellipse(160, y + 10, 34, 24, 0, 0, 6.29); g.fill();
        g.fillStyle = '#c8901c'; g.fillRect(146, y - 6, 28, 34);
        g.fillStyle = '#ffd23a'; g.fillRect(148, y - 4, 24, 30);
        g.fillStyle = '#7a5030'; for (let l = 0; l < 6; l++) g.fillRect(151, y + l * 4, 18 - (l % 3) * 3, 1);
        break;
      }
      case 'rature': {
        this.sky('#f4f0e0', '#c8d0e0');
        g.fillStyle = '#8a93a8';
        for (let l = 0; l < 14; l++) for (let c = 0; c < 3; c++) g.fillRect(16 + c * 104, 12 + l * 11, 70 + ((l * 13 + c * 7) % 20), 2);
        // une ligne raturée : c'est toi
        g.fillStyle = '#f4f0e0'; g.fillRect(110, 76, 100, 30);
        g.strokeStyle = '#e0404a'; g.lineWidth = 2; g.beginPath();
        for (let x = 0; x < Math.min(100, t * 80); x += 4) g.lineTo(110 + x, 90 + Math.sin(x * 0.6) * 6);
        g.stroke();
        const hero = this.game.world.players[0]?.hero.sprite ?? 'dummy';
        const s = this.spr(hero, 4);
        if (s) g.drawImage(s, Math.round(160 - s.width / 2), Math.round(150 - s.height + Math.sin(t * 3) * 2));
        break;
      }
      case 'descent': case 'loop': {
        this.sky('#0b0812', scene === 'loop' ? '#2a2242' : '#1e1830'); this.stars(t, 40, '#c9a0ff');
        for (let i = 6; i >= 0; i--) { const r = ((t * 20 + i * 14) % 98) + 2; g.strokeStyle = `rgba(154,112,255,${1 - r / 100})`; g.lineWidth = 1; g.beginPath(); g.ellipse(160, 110, r * 1.4, r * 0.5, 0, 0, 6.29); g.stroke(); }
        const pr = this.spr('portal', 3);
        if (pr) g.drawImage(pr, Math.round(160 - pr.width / 2), Math.round(70 - pr.height / 2 + Math.sin(t * 2) * 2));
        const hero = this.game.world.players[0]?.hero.sprite ?? 'dummy';
        const s = this.spr(hero, 2);
        if (s) g.drawImage(s, Math.round(160 - s.width / 2), Math.round(160 - s.height));
        if (scene === 'loop') { g.fillStyle = '#ffd23a'; g.font = '16px monospace'; g.textAlign = 'center'; g.fillText('∞', 160, 26); }
        break;
      }
      case 'reliure': {
        this.sky('#2a0c1c', '#5a1a10');
        this.ground('#1b1326', 140);
        for (let i = 0; i < 18; i++) { const k = (t * 0.4 + i / 18) % 1; g.fillStyle = '#ff9a30'; g.globalAlpha = 1 - k; g.fillRect((i * 41) % W, 140 - k * 120, 2, 2); }
        g.globalAlpha = 1;
        this.book(160, 105, 1, (Math.sin(t * 3) + 1) / 2, true);
        for (let i = 0; i < 7; i++) this.page(160 + Math.cos(t + i) * (60 - Math.min(50, t * 12)), 80 + Math.sin(t * 1.3 + i) * 20, t + i, 0.9);
        break;
      }
      case 'dawn': {
        const k = Math.min(1, t / 4);
        this.sky(k > 0.5 ? '#ff9ad0' : '#3a2460', '#ffd23a');
        g.fillStyle = '#fff3c0'; g.beginPath(); g.arc(160, 150 - k * 70, 26, 0, 6.29); g.fill();
        g.fillStyle = '#2c8a44';
        for (let x = 0; x < W; x += 18) { g.beginPath(); g.moveTo(x, 160); g.lineTo(x + 9, 118 + ((x * 7) % 20)); g.lineTo(x + 18, 160); g.fill(); }
        this.ground('#1e4a2a', 158);
        this.book(160, 150, 0.4, 1);
        break;
      }
      default: this.sky('#0b0812', '#2a1848'); this.stars(t);
    }
    // grain + vignettage
    g.fillStyle = 'rgba(11,8,18,.35)';
    g.fillRect(0, 0, W, 6); g.fillRect(0, H - 6, W, 6);
  }
}
