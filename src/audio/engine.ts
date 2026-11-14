// Utilitaires partagés par les SFX et la musique (aucune dépendance au reste du jeu).

/** Accès bas niveau au contexte audio fourni par AudioSys aux couches de synthèse. */
export interface Engine {
  ac: AudioContext;
  /** 1 s de bruit blanc (bouclé, lu à un décalage aléatoire). */
  noise: AudioBuffer;
  /** Réserve une voix ('m' = musique, 's' = sfx). false si le budget est atteint. */
  take(kind: 'm' | 's'): boolean;
  /** À la fin de `src` : déconnecte `nodes`, libère la voix, puis appelle `done`. */
  own(src: AudioScheduledSourceNode, nodes: AudioNode[], kind: 'm' | 's', done?: () => void): void;
}

/** Budgets de voix (≤ 24 au total, raisonnable sur mobile). */
export const SFX_VOICES = 12;
export const MUSIC_VOICES = 12;

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** PRNG déterministe (mulberry32) : la musique d'un monde est toujours la même. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Courbe de saturation douce (tanh). */
export function softClip(k: number, n = 1024): Float32Array {
  const c = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / norm;
  }
  return c;
}

/** Courbe « bitcrush » légère : quantification de l'amplitude. */
export function crushCurve(levels: number, n = 512): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.round(x * levels) / levels;
  }
  return c;
}

export function makeNoise(ac: AudioContext): AudioBuffer {
  const len = Math.max(1, Math.floor(ac.sampleRate || 44100));
  const buf = ac.createBuffer(1, len, ac.sampleRate || 44100);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Programme une source de bruit bouclée, démarrée à `t` pour `dur` s. */
export function noiseSource(e: Engine, t: number, dur: number): AudioBufferSourceNode {
  const s = e.ac.createBufferSource();
  s.buffer = e.noise;
  s.loop = true;
  s.start(t, Math.random() * 0.8);
  s.stop(t + dur);
  return s;
}
