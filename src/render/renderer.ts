// Rendu PixiJS : lit l'état du World et le dessine. Aucune logique de jeu ici.
// Couches (de bas en haut) : root[sol, tuiles animées, décalques, torches, ombres, entités, traînées, balles, effets,
// particules] → assombrissement d'ambiance → lumières additives (halos, lucioles, braises) → textes → vignette → obscurité → flash.
// Zéro allocation par image dans les chemins chauds : sprites et objets (particules, textes, lumières) sont recyclés.
import { Application, Container, Sprite, Texture, Rectangle, Graphics, ColorMatrixFilter } from 'pixi.js';
import type { Fx, DrawAPI, ThemeDef, Player, WeaponDef } from '../core/types';
import { R } from '../core/registry';
import { RARITY_HEX } from '../core/damage';
import type { World } from '../sim/world';
import { TILE, type Floor } from '../sim/dungeon';
import { getAtlas, glyphId } from './sprites';
import { paintFloor, paintAnimTiles, ANIM_FRAMES, DEFAULT_THEME, hexNum, emptyFeatures, type FloorFeatures } from './tiles';
import { styleFor, type WorldStyle } from './style';

interface Tex { frames: Texture[]; flash: Texture[]; ax: number; ay: number; w: number; h: number; color: number }
/** kind : 0 étincelle · 1 douille · 2 éclat coloré · 3 pixel qui s'élève · 4 cartouche · 5 poussière */
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number; kind: number; z: number; vz: number; rot: number }
interface FloatText { x: number; y: number; vx: number; s: string; color: number; t: number; big: boolean; num: boolean }
interface Ring { x: number; y: number; r: number; t: number; color: number }
interface Light { x: number; y: number; r: number; color: number; a: number; t: number; dur: number }
interface Amb { x: number; y: number; vx: number; vy: number; ph: number; kind: number; color: number; size: number; on: boolean }
interface Corpse { s: Sprite; t: number; dur: number; x: number; y: number; sx: number; sy: number; h: number; color: number; tid: string; fr: number; big: boolean }
/** État visuel propre à chaque joueur (visée lissée, flash de bouche, changement d'arme…). */
interface PState { aim: number; shot: unknown; wdef: WeaponDef | null; swapT: number; muzzleT: number; muzzleFr: number; muzzleColor: number; smoke: boolean; sign: number; melee: number }
type VSprite = Sprite & { _f?: number; _en?: number; _tid?: string; _fr?: number; _col?: number; _big?: boolean; _fl?: number; _hit?: number; _open?: boolean };

const STATUS_TINT: Record<string, number> = { burn: 0xffa060, poison: 0x90e060, freeze: 0x80c8ff, shock: 0xffff80, slow: 0xb0b0ff };
const STATUS_FX: Record<string, number> = { burn: 0xff8030, poison: 0x70d840, freeze: 0xd8f0ff, shock: 0xffff80 };
const PICKUP_GLOW: Record<string, number> = { coin: 0xffd23a, energy: 0x58c0e8, hp: 0xff4455, gem: 0xc070ff };
const clean = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const NUM = /^[-+]?\d+$/;
const TAU = Math.PI * 2;
function mixColor(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return ((r & 255) << 16) | ((g & 255) << 8) | (bl & 255);
}

/** Réserve de sprites rejouée à chaque image (take → … → end masque le reste). */
class SPool {
  arr: Sprite[] = [];
  n = 0;
  constructor(readonly c: Container, readonly blend: 'add' | 'normal' = 'normal') {}
  take(tex: Texture): Sprite {
    let s = this.arr[this.n];
    if (!s) { s = new Sprite(tex); s.blendMode = this.blend; this.arr.push(s); this.c.addChild(s); }
    this.n++;
    if (s.texture !== tex) s.texture = tex;
    s.visible = true; s.anchor.set(0.5); s.rotation = 0; s.scale.set(1); s.alpha = 1; s.tint = 0xffffff;
    return s;
  }
  end(): void {
    for (let i = this.n; i < this.arr.length; i++) { if (!this.arr[i].visible) break; this.arr[i].visible = false; }
    this.n = 0;
  }
}

export class Renderer {
  app!: Application;
  private tex = new Map<string, Tex>();
  private root = new Container();
  private floorSpr = new Sprite();
  private hazC = new Container();
  private decals = new Container();
  private torchC = new Container();
  private under = new Graphics();
  private ents = new Container();
  private trailC = new Container();
  private bulletsC = new Container();
  private fxC = new Container();
  private over = new Graphics();
  private parts = new Container();
  private lightRoot = new Container();
  private topRoot = new Container();
  private labels = new Container();
  private dimSpr = new Sprite(Texture.WHITE);
  private vignette!: Sprite;
  private dark!: Sprite;
  private flashG = new Graphics();
  private gray = new ColorMatrixFilter();
  private grayOn = 0;
  cam = { x: 0, y: 0, zoom: 3, shake: 0 };
  private views = new Map<number, VSprite>();
  private pool: VSprite[] = [];
  private frame = 0;
  private time = 0;
  private particles: Particle[] = [];
  private partFree: Particle[] = [];
  private partSprites: Sprite[] = [];
  private texts: FloatText[] = [];
  private textFree: FloatText[] = [];
  private rings: Ring[] = [];
  private lights: Light[] = [];
  private lightFree: Light[] = [];
  private amb: Amb[] = [];
  private corpses: Corpse[] = [];
  private labelSprites: Sprite[] = [];
  private labelN = 0;
  private flashA = 0;
  /** Effets rejetés car invalides (debug). */
  badFx = 0;
  private flashColor = 0xffffff;
  private floorRef: Floor | null = null;
  private floorRev = -1;
  private theme: ThemeDef = DEFAULT_THEME;
  private style: WorldStyle = styleFor(0);
  private feats: FloorFeatures = emptyFeatures();
  private animTheme: ThemeDef | null = null;
  private animTex: Texture[] = [];
  private animFrame = -1;
  private hazSprites: Sprite[] = [];
  private hazN = 0;
  private torchSprites: Sprite[] = [];
  private decalSprites: Sprite[] = [];
  private decalI = 0;
  private pstate = new Map<number, PState>();
  private noCorpse = false;
  private trails!: SPool;
  private fxp!: SPool;
  private glows!: SPool;
  private ambP!: SPool;
  private glowTex!: Texture;
  private pxTex!: Texture;
  // vue courante (monde) pour le tri des éléments hors champ
  private vx0 = 0; private vy0 = 0; private vx1 = 0; private vy1 = 0;
  /** Multiplicateur de tremblement (option joueur). */
  shakeOpt = 1;
  showNumbers = true;
  /** Mode performance : 'auto' bascule seul si les FPS tombent sous 45. */
  perfMode: 'auto' | 'on' | 'off' = 'auto';
  perf = false;
  fpsAvg = 60;
  private lowT = 0;
  private highT = 0;
  private draw: DrawAPI;

  constructor() {
    const o = this.over;
    this.draw = {
      circle: (x, y, r, color, alpha = 1, fill = false) => { o.circle(x, y, r); if (fill) o.fill({ color, alpha }); else o.stroke({ width: 1, color, alpha }); },
      line: (x0, y0, x1, y1, color, alpha = 1, width = 1) => { o.moveTo(x0, y0).lineTo(x1, y1).stroke({ width, color, alpha }); },
      rect: (x, y, w, h, color, alpha = 1) => { o.rect(x, y, w, h).fill({ color, alpha }); },
    };
  }

