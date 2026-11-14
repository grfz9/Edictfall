import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioSys } from '../src/audio/audio';
import { SFX } from '../src/audio/sfx';
import { compose, WORLDS } from '../src/audio/music';

const IDS = ('shoot rifle shotgun laser bow launch swing magic weird empty hit crit explode break die bossdie hurt armor ' +
  'armorup death eshoot ering elob elaser summon dash blink phase boss wave lock clear chest mimic coin orb heal gem ' +
  'pickup swap buy deny unlock select skill offer edict buff synergy portal secret victory gameover pet ' +
  'zap bubble thud pew boing honk splash fire ice charge').split(' ');

// ─── Faux AudioContext minimal (vérifie les mêmes contraintes que les navigateurs) ───
class MockParam {
  value = 0;
  private chk(v: number, t = 0): void {
    if (!Number.isFinite(v) || !Number.isFinite(t)) throw new TypeError('non-finite');
  }
  setValueAtTime(v: number, t: number) { this.chk(v, t); this.value = v; return this; }
  linearRampToValueAtTime(v: number, t: number) { this.chk(v, t); this.value = v; return this; }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.chk(v, t);
    if (v === 0) throw new RangeError('exponential ramp to 0');
    this.value = v; return this;
  }
  setTargetAtTime(v: number, t: number, tc: number) { this.chk(v, t); this.chk(tc); this.value = v; return this; }
  cancelScheduledValues() { return this; }
}

