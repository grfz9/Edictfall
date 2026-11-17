// Colle entre le jeu (Game : entrées, rendu, interface) et la session réseau (NetHost / NetClient).
// - Hôte : simulation normale, sauf que la pause ne fige rien et qu'un écran ouvert ne bloque que SES entrées.
// - Invité : aucune simulation ; ses entrées partent chez l'hôte, le World affiché est un miroir des instantanés.
import type { Game } from '../main';
import type { PlayerInput } from '../core/types';
import { storeSave } from '../core/save';
import { R } from '../core/registry';
import { NetHost } from './host';
import { NetClient } from './client';
import { BroadcastTransport, type Transport } from './transport';
import { cleanName, normalizeCode, CODE_LEN, type LobbyEntry } from './protocol';

const STEP = 1 / 60;
const JOIN_TIMEOUT = 20000;

export class Online {
  host: NetHost | null = null;
  client: NetClient | null = null;
  status: 'idle' | 'connecting' | 'host' | 'guest' = 'idle';
  error = '';
  private acc = 0;
  private lastFrame = 0;
  private lastMode = '';
  private savedMethods: { pick?: unknown; dialogChoose?: unknown } | null = null;

  constructor(private g: Game) {}

  get active(): boolean { return !!(this.host || this.client); }
  get role(): 'host' | 'guest' | null { return this.host ? 'host' : this.client ? 'guest' : null; }
  get localIndex(): number { return this.client ? Math.max(0, this.client.index) : 0; }
  get code(): string { return this.host?.code ?? this.client?.code ?? ''; }
  get ping(): number { return this.client ? Math.round(this.client.ping) : 0; }
  lobby(): LobbyEntry[] { return this.host ? this.host.lobby() : this.client?.lobby ?? []; }
  /** Votes affichés sur les cartes d'édit. */
  votes(): [number, string][] { return this.host ? this.host.votes() : this.client?.mirror.votes ?? []; }
  link(): string {
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('salon', this.code);
    if (new URLSearchParams(location.search).get('net') === 'local') u.searchParams.set('net', 'local');
    return u.toString();
  }

  get name(): string { return cleanName(this.g.save.flags?.netName ?? ''); }
  setName(n: string): void { (this.g.save.flags ??= {}).netName = cleanName(n); storeSave(this.g.save); }

  /** WebRTC (PeerJS) par défaut ; `?net=local` : deux onglets du même navigateur, sans serveur. */
  private async transport(): Promise<Transport> {
    if (new URLSearchParams(location.search).get('net') === 'local') return new BroadcastTransport();
    const { PeerTransport } = await import('./peer');
    return new PeerTransport();
  }

  private refresh(): void { this.g.ui.refreshOnline(); }

  // ------------------------------------------------------------------ créer / rejoindre / quitter
  async create(): Promise<void> {
    if (this.active || this.status === 'connecting') return;
    const g = this.g;
    if (g.world.mode !== 'hub') g.world.startHub();
    if (g.world.players.length > 1) g.toggleCoop();
    this.status = 'connecting'; this.error = '';
    this.refresh();
    try {
      const host = new NetHost(g.world, await this.transport(), this.name);
      await host.open();
      this.host = host;
      this.status = 'host';
      host.onChange = () => this.refresh();
      host.onToast = (t, s) => g.ui.banner(t, s, '#9ad8ff');
      host.onActivity = () => this.wake();
      if (g.state !== 'play') g.setState('play');
      g.ui.banner('SALON ' + host.code, 'Partage ce code à tes amis (2 à 4 joueurs).', '#9ad8ff');
      g.audio.sfx('unlock');
    } catch (e) {
      this.status = 'idle';
      this.error = this.explain(e, 'Impossible de créer le salon');
    }
    this.refresh();
  }

