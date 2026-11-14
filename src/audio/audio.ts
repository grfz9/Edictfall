// Audio 100 % synthétisé (Web Audio). Interface publique stable :
//   unlock(), sfx(id, vol), setVolumes(sfx, music), startMusic(world), setIntensity(n), stopMusic(), setPaused(b)
// + debugState() (lecture seule, pour les tests).
//
// Graphe : sfx instances → [crusher] → sfxBus ─┐
//          Song.out → musicBus → pauseLP → pauseGain ─┴→ limiter → master → destination
import { Engine, SFX_VOICES, MUSIC_VOICES, crushCurve, makeNoise, noiseSource } from './engine';
import { SFX, SFX_FALLBACK, RISE, SfxDef, SfxLayer } from './sfx';
import { Song, WORLDS } from './music';

interface Inst { id: string; g: GainNode; srcs: AudioScheduledSourceNode[]; pending: number; p: number; t: number; voices: number; dead: boolean }

export interface AudioDebugState {
  hasContext: boolean;
  state: string;
  world: number;
  playing: boolean;
  intensity: number;
  layers: string[];
  activeLayers: number;
  bpm: number;
  bar: number;
  sfxVoices: number;
  musicVoices: number;
  sfxInstances: number;
  notes: number;
  sfxPlayed: number;
  paused: boolean;
}

const MUSIC_GAIN = 0.55;

export class AudioSys {
  private ac: AudioContext | null = null;
  private eng: Engine | null = null;
  private sfxBus: GainNode | null = null;
  private crush: WaveShaperNode | null = null;
  private musicBus: GainNode | null = null;
  private pauseLP: BiquadFilterNode | null = null;
  private pauseGain: GainNode | null = null;
  private sfxVol = 0.7;
  private musicVol = 0.5;
  private last = new Map<string, number>();
  private combo = new Map<string, { t: number; n: number }>();
  private insts: Inst[] = [];
  private sfxVoices = 0;
  private musicVoices = 0;
  private sfxPlayed = 0;
  private song: Song | null = null;
  private world = 0;
  private wantMusic = false;
  private intensity = 0;
  private paused = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private bound = false;

  // ─── Cycle de vie ───

  /** À appeler depuis un geste utilisateur (iOS) : crée ou reprend le contexte. */
  unlock(): void {
    try {
      if (!this.ac) {
        const g = globalThis as any;
        const AC = g.AudioContext || g.webkitAudioContext;
        if (!AC) return;
        let ac: AudioContext;
        try { ac = new AC({ latencyHint: 'interactive' }); } catch { ac = new AC(); }
        this.ac = ac;
        this.build(ac);
      }
      this.resume();
      this.bindResume();
      if (this.wantMusic && !this.song) this.startMusic(this.world);
    } catch {
      /* pas d'audio : le jeu continue en silence */
    }
  }

  private resume(): void {
    const ac = this.ac;
    if (!ac || ac.state === 'running' || ac.state === 'closed') return;
    try {
      const p: any = ac.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      // iOS : jouer un buffer muet dans le geste « déverrouille » la sortie.
      const b = ac.createBufferSource();
      b.buffer = ac.createBuffer(1, 1, ac.sampleRate || 44100);
      b.connect(ac.destination);
      b.onended = () => { try { b.disconnect(); } catch { /* */ } };
      b.start(0);
    } catch { /* */ }
  }

