// Outils de test : charge tout le contenu et fait tourner la simulation sans navigateur.
import { defaultSave } from '../src/core/save';
import { World } from '../src/sim/world';
import { botInput } from '../src/sim/bot';

import.meta.glob('../src/content/**/*.ts', { eager: true });

export function makeWorld(seed = 'TEST', hero?: string): World {
  const w = new World(defaultSave());
  w.startHub();
  w.startRun(seed, [hero ?? w.players[0].hero.id]);
  return w;
}
/** Fait jouer le bot pendant `ticks` pas (60 Hz). pick choisit la carte lors des choix. */
export function runBot(w: World, ticks: number, pick: (w: World) => number = () => 0, god = false): void {
  for (let i = 0; i < ticks; i++) {
    if (w.mode !== 'run') break;
    if (w.choice) { w.pick(Math.min(pick(w), w.choice.options.length - 1)); continue; }
    const p = w.players[0];
    if (god) { p.hp = w.maxHp(p); p.energy = Math.max(p.energy, 50); }
    p.input = botInput(w, p);
    w.update(1 / 60);
    w.fx.length = 0;
  }
}
