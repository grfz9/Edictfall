// Protocole réseau du multijoueur en ligne (hôte autoritaire). Messages JSON compacts.
// Seuls transitent : le pseudo choisi par le joueur, ses entrées de jeu et l'état de la partie.
import type { Fx, PlayerInput, RunMode } from '../core/types';

export const PROTO_VERSION = 1;
export const MAX_PLAYERS = 4;
/** Fréquence des instantanés envoyés par l'hôte (Hz). */
export const SNAPSHOT_HZ = 20;
/** Alphabet des codes de salon : pas de 0/O, 1/I/L, etc. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 5;

export function randomCode(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return s;
}
/** Normalise un code saisi (majuscules, espaces et caractères hors alphabet retirés). Accepte aussi un lien `?salon=`. */
export function normalizeCode(s: string): string {
  const m = /[?&]salon=([^&#]+)/i.exec(s);
  if (m) s = decodeURIComponent(m[1]);
  return s.toUpperCase().split('').filter((c) => CODE_ALPHABET.includes(c)).join('').slice(0, 8);
}
/** Pseudo propre : 1 à 16 caractères imprimables. */
export function cleanName(s: unknown): string {
  const t = String(s ?? '').replace(/[\u0000-\u001f\u007f<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return t || 'Joueur';
}

/** Entrée compacte : [mx, my, ax, ay, bits] (bits : aimManual, fire, firePressed, swap, interact, skill). */
export type InputPacket = [number, number, number, number, number];
const r2 = (v: number) => Math.round(v * 100) / 100;
export function packInput(i: PlayerInput): InputPacket {
  const bits = (i.aimManual ? 1 : 0) | (i.fire ? 2 : 0) | (i.firePressed ? 4 : 0) | (i.swap ? 8 : 0) | (i.interact ? 16 : 0) | (i.skill ? 32 : 0);
  return [r2(i.mx), r2(i.my), r2(i.ax), r2(i.ay), bits];
}
export function unpackInput(p: unknown): PlayerInput | null {
  if (!Array.isArray(p) || p.length < 5) return null;
  const n = (v: unknown, lim: number) => { const x = Number(v); return Number.isFinite(x) ? Math.max(-lim, Math.min(lim, x)) : 0; };
  const b = n(p[4], 255) | 0;
  return {
    mx: n(p[0], 1.5), my: n(p[1], 1.5), ax: n(p[2], 1e5), ay: n(p[3], 1e5),
    aimManual: !!(b & 1), fire: !!(b & 2), firePressed: !!(b & 4), swap: !!(b & 8), interact: !!(b & 16), skill: !!(b & 32),
  };
}

export interface LobbyEntry { name: string; hero: string; ping: number; host: boolean }

/** Invité → hôte. */
export type GuestMsg =
  | { t: 'hello'; v: number; name: string }
  | { t: 'in'; i: InputPacket }
  | { t: 'ping'; c: number; rtt: number }
  | { t: 'vote'; i: number }
  | { t: 'dlg'; d: number; i: number }
  | { t: 'bye' };

/** Hôte → invité. */
export type HostMsg =
  | { t: 'welcome'; index: number; code: string }
  | { t: 'reject'; reason: string }
  | { t: 'pong'; c: number }
  | { t: 'lobby'; m: LobbyEntry[]; code: string; mode: RunMode }
  | { t: 'req'; type: string; data?: unknown }
  | { t: 'toast'; title: string; sub?: string; color?: string }
  | { t: 'bye'; reason: string }
  | Snapshot;

export interface FloorPacket {
  w: number; h: number; tiles: number[]; rooms: any[]; start: number; world: number; floor: number; rev: number;
}
/** Instantané de l'état (les listes d'entités sont delta-encodées : la partie statique n'est renvoyée que si elle change). */
export interface Snapshot {
  t: 's';
  n: number;
  /** Index du joueur destinataire. */
  me: number;
  h: any[];
  P: any[]; E: any[]; B: any[]; K: any[]; C: any[]; O: any[]; I: any[]; T: any[]; U: any[];
  /** États des salles (si changés). */
  R?: number[];
  /** Focus (objet à portée) de chaque joueur. */
  Fo: number[];
  fx: Fx[];
  F?: FloorPacket;
  M?: any;
  Ru?: any[];
  Ch?: any | null;
  D?: any | null;
  S?: any | null;
  V?: [number, string][];
}
export type AnyMsg = GuestMsg | HostMsg;