  private bindResume(): void {
    if (this.bound || typeof window === 'undefined' || !window.addEventListener) return;
    this.bound = true;
    const h = () => this.resume();
    for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, h, { passive: true });
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden) h(); });
  }

  private build(ac: AudioContext): void {
    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    const master = ac.createGain();
    master.gain.value = 0.9;
    limiter.connect(master);
    master.connect(ac.destination);

    this.sfxBus = ac.createGain();
    this.sfxBus.gain.value = this.sfxVol;
    this.sfxBus.connect(limiter);
    this.crush = ac.createWaveShaper();
    this.crush.curve = crushCurve(14) as any;
    this.crush.connect(this.sfxBus);

    this.musicBus = ac.createGain();
    this.musicBus.gain.value = this.musicVol * MUSIC_GAIN;
    this.pauseLP = ac.createBiquadFilter();
    this.pauseLP.type = 'lowpass';
    this.pauseLP.frequency.value = this.paused ? 500 : 20000;
    this.pauseGain = ac.createGain();
    this.pauseGain.gain.value = this.paused ? 0.4 : 1;
    this.musicBus.connect(this.pauseLP);
    this.pauseLP.connect(this.pauseGain);
    this.pauseGain.connect(limiter);

    this.eng = {
      ac,
      noise: makeNoise(ac),
      take: (k) => {
        if (k === 'm') { if (this.musicVoices >= MUSIC_VOICES) return false; this.musicVoices++; return true; }
        this.sfxVoices++;
        return true;
      },
      own: (src, nodes, k, done) => {
        src.onended = () => {
          for (const n of nodes) { try { n.disconnect(); } catch { /* */ } }
          if (k === 'm') this.musicVoices = Math.max(0, this.musicVoices - 1);
          else this.sfxVoices = Math.max(0, this.sfxVoices - 1);
          done?.();
        };
      },
    };
  }

  // ─── Volumes / pause ───

  setVolumes(sfx: number, music: number): void {
    this.sfxVol = clamp01(sfx);
    this.musicVol = clamp01(music);
    const ac = this.ac;
    if (!ac) return;
    const now = ac.currentTime;
    try {
      this.sfxBus?.gain.setTargetAtTime(this.sfxVol, now, 0.02);
      this.musicBus?.gain.setTargetAtTime(this.musicVol * MUSIC_GAIN, now, 0.05);
    } catch { /* */ }
  }

  setPaused(b: boolean): void {
    b = !!b;
    if (b === this.paused) return;
    this.paused = b;
    const ac = this.ac;
    if (!ac || !this.pauseLP || !this.pauseGain) return;
    const now = ac.currentTime;
    try {
      this.pauseLP.frequency.setTargetAtTime(b ? 500 : 20000, now, 0.08);
      this.pauseGain.gain.setTargetAtTime(b ? 0.4 : 1, now, 0.08);
    } catch { /* */ }
  }

  // ─── Effets sonores ───

  sfx(id: string, vol = 1): void {
    try { this.playSfx(id, vol); } catch { /* jamais d'exception vers le jeu */ }
  }

  private playSfx(id: string, vol: number): void {
    const ac = this.ac, e = this.eng;
    if (!ac || !e || !this.sfxBus || this.sfxVol <= 0) return;
    if (!Number.isFinite(vol)) vol = 1;
    if (vol <= 0 || ac.state !== 'running') return;
    const known = Object.prototype.hasOwnProperty.call(SFX, id);
    const def: SfxDef = known ? SFX[id] : SFX_FALLBACK;
    const key = known ? id : '?';
    const now = ac.currentTime;
    if (now - (this.last.get(key) ?? -1) < (def.gap ?? 0.03)) return;
    const p = def.p ?? 1;
    const need = def.l.length;

    // Anti-saturation : instances max par son, puis budget global de voix.
    const live = this.insts.filter((i) => !i.dead);
    const same = live.filter((i) => i.id === key);
    if (same.length >= (def.max ?? 4)) this.kill(same[0], now);
    if (this.sfxVoices + need > SFX_VOICES) {
      let victim: Inst | null = null;
      for (const i of live) if (!i.dead && i.p <= p && (!victim || i.p < victim.p || (i.p === victim.p && i.t < victim.t))) victim = i;
      if (!victim) return; // rien de moins important à sacrifier : on laisse tomber ce son
      this.kill(victim, now);
    }
    this.last.set(key, now);

    let pitch = Math.pow(2, ((Math.random() * 2 - 1) * (def.j ?? 0.7)) / 12);
    if (def.rise) {
      const c = this.combo.get(key);
      const n = c && now - c.t < 0.6 ? Math.min(RISE.length - 1, c.n + 1) : 0;
      this.combo.set(key, { t: now, n });
      pitch = Math.pow(2, RISE[n] / 12);
    }

    const g = ac.createGain();
    g.gain.value = 0.25 * (def.v ?? 1) * Math.min(2, vol);
    g.connect(def.crush && this.crush ? this.crush : this.sfxBus);
    const inst: Inst = { id: key, g, srcs: [], pending: 0, p, t: now, voices: need, dead: false };
    const done = () => {
      if (--inst.pending > 0) return;
      inst.dead = true;
      try { g.disconnect(); } catch { /* */ }
      const k = this.insts.indexOf(inst);
      if (k >= 0) this.insts.splice(k, 1);
    };
    for (const L of def.l) this.layer(e, L, now + 0.005, pitch, g, inst, done);
    if (inst.pending === 0) { try { g.disconnect(); } catch { /* */ } return; }
    this.insts.push(inst);
    this.sfxPlayed++;
  }

  private kill(i: Inst, now: number): void {
    if (i.dead) return;
    i.dead = true;
    try {
      i.g.gain.setTargetAtTime(0, now, 0.006);
      for (const s of i.srcs) s.stop(now + 0.03);
    } catch { /* */ }
  }

  private layer(e: Engine, L: SfxLayer, t0: number, pitch: number, out: AudioNode, inst: Inst, done: () => void): void {
    const ac = e.ac;
    const t = t0 + (L.at ?? 0);
    const v = L.v ?? 1;
    const a = Math.max(0.001, L.a ?? 0.002);
    const st = L.st ?? 0.06;
    const notes = L.n && L.n.length ? L.n : null;
    const total = notes ? st * (notes.length - 1) + L.d : L.d;
    const end = t + a + total + 0.02;
    const g = ac.createGain();
    const nodes: AudioNode[] = [g];
    // Enveloppe
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    if (notes) {
      for (let i = 0; i < notes.length; i++) {
        const ti = t + a + i * st;
        if (i > 0) g.gain.setValueAtTime(v, ti);
        if (i < notes.length - 1) g.gain.exponentialRampToValueAtTime(v * 0.4, ti + st - 0.004);
        else g.gain.exponentialRampToValueAtTime(0.0001, ti + L.d);
      }
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + L.d);
    }
    let src: AudioScheduledSourceNode;
    if (L.w === 'noise') {
      src = noiseSource(e, t, end - t);
      const f = ac.createBiquadFilter();
      f.type = L.flt ?? 'lowpass';
      f.Q.value = L.q ?? 0.8;
      const f0 = clampF(L.f * pitch);
      f.frequency.setValueAtTime(f0, t);
      if (L.to) f.frequency.exponentialRampToValueAtTime(clampF(L.to * pitch), t + a + L.d);
      src.connect(f); f.connect(g);
      nodes.push(src, f);
    } else {
      const o = ac.createOscillator();
      o.type = L.w;
      const f0 = clampF(L.f * pitch);
      if (notes) {
        o.frequency.setValueAtTime(clampF(f0 * Math.pow(2, notes[0] / 12)), t);
        for (let i = 1; i < notes.length; i++) o.frequency.setValueAtTime(clampF(f0 * Math.pow(2, notes[i] / 12)), t + a + i * st);
      } else {
        o.frequency.setValueAtTime(f0, t);
      }
      if (!notes && L.to) {
        const f1 = clampF(L.to * pitch);
        if (L.lin) o.frequency.linearRampToValueAtTime(f1, t + a + L.d);
        else o.frequency.exponentialRampToValueAtTime(f1, t + a + L.d);
      }
      if (L.vib) {
        const lfo = ac.createOscillator(), lg = ac.createGain();
        lfo.frequency.value = L.vib[0];
        lg.gain.value = f0 * L.vib[1];
        lfo.connect(lg); lg.connect(o.frequency);
        lfo.start(t); lfo.stop(end);
        nodes.push(lfo, lg);
      }
      let last: AudioNode = o;
      if (L.flt) {
        const f = ac.createBiquadFilter();
        f.type = L.flt;
        f.frequency.value = clampF((L.ff ?? 3000) * pitch);
        f.Q.value = L.q ?? 0.8;
        o.connect(f);
        last = f;
        nodes.push(f);
      }
      last.connect(g);
      o.start(t);
      o.stop(end);
      nodes.push(o);
      src = o;
    }
    g.connect(out);
    e.take('s');
    inst.pending++;
    inst.srcs.push(src);
    e.own(src, nodes, 's', done);
  }

  // ─── Musique ───

  startMusic(world: number): void {
    try {
      let w = Math.floor(Number(world) || 0);
      if (w < 0) w = 0;
      if (w >= WORLDS.length) w = ((w - 1) % (WORLDS.length - 1)) + 1;
      this.world = w;
      this.wantMusic = true;
      const ac = this.ac, e = this.eng;
      if (!ac || !e || !this.musicBus) return;
      if (this.song && this.song.world === w && !this.song.dead) return;
      const now = ac.currentTime;
      const prev = this.song;
      if (prev) this.retire(prev, now, 0.6);
      const s = new Song(e, w, this.musicBus, prev ? 0.6 : 1.5);
      s.setIntensity(this.intensity, now);
      this.song = s;
      this.ensureTimer();
    } catch { /* */ }
  }

  setIntensity(n: number): void {
    n = Number.isFinite(n) ? Math.max(0, Math.min(12, n)) : 0;
    if (n === this.intensity) return;
    this.intensity = n;
    try {
      if (this.ac && this.song) this.song.setIntensity(n, this.ac.currentTime);
    } catch { /* */ }
  }

  stopMusic(): void {
    this.wantMusic = false;
    const ac = this.ac;
    if (!ac || !this.song) return;
    try { this.retire(this.song, ac.currentTime, 1.2); } catch { /* */ }
    this.song = null;
    this.clearTimer();
  }

  private retire(s: Song, now: number, dur: number): void {
    s.fadeOut(now, dur);
    setTimeout(() => s.dispose(), (dur + 0.4) * 1000);
  }

  private ensureTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.pump(), 25);
    this.pump();
  }

  private clearTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private pump(): void {
    try {
      const ac = this.ac, s = this.song;
      if (!ac || !s) { this.clearTimer(); return; }
      if (ac.state !== 'running') return;
      const hidden = typeof document !== 'undefined' && !!document.hidden;
      s.pump(ac.currentTime, hidden ? 1.1 : 0.1, this.musicVol <= 0);
    } catch { /* */ }
  }

  // ─── Debug (lecture seule) ───

  debugState(): AudioDebugState {
    const s = this.song;
    const layers = s ? s.activeLayers() : [];
    return {
      hasContext: !!this.ac,
      state: this.ac ? this.ac.state : 'none',
      world: this.world,
      playing: !!s,
      intensity: this.intensity,
      layers,
      activeLayers: layers.length,
      bpm: s ? s.bpm() : 0,
      bar: s ? (s.pos >> 4) & 15 : 0,
      sfxVoices: this.sfxVoices,
      musicVoices: this.musicVoices,
      sfxInstances: this.insts.length,
      notes: s ? s.notes : 0,
      sfxPlayed: this.sfxPlayed,
      paused: this.paused,
    };
  }
}

function clamp01(x: number): number { return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0; }
function clampF(f: number): number { return Math.max(20, Math.min(20000, f)); }