  async join(raw: string): Promise<void> {
    if (this.active || this.status === 'connecting') return;
    const code = normalizeCode(raw);
    if (code.length < CODE_LEN) { this.error = 'Code incomplet : il fait ' + CODE_LEN + ' caractères.'; this.refresh(); return; }
    const g = this.g;
    if (g.world.mode !== 'hub') g.world.startHub();
    if (g.world.players.length > 1) g.toggleCoop();
    this.status = 'connecting'; this.error = '';
    this.refresh();
    let client: NetClient | null = null;
    try {
      client = new NetClient(g.world, await this.transport(), this.name);
      let timer = 0;
      await Promise.race([
        client.join(code),
        new Promise<never>((_, rej) => { timer = window.setTimeout(() => rej(new Error('Pas de réponse de l\'hôte. Vérifie le code et réessaie.')), JOIN_TIMEOUT); }),
      ]).finally(() => window.clearTimeout(timer));
    } catch (e) {
      client?.close();
      this.status = 'idle';
      this.error = this.explain(e, 'Impossible de rejoindre');
      this.refresh();
      return;
    }
    this.client = client;
    this.status = 'guest';
    this.installMirror(client);
    client.onClose = (reason) => this.leave(reason);
    client.onRequest = (type, data) => {
      if (type === 'scene') g.ui.playScene(Number(data));
      else g.ui.openPanel(type);
    };
    client.onToast = (t, s, c) => g.ui.banner(t, s, c ?? '#9ad8ff');
    client.onLobby = () => this.refresh();
    client.onSnapshot = () => this.afterSnapshot();
    if (g.state !== 'play') g.setState('play');
    g.ui.banner('SALON ' + client.code, 'Connecté ! Choisis ton héros dans le hall.', '#9ad8ff');
    g.audio.sfx('unlock');
    this.refresh();
  }

  /** Le World local devient un miroir : choisir une carte = voter, choisir dans un dialogue = demander à l'hôte. */
  private installMirror(client: NetClient): void {
    const w = this.g.world as unknown as Record<string, unknown>;
    this.savedMethods = { pick: w.pick, dialogChoose: w.dialogChoose };
    w.pick = (i: number) => { client.vote(i); this.g.ui.banner('VOTE ENVOYÉ', 'L\'hôte valide l\'édit choisi.', '#c9a0ff'); };
    w.dialogChoose = (i: number) => { client.dialogChoose(i); };
    this.g.world.persist = () => {};
  }
  private uninstallMirror(): void {
    const w = this.g.world as unknown as Record<string, unknown>;
    if (this.savedMethods) { delete w.pick; delete w.dialogChoose; }
    this.savedMethods = null;
    this.g.world.persist = () => storeSave(this.g.save);
  }

  /** Quitte le salon (ou le ferme si on est l'hôte) et revient au hall en solo. */
  leave(reason?: string): void {
    const g = this.g;
    const wasGuest = !!this.client;
    if (this.host) this.host.close();
    if (this.client) { this.client.onClose = () => {}; this.client.close(); }
    this.host = null; this.client = null;
    this.status = 'idle';
    if (wasGuest) { this.uninstallMirror(); g.world.request = null; g.world.choice = null; g.world.dialog = null; }
    g.world.startHub();
    g.setState('play');
    if (reason) g.ui.banner('MULTIJOUEUR', reason, '#ff9a6a');
    this.refresh();
  }

  private explain(e: unknown, prefix: string): string {
    const m = (e as Error)?.message ?? String(e);
    if (m === 'unavailable-id') return prefix + ' : code déjà utilisé, réessaie.';
    if (m === 'network' || m === 'server-error' || m === 'socket-error' || m === 'socket-closed' || m === 'timeout') return prefix + ' : serveur de connexion injoignable (vérifie ta connexion Internet).';
    if (m === 'browser-incompatible') return prefix + ' : ce navigateur ne gère pas WebRTC.';
    return m.length > 4 && !/^[a-z-]+$/.test(m) ? m : `${prefix} (${m}).`;
  }

  /** Lien `?salon=CODE` : rejoint directement au démarrage. */
  autoJoinFromUrl(): void {
    const q = new URLSearchParams(location.search);
    const code = q.get('salon');
    if (!code) return;
    q.delete('salon');
    const rest = q.toString();
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
    const g = this.g;
    g.toHub();
    g.ui.openPanel('online');
    void this.join(code);
  }

  // ------------------------------------------------------------------ boucle
  /** Onglet hôte masqué : le navigateur coupe requestAnimationFrame, on avance au rythme des messages des invités. */
  private wake(): void {
    // (certains navigateurs coupent aussi l'animation d'un onglet d'arrière-plan qui se dit « visible »)
    const now = performance.now();
    const stalled = now - this.lastFrame > (document.hidden ? 30 : 120);
    if (stalled) this.g.frame(now);
  }

