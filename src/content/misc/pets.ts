// Familiers : ils suivent leur maître et « aident un peu » (DPS 4–8).
import { definePet, defineSprite } from '../../core/registry';

// ------------------------------------------------------------------ Pépin : tireur simple (gratuit)
defineSprite('pet_pepin', ['..1..1..', '...yy...', '..yyyy..', '.y0yy0y.', '.yyyyyy.', '..YyyY..', '.Y.YY.Y.', '........'], {
  frames: [['.1....1.', '...yy...', '..yyyy..', '.y0yy0y.', '.yyyyyy.', '..YyyY..', '.Y.YY.Y.', '........']],
});
definePet({
  id: 'pet_pepin', name: 'Pépin', desc: 'Une luciole grincheuse qui crache des étincelles.', sprite: 'pet_pepin', cost: 0, speed: 120,
  attack: { cooldown: 0.8, range: 150, bullet: { damage: 4, speed: 210, sprite: 'b_small', color: 0xfff080, life: 0.8 } },
});

// ------------------------------------------------------------------ Croc : mordeur de mêlée
defineSprite('pet_croc', ['.N....N.', '.NNnnNN.', '.n0nn0n.', '.nnnnnn.', '..nkkn..', '.nnnnnn.', '.N.NN.N.', '........'], {
  frames: [['.N....N.', '.NNnnNN.', '.n0nn0n.', '.nnnnnn.', '..nkkn..', '.nnnnnn.', '..N..N..', '........']],
});
definePet({
  id: 'pet_croc', name: 'Croc', desc: 'Un chiot têtu qui bondit mordre les ennemis proches.', sprite: 'pet_croc', cost: 25, speed: 130,
  onUpdate: (ctx, pet, dt) => {
    if (ctx.world.mode !== 'run') return;
    const d = pet.data;
    if (d.lunge > 0) {
      d.lunge -= dt;
      const e = ctx.enemies.find((x) => x.id === d.target && !x.dead);
      if (!e) { d.lunge = 0; return; }
      const dx = e.x - pet.x, dy = e.y - pet.y, dist = Math.hypot(dx, dy) || 1;
      if (dist < 8 + e.radius * e.scale) {
        ctx.damageEnemy(e, 9, { cause: 'rule', source: pet.owner });
        ctx.burst(e.x, e.y, 0xffffff, 4, 60, 0.2);
        d.lunge = 0;
        return;
      }
      const step = Math.min(dist, 320 * dt);
      const nx = pet.x + (dx / dist) * step, ny = pet.y + (dy / dist) * step;
      if (!ctx.isSolid(nx, pet.y)) pet.x = nx;
      if (!ctx.isSolid(pet.x, ny)) pet.y = ny;
      pet.facing = dx > 0 ? 1 : -1;
      return;
    }
    if (pet.cd > 0) return;
    const e = ctx.nearestEnemy(pet.x, pet.y, 80);
    if (!e || !ctx.los(pet.x, pet.y, e.x, e.y)) return;
    pet.cd = 1.4;
    d.lunge = 0.35;
    d.target = e.id;
  },
});

// ------------------------------------------------------------------ Grigou : ramasseur d'or
defineSprite('pet_grigou', ['...NN...', '..NyyN..', '.yyyyyy.', '.ygyygy.', 'yyyyyyyY', 'yyYyyYyY', '.YyyyyY.', '..Y..Y..'], {
  frames: [['...NN...', '..NyyN..', '.yyyyyy.', '.ygyygy.', 'yyyyyyyY', 'yyYyyYyY', '.YyyyyY.', '.Y....Y.']],
});
definePet({
  id: 'pet_grigou', name: 'Grigou', desc: 'Une bourse vivante qui rabat pièces et gemmes vers toi.', sprite: 'pet_grigou', cost: 50, speed: 120,
  onUpdate: (ctx, pet, dt) => {
    const o = pet.owner;
    for (const k of ctx.world.pickups) {
      if (k.dead || k.age < 0.25 || (k.kind !== 'coin' && k.kind !== 'gem')) continue;
      if (Math.hypot(k.x - pet.x, k.y - pet.y) > 110) continue;
      const dx = o.x - k.x, dy = o.y - k.y, d = Math.hypot(dx, dy) || 1;
      k.vx += (dx / d) * 420 * dt; k.vy += (dy / d) * 420 * dt;
      const sp = Math.hypot(k.vx, k.vy);
      if (sp > 220) { k.vx *= 220 / sp; k.vy *= 220 / sp; }
    }
  },
});

// ------------------------------------------------------------------ Mousse : soigneur lent
defineSprite('pet_mousse', ['...m....', '..mym...', '...l....', '.llllll.', 'lf0ll0fl', 'llllllll', 'lffffffl', '.ffffff.'], {
  frames: [['....m...', '...mym..', '...l....', '.llllll.', 'lf0ll0fl', 'llllllll', 'lffffffl', '.ffffff.']],
});
definePet({
  id: 'pet_mousse', name: 'Mousse', desc: 'Un petit tas de mousse qui rend 1 PV toutes les 45 s.', sprite: 'pet_mousse', cost: 80, speed: 100,
  onUpdate: (ctx, pet, dt) => {
    if (ctx.world.mode !== 'run') return;
    const o = pet.owner;
    pet.data.t = Math.min(45, (pet.data.t ?? 0) + dt);
    if (pet.data.t < 45 || o.downed || o.hp >= ctx.maxHp(o)) return;
    pet.data.t = 0;
    ctx.heal(o, 1);
    ctx.burst(pet.x, pet.y, 0xa8f070, 8, 50, 0.5);
  },
});

// ------------------------------------------------------------------ Givrelin : tirs gelants
defineSprite('pet_givrelin', ['...ii...', '..iIIi..', '.icCCci.', 'ic0cc0ci', 'icccccci', '.iCccCi.', '..i..i..', '........'], {
  frames: [['...ii...', '..iIIi..', '.icCCci.', 'ic0cc0ci', 'icccccci', '.iCccCi.', '.i....i.', '........']],
});
definePet({
  id: 'pet_givrelin', name: 'Givrelin', desc: 'Un esprit du gel dont les flocons figent les ennemis.', sprite: 'pet_givrelin', cost: 120, speed: 115,
  attack: { cooldown: 1.1, range: 160, bullet: { damage: 5, speed: 180, sprite: 'b_energy', color: 0xd8f0ff, scale: 0.7, life: 1, status: { kind: 'freeze', dur: 1.2 } } },
});
