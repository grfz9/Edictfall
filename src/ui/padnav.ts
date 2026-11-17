// Navigation manette dans l'interface : croix / stick gauche (avec répétition), A valider, B retour, Start.
// Indépendant de input.ts (qui ne lit les manettes qu'en jeu) : garde son propre état « bouton précédent ».

export type PadAction = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | 'start';

const FIRST = 0.38, REPEAT = 0.13;

export class PadNav {
  private prev: Record<string, boolean> = {};
  private hold: Record<string, number> = {};
  /** Une manette a servi récemment (pour les invites). */
  used = false;

  /** Retourne les actions de cette frame (fronts montants + répétition des directions). */
  poll(dt: number): PadAction[] {
    const out: PadAction[] = [];
    const pads = (navigator.getGamepads?.() ?? []).filter((g): g is Gamepad => !!g && g.connected);
    const now: Record<string, boolean> = {};
    for (const g of pads) {
      const b = (i: number) => !!g.buttons[i]?.pressed;
      const x = g.axes[0] ?? 0, y = g.axes[1] ?? 0;
      now.up ||= b(12) || y < -0.55;
      now.down ||= b(13) || y > 0.55;
      now.left ||= b(14) || x < -0.55;
      now.right ||= b(15) || x > 0.55;
      now.ok ||= b(0);
      now.back ||= b(1);
      now.start ||= b(9);
    }
    for (const k of ['up', 'down', 'left', 'right', 'ok', 'back', 'start'] as PadAction[]) {
      const on = !!now[k], was = !!this.prev[k];
      if (on && !was) { out.push(k); this.hold[k] = FIRST; this.used = true; }
      else if (on && (k === 'up' || k === 'down' || k === 'left' || k === 'right')) {
        this.hold[k] -= dt;
        if (this.hold[k] <= 0) { out.push(k); this.hold[k] = REPEAT; }
      }
      this.prev[k] = on;
    }
    return out;
  }
  /** Oublie les boutons enfoncés (ex. : après un changement d'écran, A ne doit pas re-valider). */
  sync(): void {
    const pads = (navigator.getGamepads?.() ?? []).filter((g): g is Gamepad => !!g && g.connected);
    for (const g of pads) {
      if (g.buttons[0]?.pressed) this.prev.ok = true;
      if (g.buttons[1]?.pressed) this.prev.back = true;
      if (g.buttons[9]?.pressed) this.prev.start = true;
    }
  }
}
