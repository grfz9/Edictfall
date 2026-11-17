// Invité : envoie ses entrées à l'hôte et applique les instantanés reçus sur un World miroir (aucune simulation locale).
// Indépendant du DOM : testable en headless avec un transport en mémoire.
import type { PlayerInput, RunMode } from '../core/types';
import type { World } from '../sim/world';
import type { Conn, Transport } from './transport';
import { Mirror } from './codec';
import { PROTO_VERSION, cleanName, packInput, type LobbyEntry } from './protocol';

const SEND_HZ = 30;

export class NetClient {
  readonly role = 'guest' as const;
  /** Index de mon joueur dans world.players (-1 tant que non accepté). */
  index = -1;
  /** Aller-retour mesuré avec l'hôte (ms). */
  ping = 0;
  code = '';
  lobby: LobbyEntry[] = [];
  hubMode: RunMode = 'story';
  readonly mirror: Mirror;
  name: string;
  private conn: Conn | null = null;
  private pend: PlayerInput | null = null;
  private sendT = 0;
  private pingT = 0;
  private closed = false;
  private reason = 'La connexion avec l\'hôte a été perdue.';
  /** Horloge (ms) : remplaçable dans les tests. */
  clock: () => number = () => performance.now();
  onClose: (reason: string) => void = () => {};
  onRequest: (type: string, data?: unknown) => void = () => {};
  onToast: (title: string, sub?: string, color?: string) => void = () => {};
  onLobby: () => void = () => {};
  /** Un instantané vient d'être appliqué. */
  onSnapshot: () => void = () => {};

  constructor(public world: World, private transport: Transport, name: string) {
    this.mirror = new Mirror(world);
    this.name = cleanName(name);
  }

  /** Rejoint le salon : résout à l'acceptation par l'hôte, rejette (avec un message lisible) sinon. */
  async join(code: string): Promise<void> {
    let conn: Conn;
    try { conn = await this.transport.join(code); }
    catch (e) {
      const m = (e as Error)?.message ?? '';
      throw new Error(m === 'peer-unavailable' ? `Salon « ${code} » introuvable. Vérifie le code.` : m === 'timeout' ? 'Le serveur de connexion ne répond pas. Réessaie.' : `Connexion impossible (${m || 'erreur'}).`);
    }
    this.conn = conn;
    this.code = code;
    return new Promise<void>((resolve, reject) => {
      let accepted = false;
      conn.onMessage = (msg: any) => {
        if (!msg || typeof msg !== 'object') return;
        if (!accepted) {
          if (msg.t === 'welcome') { accepted = true; this.index = msg.index; this.code = msg.code || code; resolve(); }
          else if (msg.t === 'reject') { this.closed = true; reject(new Error(msg.reason)); conn.close(); }
          return;
        }
        this.onMsg(msg);
      };
      conn.onClose = () => {
        if (!accepted) { if (!this.closed) reject(new Error('L\'hôte a refusé ou fermé la connexion.')); this.closed = true; return; }
        this.end(this.reason);
      };
      conn.send({ t: 'hello', v: PROTO_VERSION, name: this.name });
    });
  }

  get connected(): boolean { return !!this.conn && !this.closed; }

  private onMsg(msg: any): void {
    switch (msg.t) {
      case 's':
        this.mirror.apply(msg, this.clock());
        this.index = msg.me;
        this.onSnapshot();
        break;
      case 'pong':
        if (Number.isFinite(msg.c)) { const rtt = this.clock() - msg.c; this.ping = this.ping ? this.ping * 0.6 + rtt * 0.4 : rtt; }
        break;
      case 'lobby':
        this.lobby = Array.isArray(msg.m) ? msg.m : [];
        if (msg.code) this.code = msg.code;
        if (msg.mode) this.hubMode = msg.mode;
        this.onLobby();
        break;
      case 'req': this.onRequest(String(msg.type), msg.data); break;
      case 'toast': this.onToast(String(msg.title ?? ''), msg.sub ? String(msg.sub) : undefined, msg.color); break;
      case 'bye': this.reason = String(msg.reason || 'L\'hôte a quitté la partie.'); this.end(this.reason); break;
    }
  }

  /** Entrées locales de cette image (les fronts montants sont cumulés jusqu'à l'envoi). */
  pushInput(inp: PlayerInput, dt: number): void {
    if (!this.connected || this.index < 0) return;
    const p = this.pend;
    if (p) { inp.swap ||= p.swap; inp.interact ||= p.interact; inp.skill ||= p.skill; inp.firePressed ||= p.firePressed; }
    this.pend = inp;
    this.sendT += dt;
    const edge = inp.swap || inp.interact || inp.skill || inp.firePressed;
    if (edge || this.sendT >= 1 / SEND_HZ) {
      this.sendT = 0;
      this.conn!.send({ t: 'in', i: packInput(inp) });
      this.pend = null;
    }
  }

  /** À chaque image : interpolation et ping. */
  frame(dt: number): void {
    this.mirror.interpolate(this.clock(), dt);
    if (!this.connected) return;
    this.pingT += dt;
    if (this.pingT >= 1) { this.pingT = 0; this.conn!.send({ t: 'ping', c: this.clock(), rtt: Math.round(this.ping) }); }
  }

  /** Vote pour une carte d'édit (l'hôte valide). */
  vote(i: number): void { this.conn?.send({ t: 'vote', i }); }
  /** Choix dans un dialogue affiché (Wassim, PNJ…). */
  dialogChoose(i: number): void { this.conn?.send({ t: 'dlg', d: this.mirror.dialogId, i }); }

  private end(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    const c = this.conn;
    this.conn = null;
    c?.close();
    this.onClose(reason);
  }

  /** Quitte le salon volontairement. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    const c = this.conn;
    this.conn = null;
    c?.send({ t: 'bye' });
    c?.close();
  }
}
