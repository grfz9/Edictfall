// Rendu PixiJS : lit l'état du World et le dessine. Aucune logique de jeu ici.
import { Application, Container, Sprite, Texture, Rectangle, Graphics, ColorMatrixFilter } from 'pixi.js';
import type { Fx, DrawAPI, ThemeDef, Player } from '../core/types';
import { R } from '../core/registry';
import { RARITY_HEX } from '../core/damage';
import type { World } from '../sim/world';
import { T, TILE, type Floor } from '../sim/dungeon';
import { getAtlas, glyphId } from './sprites';
import { paintFloor, DEFAULT_THEME, hexNum } from './tiles';

interface Tex { frames: Texture[]; flash: Texture[]; ax: number; ay: number; w: number; h: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number; kind: number; z: number; vz: number; rot: number }
interface FloatText { x: number; y: number; s: string; color: number; t: number; big: boolean }
interface Ring { x: number; y: number; r: number; t: number; color: number }

const STATUS_TINT: Record<string, number> = { burn: 0xffa060, poison: 0x90e060, freeze: 0x80c8ff, shock: 0xffff80, slow: 0xb0b0ff };
const clean = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export class Renderer {
  app!: Application;
  private tex = new Map<string, Tex>();
  private root = new Container();
  private floorSpr = new Sprite();
  private decals = new Container();
  private under = new Graphics();
  private ents = new Container();
  private bulletsC = new Container();
  private over = new Graphics();
  private parts = new Container();
  private labels = new Container();
  private dark!: Sprite;
  private flashG = new Graphics();
  private gray = new ColorMatrixFilter();
  private grayOn = 0;
  cam = { x: 0, y: 0, zoom: 3, shake: 0 };
  private views = new Map<number, Sprite>();
  private pool: Sprite[] = [];
  private frame = 0;
  private time = 0;
  private particles: Particle[] = [];
  private partSprites: Sprite[] = [];
  private texts: FloatText[] = [];
  private rings: Ring[] = [];
  private labelSprites: Sprite[] = [];
  private labelN = 0;
  private flashA = 0;
  /** Effets rejetés car invalides (debug). */
  badFx = 0;
  private flashColor = 0xffffff;
  private floorRef: Floor | null = null;
  private floorRev = -1;
  private theme: ThemeDef = DEFAULT_THEME;
  /** Multiplicateur de tremblement (option joueur). */
  shakeOpt = 1;
  showNumbers = true;
  private draw: DrawAPI;

  constructor() {
    const o = this.over;
    this.draw = {
      circle: (x, y, r, color, alpha = 1, fill = false) => { o.circle(x, y, r); if (fill) o.fill({ color, alpha }); else o.stroke({ width: 1, color, alpha }); },
      line: (x0, y0, x1, y1, color, alpha = 1, width = 1) => { o.moveTo(x0, y0).lineTo(x1, y1).stroke({ width, color, alpha }); },
      rect: (x, y, w, h, color, alpha = 1) => { o.rect(x, y, w, h).fill({ color, alpha }); },
    };
  }

  async init(parent: HTMLElement): Promise<void> {
    const app = (this.app = new Application());
    await app.init({
      background: '#0b0812', resizeTo: window, antialias: false, roundPixels: true,
      resolution: Math.min(window.devicePixelRatio || 1, 3), autoDensity: true, preference: 'webgl', powerPreference: 'high-performance',
    });
    parent.appendChild(app.canvas);
    // atlas
    const atlas = getAtlas();
    const base = Texture.from(atlas.canvas);
    base.source.scaleMode = 'nearest';
    for (const [id, e] of atlas.entries) {
      const mk = (f: { x: number; y: number; w: number; h: number }) => new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
      this.tex.set(id, { frames: e.frames.map(mk), flash: e.flash.map(mk), ax: e.ax, ay: e.ay, w: e.w, h: e.h });
    }
    this.ents.sortableChildren = true;
    this.root.addChild(this.floorSpr, this.decals, this.under, this.ents, this.bulletsC, this.over, this.parts, this.labels);
    app.stage.addChild(this.root);
    // obscurité (règles visuelles)
    const dc = document.createElement('canvas');
    dc.width = dc.height = 1024;
    const g = dc.getContext('2d')!;
    g.fillStyle = '#05030a';
    g.fillRect(0, 0, 1024, 1024);
    const grad = g.createRadialGradient(512, 512, 26, 512, 512, 64);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = grad;
    g.beginPath(); g.arc(512, 512, 64, 0, 7); g.fill();
    const dt = Texture.from(dc);
    dt.source.scaleMode = 'linear';
    this.dark = new Sprite(dt);
    this.dark.anchor.set(0.5);
    this.dark.visible = false;
    app.stage.addChild(this.dark, this.flashG);
  }

  has(id: string): boolean { return this.tex.has(id); }

  // ------------------------------------------------------------------ utilitaires sprites
  private get(key: number, layer: Container): Sprite {
    let s = this.views.get(key);
    if (!s) {
      s = this.pool.pop() ?? new Sprite();
      s.tint = 0xffffff; s.alpha = 1; s.rotation = 0; s.scale.set(1); s.visible = true;
      layer.addChild(s);
      this.views.set(key, s);
    }
    (s as any)._f = this.frame;
    return s;
  }
  private setTex(s: Sprite, id: string, frame = 0, flash = false): Tex {
    const t = this.tex.get(id) ?? this.tex.get('missing')!;
    const arr = flash ? t.flash : t.frames;
    const tx = arr[frame % arr.length];
    if (s.texture !== tx) s.texture = tx;
    s.anchor.set(t.ax, t.ay);
    return t;
  }
  private label(str: string, x: number, y: number, color: number, scale = 1, alpha = 1): void {
    const s = clean(str);
    let cx = Math.round(x - (s.length * 4 * scale) / 2);
    for (let i = 0; i < s.length; i++) {
      const t = this.tex.get(glyphId(s[i]));
      if (t) {
        let sp = this.labelSprites[this.labelN];
        if (!sp) { sp = new Sprite(); this.labelSprites.push(sp); this.labels.addChild(sp); }
        this.labelN++;
        sp.visible = true; sp.texture = t.frames[0]; sp.tint = color; sp.alpha = alpha;
        sp.scale.set(scale); sp.position.set(cx - scale, Math.round(y));
      }
      cx += 4 * scale;
    }
  }

  // ------------------------------------------------------------------ effets
  handleFx(fx: Fx, w: World): void {
    // Un effet aux valeurs invalides (NaN) ne doit jamais contaminer la caméra ou les particules.
    for (const k in fx) { const v = (fx as any)[k]; if (typeof v === 'number' && !Number.isFinite(v)) { this.badFx++; return; } }
    switch (fx.t) {
      case 'shake': this.cam.shake = Math.min(14, Math.max(this.cam.shake, fx.a) + fx.a * 0.25) ; break;
      case 'burst': {
        const n = Math.round(fx.n);
        for (let i = 0; i < n && this.particles.length < 700; i++) {
          const a = Math.random() * 6.283, sp = (fx.speed ?? 60) * (0.3 + Math.random() * 0.9);
          const life = (fx.life ?? 0.35) * (0.6 + Math.random() * 0.7);
          this.particles.push({ x: fx.x, y: fx.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, color: fx.color, size: fx.size ?? 1, kind: 0, z: 0, vz: 0, rot: 0 });
        }
        break;
      }
      case 'casing': {
        const a = fx.dir + (Math.random() - 0.5) * 0.8, sp = 30 + Math.random() * 30;
        if (this.particles.length < 700) this.particles.push({ x: fx.x, y: fx.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 5, max: 5, color: 0xd8a838, size: 1, kind: 1, z: 6, vz: 50 + Math.random() * 30, rot: Math.random() * 6 });
        break;
      }
      case 'text':
        if (!this.showNumbers && /^[-+]?\d+$/.test(fx.s)) break;
        if (this.texts.length < 80) this.texts.push({ x: fx.x + (Math.random() - 0.5) * 8, y: fx.y, s: fx.s, color: fx.color, t: 0, big: !!fx.big });
        break;
      case 'flash': if (fx.a > this.flashA) { this.flashA = fx.a; this.flashColor = fx.color; } break;
      case 'ring': this.rings.push({ x: fx.x, y: fx.y, r: fx.r, t: 0, color: fx.color }); break;
      case 'decal': {
        if (this.decals.children.length > 140) this.decals.removeChildAt(0).destroy();
        const s = new Sprite(this.tex.get('shadow')!.frames[0]);
        s.anchor.set(0.5); s.position.set(fx.x, fx.y); s.scale.set(Math.max(0.6, fx.r / 5), Math.max(0.5, fx.r / 4));
        s.tint = fx.color; s.alpha = 0.16;
        this.decals.addChild(s);
        break;
      }
    }
    void w;
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.root.x) / this.root.scale.x, y: (sy - this.root.y) / this.root.scale.y };
  }
  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: x * this.root.scale.x + this.root.x, y: y * this.root.scale.y + this.root.y };
  }

  private rebuildFloor(w: World): void {
    const changed = this.floorRef !== w.floor;
    this.floorRef = w.floor; this.floorRev = w.floor.rev;
    this.theme = R.themes.get(((w.worldNum - 1) % 3) + 1) ?? DEFAULT_THEME;
    if (w.mode === 'hub' || w.worldNum === 0) this.theme = DEFAULT_THEME;
    const old = this.floorSpr.texture;
    const t = Texture.from(paintFloor(w.floor, this.theme));
    t.source.scaleMode = 'nearest';
    this.floorSpr.texture = t;
    if (old && old !== Texture.EMPTY && old !== Texture.WHITE) old.destroy(true);
    if (changed) {
      for (const c of this.decals.removeChildren()) c.destroy();
      this.particles.length = 0; this.texts.length = 0; this.rings.length = 0;
      const l = w.lead();
      if (l) { this.cam.x = l.x; this.cam.y = l.y; }
    }
  }

  // ------------------------------------------------------------------ frame
  render(w: World, dt: number): void {
    this.frame++;
    this.time += dt;
    const time = this.time;
    if (!w.floor) return;
    if (this.floorRef !== w.floor || this.floorRev !== w.floor.rev) this.rebuildFloor(w);
    const under = this.under, over = this.over;
    under.clear(); over.clear();
    this.labelN = 0;
    const paused = !!w.choice;

    // --- caméra
    const app = this.app, W = app.screen.width, H = app.screen.height, dpr = app.renderer.resolution;
    let zd = Math.max(1, Math.round((H * dpr) / 250));
    zd = Math.max(1, Math.min(zd, Math.floor((W * dpr) / 300)));
    const zoom = (zd / dpr) * w.mods.zoom;
    this.cam.zoom = zoom;
    let tx = 0, ty = 0, n = 0;
    for (const p of w.players) if (!p.downed) { tx += p.x + Math.cos(p.aim) * (w.players.length > 1 ? 0 : 12); ty += p.y + Math.sin(p.aim) * (w.players.length > 1 ? 0 : 12); n++; }
    if (n) {
      const k = 1 - Math.exp(-9 * dt);
      this.cam.x += (tx / n - this.cam.x) * k; this.cam.y += (ty / n - this.cam.y) * k;
    }
    if (!Number.isFinite(this.cam.x) || !Number.isFinite(this.cam.y)) { const l = w.lead(); this.cam.x = l?.x || 0; this.cam.y = l?.y || 0; }
    if (!Number.isFinite(this.cam.shake)) this.cam.shake = 0;
    const sh = this.cam.shake * this.shakeOpt * w.mods.shake;
    this.cam.shake *= Math.exp(-11 * dt);
    if (this.cam.shake < 0.05) this.cam.shake = 0;
    const sx = (Math.random() - 0.5) * 2 * sh, sy = (Math.random() - 0.5) * 2 * sh;
    const snap = (v: number) => Math.round(v * dpr) / dpr;
    const mirror = w.mods.mirror;
    this.root.scale.set(mirror ? -zoom : zoom, zoom);
    this.root.position.set(snap(mirror ? W / 2 + (this.cam.x + sx) * zoom : W / 2 - (this.cam.x + sx) * zoom), snap(H / 2 - (this.cam.y + sy) * zoom));
    if (this.root.tint !== w.mods.tint) this.root.tint = w.mods.tint;
    if (w.mods.grayscale !== this.grayOn) {
      this.grayOn = w.mods.grayscale;
      if (this.grayOn > 0) { this.gray.saturate(-this.grayOn, false); this.root.filters = [this.gray]; }
      else this.root.filters = [];
    }

    // --- portes fermées
    const doorC = hexNum(this.theme.door);
    for (const room of w.floor.rooms) {
      if (!room.locked) continue;
      for (const d of room.doors) {
        const x = d.x * TILE, y = d.y * TILE;
        under.rect(x, y, TILE, TILE).fill({ color: 0x1b1326 });
        under.rect(x + 1, y + 1, TILE - 2, TILE - 2).fill({ color: doorC });
        under.rect(x + 3, y + 3, 2, TILE - 6).fill({ color: 0x1b1326, alpha: 0.5 });
        under.rect(x + 7, y + 3, 2, TILE - 6).fill({ color: 0x1b1326, alpha: 0.5 });
        under.rect(x + 11, y + 3, 2, TILE - 6).fill({ color: 0x1b1326, alpha: 0.5 });
      }
    }

    // --- objets interactifs
    for (const it of w.items) {
      if (it.dead) continue;
      const s = this.get(it.id * 4, this.ents);
      const t = this.setTex(s, it.sprite, it.kind === 'portal' ? Math.floor(time * 6) : 0);
      const bob = it.bob ? Math.sin(time * 3 + it.id) * 1.5 : 0;
      s.position.set(it.x, it.y + bob - (it.kind === 'weapon' || it.kind === 'shopitem' ? 3 : 0));
      s.zIndex = it.y + (it.kind === 'portal' ? -20 : 0);
      s.tint = it.tint ?? 0xffffff;
      s.rotation = it.kind === 'weapon' ? -0.5 : 0;
      if (it.kind === 'weapon' || (it.kind === 'shopitem' && it.weapon)) {
        const c = RARITY_HEX[it.weapon!.rarity];
        under.ellipse(it.x, it.y + 5, 9, 4).fill({ color: c, alpha: 0.28 + Math.sin(time * 4 + it.id) * 0.1 });
      } else if (it.kind === 'portal') {
        under.ellipse(it.x, it.y + t.h / 2 - 2, 12, 4).fill({ color: 0x9a70ff, alpha: 0.3 });
        if (!paused && this.frame % 4 === 0) this.particles.push({ x: it.x + (Math.random() - 0.5) * 16, y: it.y + 8, vx: 0, vy: -20 - Math.random() * 20, life: 0.7, max: 0.7, color: 0xb090ff, size: 1, kind: 0, z: 0, vz: 0, rot: 0 });
      } else under.ellipse(it.x, it.y + t.h / 2 - 1, t.w * 0.38, 3).fill({ color: 0, alpha: 0.28 });
      if (it.kind === 'shopitem') this.label(String(w.priceOf(it)), it.x, it.y + 9, w.coins >= w.priceOf(it) ? 0xffd23a : 0xff6677);
      if (it.kind === 'hero' && it.tint !== undefined && it.tint !== 0xffffff) {
        const h = R.heroes.get(it.data?.hero);
        if (h) this.label(String(h.cost), it.x, it.y + 12, 0xc070ff);
      }
    }
    for (const c of w.chests) {
      if (c.dead) continue;
      const s = this.get(c.id * 4, this.ents);
      this.setTex(s, (c.kind === 'big' ? 'chest_big' : 'chest') + (c.opened ? '_open' : ''));
      s.position.set(c.x, c.y); s.zIndex = c.y;
      under.ellipse(c.x, c.y + 6, 8, 3).fill({ color: 0, alpha: 0.3 });
    }
    for (const p of w.props) {
      if (p.dead) continue;
      const s = this.get(p.id * 4, this.ents);
      this.setTex(s, p.kind, 0, p.flash > 0);
      s.position.set(p.x, p.y - 2); s.zIndex = p.y;
      under.ellipse(p.x, p.y + 5, 7, 3).fill({ color: 0, alpha: 0.3 });
    }
    for (const k of w.pickups) {
      const s = this.get(k.id * 4, this.ents);
      this.setTex(s, 'pk_' + k.kind, Math.floor(time * 6 + k.id));
      s.position.set(k.x, k.y - 2 - Math.abs(Math.sin(time * 5 + k.id)) * 2); s.zIndex = k.y - 6;
    }
    for (const pet of w.pets) {
      const key = (pet.owner.id * 4 + 3);
      const s = this.get(key, this.ents);
      this.setTex(s, pet.def.sprite, Math.floor(time * 5));
      s.position.set(pet.x, pet.y - 2 - Math.abs(Math.sin(time * 6)) * 1.5); s.zIndex = pet.y; s.scale.set(pet.facing, 1);
      under.ellipse(pet.x, pet.y + 4, 5, 2).fill({ color: 0, alpha: 0.3 });
    }

    // --- ennemis
    for (const e of w.enemies) {
      if (e.dead) continue;
      const r = e.radius * e.scale;
      if (e.spawnT > 0) {
        const k = Math.min(1, e.spawnT / 0.7);
        under.circle(e.x, e.y, r * (0.4 + k)).stroke({ width: 1, color: 0xff4466, alpha: 0.9 - k * 0.5 });
        under.circle(e.x, e.y, r * 0.5 * (1 - k)).fill({ color: 0xff4466, alpha: 0.5 });
        continue;
      }
      under.ellipse(e.x, e.y + r * 0.85, r * 0.9, Math.max(2, r * 0.3)).fill({ color: 0, alpha: 0.3 });
      if (e.elite || e.champion) under.circle(e.x, e.y + r * 0.4, r * 1.35 + Math.sin(time * 6) * 1).stroke({ width: 1, color: e.champion ? 0xff5040 : 0xffd23a, alpha: 0.8 });
      const s = this.get(e.id * 4, this.ents);
      const tele = e.tele > 0 || e.data.windup > 0;
      const blink = tele && Math.floor(time * 20) % 2 === 0;
      const moving = Math.abs(e.vx) + Math.abs(e.vy) > 4;
      this.setTex(s, e.def.sprite, moving ? Math.floor(time * 6 + e.id) : Math.floor(time * 2.5 + e.id), e.flash > 0 || blink);
      const sq = 1 + Math.sin(time * 7 + e.id) * 0.04;
      s.scale.set(e.scale * e.facing, e.scale * sq);
      s.position.set(e.x, e.y - (moving ? Math.abs(Math.sin(time * 9 + e.id)) * 1.5 : 0));
      s.zIndex = e.y + r * 0.5;
      let tint = 0xffffff;
      for (const k in e.status) { tint = STATUS_TINT[k] ?? tint; }
      if (e.charmed) tint = 0xff90d0;
      s.tint = tint;
      if (tele) this.label('!', e.x, e.y - r - 9, 0xff4455);
    }

    // --- joueurs
    for (const p of w.players) this.drawPlayer(w, p, time);

    // --- balles
    for (const b of w.bullets) {
      if (b.dead) continue;
      const enemy = b.team === 'enemy';
      if (b.kind === 'shot') {
        const s = this.get(b.id * 4, this.bulletsC);
        this.setTex(s, b.sprite ?? (enemy ? 'eb_round' : 'b_round'));
        s.position.set(b.x, b.y);
        s.rotation = b.dir + (b.spin ?? 0) * b.age;
        s.tint = b.color ?? 0xffffff;
        s.scale.set(b.scale ?? 1);
        if (b.trail !== undefined && !paused && this.frame % 2 === 0 && this.particles.length < 600) this.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.22, max: 0.22, color: b.trail, size: 1, kind: 0, z: 0, vz: 0, rot: 0 });
      } else if (b.kind === 'lob') {
        const t = Math.min(1, b.age / b.life), h = Math.sin(Math.PI * t) * 28;
        const s = this.get(b.id * 4, this.bulletsC);
        this.setTex(s, b.sprite ?? (enemy ? 'eb_orb' : 'b_round'));
        s.position.set(b.x, b.y - h); s.tint = b.color ?? 0xffffff; s.scale.set((b.scale ?? 1) * (1 + Math.sin(Math.PI * t) * 0.4)); s.rotation = time * 8;
        under.ellipse(b.x, b.y, 3, 1.5).fill({ color: 0, alpha: 0.35 });
        const rad = (b.explode?.radius ?? 16) * w.mods.explosionSize;
        const col = enemy ? 0xff3355 : 0xffc04a;
        under.circle(b.tx!, b.ty!, rad).stroke({ width: 1, color: col, alpha: 0.75 });
        under.circle(b.tx!, b.ty!, rad * t).fill({ color: col, alpha: 0.22 });
      } else if (b.kind === 'slash') {
        const t = Math.min(1, b.age / b.life), range = b.range ?? 26, arc = b.arc ?? 1.8;
        const col = b.color ?? (enemy ? 0xff6677 : 0xffffff);
        const a0 = b.dir - arc / 2 + arc * t * 0.25, a1 = b.dir + arc / 2;
        over.moveTo(b.x + Math.cos(a0) * range, b.y + Math.sin(a0) * range).arc(b.x, b.y, range, a0, a1).stroke({ width: 4 * (1 - t) + 1, color: col, alpha: 1 - t * 0.8 });
        over.moveTo(b.x + Math.cos(a0) * range * 0.7, b.y + Math.sin(a0) * range * 0.7).arc(b.x, b.y, range * 0.7, a0, a1).stroke({ width: 2, color: col, alpha: 0.35 * (1 - t) });
      } else if (b.kind === 'beam' && b.pts) {
        const t = Math.min(1, b.age / b.life), col = b.color ?? (enemy ? 0xff3355 : 0x7ae8ff);
        const warn = b.data?.warn;
        const wd = warn ? 1 : Math.max(1, (b.width ?? 3) * (1 - t * 0.7));
        over.moveTo(b.pts[0], b.pts[1]);
        for (let i = 2; i < b.pts.length; i += 2) over.lineTo(b.pts[i], b.pts[i + 1]);
        over.stroke({ width: wd, color: col, alpha: warn ? 0.35 + (Math.floor(time * 16) % 2) * 0.35 : 1 - t * 0.6 });
        if (!warn && wd > 2) {
          over.moveTo(b.pts[0], b.pts[1]);
          for (let i = 2; i < b.pts.length; i += 2) over.lineTo(b.pts[i], b.pts[i + 1]);
          over.stroke({ width: Math.max(1, wd * 0.4), color: 0xffffff, alpha: 1 - t });
        }
      }
    }

    // --- particules
    const ps = this.particles;
    let pn = 0;
    const px = this.tex.get('px')!.frames[0];
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!paused) {
        p.life -= dt;
        if (p.kind === 1) {
          // douille : rebondit puis reste au sol
          if (p.z > 0 || p.vz > 0) {
            p.vz -= 260 * dt; p.z += p.vz * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += 14 * dt;
            if (p.z <= 0) { p.z = 0; if (p.vz < -40) { p.vz = -p.vz * 0.4; p.vx *= 0.5; p.vy *= 0.5; } else p.vz = 0; }
          }
        } else {
          p.x += p.vx * dt; p.y += p.vy * dt;
          const d = Math.exp(-4 * dt); p.vx *= d; p.vy *= d;
        }
      }
      if (p.life <= 0) continue;
      ps[pn] = p;
      let s = this.partSprites[pn];
      if (!s) { s = new Sprite(px); s.anchor.set(0.5); this.partSprites.push(s); this.parts.addChild(s); }
      s.visible = true; s.tint = p.color;
      if (p.kind === 1) { s.position.set(p.x, p.y - p.z); s.scale.set(2, 1); s.rotation = p.rot; s.alpha = Math.min(1, p.life); }
      else { s.position.set(p.x, p.y); const k = p.life / p.max; s.scale.set(p.size * (0.5 + k)); s.rotation = 0; s.alpha = Math.min(1, k * 2); }
      pn++;
    }
    ps.length = pn;
    for (let i = pn; i < this.partSprites.length; i++) { if (!this.partSprites[i].visible) break; this.partSprites[i].visible = false; }

    // --- anneaux d'explosion
    let rn = 0;
    for (const r of this.rings) {
      if (!paused) r.t += dt * 3.2;
      if (r.t >= 1) continue;
      this.rings[rn++] = r;
      const e = 1 - (1 - r.t) * (1 - r.t);
      over.circle(r.x, r.y, r.r * e).stroke({ width: 3 * (1 - r.t) + 1, color: r.color, alpha: 1 - r.t });
      if (r.t < 0.35) over.circle(r.x, r.y, r.r * e * 0.8).fill({ color: 0xffffff, alpha: 0.5 * (1 - r.t / 0.35) });
    }
    this.rings.length = rn;

    // --- rendu libre des règles
    for (const inst of w.rules.order()) {
      if (inst.def.render && !inst.muted) {
        try { inst.def.render(w.ctx, this.draw, inst); } catch { inst.muted = true; }
      }
    }

    // --- textes flottants
    let tn = 0;
    for (const t of this.texts) {
      if (!paused) t.t += dt;
      if (t.t > 0.75) continue;
      this.texts[tn++] = t;
      const k = t.t / 0.75;
      this.label(t.s, t.x, t.y - 14 * (1 - (1 - k) * (1 - k)) - (t.big ? 3 : 0), t.color, t.big ? 2 : 1, k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
    }
    this.texts.length = tn;
    for (let i = this.labelN; i < this.labelSprites.length; i++) { if (!this.labelSprites[i].visible) break; this.labelSprites[i].visible = false; }

    // --- balayage des vues orphelines
    for (const [key, s] of this.views) {
      if ((s as any)._f !== this.frame) {
        s.parent?.removeChild(s);
        this.views.delete(key);
        this.pool.push(s);
      }
    }

    // --- obscurité & flash
    const dk = w.mods.darkness;
    this.dark.visible = dk > 0;
    if (dk > 0) {
      const l = w.lead();
      const sp = this.worldToScreen(l.x, l.y);
      this.dark.position.set(sp.x, sp.y);
      this.dark.scale.set((dk * zoom) / 64);
    }
    this.flashG.clear();
    if (this.flashA > 0.01) {
      this.flashG.rect(0, 0, W, H).fill({ color: this.flashColor, alpha: this.flashA });
      this.flashA *= Math.exp(-7 * dt);
    }
  }

  private drawPlayer(w: World, p: Player, time: number): void {
    const s = this.get(p.id * 4, this.ents);
    const sc = p.mods.playerScale;
    if (p.downed) {
      this.setTex(s, p.hero.sprite);
      s.position.set(p.x, p.y + 3); s.rotation = Math.PI / 2; s.tint = 0x666677; s.alpha = 0.8; s.zIndex = p.y - 8; s.scale.set(sc);
      return;
    }
    this.under.ellipse(p.x, p.y + 6 * sc, 6 * sc, 2.5 * sc).fill({ color: 0, alpha: 0.32 });
    this.setTex(s, p.hero.sprite, p.moving ? Math.floor(time * 9) : 0, p.flash > 0);
    s.rotation = 0;
    s.position.set(p.x, p.y - 2 - (p.moving ? Math.abs(Math.sin(time * 14)) * 1.5 : Math.sin(time * 3) * 0.5));
    s.scale.set(p.facing * sc, sc);
    s.alpha = p.invuln > 0 && Math.floor(time * 24) % 2 === 0 ? 0.35 : 1;
    s.zIndex = p.y;
    let tint = 0xffffff;
    for (const k in p.status) tint = STATUS_TINT[k] ?? tint;
    s.tint = tint;
    if (p.skillT > 0) this.under.circle(p.x, p.y, 11 + Math.sin(time * 10) * 1.5).stroke({ width: 1, color: 0x9ae8ff, alpha: 0.9 });
    const wi = p.weapons[p.cur];
    if (!wi) return;
    const ws = this.get(p.id * 4 + 1, this.ents);
    this.setTex(ws, wi.def.sprite);
    let rot = p.aim;
    const melee = wi.def.bullet.kind === 'slash';
    if (melee) {
      const arc = wi.def.bullet.arc ?? 1.8;
      rot += p.swing > 0 ? (0.5 - p.swing / 0.18) * arc * p.facing : -0.9 * p.facing;
    }
    const d = 3 - p.recoil;
    ws.position.set(p.x + Math.cos(p.aim) * d, p.y + 2 + Math.sin(p.aim) * d);
    ws.rotation = rot;
    ws.scale.set(sc, p.facing * sc);
    ws.zIndex = p.y + (Math.sin(p.aim) < -0.3 ? -1 : 1);
    ws.alpha = s.alpha;
    if (wi.charge > 0) {
      this.over.rect(p.x - 8, p.y - 15, 16, 3).fill({ color: 0x1b1326 });
      this.over.rect(p.x - 7, p.y - 14, 14 * wi.charge, 1).fill({ color: wi.charge >= 0.99 ? 0xffffff : 0xffd23a });
    }
    void w;
  }
}
