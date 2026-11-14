import { it, expect } from 'vitest';
import { makeWorld } from './helpers';
import { botInput } from '../src/sim/bot';
import { R } from '../src/core/registry';

// Aucun effet émis par la simulation ne doit contenir de NaN (sinon le rendu se corrompt).
it('aucun fx NaN sur plusieurs runs avec règles aléatoires', () => {
  const rules = [...R.mods.values()].filter((m) => m.kind === 'rule').map((m) => m.id);
  const bad: string[] = [];
  for (let s = 0; s < 12; s++) {
    const w = makeWorld('FX' + s);
    for (let k = 0; k < 4; k++) w.rules.add(rules[(s * 7 + k * 13) % rules.length]);
    for (let i = 0; i < 60 * 90 && w.mode === 'run'; i++) {
      if (w.choice) { w.pick(0); continue; }
      const p = w.players[0]; p.hp = w.maxHp(p);
      p.input = botInput(w, p);
      w.update(1 / 60);
      for (const fx of w.fx) for (const [k, v] of Object.entries(fx)) if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${fx.t}.${k} (seed FX${s}, règles ${w.rules.list.map((r) => r.def.id)})`);
      w.fx.length = 0;
    }
  }
  expect([...new Set(bad)].slice(0, 10)).toEqual([]);
});