  // plafonds (réduits en mode performance)
  private get maxParts() { return this.perf ? 260 : 700; }
  private get maxGlows() { return this.perf ? 45 : 170; }
  private get maxCorpses() { return this.perf ? 8 : 28; }

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
      this.tex.set(id, { frames: e.frames.map(mk), flash: e.flash.map(mk), ax: e.ax, ay: e.ay, w: e.w, h: e.h, color: e.color });
    }
    this.pxTex = this.tex.get('px')!.frames[0];
    this.ents.sortableChildren = true;
    this.root.addChild(this.floorSpr, this.hazC, this.decals, this.torchC, this.under, this.ents, this.trailC, this.bulletsC, this.fxC, this.over, this.parts);
    const ambC = new Container(), glowC = new Container();
    this.lightRoot.addChild(glowC, ambC);
    this.topRoot.addChild(this.labels);
    this.trails = new SPool(this.trailC);
    this.fxp = new SPool(this.fxC);
    this.glows = new SPool(glowC, 'add');
    this.ambP = new SPool(ambC, 'add');
    // halo : dégradé radial doux (filtrage linéaire)
    const gc = document.createElement('canvas');
    gc.width = gc.height = 64;
    const gg = gc.getContext('2d')!;
    const gr = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    gg.fillStyle = gr; gg.fillRect(0, 0, 64, 64);
    this.glowTex = Texture.from(gc);
    this.glowTex.source.scaleMode = 'linear';
    // vignette
    const vc = document.createElement('canvas');
    vc.width = vc.height = 256;
    const vg = vc.getContext('2d')!;
    const vgr = vg.createRadialGradient(128, 128, 70, 128, 128, 182);
    vgr.addColorStop(0, 'rgba(0,0,0,0)'); vgr.addColorStop(0.6, 'rgba(0,0,0,0.35)'); vgr.addColorStop(1, 'rgba(0,0,0,0.95)');
    vg.fillStyle = vgr; vg.fillRect(0, 0, 256, 256);
    const vt = Texture.from(vc);
    vt.source.scaleMode = 'linear';
    this.vignette = new Sprite(vt);
    app.stage.addChild(this.root, this.dimSpr, this.lightRoot, this.topRoot, this.vignette);
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
  private idleCache = new Map<string, string | null>();
  /** Sprite de repos « <id>_idle » s'il existe (mis en cache : aucune chaîne créée par image). */
  private idleOf(id: string): string | null {
    let v = this.idleCache.get(id);
    if (v === undefined) { v = this.tex.has(id + '_idle') ? id + '_idle' : null; this.idleCache.set(id, v); }
    return v;
  }

  // ------------------------------------------------------------------ utilitaires sprites
  private get(key: number, layer: Container): VSprite {
    let s = this.views.get(key);
    if (!s) {
      s = this.pool.pop() ?? (new Sprite() as VSprite);
      s.tint = 0xffffff; s.alpha = 1; s.rotation = 0; s.scale.set(1); s.visible = true;
      s._en = 0; s._fl = 0; s._hit = 0; s._open = undefined;
      layer.addChild(s);
      this.views.set(key, s);
    }
    s._f = this.frame;
    return s;
  }
  private setTex(s: VSprite, id: string, frame = 0, flash = false): Tex {
    const t = this.tex.get(id) ?? this.tex.get('missing')!;
    const arr = flash ? t.flash : t.frames;
    const tx = arr[frame % arr.length];
    if (s.texture !== tx) s.texture = tx;
    s.anchor.set(t.ax, t.ay);
    s._tid = id; s._fr = frame % arr.length;
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
  private inView(x: number, y: number, m = 24): boolean {
    return x > this.vx0 - m && x < this.vx1 + m && y > this.vy0 - m && y < this.vy1 + m;
  }
  /** Halo additif (lumière). */
  private glow(x: number, y: number, r: number, color: number, a: number): void {
    if (this.glows.n >= this.maxGlows || a <= 0.01 || !this.inView(x, y, r)) return;
    const s = this.glows.take(this.glowTex);
    s.position.set(x, y); s.scale.set(r / 32); s.tint = color; s.alpha = Math.min(1, a);
  }
  private shadow(x: number, y: number, rx: number, ry: number, a = 0.3): void {
    this.under.ellipse(x, y, rx, ry).fill({ color: 0, alpha: a * 0.55 });
    this.under.ellipse(x, y, rx * 0.62, ry * 0.62).fill({ color: 0, alpha: a * 0.5 });
  }
  private part(x: number, y: number, vx: number, vy: number, life: number, color: number, size: number, kind: number, z = 0, vz = 0): Particle | null {
    if (this.particles.length >= this.maxParts) return null;
    const p = this.partFree.pop() ?? ({} as Particle);
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.color = color; p.size = size; p.kind = kind; p.z = z; p.vz = vz; p.rot = Math.random() * TAU;
    this.particles.push(p);
    return p;
  }
  private addLight(x: number, y: number, r: number, color: number, a: number, dur: number): void {
    if (this.lights.length > 40) return;
    const l = this.lightFree.pop() ?? ({} as Light);
    l.x = x; l.y = y; l.r = r; l.color = color; l.a = a; l.t = 0; l.dur = dur;
    this.lights.push(l);
  }
  /** Éclats colorés qui rebondissent puis restent un instant au sol. */
  private chips(x: number, y: number, color: number, n: number, speed = 60): void {
    if (this.perf) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = speed * (0.4 + Math.random() * 0.8);
      this.part(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, 0.7 + Math.random() * 0.6, i % 3 === 0 ? mixColor(color, 0xffffff, 0.4) : color, 1 + (Math.random() < 0.3 ? 1 : 0), 2, 3 + Math.random() * 4, 30 + Math.random() * 50);
    }
  }

  // ------------------------------------------------------------------ effets
  handleFx(fx: Fx, w: World): void {
    // Un effet aux valeurs invalides (NaN) ne doit jamais contaminer la caméra ou les particules.
    for (const k in fx) { const v = (fx as any)[k]; if (typeof v === 'number' && !Number.isFinite(v)) { this.badFx++; return; } }
    switch (fx.t) {
      case 'shake': this.cam.shake = Math.min(14, Math.max(this.cam.shake, fx.a) + fx.a * 0.25); break;
      case 'burst': {
        const n = Math.round(fx.n);
        const size = fx.size ?? 1;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * 6.283, sp = (fx.speed ?? 60) * (0.3 + Math.random() * 0.9);
          const life = (fx.life ?? 0.35) * (0.6 + Math.random() * 0.7);
          if (!this.part(fx.x, fx.y, Math.cos(a) * sp, Math.sin(a) * sp, life, i % 4 === 0 ? 0xffffff : fx.color, size, 0)) break;
        }
        if (n >= 6 && size >= 2) this.addLight(fx.x, fx.y, 18 + n * 1.5, fx.color, 0.55, 0.3);
        break;
      }
      case 'casing': {
        const a = fx.dir + (Math.random() - 0.5) * 0.8, sp = 30 + Math.random() * 30;
        let shell = false;
        for (const p of w.players) if (Math.abs(p.x - fx.x) < 1 && Math.abs(p.y - fx.y) < 1) shell = p.weapons[p.cur]?.def.type === 'shotgun';
        this.part(fx.x, fx.y, Math.cos(a) * sp, Math.sin(a) * sp, 4, 0xffffff, 1, shell ? 4 : 1, 6, 55 + Math.random() * 35);
        break;
      }
      case 'text': {
        const num = NUM.test(fx.s);
        if (!this.showNumbers && num) break;
        if (this.texts.length >= 80) break;
        const t = this.textFree.pop() ?? ({} as FloatText);
        t.x = fx.x + (Math.random() - 0.5) * 6; t.y = fx.y; t.vx = num ? (Math.random() - 0.5) * 26 : 0; t.s = fx.s; t.color = fx.color; t.t = 0; t.big = !!fx.big; t.num = num;
        this.texts.push(t);
        break;
      }
      case 'flash': if (fx.a > this.flashA) { this.flashA = fx.a; this.flashColor = fx.color; } break;
      case 'ring':
        this.rings.push({ x: fx.x, y: fx.y, r: fx.r, t: 0, color: fx.color });
        this.addLight(fx.x, fx.y, fx.r * 2.2, fx.color, 0.8, 0.35);
        break;
      case 'decal': {
        // décalques recyclés en anneau (aucune création/destruction en jeu)
        let s = this.decalSprites[this.decalI];
        if (!s) { s = new Sprite(this.tex.get('shadow')!.frames[0]); s.anchor.set(0.5); this.decalSprites.push(s); this.decals.addChild(s); }
        this.decalI = (this.decalI + 1) % 140;
        s.visible = true;
        s.position.set(fx.x, fx.y); s.scale.set(Math.max(0.6, fx.r / 5), Math.max(0.5, fx.r / 4)); s.rotation = 0;
        s.tint = fx.color; s.alpha = fx.color === 0 ? 0.24 : 0.18;
        break;
      }
    }
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
    this.style = styleFor(this.theme.world);
    const old = this.floorSpr.texture;
    const feats = emptyFeatures();
    const t = Texture.from(paintFloor(w.floor, this.theme, feats));
    t.source.scaleMode = 'nearest';
    this.floorSpr.texture = t;
    this.feats = feats;
    if (old && old !== Texture.EMPTY && old !== Texture.WHITE) old.destroy(true);
    // tuiles animées
    if (this.animTheme !== this.theme) {
      this.animTheme = this.theme;
      const prev = this.animTex[0];
      const src = Texture.from(paintAnimTiles(this.theme));
      src.source.scaleMode = 'nearest';
      this.animTex = [];
      for (let row = 0; row < 2; row++)
        for (let i = 0; i < ANIM_FRAMES; i++) this.animTex.push(new Texture({ source: src.source, frame: new Rectangle(i * TILE, row * TILE, TILE, TILE) }));
      if (prev) prev.source.destroy();
    }
    let n = 0;
    const place = (list: { x: number; y: number }[]) => {
      for (const h of list) {
        let s = this.hazSprites[n];
        if (!s) { s = new Sprite(); this.hazSprites.push(s); this.hazC.addChild(s); }
        s.visible = true; s.position.set(h.x, h.y); s.alpha = 1;
        n++;
      }
    };
    place(feats.hazards); place(feats.slicks);
    for (let i = n; i < this.hazSprites.length; i++) this.hazSprites[i].visible = false;
    this.hazN = n;
    this.animFrame = -1;
    // torches
    for (let i = 0; i < feats.torches.length; i++) {
      let s = this.torchSprites[i];
      if (!s) { s = new Sprite(); this.torchSprites.push(s); this.torchC.addChild(s); }
      s.position.set(feats.torches[i].x, feats.torches[i].y);
    }
    for (let i = feats.torches.length; i < this.torchSprites.length; i++) this.torchSprites[i].visible = false;
    if (changed) {
      for (const s of this.decalSprites) s.visible = false;
      for (const p of this.particles) this.partFree.push(p);
      for (const t2 of this.texts) this.textFree.push(t2);
      this.particles.length = 0; this.texts.length = 0; this.rings.length = 0;
      for (const l of this.lights) this.lightFree.push(l);
      this.lights.length = 0;
      for (const c of this.corpses) { c.s.parent?.removeChild(c.s); this.pool.push(c.s); }
      this.corpses.length = 0;
      for (const a of this.amb) a.on = false;
      this.noCorpse = true;
      for (const id of [...this.pstate.keys()]) if (!w.players.some((p) => p.id === id)) this.pstate.delete(id);
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
    this.noCorpse = false;
    if (this.floorRef !== w.floor || this.floorRev !== w.floor.rev) this.rebuildFloor(w);
    const under = this.under, over = this.over;
    under.clear(); over.clear();
    this.labelN = 0;
    const paused = !!w.choice || dt === 0;
    const st = this.style;

    // --- mode performance automatique
    if (dt > 0) {
      this.fpsAvg += (1 / Math.max(dt, 0.001) - this.fpsAvg) * 0.05;
      if (this.perfMode === 'auto') {
        if (!this.perf) { this.lowT = this.fpsAvg < 45 ? this.lowT + dt : 0; if (this.lowT > 2) { this.perf = true; this.highT = 0; } }
        else { this.highT = this.fpsAvg > 58 ? this.highT + dt : 0; if (this.highT > 12) { this.perf = false; this.lowT = 0; } }
      } else this.perf = this.perfMode === 'on';
    }

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
    this.lightRoot.scale.copyFrom(this.root.scale); this.lightRoot.position.copyFrom(this.root.position);
    this.topRoot.scale.copyFrom(this.root.scale); this.topRoot.position.copyFrom(this.root.position);
    const hw = W / 2 / zoom, hh = H / 2 / zoom;
    this.vx0 = this.cam.x - hw; this.vx1 = this.cam.x + hw; this.vy0 = this.cam.y - hh; this.vy1 = this.cam.y + hh;
    if (this.root.tint !== w.mods.tint) this.root.tint = w.mods.tint;
    if (w.mods.grayscale !== this.grayOn) {
      this.grayOn = w.mods.grayscale;
      if (this.grayOn > 0) { this.gray.saturate(-this.grayOn, false); this.root.filters = [this.gray]; this.lightRoot.filters = [this.gray]; }
      else { this.root.filters = []; this.lightRoot.filters = []; }
    }

    // --- tuiles animées (lave qui pulse, ronces qui bougent, glace qui scintille)
    const af = Math.floor(time * 5);
    const feats = this.feats, nh = feats.hazards.length;
    const pulse = st.hazard === 'lava' || st.hazard === 'goo';
    if (af !== this.animFrame && this.animTex.length) {
      this.animFrame = af;
      for (let i = 0; i < this.hazN; i++) {
        const h = i < nh ? feats.hazards[i] : feats.slicks[i - nh];
        this.hazSprites[i].texture = this.animTex[(i < nh ? 0 : ANIM_FRAMES) + ((af + h.ph) % ANIM_FRAMES)];
      }
    }
    if (pulse) for (let i = 0; i < nh; i++) this.hazSprites[i].alpha = 0.55 + 0.45 * Math.sin(time * 2.4 + feats.hazards[i].ph * 1.7);
    if (st.hazardLight !== null) {
      for (let i = 0; i < nh; i += 2) {
        const h = feats.hazards[i];
        if (this.inView(h.x + 8, h.y + 8, 24)) this.glow(h.x + 8, h.y + 8, 22, st.hazardLight, (pulse ? 0.16 : 0.08) + Math.sin(time * 2.4 + h.ph * 1.7) * 0.05);
      }
    }
    // --- torches & lumières de décor
    const torch = this.tex.get(st.torch);
    for (let i = 0; i < feats.torches.length; i++) {
      const tc = feats.torches[i], s = this.torchSprites[i];
      const vis = this.inView(tc.x, tc.y, 20);
      s.visible = vis;
      if (!vis || !torch) continue;
      const fr = torch.frames[Math.floor(time * 9 + tc.ph) % torch.frames.length];
      if (s.texture !== fr) s.texture = fr;
      s.anchor.set(torch.ax, torch.ay);
      const fl = Math.sin(time * 13 + tc.ph) * 0.5 + Math.sin(time * 7.3 + tc.ph * 2) * 0.5;
      this.glow(tc.x, tc.y - 2, 44 + fl * 3, st.light, 0.3 + fl * 0.04);
      this.glow(tc.x, tc.y - 2, 12, 0xffffff, 0.12);
      if (!paused && st.torch === 'fx_flame' && Math.random() < 0.04) this.part(tc.x, tc.y - 5, (Math.random() - 0.5) * 6, -18 - Math.random() * 10, 0.6, 0xffb040, 1, 3);
    }
    for (const l of feats.lights) if (this.inView(l.x, l.y, 16)) this.glow(l.x, l.y, l.r + Math.sin(time * 2 + l.ph) * 2, l.color, 0.2 + Math.sin(time * 3 + l.ph) * 0.06);

    // --- portes fermées
    const doorC = hexNum(this.theme.door);
    for (const room of w.floor.rooms) {
      if (!room.locked) continue;
      for (const d of room.doors) {
        const x = d.x * TILE, y = d.y * TILE;
        under.rect(x, y, TILE, TILE).fill({ color: 0x1b1326 });
        under.rect(x + 1, y + 1, TILE - 2, TILE - 2).fill({ color: doorC });
        under.rect(x + 1, y + 1, TILE - 2, 1).fill({ color: 0xffffff, alpha: 0.35 });
        for (let k = 3; k <= 11; k += 4) {
          under.rect(x + k, y + 3, 2, TILE - 6).fill({ color: 0x1b1326, alpha: 0.55 });
          under.rect(x + k, y + 3, 1, TILE - 6).fill({ color: 0xffffff, alpha: 0.15 });
        }
        under.rect(x + 6, y + 6, 4, 4).fill({ color: 0xffffff, alpha: 0.4 + Math.sin(time * 5) * 0.25 });
        this.glow(x + 8, y + 8, 18, doorC, 0.22);
      }
    }

    // --- objets interactifs
    for (const it of w.items) {
      if (it.dead) continue;
      const s = this.get(it.id * 4, this.ents);
      const anim = it.kind === 'portal' ? Math.floor(time * 6) : it.kind === 'npc' || it.kind === 'hero' ? Math.floor(time * 2.5 + it.id) : it.kind === 'statue' || it.kind === 'altar' ? Math.floor(time * 1.2) : 0;
      // héros exposés dans le Hall : animation de repos (_idle) si elle existe, sinon image fixe
      const idle = it.kind === 'hero' ? this.idleOf(it.sprite) : null;
      const t = this.setTex(s, idle ?? it.sprite, it.kind === 'hero' && !idle ? 0 : anim);
      const bob = it.bob ? Math.sin(time * 3 + it.id) * 1.5 : 0;
      s.position.set(it.x, it.y + bob - (it.kind === 'weapon' || it.kind === 'shopitem' ? 3 : 0));
      s.zIndex = it.y + (it.kind === 'portal' ? -20 : 0);
      s.tint = it.tint ?? 0xffffff;
      s.rotation = it.kind === 'weapon' ? -0.5 + Math.sin(time * 2 + it.id) * 0.06 : 0;
      s.scale.set(1, it.kind === 'npc' || it.kind === 'hero' ? 1 + Math.sin(time * 3 + it.id) * 0.025 : 1);
      if (it.kind === 'weapon' || (it.kind === 'shopitem' && it.weapon)) {
        const c = RARITY_HEX[it.weapon!.rarity];
        under.ellipse(it.x, it.y + 5, 9, 4).fill({ color: c, alpha: 0.28 + Math.sin(time * 4 + it.id) * 0.1 });
        this.glow(it.x, it.y, 16 + it.weapon!.rarity * 3, c, 0.22 + Math.sin(time * 4 + it.id) * 0.06);
        if (it.weapon!.rarity >= 2 && !paused && Math.random() < 0.03 * it.weapon!.rarity) this.part(it.x + (Math.random() - 0.5) * 14, it.y + 2, 0, -14 - Math.random() * 10, 0.7, c, 1, 3);
      } else if (it.kind === 'portal') {
        under.ellipse(it.x, it.y + t.h / 2 - 2, 12, 4).fill({ color: 0x9a70ff, alpha: 0.3 });
        this.glow(it.x, it.y, 46 + Math.sin(time * 3) * 4, 0x9a70ff, 0.4);
        this.glow(it.x, it.y, 14, 0xe0d0ff, 0.35);
        if (!paused && this.frame % 3 === 0) {
          const a = Math.random() * TAU;
          this.part(it.x + Math.cos(a) * 16, it.y + Math.sin(a) * 16, -Math.cos(a) * 30 - Math.sin(a) * 20, -Math.sin(a) * 30 + Math.cos(a) * 20, 0.6, Math.random() < 0.5 ? 0xb090ff : 0xe0d0ff, 1, 3);
        }
      } else {
        this.shadow(it.x, it.y + t.h / 2 - 1, t.w * 0.38, 3, 0.32);
        if (it.kind === 'statue' || it.kind === 'altar') this.glow(it.x, it.y - 4, 34, 0xffe0a0, 0.16 + Math.sin(time * 1.5) * 0.04);
      }
      if (it.kind === 'shopitem') this.label(String(w.priceOf(it)), it.x, it.y + 9, w.coins >= w.priceOf(it) ? 0xffd23a : 0xff6677);
      if (it.kind === 'hero' && it.tint !== undefined && it.tint !== 0xffffff) {
        const h = R.heroes.get(it.data?.hero);
        if (h) this.label(String(h.cost), it.x, it.y + 12, 0xc070ff);
      }
    }
    for (const c of w.chests) {
      if (c.dead) continue;
      const s = this.get(c.id * 4, this.ents);
      const big = c.kind === 'big';
      const t = this.setTex(s, (big ? 'chest_big' : 'chest') + (c.opened ? '_open' : ''));
      if (s._open === false && c.opened) {
        // ouverture : gerbe d'étincelles dorées + éclair de lumière
        for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, sp = 50 + Math.random() * 60; this.part(c.x, c.y - 4, Math.cos(a) * sp, Math.sin(a) * sp, 0.6, i % 2 ? 0xffd23a : 0xffffff, 1, 0); }
        this.addLight(c.x, c.y, 50, big ? 0xc070ff : 0xffd23a, 0.7, 0.5);
        s._hit = 0.2;
      }
      s._open = c.opened;
      s._hit = Math.max(0, (s._hit ?? 0) - dt);
      const q = (s._hit ?? 0) / 0.2;
      s.scale.set(1 + q * 0.2, 1 - q * 0.15);
      s.position.set(c.x, c.y); s.zIndex = c.y;
      this.shadow(c.x, c.y + t.h / 2 - 1, t.w * 0.42, 3, 0.35);
      if (!c.opened) {
        this.glow(c.x, c.y, big ? 30 : 20, big ? 0xc070ff : 0xffd23a, 0.14 + Math.sin(time * 3 + c.id) * 0.05);
        if (!paused && Math.random() < (big ? 0.06 : 0.02)) this.part(c.x + (Math.random() - 0.5) * t.w, c.y - t.h / 2 + Math.random() * 4, 0, -10, 0.6, big ? 0xe0b0ff : 0xfff0a0, 1, 3);
      }
    }
    for (const p of w.props) {
      if (p.dead) continue;
      const s = this.get(p.id * 4, this.ents);
      this.setTex(s, p.kind, 0, p.flash > 0);
      const q = p.flash > 0 ? 1 : 0;
      s.scale.set(1 + q * 0.14, 1 - q * 0.12);
      s.position.set(p.x + (q ? (Math.random() - 0.5) * 1.5 : 0), p.y - 2); s.zIndex = p.y;
      this.shadow(p.x, p.y + 5, 7, 3, 0.34);
    }
    for (const k of w.pickups) {
      const s = this.get(k.id * 4, this.ents);
      this.setTex(s, 'pk_' + k.kind, Math.floor(time * 7 + k.id));
      const hop = Math.abs(Math.sin(time * 5 + k.id)) * 2;
      s.position.set(k.x, k.y - 2 - hop); s.zIndex = k.y - 6;
      s.scale.set(1, 1 - (hop < 0.3 ? 0.12 : 0));
      under.ellipse(k.x, k.y + 2, 2.5 - hop * 0.3, 1).fill({ color: 0, alpha: 0.25 });
      const gc = PICKUP_GLOW[k.kind];
      if (gc !== undefined) this.glow(k.x, k.y - 2, k.kind === 'coin' ? 8 : 11, gc, 0.22);
    }
    for (const pet of w.pets) {
      const key = (pet.owner.id * 4 + 3);
      const s = this.get(key, this.ents);
      this.setTex(s, pet.def.sprite, Math.floor(time * 5));
      const hop = Math.abs(Math.sin(time * 6));
      s.position.set(pet.x, pet.y - 2 - hop * 1.5); s.zIndex = pet.y; s.scale.set(pet.facing * (1 + (1 - hop) * 0.05), 1 - (1 - hop) * 0.05);
      this.shadow(pet.x, pet.y + 4, 5, 2);
    }

    // --- ennemis
    for (const e of w.enemies) {
      if (e.dead) continue;
      const r = e.radius * e.scale;
      if (e.spawnT > 0) {
        const k = Math.min(1, e.spawnT / 0.7);
        under.circle(e.x, e.y, r * (0.4 + k)).stroke({ width: 1, color: 0xff4466, alpha: 0.9 - k * 0.5 });
        under.circle(e.x, e.y, r * 0.5 * (1 - k)).fill({ color: 0xff4466, alpha: 0.5 });
        this.glow(e.x, e.y, r * 2.5, 0xff3355, 0.25 * (1 - k) + 0.05);
        if (!paused && Math.random() < 0.3) this.part(e.x + (Math.random() - 0.5) * r * 2, e.y + r * 0.5, 0, -25, 0.4, 0xff6680, 1, 3);
        continue;
      }
      this.shadow(e.x, e.y + r * 0.85, r * 0.9, Math.max(2, r * 0.3));
      if (e.elite || e.champion) under.circle(e.x, e.y + r * 0.4, r * 1.35 + Math.sin(time * 6) * 1).stroke({ width: 1, color: e.champion ? 0xff5040 : 0xffd23a, alpha: 0.8 });
      const s = this.get(e.id * 4, this.ents);
      const tele = e.tele > 0 || e.data.windup > 0;
      const blink = tele && Math.floor(time * 20) % 2 === 0;
      const moving = Math.abs(e.vx) + Math.abs(e.vy) > 4;
      const look = e.data.look;
      if (look?.aura !== undefined) {
        under.circle(e.x, e.y, r * 1.6 + Math.sin(time * 5) * 2).fill({ color: look.aura, alpha: 0.18 + Math.sin(time * 7) * 0.06 });
        this.glow(e.x, e.y, r * 3.2, look.aura, 0.3 + Math.sin(time * 5) * 0.08);
      }
      const t = this.setTex(s, look?.sprite && this.tex.has(look.sprite) ? look.sprite : e.def.sprite, moving ? Math.floor(time * 6 + e.id) : Math.floor(time * 2.5 + e.id), e.flash > 0 || blink);
      s._en = 1; s._col = t.color; s._big = !!e.def.boss || e.champion;
      // impact : écrasement puis étirement + éclats de sa couleur
      if (e.flash > (s._fl ?? 0) + 0.001) {
        s._hit = 0.16;
        if (!paused) this.chips(e.x, e.y - r * 0.3, t.color, 3, 55);
      }
      s._fl = e.flash;
      if ((s._hit ?? 0) > 0) s._hit! -= dt;
      const hk = Math.max(0, s._hit ?? 0) / 0.16;
      const q = Math.sin(hk * Math.PI * 1.5) * hk;
      const sq = 1 + Math.sin(time * 7 + e.id) * 0.04;
      const ls = look?.scale ?? 1;
      s.scale.set(e.scale * ls * e.facing * (1 + 0.3 * q), e.scale * ls * sq * (1 - 0.24 * q));
      s.position.set(e.x, e.y - (moving ? Math.abs(Math.sin(time * 9 + e.id)) * 1.5 : 0));
      s.zIndex = e.y + r * 0.5;
      let tint = 0xffffff;
      for (const k in e.status) {
        tint = STATUS_TINT[k] ?? tint;
        const fc = STATUS_FX[k];
        if (fc !== undefined && !paused && Math.random() < 0.12) this.part(e.x + (Math.random() - 0.5) * r * 1.6, e.y - Math.random() * r, (Math.random() - 0.5) * 8, k === 'freeze' ? 4 : -22, 0.45, fc, 1, k === 'shock' ? 0 : 3);
      }
      if (e.charmed) tint = 0xff90d0;
      else if (tint === 0xffffff && look?.tint !== undefined) tint = look.tint;
      s.tint = tint;
      if (tele) { this.label('!', e.x, e.y - r - 9 - (Math.floor(time * 10) % 2), 0xff4455); this.glow(e.x, e.y, r * 2, 0xff3355, 0.18); }
    }

    // --- joueurs
    for (const p of w.players) this.drawPlayer(w, p, time, dt, paused);

    // --- balles
    const maxTrail = this.perf ? 60 : 400;
    for (const b of w.bullets) {
      if (b.dead) continue;
      const enemy = b.team === 'enemy';
      if (b.kind === 'shot') {
        const s = this.get(b.id * 4, this.bulletsC);
        const t = this.setTex(s, b.sprite ?? (enemy ? 'eb_round' : 'b_round'));
        s.position.set(b.x, b.y);
        s.rotation = b.dir + (b.spin ?? 0) * b.age;
        s.tint = b.color ?? 0xffffff;
        const spd = Math.abs(b.vx) + Math.abs(b.vy);
        const bs = b.scale ?? 1;
        const pop = b.age < 0.06 ? 1 + (0.06 - b.age) * 6 : 1;
        const str = b.spin ? 1 : 1 + Math.min(0.35, spd / 900);
        s.scale.set(bs * pop * str, (bs * pop) / str);
        const col = b.color ?? t.color;
        if (spd > 50 && this.trails.n < maxTrail && (!enemy || !this.perf)) {
          const tr = this.trails.take(this.pxTex);
          tr.anchor.set(1, 0.5);
          tr.position.set(b.x, b.y);
          tr.rotation = Math.atan2(b.vy, b.vx);
          tr.scale.set(Math.min(16, spd * 0.032) * bs, Math.max(1, t.h * 0.4 * bs));
          tr.tint = col; tr.alpha = enemy ? 0.3 : 0.45;
        }
        this.glow(b.x, b.y, (enemy ? 9 : 8) * bs + t.w * 0.4, col, enemy ? 0.34 : 0.24);
        if (b.trail !== undefined && !paused && this.frame % 2 === 0) this.part(b.x, b.y, 0, 0, 0.22, b.trail, 1, 0);
      } else if (b.kind === 'lob') {
        const t = Math.min(1, b.age / b.life), h = Math.sin(Math.PI * t) * 28;
        const s = this.get(b.id * 4, this.bulletsC);
        const tx2 = this.setTex(s, b.sprite ?? (enemy ? 'eb_orb' : 'b_round'));
        s.position.set(b.x, b.y - h); s.tint = b.color ?? 0xffffff; s.scale.set((b.scale ?? 1) * (1 + Math.sin(Math.PI * t) * 0.4)); s.rotation = time * 8;
        under.ellipse(b.x, b.y, 3 + (1 - Math.sin(Math.PI * t)) * 1.5, 1.5).fill({ color: 0, alpha: 0.35 });
        const rad = (b.explode?.radius ?? 16) * w.mods.explosionSize;
        const col = enemy ? 0xff3355 : 0xffc04a;
        under.circle(b.tx!, b.ty!, rad).stroke({ width: 1, color: col, alpha: 0.75 });
        under.circle(b.tx!, b.ty!, rad * t).fill({ color: col, alpha: 0.22 });
        this.glow(b.x, b.y - h, 12, b.color ?? tx2.color, 0.3);
      } else if (b.kind === 'slash') {
        this.drawSlash(w, b.x, b.y, b.dir, Math.min(1, b.age / b.life), b.range ?? 26, b.arc ?? 1.8, b.color ?? (enemy ? 0xff6677 : 0xffffff), enemy ? 1 : this.swingSign(b.owner as Player | null));
      } else if (b.kind === 'beam' && b.pts) {
        const t = Math.min(1, b.age / b.life), col = b.color ?? (enemy ? 0xff3355 : 0x7ae8ff);
        const warn = b.data?.warn;
        const wd = warn ? 1 : Math.max(1, (b.width ?? 3) * (1 - t * 0.7));
        if (!warn) {
          over.moveTo(b.pts[0], b.pts[1]);
          for (let i = 2; i < b.pts.length; i += 2) over.lineTo(b.pts[i], b.pts[i + 1]);
          over.stroke({ width: wd * 2.6, color: col, alpha: 0.22 * (1 - t) });
        }
        over.moveTo(b.pts[0], b.pts[1]);
        for (let i = 2; i < b.pts.length; i += 2) over.lineTo(b.pts[i], b.pts[i + 1]);
        over.stroke({ width: wd, color: col, alpha: warn ? 0.35 + (Math.floor(time * 16) % 2) * 0.35 : 1 - t * 0.6 });
        if (!warn && wd > 2) {
          over.moveTo(b.pts[0], b.pts[1]);
          for (let i = 2; i < b.pts.length; i += 2) over.lineTo(b.pts[i], b.pts[i + 1]);
          over.stroke({ width: Math.max(1, wd * 0.4), color: 0xffffff, alpha: 1 - t });
        }
        if (!warn) {
          const L = b.pts.length;
          this.glow(b.pts[0], b.pts[1], 16, col, 0.5 * (1 - t));
          this.glow(b.pts[L - 2], b.pts[L - 1], 20, col, 0.6 * (1 - t));
          for (let i = 2; i < L - 2; i += 2) this.glow(b.pts[i], b.pts[i + 1], 12, col, 0.3 * (1 - t));
        }
      }
    }

    // --- particules
    const ps = this.particles;
    let pn = 0;
    const px = this.pxTex;
    const casT = this.tex.get('fx_casing')?.frames[0] ?? px, shellT = this.tex.get('fx_shell')?.frames[0] ?? px;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const ground = p.kind === 1 || p.kind === 2 || p.kind === 4;
      if (!paused) {
        p.life -= dt;
        if (ground) {
          // douilles / éclats : rebondissent puis restent au sol
          if (p.z > 0 || p.vz > 0) {
            p.vz -= 260 * dt; p.z += p.vz * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += 14 * dt;
            if (p.z <= 0) {
              p.z = 0;
              if (p.vz < -40) { p.vz = -p.vz * 0.4; p.vx *= 0.5; p.vy *= 0.5; }
              else { p.vz = 0; p.rot = Math.round(p.rot / Math.PI) * Math.PI + (p.kind === 2 ? 0 : 0.3); }
            }
          }
        } else if (p.kind === 3) {
          p.x += (p.vx + Math.sin(p.life * 12 + p.rot) * 6) * dt; p.y += p.vy * dt;
        } else {
          p.x += p.vx * dt; p.y += p.vy * dt;
          const d = Math.exp((p.kind === 5 ? -6 : -4) * dt); p.vx *= d; p.vy *= d;
        }
      }
      if (p.life <= 0) { this.partFree.push(p); continue; }
      ps[pn] = p;
      let s = this.partSprites[pn];
      if (!s) { s = new Sprite(px); s.anchor.set(0.5); this.partSprites.push(s); this.parts.addChild(s); }
      s.visible = true;
      const tex = p.kind === 1 ? casT : p.kind === 4 ? shellT : px;
      if (s.texture !== tex) s.texture = tex;
      const k = p.life / p.max;
      if (p.kind === 1 || p.kind === 4) {
        s.tint = 0xffffff; s.position.set(p.x, p.y - p.z); s.scale.set(1); s.rotation = p.rot; s.alpha = Math.min(1, p.life);
      } else if (p.kind === 2) {
        s.tint = p.color; s.position.set(p.x, p.y - p.z); s.scale.set(p.size); s.rotation = 0; s.alpha = Math.min(1, p.life * 3);
      } else if (p.kind === 3) {
        s.tint = p.color; s.position.set(p.x, p.y); s.scale.set(p.size); s.rotation = 0; s.alpha = Math.min(1, k * 1.6) * (Math.floor(p.life * 25) % 3 === 0 ? 0.5 : 1);
      } else if (p.kind === 5) {
        s.tint = p.color; s.position.set(p.x, p.y); s.scale.set(p.size * (2 - k)); s.rotation = 0; s.alpha = k * 0.45;
      } else {
        s.tint = p.color; s.position.set(p.x, p.y); s.scale.set(p.size * (0.5 + k)); s.rotation = 0; s.alpha = Math.min(1, k * 2);
      }
      pn++;
    }
    ps.length = pn;
    for (let i = pn; i < this.partSprites.length; i++) { if (!this.partSprites[i].visible) break; this.partSprites[i].visible = false; }

    // --- cadavres qui se dissolvent
    this.updateCorpses(dt, paused);

    // --- particules d'ambiance (lucioles, flocons, braises…)
    this.updateAmbient(time, dt, paused);

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
    // --- lumières passagères
    let ln = 0;
    for (const l of this.lights) {
      if (!paused) l.t += dt;
      if (l.t >= l.dur) { this.lightFree.push(l); continue; }
      this.lights[ln++] = l;
      const k = 1 - l.t / l.dur;
      this.glow(l.x, l.y, l.r * (0.8 + 0.2 * k), l.color, l.a * k * k);
    }
    this.lights.length = ln;

    // --- rendu libre des règles
    for (const inst of w.rules.order()) {
      if (inst.def.render && !inst.muted) {
        try { inst.def.render(w.ctx, this.draw, inst); } catch { inst.muted = true; }
      }
    }

    // --- textes flottants (chiffres de dégâts : pop, arc, scintillement des critiques)
    let tn = 0;
    for (const t of this.texts) {
      if (!paused) t.t += dt;
      const life = t.big ? 0.95 : 0.75;
      if (t.t > life) { this.textFree.push(t); continue; }
      this.texts[tn++] = t;
      const k = t.t / life;
      let scale = t.big ? 2 : 1, color = t.color, x = t.x + t.vx * t.t;
      if (t.num) {
        if (t.t < (t.big ? 0.08 : 0.05)) scale += 1;
        if (t.big && t.t < 0.25) { x += Math.floor(t.t * 40) % 2 ? 1 : -1; if (Math.floor(t.t * 30) % 2) color = 0xffffff; }
      }
      const y = t.y - 14 * (1 - (1 - k) * (1 - k)) - (t.big ? 3 : 0) + (t.num ? k * k * 6 : 0);
      this.label(t.s, x, y, color, scale, k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
    }
    this.texts.length = tn;
    for (let i = this.labelN; i < this.labelSprites.length; i++) { if (!this.labelSprites[i].visible) break; this.labelSprites[i].visible = false; }

    // --- balayage des vues orphelines (un ennemi disparu devient un cadavre qui se dissout)
    for (const [key, s] of this.views) {
      if (s._f !== this.frame) {
        this.views.delete(key);
        if (s._en && !this.noCorpse && this.corpses.length < this.maxCorpses && s._tid) this.startCorpse(s);
        else { s.parent?.removeChild(s); this.pool.push(s); }
      }
    }

    this.trails.end(); this.fxp.end(); this.glows.end(); this.ambP.end();

    // --- ambiance plein écran : assombrissement qui respire + vignette
    const breathe = Math.sin(time * 0.9) * 0.6 + Math.sin(time * 0.37 + 1) * 0.4;
    this.dimSpr.tint = st.dimColor;
    this.dimSpr.alpha = Math.max(0, st.dim + breathe * st.breathe);
    this.dimSpr.width = W; this.dimSpr.height = H;
    this.vignette.width = W; this.vignette.height = H;
    this.vignette.alpha = st.vignette;

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

  // ------------------------------------------------------------------ mêlée
  private swingSign(p: Player | null): number {
    if (!p || (p as any).team !== 'player') return 1;
    const ps = this.pstate.get(p.id);
    // même sens visuel que la lame (dont la rotation est miroir quand on vise à gauche)
    return ps ? ps.sign * (Math.cos(ps.aim) < 0 ? -1 : 1) : 1;
  }
  /** Arc de coup : croissant plein qui balaie (frottis) + liseré blanc sur le bord d'attaque. */
  private drawSlash(_w: World, x: number, y: number, dir: number, t: number, range: number, arc: number, col: number, sign: number): void {
    const o = this.over;
    const head = 1 - Math.pow(1 - Math.min(1, t * 1.7), 3);
    const tail = Math.max(0, (t - 0.3) / 0.7);
    if (head - tail < 0.02) return;
    const a0 = dir - (arc / 2) * sign;
    const span = arc * sign;
    const seg = 10;
    const pts: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const u = tail + ((head - tail) * i) / seg;
      const a = a0 + span * u;
      pts.push(x + Math.cos(a) * range, y + Math.sin(a) * range);
    }
    for (let i = seg; i >= 0; i--) {
      const u = tail + ((head - tail) * i) / seg;
      const a = a0 + span * u;
      const th = 0.25 + 0.4 * (i / seg); // plus épais vers la tête
      pts.push(x + Math.cos(a) * range * (1 - th), y + Math.sin(a) * range * (1 - th));
    }
    o.poly(pts).fill({ color: col, alpha: 0.42 * (1 - t * 0.7) });
    const ah = a0 + span * head, at = a0 + span * Math.max(tail, head - 0.35);
    o.moveTo(x + Math.cos(at) * range, y + Math.sin(at) * range);
    for (let i = 1; i <= 5; i++) { const a = at + ((ah - at) * i) / 5; o.lineTo(x + Math.cos(a) * range, y + Math.sin(a) * range); }
    o.stroke({ width: 2, color: 0xffffff, alpha: 0.9 * (1 - t) });
    this.glow(x + Math.cos(ah) * range * 0.8, y + Math.sin(ah) * range * 0.8, range * 0.9, col, 0.3 * (1 - t));
  }

  // ------------------------------------------------------------------ cadavres
  private startCorpse(s: VSprite): void {
    const t = this.tex.get(s._tid!) ?? this.tex.get('missing')!;
    const big = !!s._big;
    this.corpses.push({ s, t: 0, dur: big ? 1.5 : 0.8, x: s.x, y: s.y, sx: s.scale.x, sy: s.scale.y, h: t.h, color: s._col ?? 0xffffff, tid: s._tid!, fr: s._fr ?? 0, big });
    s.zIndex = s.y - 12;
    s._en = 0;
    this.chips(s.x, s.y, s._col ?? 0xffffff, big ? 22 : 8, big ? 110 : 70);
    this.addLight(s.x, s.y, big ? 70 : 26, s._col ?? 0xffffff, big ? 0.7 : 0.35, big ? 0.5 : 0.22);
  }
  private updateCorpses(dt: number, paused: boolean): void {
    let n = 0;
    for (const c of this.corpses) {
      if (!paused) c.t += dt;
      if (c.t >= c.dur) { c.s.parent?.removeChild(c.s); this.pool.push(c.s); continue; }
      this.corpses[n++] = c;
      const s = c.s;
      this.setTex(s, c.tid, c.fr, c.t < 0.07);
      const e = Math.min(1, c.t / c.dur);
      const flat = 0.55 * e * e;
      s.scale.set(c.sx * (1 + 0.25 * e), c.sy * (1 - flat));
      s.position.set(c.x, c.y + c.h * Math.abs(c.sy) * 0.5 * flat);
      s.tint = mixColor(0xffffff, 0x2a1a38, Math.min(1, e * 1.4));
      const a = e < 0.4 ? 1 : 1 - (e - 0.4) / 0.6;
      s.alpha = e > 0.5 && Math.floor(c.t * 30) % 2 ? a * 0.55 : a;
      if (!paused && Math.random() < (c.big ? 0.9 : 0.45) * (this.perf ? 0.4 : 1)) {
        const hw = c.h * Math.abs(c.sx) * 0.45;
        this.part(c.x + (Math.random() - 0.5) * 2 * hw, c.y + (Math.random() - 0.3) * hw, 0, -18 - Math.random() * 24, 0.5 + Math.random() * 0.3, Math.random() < 0.3 ? 0xffffff : c.color, 1, 3);
      }
    }
    this.corpses.length = n;
  }

  // ------------------------------------------------------------------ ambiance
  private updateAmbient(time: number, dt: number, paused: boolean): void {
    const st = this.style;
    const want = Math.round(st.ambientN * (this.perf ? 0.4 : 1));
    while (this.amb.length < want) this.amb.push({ x: 0, y: 0, vx: 0, vy: 0, ph: 0, kind: 0, color: 0, size: 1, on: false });
    const x0 = this.vx0 - 10, x1 = this.vx1 + 10, y0 = this.vy0 - 10, y1 = this.vy1 + 10;
    for (let i = 0; i < want; i++) {
      const a = this.amb[i];
      if (!a.on) {
        a.on = true;
        a.kind = st.ambient[i % st.ambient.length];
        a.color = st.ambientColors[i % st.ambientColors.length];
        a.ph = Math.random() * 100;
        a.size = a.kind === 2 && Math.random() < 0.3 ? 2 : 1;
        a.x = x0 + Math.random() * (x1 - x0);
        a.y = y0 + Math.random() * (y1 - y0);
        a.vx = (Math.random() - 0.5) * 6; a.vy = (Math.random() - 0.5) * 4;
        if (a.kind === 2) a.vy = 12 + Math.random() * 12 * a.size;
        else if (a.kind === 3) a.vy = -10 - Math.random() * 16;
        else if (a.kind === 4) { a.vy = 6 + Math.random() * 5; a.color = 0x8a8090; }
      }
      if (!paused) {
        let vx = a.vx, vy = a.vy;
        if (a.kind === 1) { vx = Math.cos(a.ph + time * 0.7) * 9; vy = Math.sin(a.ph * 1.3 + time * 0.9) * 7; }
        else if (a.kind === 2) vx = 7 + Math.sin(time * 0.8 + a.ph) * 7;
        else if (a.kind === 3 || a.kind === 4) vx = Math.sin(time * 1.6 + a.ph) * 6;
        else if (a.kind === 5) { vx = Math.sin(time * 0.3 + a.ph) * 3; vy = -2 + Math.cos(time * 0.4 + a.ph) * 2; }
        a.x += vx * dt; a.y += vy * dt;
      }
      // hors champ → réapparaît du bon côté
      if (a.x < x0 || a.x > x1 || a.y < y0 || a.y > y1) {
        if (a.kind === 2 || a.kind === 4) { a.y = y0 + 1; a.x = x0 + Math.random() * (x1 - x0); }
        else if (a.kind === 3) { a.y = y1 - 1; a.x = x0 + Math.random() * (x1 - x0); }
        else { a.x = x0 + Math.random() * (x1 - x0); a.y = y0 + Math.random() * (y1 - y0); }
      }
      let alpha: number;
      if (a.kind === 1) alpha = Math.max(0, Math.sin(time * 1.8 + a.ph)) ** 2;
      else if (a.kind === 3) alpha = 0.5 + 0.5 * Math.sin(time * 9 + a.ph);
      else if (a.kind === 2) alpha = a.size === 2 ? 0.9 : 0.6;
      else alpha = 0.25 + 0.2 * Math.sin(time * 2 + a.ph);
      if (alpha < 0.03) continue;
      const s = this.ambP.take(this.pxTex);
      s.blendMode = a.kind === 2 || a.kind === 4 ? 'normal' : 'add';
      s.position.set(a.x, a.y); s.scale.set(a.size); s.tint = a.color; s.alpha = alpha;
      if (a.kind === 1 || a.kind === 3) this.glow(a.x, a.y, a.kind === 1 ? 7 : 5, a.color, alpha * 0.35);
    }
  }

  // ------------------------------------------------------------------ joueur & arme
  private pst(p: Player): PState {
    let s = this.pstate.get(p.id);
    if (!s) {
      s = { aim: p.aim, shot: p.lastShot, wdef: null, swapT: 0, muzzleT: 0, muzzleFr: 0, muzzleColor: 0xfff0a0, smoke: false, sign: 1, melee: -0.9 };
      this.pstate.set(p.id, s);
    }
    return s;
  }

  private drawPlayer(_w: World, p: Player, time: number, dt: number, paused: boolean): void {
    const s = this.get(p.id * 4, this.ents);
    const sc = p.mods.playerScale;
    const ps = this.pst(p);
    if (p.downed) {
      this.setTex(s, p.hero.sprite);
      s.position.set(p.x, p.y + 3); s.rotation = Math.PI / 2; s.tint = 0x666677; s.alpha = 0.8; s.zIndex = p.y - 8; s.scale.set(sc);
      return;
    }
    this.shadow(p.x, p.y + 6 * sc, 6 * sc, 2.5 * sc, 0.34);
    // corps : marche (rebond + écrasement à chaque pas), repos (respiration, sprite _idle s'il existe)
    const idleId = this.idleOf(p.hero.sprite);
    if (p.moving) this.setTex(s, p.hero.sprite, Math.floor(time * 9), p.flash > 0);
    else if (idleId) this.setTex(s, idleId, Math.floor(time * 2.5), p.flash > 0);
    else this.setTex(s, p.hero.sprite, 0, p.flash > 0);
    const step = p.moving ? Math.abs(Math.sin(time * 14)) : 0;
    const bob = p.moving ? step * 1.5 : Math.sin(time * 3) * 0.5;
    const land = p.moving ? Math.max(0, 1 - step * 3) : 0;
    const hurt = p.flash > 0 ? 1 : 0;
    s.rotation = p.moving ? Math.sin(time * 7) * 0.05 : 0;
    s.position.set(p.x, p.y - 2 - bob);
    s.scale.set(p.facing * sc * (1 + land * 0.08 + hurt * 0.12), sc * (1 - land * 0.08 - hurt * 0.1 + (p.moving ? 0 : Math.sin(time * 3) * 0.02)));
    s.alpha = p.invuln > 0 && Math.floor(time * 24) % 2 === 0 ? 0.35 : 1;
    s.zIndex = p.y;
    let tint = 0xffffff;
    for (const k in p.status) tint = STATUS_TINT[k] ?? tint;
    s.tint = tint;
    // poussière de pas
    if (p.moving && !paused && land > 0.9 && (this.frame & 1) === 0) this.part(p.x - p.facing * 3, p.y + 6 * sc, -p.facing * 8, -3, 0.35, 0x9a90a8, 1.5, 5);
    // halo personnel
    this.glow(p.x, p.y, 64, this.style.playerLight, 0.15);
    if (p.skillT > 0) {
      this.under.circle(p.x, p.y, 11 + Math.sin(time * 10) * 1.5).stroke({ width: 1, color: 0x9ae8ff, alpha: 0.9 });
      this.glow(p.x, p.y, 28, 0x9ae8ff, 0.3);
    }
    const wi = p.weapons[p.cur];
    if (!wi) return;
    const def = wi.def;
    const kind = def.bullet.kind ?? 'shot';
    const melee = kind === 'slash';
    // tir détecté (nouveau lastShot) → flash de bouche, fumée, sens du prochain coup
    if (p.lastShot !== ps.shot) {
      ps.shot = p.lastShot;
      if (p.lastShot) {
        if (melee) ps.sign = -ps.sign;
        else if (def.muzzle !== 0) {
          ps.muzzleT = 0.07; ps.muzzleFr = (Math.random() * 3) | 0;
          ps.muzzleColor = def.muzzle ?? (kind === 'beam' ? def.bullet.color ?? 0x7ae8ff : 0xfff0a0);
          ps.smoke = true;
        }
      }
    }
    if (def !== ps.wdef) {
      if (ps.wdef) {
        ps.swapT = 0.24;
        for (let i = 0; i < 6; i++) { const a = Math.random() * TAU; this.part(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 4, Math.cos(a) * 30, Math.sin(a) * 30 - 10, 0.3, RARITY_HEX[wi.rarity], 1, 0); }
      }
      ps.wdef = def;
      ps.melee = -0.9;
    }
    // visée lissée (rotation fluide)
    let da = p.aim - ps.aim;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    ps.aim += da * (1 - Math.exp(-32 * dt));
    if (!Number.isFinite(ps.aim)) ps.aim = p.aim;
    const aim = ps.aim;
    const wf = Math.cos(aim) < 0 ? -1 : 1;
    const ws = this.get(p.id * 4 + 1, this.ents);
    const wt = this.setTex(ws, def.sprite);
    let rot = aim, dist = 3, wsx = 1, wsy = 1;
    if (melee) {
      const arc = def.bullet.arc ?? 1.8;
      if (def.type === 'spear') {
        // estoc : poussée vers l'avant
        if (p.swing > 0) dist += Math.sin(Math.min(1, (1 - p.swing / 0.18) * 1.4) * Math.PI) * 8;
        ps.melee += (0.2 * wf - ps.melee) * (1 - Math.exp(-12 * dt));
        rot += p.swing > 0 ? 0 : ps.melee;
      } else {
        if (p.swing > 0) {
          const t = 1 - p.swing / 0.18, e = 1 - Math.pow(1 - t, 3);
          ps.melee = (-0.5 + e) * arc * 0.95 * ps.sign * wf;
          // frottis : silhouettes blanches qui traînent derrière la lame
          if (!this.perf) {
            const col = def.bullet.color ?? 0xffffff;
            for (let i = 1; i <= 3; i++) {
              const ti = Math.max(0, t - i * 0.08), ei = 1 - Math.pow(1 - ti, 3);
              const g = this.fxp.take(wt.flash[0]);
              g.anchor.set(wt.ax, wt.ay);
              g.position.set(p.x + Math.cos(aim) * dist, p.y + 2 - bob + Math.sin(aim) * dist);
              g.rotation = aim + (-0.5 + ei) * arc * 0.95 * ps.sign * wf;
              g.scale.set(sc, wf * sc); g.tint = col; g.alpha = 0.45 - i * 0.12;
            }
          }
        } else {
          const rest = Math.max(-1.1, Math.min(1.1, 0.5 * arc * 0.95 * ps.sign)) * wf;
          ps.melee += (rest - ps.melee) * (1 - Math.exp(-10 * dt));
        }
        rot += ps.melee;
      }
    } else {
      // recul : l'arme recule, se cabre et s'écrase
      const rc = p.recoil;
      dist -= rc * 0.9;
      rot -= wf * Math.min(0.45, rc * 0.06);
      wsx = 1 - Math.min(0.25, rc * 0.03); wsy = 1 + Math.min(0.25, rc * 0.04);
      if (wi.charge > 0) { dist -= wi.charge * 2; if (wi.charge >= 0.99) rot += Math.sin(time * 60) * 0.03; }
      if (p.moving) rot += Math.sin(time * 7) * 0.05 * wf;
    }
    // changement d'arme : l'arme remonte en tournoyant et « pop »
    if (ps.swapT > 0) {
      const k = ps.swapT / 0.24;
      rot += wf * k * k * 2.4;
      dist -= k * 3;
      const pop = 1 + Math.sin((1 - k) * Math.PI) * 0.3;
      wsx *= pop; wsy *= pop;
      ps.swapT -= dt;
    }
    // l'arme rebondit à la marche, avec un léger retard sur le corps
    const lag = p.moving ? Math.abs(Math.sin(time * 14 - 0.7)) * 1.5 : Math.sin(time * 3 - 0.5) * 0.5;
    const hx = p.x + Math.cos(aim) * dist, hy = p.y + 2 - lag + Math.sin(aim) * dist;
    ws.position.set(hx, hy);
    ws.rotation = rot;
    ws.scale.set(sc * wsx, wf * sc * wsy);
    ws.zIndex = p.y + (Math.sin(aim) < -0.3 ? -1 : 1);
    ws.alpha = s.alpha;
    // flash de bouche (sprite) + halo + fumée
    if (ps.muzzleT > 0) {
      const tip = (1 - wt.ax) * wt.w * sc * wsx;
      const mx = hx + Math.cos(rot) * tip, my = hy + Math.sin(rot) * tip;
      const mt = this.tex.get('fx_muzzle');
      const k = ps.muzzleT / 0.07;
      if (mt) {
        const m = this.fxp.take(mt.frames[(ps.muzzleFr + (k < 0.5 ? 1 : 0)) % mt.frames.length]);
        m.anchor.set(mt.ax, mt.ay);
        m.position.set(mx, my); m.rotation = rot; m.scale.set(sc * (0.7 + k * 0.5)); m.tint = ps.muzzleColor;
        const core = this.fxp.take(mt.frames[2]);
        core.anchor.set(mt.ax, mt.ay); core.position.set(mx, my); core.rotation = rot; core.scale.set(sc * 0.6 * k);
      }
      this.glow(mx, my, 30, ps.muzzleColor, 0.6 * k);
      if (ps.smoke && !paused) {
        ps.smoke = false;
        this.part(mx, my, Math.cos(rot) * 14, Math.sin(rot) * 14 - 6, 0.45, 0x8a8494, 2, 5);
        this.part(mx, my, (Math.random() - 0.5) * 30 + Math.cos(rot) * 50, (Math.random() - 0.5) * 30 + Math.sin(rot) * 50, 0.12, ps.muzzleColor, 1, 0);
      }
      ps.muzzleT -= dt;
    }
    if (wi.charge > 0) {
      this.over.rect(p.x - 8, p.y - 15, 16, 3).fill({ color: 0x1b1326 });
      this.over.rect(p.x - 7, p.y - 14, 14 * wi.charge, 1).fill({ color: wi.charge >= 0.99 ? 0xffffff : 0xffd23a });
      if (wi.charge >= 0.99) this.glow(hx, hy, 16, 0xffffff, 0.3 + Math.sin(time * 20) * 0.1);
    }
  }
}
