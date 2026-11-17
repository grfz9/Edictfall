// Hôte autoritaire : fait tourner la vraie simulation, applique les entrées des invités à leur joueur
// et leur diffuse des instantanés de l'état (~20 Hz) + les effets (sons, particules, bannières).
// Indépendant du DOM : testable en headless avec un transport en mémoire.
import type { Fx, Dialog, HeroDef } from '../core/types';
import { R } from '../core/registry';
import { roomCenter } from '../sim/dungeon';
import type { World } from '../sim/world';
import type { Conn, HostHandle, Transport } from './transport';
import { Encoder } from './codec';
import { PROTO_VERSION, MAX_PLAYERS, SNAPSHOT_HZ, randomCode, cleanName, unpackInput, type HostMsg, type LobbyEntry } from './protocol';

export interface Member {
  id: number;
  name: string;
  /** null = l'hôte lui-même (membre 0). */
  conn: Conn | null;
  ping: number;
  hero: string;
  enc: Encoder | null;
  /** Carte d'édit pour laquelle ce joueur vote (-1 = aucune). */
  vote: number;
}

export class NetHost {
  readonly role = 'host' as const;
  code = '';
  members: Member[] = [];
  private handle: HostHandle | null = null;
  private fxBuf: Fx[] = [];
  private snapT = 0;
  private lobbyT = 0;
  private nextMember = 1;
  private dlgIds = new WeakMap<Dialog, number>();
  private dlgN = 0;
  private choiceRef: unknown = null;
  private closed = false;
  /** Le salon a changé (arrivée, départ, héros, ping). */
  onChange: () => void = () => {};
  /** Message à afficher localement (arrivée / départ d'un joueur). */
  onToast: (title: string, sub?: string) => void = () => {};
  /** Un message d'invité vient d'arriver (sert à faire avancer un onglet hôte masqué). */
  onActivity: () => void = () => {};

  constructor(public world: World, private transport: Transport, name: string) {
    this.members.push({ id: 0, name: cleanName(name), conn: null, ping: 0, hero: world.players[0]?.hero.id ?? '', enc: null, vote: -1 });
    // les invités ne dépensent pas les gemmes de l'hôte (déblocage de héros au hall)
    world.canSpend = (p) => p.index === 0;
  }

  /** Ouvre le salon (code aléatoire, nouvel essai si déjà pris). Retourne le code. */
  async open(code?: string, rand: () => number = Math.random): Promise<string> {
    let last: unknown = null;
    for (let i = 0; i < 5; i++) {
      const c = code ?? randomCode(rand);
      try {
        this.handle = await this.transport.host(c, (conn) => this.accept(conn));
        this.code = c;
        return c;
      } catch (e) {
        last = e;
        if (code || (e as Error)?.message !== 'unavailable-id') break;
      }
    }
    throw last ?? new Error('host');
  }

  get guests(): number { return this.members.length - 1; }

  private accept(conn: Conn): void {
    let m: Member | null = null;
    conn.onMessage = (msg) => {
      this.onActivity();
      if (!msg || typeof msg !== 'object') return;
      if (!m) { if (msg.t === 'hello') m = this.admit(conn, msg); return; }
      this.onMsg(m, msg);
    };
    conn.onClose = () => { if (m) this.drop(m); };
  }

  private freeHero(): HeroDef {
    const w = this.world;
    const used = new Set(w.players.map((p) => p.hero));
    return [...R.heroes.values()].find((h) => w.heroUnlocked(h) && !used.has(h)) ?? w.players[0]?.hero ?? w.heroDef();
  }

  private admit(conn: Conn, msg: { v: number; name: string }): Member | null {
    const w = this.world;
    const reject = (reason: string) => { conn.send({ t: 'reject', reason }); setTimeout(() => conn.close(), 300); return null; };
    if (this.closed) return reject('Le salon est fermé.');
    if (msg.v !== PROTO_VERSION) return reject('Version du jeu différente : rechargez la page (Ctrl+F5) des deux côtés.');
    if (this.members.length >= MAX_PLAYERS) return reject('Salon complet (4 joueurs maximum).');
    if (w.mode !== 'hub') return reject('Partie en cours : attends que l\'hôte revienne au hall.');
    this.syncPlayers();
    const hero = this.freeHero();
    const m: Member = { id: this.nextMember++, name: cleanName(msg.name), conn, ping: 0, hero: hero.id, enc: new Encoder(), vote: -1 };
    this.members.push(m);
    this.addPlayer(this.members.length - 1, hero);
    conn.send({ t: 'welcome', index: this.members.length - 1, code: this.code });
    this.snapT = 1;
    this.toastAll(`${m.name} a rejoint le salon`, '', m);
    this.broadcastLobby();
    return m;
  }

  private addPlayer(i: number, hero: HeroDef): void {
    const w = this.world;
    const lead = w.players[0];
    const c = lead ? { x: lead.x, y: lead.y } : roomCenter(w.floor.start);
    const p = w.makePlayer(hero, i, c.x + 18 * i, c.y + 12);
    w.players.splice(i, 0, p);
    w.players.forEach((q, k) => { q.index = k; });
  }

  /** Dans le hall : garantit un joueur par membre (après world.startHub()). */
  syncPlayers(): void {
    const w = this.world;
    if (w.mode !== 'hub') return;
    for (let i = w.players.length; i < this.members.length; i++) this.addPlayer(i, R.heroes.get(this.members[i].hero) ?? this.freeHero());
  }
  /** À appeler juste après world.startHub() : remet les invités dans le hall avec leur héros. */
  onHub(): void { this.syncPlayers(); this.snapT = 1; this.broadcastLobby(); }

  /** Héros de chaque membre, dans l'ordre des joueurs (pour world.startRun). */
  heroIds(): string[] {
    return this.members.map((m, i) => this.world.players[i]?.hero.id ?? m.hero);
  }

