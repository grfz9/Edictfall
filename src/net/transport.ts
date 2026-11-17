// Transports réseau : une interface minimale (connexion fiable et ordonnée de messages JSON),
// une implémentation en mémoire (tests) et une par BroadcastChannel (deux onglets du même navigateur, sans Internet).
// L'implémentation WebRTC (PeerJS) est dans peer.ts, chargée à la demande.
import type { AnyMsg } from './protocol';

export interface Conn {
  send(msg: AnyMsg): void;
  close(): void;
  /** Remplacés par l'utilisateur de la connexion. */
  onMessage: (msg: any) => void;
  onClose: () => void;
}
export interface HostHandle { close(): void }
export interface Transport {
  /** Ouvre un salon ; rejette si le code est déjà pris. */
  host(code: string, onConnection: (c: Conn) => void): Promise<HostHandle>;
  /** Rejoint un salon ; rejette s'il est introuvable. */
  join(code: string): Promise<Conn>;
}

// ------------------------------------------------------------------ mémoire (tests)
/** Réseau factice : les messages sont mis en file et délivrés par pump() (copie JSON, comme un vrai transport). */
export class MemoryNet {
  private hosts = new Map<string, (c: Conn) => void>();
  private queue: (() => void)[] = [];
  /** Octets transmis (taille JSON), pour mesurer la bande passante dans les tests. */
  bytes = 0;
  pump(max = 100000): number {
    let n = 0;
    while (this.queue.length && n < max) { this.queue.shift()!(); n++; }
    return n;
  }
  transport(): Transport {
    return {
      host: async (code, onConn) => {
        if (this.hosts.has(code)) throw new Error('unavailable-id');
        this.hosts.set(code, onConn);
        return { close: () => { this.hosts.delete(code); } };
      },
      join: async (code) => {
        const onConn = this.hosts.get(code);
        if (!onConn) throw new Error('peer-unavailable');
        const [a, b] = this.pair();
        onConn(b);
        return a;
      },
    };
  }
  private pair(): [Conn, Conn] {
    // open : on peut encore envoyer ; alive : les messages déjà partis sont encore délivrés (comme un vrai canal)
    let open = true, alive = true;
    const mk = (): Conn => ({ send: () => {}, close: () => {}, onMessage: () => {}, onClose: () => {} });
    const a = mk(), b = mk();
    const wire = (from: Conn, to: Conn) => {
      from.send = (msg) => {
        if (!open) return;
        const s = JSON.stringify(msg);
        this.bytes += s.length;
        this.queue.push(() => { if (alive) to.onMessage(JSON.parse(s)); });
      };
      from.close = () => {
        if (!open) return;
        open = false;
        this.queue.push(() => { alive = false; a.onClose(); b.onClose(); });
      };
    };
    wire(a, b); wire(b, a);
    return [a, b];
  }
}

// ------------------------------------------------------------------ BroadcastChannel (même navigateur)
/** Deux onglets du même navigateur (mode `?net=local`) : utile hors ligne et pour tester sans serveur de signalisation. */
export class BroadcastTransport implements Transport {
  async host(code: string, onConn: (c: Conn) => void): Promise<HostHandle> {
    const ch = new BroadcastChannel('edictfall-salon-' + code);
    const peers = new Map<string, Conn>();
    let taken = false;
    // vérifie qu'aucun autre onglet n'héberge déjà ce code
    const probe = new BroadcastChannel('edictfall-salon-' + code);
    probe.onmessage = (e) => { if (e.data?.k === 'here') taken = true; };
    probe.postMessage({ k: 'who' });
    await new Promise((r) => setTimeout(r, 150));
    probe.close();
    if (taken) { ch.close(); throw new Error('unavailable-id'); }
    ch.onmessage = (e) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.k === 'who') ch.postMessage({ k: 'here' });
      else if (d.k === 'join' && !peers.has(d.from)) {
        const id = d.from as string;
        const c: Conn = {
          send: (msg) => ch.postMessage({ k: 'm', to: id, m: msg }),
          close: () => { if (peers.delete(id)) { ch.postMessage({ k: 'close', to: id }); c.onClose(); } },
          onMessage: () => {}, onClose: () => {},
        };
        peers.set(id, c);
        ch.postMessage({ k: 'ok', to: id });
        onConn(c);
      } else if (d.k === 'm' && d.to === 'host') peers.get(d.from)?.onMessage(d.m);
      else if (d.k === 'close' && d.to === 'host') { const c = peers.get(d.from); if (c) { peers.delete(d.from); c.onClose(); } }
    };
    const beat = window.setInterval(() => ch.postMessage({ k: 'beat' }), 1000);
    return { close: () => { window.clearInterval(beat); for (const c of [...peers.values()]) c.close(); ch.close(); } };
  }
  join(code: string): Promise<Conn> {
    return new Promise((resolve, reject) => {
      const ch = new BroadcastChannel('edictfall-salon-' + code);
      const me = Math.random().toString(36).slice(2, 10);
      let open = false, lastBeat = performance.now();
      const c: Conn = {
        send: (msg) => { if (open) ch.postMessage({ k: 'm', to: 'host', from: me, m: msg }); },
        close: () => { if (!open) return; open = false; ch.postMessage({ k: 'close', to: 'host', from: me }); window.clearInterval(watch); ch.close(); c.onClose(); },
        onMessage: () => {}, onClose: () => {},
      };
      // l'hôte a fermé l'onglet sans prévenir : plus de battement de cœur
      const watch = window.setInterval(() => { if (open && performance.now() - lastBeat > 4000) { open = false; window.clearInterval(watch); ch.close(); c.onClose(); } }, 1000);
      const fail = window.setTimeout(() => { if (!open) { window.clearInterval(watch); ch.close(); reject(new Error('peer-unavailable')); } }, 2500);
      ch.onmessage = (e) => {
        const d = e.data;
        if (!d || typeof d !== 'object') return;
        if (d.k === 'beat') lastBeat = performance.now();
        if (d.to !== me) return;
        if (d.k === 'ok') { open = true; lastBeat = performance.now(); window.clearTimeout(fail); resolve(c); }
        else if (d.k === 'm') c.onMessage(d.m);
        else if (d.k === 'close' && open) { open = false; window.clearInterval(watch); ch.close(); c.onClose(); }
      };
      ch.postMessage({ k: 'join', from: me });
    });
  }
}
