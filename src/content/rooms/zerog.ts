// Salle Sens-Dessus-Dessous : plus de gravité, plus de frottement, et le monde est à l'envers (miroir).
import { T, TILE } from '../../sim/dungeon';
import { defineSpecialRoom } from './_kit';

defineSpecialRoom({
  id: 'zerog', name: 'Salle Sens-Dessus-Dessous', weight: 1,
  build(k) {
    const r = k.room, ctx = k.ctx;
    for (let y = r.y + 1; y < r.y + r.h - 1; y++)
      for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (ctx.world.floor.tiles[x + y * ctx.world.floor.w] === T.FLOOR) k.setTile(x, y, T.SLICK);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.world.spawnPickup(i % 6 === 0 ? 'gem' : 'coin', k.cx + Math.cos(a) * 52, k.cy + Math.sin(a) * 36, i % 6 === 0 ? 1 : 2, true);
    }
    k.npc(k.cx, k.cy - 54, {
      sprite: 'deco_sign', label: 'Panneau', sub: 'Il est à l\'envers', radius: 16,
      lines: ['Ici, le haut est en bas.', 'Attention : sol sans gravité.'],
      use: (_c, _p, self) => k.say(self, '¡ǝʇʇᴉɹƃ ǝp ǝʇᴉɯᴉl : ǝsᴉɐq ǝʇᴉssǝʌɐɹƃ', 3),
    });
    k.data.r = { x0: (r.x + 1) * TILE, y0: (r.y + 1) * TILE, x1: (r.x + r.w - 1) * TILE, y1: (r.y + r.h - 1) * TILE };
  },
  enter(k) {
    k.ctx.text(k.cx, k.cy - 30, 'APESANTEUR', 0x9ae8ff, true);
    k.ctx.sfx('portal');
  },
  modify(m) {
    m.mirror = !m.mirror;
    m.speed *= 1.15;
    m.bulletSpeed *= 0.8;
  },
  tick(k, dt) {
    // le butin dérive en orbite lente autour du centre
    const b = k.data.r;
    for (const pk of k.ctx.world.pickups) {
      if (pk.x < b.x0 || pk.x > b.x1 || pk.y < b.y0 || pk.y > b.y1) continue;
      const dx = pk.x - k.cx, dy = pk.y - k.cy, d = Math.hypot(dx, dy) || 1;
      pk.vx += (-dy / d) * 40 * dt; pk.vy += (dx / d) * 40 * dt;
    }
  },
});