  /** Remplace la partie « simulation » de Game.frame quand une session est active. */
  frame(dt: number): void {
    const g = this.g, w = g.world;
    this.lastFrame = performance.now();
    const li = this.localIndex;
    const lp = w.players[li];
    const origins = lp ? [g.renderer.worldToScreen(lp.x, lp.y)] : [];
    const inp: PlayerInput = g.input.poll(dt, 1, origins, !!w.focus[li])[0];
    // écran miroir : les commandes suivent ce qu'on voit
    if (w.mods.mirror) { inp.mx = -inp.mx; inp.ax = -inp.ax; }
    // menu ouvert, panneau, dialogue local… : le jeu continue, mais sans nos commandes
    if (g.state !== 'play' || g.ui.blocking || (w.choice && this.client)) {
      inp.mx = inp.my = 0; inp.fire = inp.firePressed = inp.swap = inp.interact = inp.skill = false;
    }
    if (this.client) { this.clientFrame(inp, dt); return; }
    const host = this.host!;
    if (lp) {
      const prev = lp.input;
      if (prev && prev !== inp) { inp.swap ||= prev.swap; inp.interact ||= prev.interact; inp.skill ||= prev.skill; inp.firePressed ||= prev.firePressed; }
      lp.input = inp;
    }
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 4) {
      // qui a interagi pendant ce pas ? (pour renvoyer un panneau du hall au bon joueur)
      const who = w.players.filter((p) => p.input.interact).map((p) => p.index);
      w.update(STEP);
      this.acc -= STEP;
      steps++;
      for (const p of w.players) { p.input.swap = p.input.interact = p.input.skill = p.input.firePressed = false; }
      if (w.request) this.route(who);
    }
    if (steps === 4) this.acc = 0;
    host.update(dt);
    if (w.mode === 'dead' || w.mode === 'won') { if (g.state !== 'end') g.setState('end'); }
  }

  /** Demandes de la simulation (portail, PNJ du hall, intermèdes) : chez l'hôte ou chez l'invité concerné. */
  private route(who: number[]): void {
    const g = this.g, w = g.world, host = this.host!;
    const r = w.request!;
    w.request = null;
    if (r.type === 'scene') { host.broadcast({ t: 'req', type: 'scene', data: r.data }); g.ui.playScene(Number(r.data)); return; }
    const guest = who.length && !who.includes(0) ? who[0] : 0;
    if (guest > 0) {
      if (r.type === 'start' || r.type === 'modes') host.sendTo(guest, { t: 'toast', title: 'L\'HÔTE DÉCIDE', sub: r.type === 'start' ? 'Seul l\'hôte peut lancer la partie.' : 'Seul l\'hôte choisit le mode de jeu.', color: '#ffd23a' });
      else host.sendTo(guest, { t: 'req', type: r.type, data: r.data });
      return;
    }
    if (r.type === 'start') g.startRun();
    else g.ui.openPanel(r.type);
  }

  private clientFrame(inp: PlayerInput, dt: number): void {
    const c = this.client!;
    c.pushInput(inp, dt);
    c.frame(dt);
  }

  /** Invité : suit les changements d'état de la partie (fin de run, retour au hall, nouvelle run). */
  private afterSnapshot(): void {
    const g = this.g, w = g.world;
    const over = w.mode === 'dead' || w.mode === 'won';
    // la partie démarre : le panneau du salon se ferme tout seul (sinon il bloquerait les commandes)
    if (w.mode === 'run' && this.lastMode === 'hub') g.ui.closePanel('online');
    this.lastMode = w.mode;
    if (over && g.state !== 'end' && w.summary) {
      // les gemmes gagnées pendant la run en ligne sont aussi créditées à l'invité
      const s = g.save, sum = w.summary as typeof w.summary & { credited?: boolean };
      if (!sum.credited) {
        sum.credited = true;
        s.gems += sum.gems; s.stats.runs++; s.stats.kills += sum.kills; if (sum.win) s.stats.wins++;
        for (const id of [...sum.rules, ...sum.synergies]) {
          const d = R.mods.get(id);
          if (d?.kind === 'rule' && !s.seenRules.includes(id)) s.seenRules.push(id);
          if (d?.kind === 'synergy' && !s.seenSynergies.includes(id)) s.seenSynergies.push(id);
        }
        storeSave(s);
      }
      g.setState('end');
    } else if (!over && g.state === 'end') g.setState('play');
  }

  /** Pseudos des joueurs (étiquettes au-dessus des personnages). */
  names(): string[] | null {
    if (!this.active) return null;
    return this.lobby().map((e) => e.name);
  }
}
