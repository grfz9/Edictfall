// Point d'entrée : assemble simulation, rendu, entrées, audio et interface.
import './ui/style.css';
import { R } from './core/registry';
import { loadSave, storeSave } from './core/save';
import { randomSeedString } from './core/rng';
import type { SaveData } from './core/types';
import { World } from './sim/world';
import { botInput } from './sim/bot';
import { Renderer } from './render/renderer';
import { Input } from './input/input';
import { AudioSys } from './audio/audio';
import { UI } from './ui/ui';

// Tout fichier déposé dans src/content/ est chargé automatiquement et s'enregistre lui-même.
import.meta.glob('./content/**/*.ts', { eager: true });

const STEP = 1 / 60;

export class Game {
  save: SaveData = loadSave();
  world = new World(this.save);
  renderer = new Renderer();
  audio = new AudioSys();
  input!: Input;
  ui!: UI;
  /** title = écran titre ; play = en jeu (hall ou run) ; pause ; end = récapitulatif de run. */
  state: 'title' | 'play' | 'pause' | 'end' = 'title';
  /** Seed imposée pour la prochaine run ('' = aléatoire). */
  seedText = '';
  /** Coop locale : héros du joueur 2 (null = solo). */
  coopHero: string | null = null;
  /** Pilote automatique (tests). */
  bot = false;
  fps = 60;
  private acc = 0;
  private last = 0;
  private musicKey = '';

  async boot(): Promise<void> {
    this.world.persist = () => storeSave(this.save);
    await this.renderer.init(document.getElementById('game')!);
    this.input = new Input(this.renderer.app.canvas, document.getElementById('touch')!);
    this.input.onPause = () => this.togglePause();
    this.input.onFirstGesture = () => { this.audio.unlock(); this.syncMusic(true); };
    this.ui = new UI(this);
    this.applyOptions();
    this.world.startHub();
    this.setState('title');
    this.last = performance.now();
    const loop = (now: number) => { this.frame(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play' && this.world.mode === 'run') this.setState('pause'); });
  }

  applyOptions(): void {
    const o = this.save.options;
    this.audio.setVolumes(o.sfx, o.music);
    this.renderer.shakeOpt = o.shake;
    this.renderer.showNumbers = o.damageNumbers;
    this.input.setTouchMode(o.touch);
    storeSave(this.save);
  }

  setState(s: Game['state']): void {
    this.state = s;
    this.input.setTouchActive(s === 'play');
    this.audio.setPaused(s === 'pause');
    this.ui.onState(s);
  }
  togglePause(): void {
    if (this.state === 'play' && !this.world.choice) this.setState('pause');
    else if (this.state === 'pause') this.setState('play');
  }
  toHub(): void {
    this.world.startHub();
    this.coopHero = null;
    this.setState('play');
  }
  startRun(seed?: string): void {
    const s = (seed ?? this.seedText).trim().toUpperCase() || randomSeedString();
    const heroes = [this.world.players[0]?.hero.id ?? this.save.hero];
    if (this.coopHero) heroes.push(this.coopHero);
    this.world.startRun(s, heroes);
    this.setState('play');
  }
  /** Ajoute/retire le joueur 2 dans le hall. */
  toggleCoop(): void {
    const w = this.world;
    if (w.mode !== 'hub') return;
    if (w.players.length > 1) { w.players.length = 1; this.coopHero = null; return; }
    const p1 = w.players[0];
    const hero = [...R.heroes.values()].find((h) => w.heroUnlocked(h) && h !== p1.hero) ?? p1.hero;
    w.players.push(w.makePlayer(hero, 1, p1.x + 16, p1.y));
    this.coopHero = hero.id;
  }

  private syncMusic(force = false): void {
    const w = this.world;
    const key = this.state === 'title' ? 'title' : w.mode === 'hub' ? 'hub' : 'w' + w.worldNum;
    if (key !== this.musicKey || force) {
      this.musicKey = key;
      this.audio.startMusic(key === 'title' || key === 'hub' ? 0 : w.worldNum);
    }
    this.audio.setIntensity(w.mode === 'run' ? w.rules.ofKind('rule').length + (w.boss ? 2 : 0) : 0);
  }

  private frame(now: number): void {
    const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;
    this.fps += (1 / Math.max(dt, 0.001) - this.fps) * 0.05;
    const w = this.world;

    if (this.state === 'play') {
      const origins = w.players.map((p) => this.renderer.worldToScreen(p.x, p.y));
      const inputs = this.input.poll(dt, w.players.length, origins, !!w.focus[0]);
      // Les fronts montants (ramasser, compétence, changer d'arme, clic) sont conservés jusqu'à ce qu'un pas
      // de simulation les consomme : sinon, sur un écran > 60 Hz, une image sans pas de simulation les perdait.
      w.players.forEach((p, i) => {
        const prev = p.input;
        const next = this.bot && i === 0 ? botInput(w, p) : inputs[i] ?? prev;
        if (prev && next !== prev) {
          next.swap ||= prev.swap; next.interact ||= prev.interact; next.skill ||= prev.skill; next.firePressed ||= prev.firePressed;
        }
        p.input = next;
      });
      if (this.bot && w.choice) w.pick(0);
      // coop : dans le hall, le héros de J2 suit ses changements
      if (w.mode === 'hub' && w.players[1]) this.coopHero = w.players[1].hero.id;
      this.acc += dt;
      let steps = 0;
      if (this.ui.blocking) this.acc = 0;
      while (this.acc >= STEP && steps < 4) {
        w.update(STEP);
        this.acc -= STEP;
        steps++;
        for (const p of w.players) { p.input.swap = p.input.interact = p.input.skill = p.input.firePressed = false; }
      }
      if (steps === 4) this.acc = 0;
      if (w.request) {
        const r = w.request;
        w.request = null;
        if (r.type === 'start') this.startRun();
        else this.ui.openPanel(r.type);
      }
      if (w.mode === 'dead' || w.mode === 'won') this.setState('end');
    }
    for (const fx of w.fx) {
      if (fx.t === 'sfx') this.audio.sfx(fx.id, fx.vol);
      else if (fx.t === 'banner') this.ui.banner(fx.title, fx.sub, fx.color);
      else this.renderer.handleFx(fx, w);
    }
    w.fx.length = 0;
    this.syncMusic();
    this.renderer.render(w, this.state === 'pause' ? 0 : dt);
    this.ui.frame(dt);
    this.input.endFrame();
  }
}

const game = new Game();
(window as any).__game = game;
game.boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f66;position:fixed;top:0;left:0;z-index:99;padding:12px">Erreur de démarrage : ${String(e?.message ?? e)}</pre>`);
});