class MockCtx {
  static instances: MockCtx[] = [];
  currentTime = 0;
  sampleRate = 44100;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  sources: any[] = [];
  created = 0;
  destination: any;
  constructor() { MockCtx.instances.push(this); this.destination = this.node('dest'); }
  node(kind: string, source = false): any {
    this.created++;
    const ctx = this;
    const base: any = { kind, connect: (d: any) => d, disconnect: () => { base.disconnected = true; } };
    if (source) {
      base.start = (t = 0) => {
        if (base.started) throw new Error('InvalidStateError: start twice');
        if (!Number.isFinite(t)) throw new TypeError('bad start');
        base.started = true; base.startT = t; ctx.sources.push(base);
      };
      base.stop = (t = 0) => {
        if (!base.started) throw new Error('InvalidStateError: stop before start');
        if (!Number.isFinite(t)) throw new TypeError('bad stop');
        base.stopT = t;
      };
    }
    return new Proxy(base, {
      get(o, k) {
        if (k in o) return o[k];
        if (typeof k === 'string' && k !== 'then' && k !== 'onended') { o[k] = new MockParam(); return o[k]; }
        return undefined;
      },
    });
  }
  createGain() { return this.node('gain'); }
  createOscillator() { return this.node('osc', true); }
  createBufferSource() { return this.node('buf', true); }
  createBiquadFilter() { return this.node('biquad'); }
  createDynamicsCompressor() { return this.node('comp'); }
  createWaveShaper() { return this.node('shaper'); }
  createDelay() { return this.node('delay'); }
  createBuffer(_ch: number, len: number, sr: number) {
    return { length: len, sampleRate: sr, duration: len / sr, getChannelData: () => new Float32Array(len) };
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  /** Avance l'horloge et déclenche onended des sources terminées. */
  advance(dt: number): void {
    this.currentTime += dt;
    const keep: any[] = [];
    for (const s of this.sources) {
      if (s.stopT !== undefined && s.stopT <= this.currentTime) { s.ended = true; s.onended?.(); }
      else keep.push(s);
    }
    this.sources = keep;
  }
}

function run(ctx: MockCtx, seconds: number): void {
  const n = Math.ceil(seconds / 0.025);
  for (let i = 0; i < n; i++) { ctx.advance(0.025); vi.advanceTimersByTime(25); }
}

describe('audio sans Web Audio (headless)', () => {
  it('toutes les méthodes publiques sont des no-op sûrs', () => {
    const g = globalThis as any;
    const saved = g.AudioContext;
    delete g.AudioContext;
    try {
      const a = new AudioSys();
      expect(() => {
        a.unlock();
        a.setVolumes(0.5, 0.5);
        for (const id of IDS) a.sfx(id, 1);
        a.sfx('inconnu', 1);
        for (let w = 0; w <= 3; w++) { a.startMusic(w); for (let n = 0; n <= 10; n++) a.setIntensity(n); }
        a.setPaused(true); a.setPaused(false);
        a.stopMusic();
      }).not.toThrow();
      expect(a.debugState().hasContext).toBe(false);
      expect(a.debugState().playing).toBe(false);
    } finally { if (saved) g.AudioContext = saved; }
  });
});

describe('audio avec un faux AudioContext', () => {
  let ctx: MockCtx;
  let a: AudioSys;
  beforeEach(() => {
    vi.useFakeTimers();
    MockCtx.instances = [];
    (globalThis as any).AudioContext = MockCtx;
    a = new AudioSys();
    a.unlock();
    ctx = MockCtx.instances[0];
  });
  afterEach(() => {
    a.stopMusic();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    delete (globalThis as any).AudioContext;
  });

  it('unlock crée et reprend le contexte', () => {
    expect(ctx).toBeDefined();
    expect(ctx.state).toBe('running');
    expect(a.debugState().hasContext).toBe(true);
  });

  it('chaque id de sfx est défini et joue sans exception ; id inconnu = bip', () => {
    for (const id of IDS) expect(SFX[id], id).toBeDefined();
    for (const id of IDS) {
      const before = a.debugState().sfxPlayed;
      expect(() => a.sfx(id, 1)).not.toThrow();
      expect(a.debugState().sfxPlayed, id).toBe(before + 1);
      run(ctx, 1.6); // laisse finir les jingles (le budget de voix sacrifierait sinon les sons de faible priorité)
    }
    const before = a.debugState().sfxPlayed;
    a.sfx('totalement_inconnu', 1);
    expect(a.debugState().sfxPlayed).toBe(before + 1);
    // Plus aucune voix après extinction (pas de fuite).
    run(ctx, 3);
    expect(a.debugState().sfxVoices).toBe(0);
    expect(a.debugState().sfxInstances).toBe(0);
  });

  it('anti-saturation : pas de doublon < 30 ms et budget de voix borné', () => {
    a.sfx('hit'); a.sfx('hit');
    expect(a.debugState().sfxPlayed).toBe(1);
    for (let i = 0; i < 200; i++) { a.sfx(IDS[i % IDS.length]); ctx.advance(0.002); }
    expect(a.debugState().sfxVoices).toBeLessThanOrEqual(24);
    run(ctx, 3);
    expect(a.debugState().sfxVoices).toBe(0);
  });

  it('volume sfx à 0 : rien n\'est joué', () => {
    a.setVolumes(0, 0.5);
    a.sfx('explode');
    expect(a.debugState().sfxPlayed).toBe(0);
  });

  it('musique : 4 mondes × intensités 0..10, couches croissantes', () => {
    for (let w = 0; w <= 3; w++) {
      a.startMusic(w);
      expect(a.debugState().world).toBe(w);
      let prevLayers = 0;
      for (let n = 0; n <= 10; n++) {
        a.setIntensity(n);
        run(ctx, 1);
        const st = a.debugState();
        expect(st.playing).toBe(true);
        expect(st.activeLayers).toBeGreaterThanOrEqual(prevLayers);
        expect(st.musicVoices).toBeLessThanOrEqual(12);
        prevLayers = st.activeLayers;
      }
      expect(prevLayers).toBe(6);
      a.setIntensity(0);
      expect(a.debugState().activeLayers).toBe(2);
      // Plusieurs mesures à intensité max : des notes sont planifiées.
      a.setIntensity(10);
      const before = a.debugState().notes;
      run(ctx, 4);
      expect(a.debugState().notes).toBeGreaterThan(before);
      expect(a.debugState().bpm).toBeGreaterThan(WORLDS[w].bpm * 1.05);
    }
  });

  it('pause, volume musique à 0 et arrêt', () => {
    a.startMusic(1);
    a.setIntensity(4);
    run(ctx, 1);
    a.setPaused(true);
    run(ctx, 1);
    expect(a.debugState().paused).toBe(true);
    expect(a.debugState().playing).toBe(true);
    a.setPaused(false);
    a.setVolumes(0.7, 0);
    run(ctx, 0.5);
    const n0 = a.debugState().notes;
    run(ctx, 2);
    expect(a.debugState().notes).toBe(n0); // aucune note planifiée inutilement
    a.setVolumes(0.7, 0.5);
    run(ctx, 1);
    expect(a.debugState().notes).toBeGreaterThan(n0);
    a.stopMusic();
    expect(a.debugState().playing).toBe(false);
    run(ctx, 3);
    expect(a.debugState().musicVoices).toBe(0);
  });

  it('startMusic avant unlock : la musique démarre au déverrouillage', () => {
    delete (globalThis as any).AudioContext;
    const b = new AudioSys();
    b.startMusic(2);
    b.setIntensity(5);
    expect(b.debugState().playing).toBe(false);
    (globalThis as any).AudioContext = MockCtx;
    b.unlock();
    expect(b.debugState().playing).toBe(true);
    expect(b.debugState().activeLayers).toBe(5);
    b.stopMusic();
  });
});

describe('composition', () => {
  it('déterministe et bien formée (16 mesures)', () => {
    for (const wm of WORLDS) {
      const c1 = compose(wm), c2 = compose(wm);
      expect(c1).toEqual(c2);
      expect(c1.chords.length).toBe(16);
      expect(c1.mel.length).toBe(16);
      for (const bar of c1.mel) for (const [s, , len] of bar) { expect(s).toBeGreaterThanOrEqual(0); expect(s + len).toBeLessThanOrEqual(16); }
    }
  });
});