  private onMsg(m: Member, msg: any): void {
    const w = this.world;
    const idx = this.members.indexOf(m);
    if (idx < 1) return;
    switch (msg.t) {
      case 'in': {
        const inp = unpackInput(msg.i);
        const p = w.players[idx];
        if (!inp || !p) return;
        // fronts montants conservés jusqu'à ce qu'un pas de simulation les consomme
        const prev = p.input;
        inp.swap ||= prev.swap; inp.interact ||= prev.interact; inp.skill ||= prev.skill; inp.firePressed ||= prev.firePressed;
        p.input = inp;
        break;
      }
      case 'ping':
        if (Number.isFinite(msg.rtt)) m.ping = Math.max(0, Math.min(9999, Math.round(msg.rtt)));
        m.conn?.send({ t: 'pong', c: msg.c });
        break;
      case 'vote':
        if (w.choice && Number.isInteger(msg.i) && msg.i >= 0 && msg.i < w.choice.options.length) { m.vote = msg.i; this.snapT = 1; this.onChange(); }
        break;
      case 'dlg':
        if (w.dialog && this.dialogId(w.dialog) === msg.d && Number.isInteger(msg.i)) w.dialogChoose(msg.i);
        break;
      case 'bye':
        this.drop(m);
        break;
    }
  }

  private dialogId(d: Dialog): number {
    let id = this.dlgIds.get(d);
    if (id === undefined) { id = ++this.dlgN; this.dlgIds.set(d, id); }
    return id;
  }

  /** Retire proprement un invité (déconnexion ou départ). */
  drop(m: Member, reason = 'a quitté la partie'): void {
    const idx = this.members.indexOf(m);
    if (idx < 1) return;
    this.members.splice(idx, 1);
    const c = m.conn;
    m.conn = null;
    c?.close();
    const w = this.world;
    const p = w.players[idx];
    if (p && w.players.length > 1) {
      w.players.splice(idx, 1);
      w.pets = w.pets.filter((pet) => pet.owner !== p);
      w.players.forEach((q, k) => { q.index = k; });
      w.focus = [];
      for (const e of w.enemies) if (e.target === p) e.target = null;
      if (w.mode === 'run' && w.players.every((q) => q.downed)) w.finish(false);
    }
    this.toastAll(`${m.name} ${reason}`);
    this.snapT = 1;
    this.broadcastLobby();
  }

  /** Votes en cours sur le choix d'édit : [carte, pseudo]. */
  votes(): [number, string][] {
    return this.members.filter((m) => m.vote >= 0).map((m) => [m.vote, m.name] as [number, string]);
  }

  lobby(): LobbyEntry[] {
    return this.members.map((m, i) => ({ name: m.name, hero: this.world.players[i]?.hero.id ?? m.hero, ping: m.ping, host: i === 0 }));
  }

  /** Appelé à chaque image après la simulation, AVANT que world.fx ne soit vidé. */
  update(dt: number): void {
    if (this.closed) return;
    const w = this.world;
    this.syncPlayers();
    let heroChanged = false;
    this.members.forEach((m, i) => { const h = w.players[i]?.hero.id; if (h && h !== m.hero) { m.hero = h; heroChanged = true; } });
    if (w.choice !== this.choiceRef) { this.choiceRef = w.choice; for (const m of this.members) m.vote = -1; }
    if (this.members.length > 1) {
      for (const f of w.fx) this.fxBuf.push(f);
      if (this.fxBuf.length > 600) this.fxBuf.splice(0, this.fxBuf.length - 600);
    }
    this.snapT += dt;
    if (this.snapT >= 1 / SNAPSHOT_HZ) {
      this.snapT = 0;
      this.sendSnapshots();
    }
    this.lobbyT += dt;
    if (this.lobbyT >= 2 || heroChanged) { this.lobbyT = 0; this.broadcastLobby(); }
  }

  sendSnapshots(): void {
    const w = this.world;
    const votes = this.votes();
    const dialogId = w.dialog ? this.dialogId(w.dialog) : 0;
    for (let i = 1; i < this.members.length; i++) {
      const m = this.members[i];
      if (!m.conn || !m.enc) continue;
      m.conn.send(m.enc.encode(w, i, this.fxBuf, { votes, dialogId }));
    }
    this.fxBuf = [];
  }

  broadcastLobby(): void {
    const msg: HostMsg = { t: 'lobby', m: this.lobby(), code: this.code, mode: this.world.hubMode };
    for (const m of this.members) m.conn?.send(msg);
    this.onChange();
  }

  sendTo(index: number, msg: HostMsg): void { this.members[index]?.conn?.send(msg); }
  broadcast(msg: HostMsg): void { for (const m of this.members) m.conn?.send(msg); }

  private toastAll(title: string, sub = '', except?: Member): void {
    this.onToast(title, sub);
    for (const m of this.members) if (m !== except) m.conn?.send({ t: 'toast', title, sub, color: '#9ad8ff' });
  }

  /** Ferme le salon : prévient les invités puis coupe tout. */
  close(reason = 'L\'hôte a fermé le salon.'): void {
    if (this.closed) return;
    this.closed = true;
    this.world.canSpend = () => true;
    const conns: Conn[] = [];
    for (const m of this.members.slice(1)) {
      m.conn?.send({ t: 'bye', reason });
      if (m.conn) conns.push(m.conn);
      m.conn = null;
    }
    this.members.length = 1;
    const h = this.handle;
    this.handle = null;
    // laisse le temps au message d'adieu de partir avant de couper
    const end = () => { for (const c of conns) c.close(); h?.close(); };
    if (typeof window === 'undefined') end(); else window.setTimeout(end, 400);
  }
}
