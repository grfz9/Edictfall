// Galerie des Statues : elles ne bougent que quand tu ne les regardes pas. Un coffre au centre, si tu oses.
import { defineSpecialRoom } from './_kit';
import type { Interactable } from '../../core/types';

interface Watcher { it: Interactable; ox: number; oy: number }

defineSpecialRoom({
  id: 'statues', name: 'Galerie des Statues', weight: 1,
  build(k) {
    const { cx, cy } = k;
    k.ctx.spawnChest(cx, cy, 'big');
    const list: Watcher[] = [];
    for (const [dx, dy] of [[-80, -50], [80, -50], [-80, 50], [80, 50], [0, -60]]) {
      const it = k.deco('statue', cx + dx, cy + dy, 0xb8a8d0);
      list.push({ it, ox: it.x, oy: it.y });
    }
    k.data.watchers = list;
  },
  enter(k) {
    k.say(k.data.watchers[4].it, 'Ne nous quitte pas des yeux…', 3);
  },
  tick(k, dt) {
    const p = k.player, ctx = k.ctx;
    const list: Watcher[] = k.data.watchers;
    const opened = ctx.world.chests.every((c) => c.opened || c.dead);
    if (opened) {
      if (k.once('calm')) k.say(list[0].it, '…bien joué.', 2.5);
      return;
    }
    const ax = Math.cos(p.aim), ay = Math.sin(p.aim);
    for (const s of list) {
      const dx = s.it.x - p.x, dy = s.it.y - p.y, d = Math.hypot(dx, dy) || 1;
      const watched = (dx * ax + dy * ay) / d > 0.45;
      if (watched) continue;
      const sp = 42 * dt;
      const nx = s.it.x - (dx / d) * sp, ny = s.it.y - (dy / d) * sp;
      if (ctx.isFree(nx, ny, 5)) { s.it.x = nx; s.it.y = ny; }
      if (d < 13) {
        ctx.damagePlayer(p, 1, 'contact');
        k.say(s.it, ctx.rng.pick(['Bouh !', 'Coucou.', 'Tu as cligné.', 'Trop lent.']), 1.6);
        ctx.burst(s.it.x, s.it.y, 0xb8a8d0, 10, 70);
        s.it.x = s.ox; s.it.y = s.oy;
      }
    }
  },
});
