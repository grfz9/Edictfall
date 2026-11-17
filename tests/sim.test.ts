import { describe, it, expect } from 'vitest';
import { makeWorld, runBot } from './helpers';

describe('simulation headless', () => {
  it('le bot traverse plusieurs étages sans exception', () => {
    const w = makeWorld('SMOKE1');
    runBot(w, 60 * 60 * 30, () => 0, true);
    console.log(`fin: mode=${w.mode} ${w.worldNum}-${w.floorNum} kills=${w.kills} salles=${w.stats.rooms} boss=${w.stats.bosses} règles=${w.rules.list.map((r) => r.def.id)}`);
    expect(w.rules.errors).toEqual([]);
    expect(w.stats.rooms).toBeGreaterThan(3);
    expect(w.depth()).toBeGreaterThan(2);
  }, 60_000);
});
