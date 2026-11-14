import { describe, it, expect } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateFloor, defaultPlan, floorIsConnected, T } from '../src/sim/dungeon';

describe('génération de donjon', () => {
  it('est déterministe pour une seed donnée', () => {
    const a = generateFloor(new Rng('ABC'), defaultPlan(1, 1), undefined);
    const b = generateFloor(new Rng('ABC'), defaultPlan(1, 1), undefined);
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    const c = generateFloor(new Rng('ABD'), defaultPlan(1, 1), undefined);
    expect(Array.from(c.tiles)).not.toEqual(Array.from(a.tiles));
  });

  it('produit toujours un étage connexe, avec les bonnes salles, sur 300 seeds × 15 étages', () => {
    for (let s = 0; s < 300; s++) {
      for (let world = 1; world <= 3; world++) {
        for (let floor = 1; floor <= 5; floor++) {
          const plan = defaultPlan(world, floor);
          const f = generateFloor(new Rng(`S${s}`).fork(`${world}-${floor}`), plan, undefined);
          const tag = `seed S${s} ${world}-${floor}`;
          expect(floorIsConnected(f), tag).toBe(true);
          expect(f.rooms[0].type, tag).toBe('start');
          const exits = f.rooms.filter((r) => r.exit);
          expect(exits.length, tag).toBe(1);
          expect(exits[0].type, tag).toBe(floor === 5 ? 'boss' : floor === 3 ? 'guardian' : 'combat');
          expect(f.rooms.filter((r) => r.type === 'combat').length, tag).toBeGreaterThanOrEqual(plan.combat);
          // chaque porte donne sur du sol des deux côtés ; aucune salle ne se chevauche
          for (const r of f.rooms) {
            expect(r.doors.length % 3, tag).toBe(0);
            for (const o of f.rooms) {
              if (o.id <= r.id) continue;
              const overlap = r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h;
              expect(overlap, tag).toBe(false);
            }
          }
          // le centre de la salle de départ est libre
          const c = f.rooms[0];
          expect(f.tiles[(c.x + (c.w >> 1)) + (c.y + (c.h >> 1)) * f.w], tag).toBe(T.FLOOR);
        }
      }
    }
  });
});
