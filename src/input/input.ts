// Entrées : clavier + souris, manettes (jusqu'à 2), tactile (deux joysticks virtuels + boutons).
import type { PlayerInput } from '../core/types';
import { emptyInput } from '../sim/world';

interface Stick { id: number; ox: number; oy: number; x: number; y: number; el: HTMLElement; knob: HTMLElement }

export class Input {
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private mouse = { x: 0, y: 0, down: false, right: false, lastMove: -99, wheel: 0, clicked: false, rclicked: false };
  private left: Stick | null = null;
  private right: Stick | null = null;
  private touchBtn = { skill: false, swap: false, fireEdge: false };
  private padPrev: boolean[][] = [[], []];
  private time = 0;
  /** Dernier périphérique utilisé : adapte les invites à l'écran. */
  device: 'kb' | 'pad' | 'touch' = 'kb';
  touchVisible = false;
  onPause: () => void = () => {};
  /** Appelé au premier geste utilisateur (déverrouille l'audio). */
  onFirstGesture: () => void = () => {};
  private gestured = false;
  private layer: HTMLElement;

  constructor(private canvas: HTMLElement, layer: HTMLElement) {
    this.layer = layer;
    const gesture = () => { if (!this.gestured) { this.gestured = true; this.onFirstGesture(); } };
    window.addEventListener('keydown', (e) => {
      gesture();
      if (e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      this.keys.add(e.code); this.pressed.add(e.code);
      this.device = 'kb';
      if (e.code === 'Escape' || e.code === 'KeyP') this.onPause();
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = this.mouse.right = false; });
    canvas.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.lastMove = this.time; });
    canvas.addEventListener('mousedown', (e) => {
      gesture();
      this.device = 'kb';
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.lastMove = this.time;
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rclicked = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.right = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    this.buildTouch(gesture);
  }

  // ------------------------------------------------------------------ tactile
  private buildTouch(gesture: () => void): void {
    const L = this.layer;
    L.innerHTML = `
      <div class="tz tz-left"></div><div class="tz tz-right"></div>
      <div class="tstick ts-left"><div class="tknob"></div></div>
      <div class="tstick ts-right"><div class="tknob"></div></div>
      <button class="tbtn tb-skill" data-b="skill">★</button>
      <button class="tbtn tb-swap" data-b="swap">⇄</button>`;
    const mk = (zone: string, stick: string, side: 'left' | 'right') => {
      const z = L.querySelector(zone) as HTMLElement, el = L.querySelector(stick) as HTMLElement, knob = el.querySelector('.tknob') as HTMLElement;
      const place = (s: Stick) => {
        el.style.left = s.ox + 'px'; el.style.top = s.oy + 'px'; el.classList.add('on');
        const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), m = Math.min(d, 46) / (d || 1);
        knob.style.transform = `translate(${dx * m}px, ${dy * m}px)`;
      };
      z.addEventListener('pointerdown', (e) => {
        gesture();
        this.device = 'touch';
        this.showTouch(true);
        if (this[side]) return;
        z.setPointerCapture(e.pointerId);
        const s: Stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, el, knob };
        this[side] = s;
        if (side === 'right') this.touchBtn.fireEdge = true;
        place(s);
        e.preventDefault();
      });
      z.addEventListener('pointermove', (e) => { const s = this[side]; if (s && s.id === e.pointerId) { s.x = e.clientX; s.y = e.clientY; place(s); } });
      const end = (e: PointerEvent) => { const s = this[side]; if (s && s.id === e.pointerId) { this[side] = null; el.classList.remove('on'); knob.style.transform = ''; } };
      z.addEventListener('pointerup', end);
      z.addEventListener('pointercancel', end);
    };
    mk('.tz-left', '.ts-left', 'left');
    mk('.tz-right', '.ts-right', 'right');
    L.querySelectorAll<HTMLElement>('.tbtn').forEach((b) => {
      b.addEventListener('pointerdown', (e) => { gesture(); this.device = 'touch'; (this.touchBtn as any)[b.dataset.b!] = true; e.preventDefault(); e.stopPropagation(); });
    });
    window.addEventListener('touchstart', () => { this.device = 'touch'; this.showTouch(true); }, { passive: true });
  }
  /** Affiche/masque les contrôles tactiles ('auto' : visibles dès le premier toucher). */
  showTouch(on: boolean): void {
    if (this.touchForce === 'off') on = false;
    if (this.touchForce === 'on') on = true;
    this.touchVisible = on;
    this.layer.classList.toggle('show', on);
  }
  touchForce: 'auto' | 'on' | 'off' = 'auto';
  setTouchMode(m: 'auto' | 'on' | 'off'): void {
    this.touchForce = m;
    this.showTouch(m === 'on' || (m === 'auto' && (this.device === 'touch' || matchMedia('(pointer: coarse)').matches)));
  }
  /** Active/désactive la capture tactile (désactivée dans les menus). */
  setTouchActive(on: boolean): void { this.layer.classList.toggle('active', on); if (!on) { this.left = this.right = null; } }

  // ------------------------------------------------------------------ lecture
  /** Retourne les entrées de chaque joueur. origins = position écran de chaque joueur (visée souris). focus = objet interactif à portée de J1. */
  poll(dt: number, count: number, origins: { x: number; y: number }[], focus: boolean): PlayerInput[] {
    this.time += dt;
    const out: PlayerInput[] = [];
    const pads = (navigator.getGamepads?.() ?? []).filter((g): g is Gamepad => !!g && g.connected);
    const k = (c: string) => this.keys.has(c), kp = (c: string) => this.pressed.has(c);
    const coopKb = count > 1 && pads.length === 0;

    // ---- J1 : clavier + souris + tactile (+ manette 0 si elle n'est pas prise par J2)
    const p1 = emptyInput();
    p1.mx = (k('KeyD') || (!coopKb && k('ArrowRight')) ? 1 : 0) - (k('KeyA') || (!coopKb && k('ArrowLeft')) ? 1 : 0);
    p1.my = (k('KeyS') || (!coopKb && k('ArrowDown')) ? 1 : 0) - (k('KeyW') || (!coopKb && k('ArrowUp')) ? 1 : 0);
    p1.fire = this.mouse.down || k('KeyJ');
    p1.firePressed = this.mouse.clicked || kp('KeyJ');
    p1.skill = kp('Space') || this.mouse.rclicked || kp('KeyK');
    p1.swap = kp('KeyQ') || kp('Tab') || kp('KeyL') || this.mouse.wheel !== 0;
    p1.interact = kp('KeyE') || kp('KeyF');
    if (this.time - this.mouse.lastMove < 4 || this.mouse.down) {
      const o = origins[0];
      if (o) { p1.ax = this.mouse.x - o.x; p1.ay = this.mouse.y - o.y; }
    }
    if (this.left) {
      const dx = this.left.x - this.left.ox, dy = this.left.y - this.left.oy, d = Math.hypot(dx, dy);
      if (d > 8) { const m = Math.min(1, d / 46) / d; p1.mx = dx * m; p1.my = dy * m; }
    }
    if (this.right) {
      const dx = this.right.x - this.right.ox, dy = this.right.y - this.right.oy, d = Math.hypot(dx, dy);
      p1.fire = true;
      if (d > 18) { p1.ax = dx; p1.ay = dy; p1.aimManual = true; }
    }
    if (this.touchBtn.fireEdge) { p1.firePressed = true; if (focus) { p1.interact = true; } }
    if (this.touchBtn.skill) p1.skill = true;
    if (this.touchBtn.swap) p1.swap = true;
    out.push(p1);

    // ---- manettes
    const padInput = (g: Gamepad, slot: number, into: PlayerInput) => {
      const b = (i: number) => !!g.buttons[i]?.pressed || (g.buttons[i]?.value ?? 0) > 0.4;
      const prev = this.padPrev[slot];
      const edge = (i: number) => b(i) && !prev[i];
      const dz = (v: number) => (Math.abs(v) < 0.22 ? 0 : v);
      const lx = dz(g.axes[0] ?? 0), ly = dz(g.axes[1] ?? 0), rx = g.axes[2] ?? 0, ry = g.axes[3] ?? 0;
      const dx = (b(15) ? 1 : 0) - (b(14) ? 1 : 0), dy = (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
      if (lx || ly || dx || dy) { into.mx = lx || dx; into.my = ly || dy; this.device = slot === 0 && count === 1 ? 'pad' : this.device; }
      if (Math.hypot(rx, ry) > 0.45) { into.ax = rx; into.ay = ry; into.aimManual = true; into.fire = true; }
      if (b(7) || b(5) || b(0)) into.fire = true;
      if (edge(7) || edge(5) || edge(0)) { into.firePressed = true; if (slot === 0 && count === 1) this.device = 'pad'; }
      if (edge(2)) into.interact = true;
      if (edge(3)) into.swap = true;
      if (edge(1) || edge(4) || edge(6)) into.skill = true;
      if (edge(9)) this.onPause();
      this.padPrev[slot] = g.buttons.map((_, i) => b(i));
    };
    if (count === 1) { if (pads[0]) padInput(pads[0], 0, p1); }
    else {
      const p2 = emptyInput();
      if (pads.length >= 2) { padInput(pads[0], 0, p1); padInput(pads[1], 1, p2); }
      else if (pads.length === 1) padInput(pads[0], 1, p2);
      else {
        p2.mx = (k('ArrowRight') ? 1 : 0) - (k('ArrowLeft') ? 1 : 0);
        p2.my = (k('ArrowDown') ? 1 : 0) - (k('ArrowUp') ? 1 : 0);
        p2.fire = k('Numpad0') || k('ControlRight') || k('Period');
        p2.firePressed = kp('Numpad0') || kp('ControlRight') || kp('Period');
        p2.skill = kp('ShiftRight') || kp('Numpad1');
        p2.swap = kp('Numpad2') || kp('Slash');
        p2.interact = kp('Enter') || kp('NumpadEnter');
      }
      out.push(p2);
    }
    return out;
  }
  /** Une manette a-t-elle appuyé sur un bouton (pour rejoindre en coop / valider un menu) ? */
  anyPadButton(): boolean {
    for (const g of navigator.getGamepads?.() ?? []) if (g && g.buttons.some((b) => b.pressed)) return true;
    return false;
  }
  padCount(): number { return (navigator.getGamepads?.() ?? []).filter((g) => g && g.connected).length; }
  keyPressed(code: string): boolean { return this.pressed.has(code); }
  /** À appeler en fin de frame : efface les fronts montants. */
  endFrame(): void {
    this.pressed.clear();
    this.mouse.clicked = this.mouse.rclicked = false;
    this.mouse.wheel = 0;
    this.touchBtn.skill = this.touchBtn.swap = this.touchBtn.fireEdge = false;
  }
}
