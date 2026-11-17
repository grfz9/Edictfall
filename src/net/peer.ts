// Transport WebRTC via PeerJS : pair-à-pair, le serveur de signalisation public de PeerJS ne sert qu'à se trouver.
// Chargé à la demande (import dynamique) : la bibliothèque n'alourdit pas le démarrage du jeu.
import type { Conn, HostHandle, Transport } from './transport';

const PREFIX = 'edictfall-v1-';
const TIMEOUT = 12000;

type PeerMod = typeof import('peerjs');
let mod: Promise<PeerMod> | null = null;
const load = () => (mod ??= import('peerjs'));

function wrap(dc: import('peerjs').DataConnection, onDone: () => void = () => {}): Conn {
  let open = true;
  const c: Conn = {
    send: (msg) => { if (open && dc.open) { try { void dc.send(msg); } catch { /* canal fermé */ } } },
    close: () => { if (!open) return; open = false; try { dc.close(); } catch { /* déjà fermé */ } c.onClose(); onDone(); },
    onMessage: () => {}, onClose: () => {},
  };
  dc.on('data', (d) => { if (open) c.onMessage(d); });
  const end = () => { if (!open) return; open = false; c.onClose(); onDone(); };
  dc.on('close', end);
  dc.on('error', end);
  // fermeture brutale de l'onglet distant : l'état ICE passe à « disconnected » / « failed »
  dc.on('iceStateChanged', (s) => { if (s === 'failed' || s === 'closed') end(); });
  return c;
}

export class PeerTransport implements Transport {
  async host(code: string, onConn: (c: Conn) => void): Promise<HostHandle> {
    const { Peer } = await load();
    const peer = new Peer(PREFIX + code, { debug: 0 });
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error('timeout')), TIMEOUT);
      peer.once('open', () => { window.clearTimeout(t); resolve(); });
      peer.once('error', (e) => { window.clearTimeout(t); reject(new Error(e.type ?? 'error')); });
    }).catch((e) => { peer.destroy(); throw e; });
    peer.on('connection', (dc) => { dc.on('open', () => onConn(wrap(dc))); });
    // perte de la signalisation : on garde les connexions établies et on tente de se reconnecter
    peer.on('disconnected', () => { if (!peer.destroyed) { try { peer.reconnect(); } catch { /* ignore */ } } });
    peer.on('error', () => { /* erreurs ponctuelles (pair parti…) : les connexions gèrent leur propre fin */ });
    return { close: () => peer.destroy() };
  }
  async join(code: string): Promise<Conn> {
    const { Peer } = await load();
    const peer = new Peer({ debug: 0 });
    try {
      await new Promise<void>((resolve, reject) => {
        const t = window.setTimeout(() => reject(new Error('timeout')), TIMEOUT);
        peer.once('open', () => { window.clearTimeout(t); resolve(); });
        peer.once('error', (e) => { window.clearTimeout(t); reject(new Error(e.type ?? 'error')); });
      });
      const dc = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      await new Promise<void>((resolve, reject) => {
        const t = window.setTimeout(() => reject(new Error('peer-unavailable')), TIMEOUT);
        dc.once('open', () => { window.clearTimeout(t); resolve(); });
        peer.once('error', (e) => { window.clearTimeout(t); reject(new Error(e.type ?? 'error')); });
      });
      return wrap(dc, () => peer.destroy());
    } catch (e) {
      peer.destroy();
      throw e;
    }
  }
}
