// Édits « salles » : la forme des étages et ce qui s'y passe.
import { defineRule } from '../../core/registry';
import { icon, pw, alivePlayers, inRun, roomMid, isCombatRoom } from './_kit';

defineRule({
  id: 'labyrinth', name: 'Labyrinthe', category: 'rooms', flavor: 'mixed', maxStacks: 2,
  desc: 'Chaque étage compte une salle de combat et une salle au trésor de plus, et les coffres sont un peu meilleurs.',
  icon: icon('ic_labyrinth', 'swirl', 'n', 'N', 'y'),
  modify: (m, _c, s) => {
    const k = pw(s, 2);
    m.chestRarityBonus += 0.15 * k;
    m.coinMult *= 1 + 0.1 * k;
  },
  onFloorPlan: (_ctx, plan, s) => {
    if (plan.end !== 'boss') plan.combat = Math.min(6, plan.combat + Math.round(Math.min(2, pw(s, 2))));
    if (plan.specials.filter((x) => x === 'chest').length < 2) plan.specials.push('chest');
  },
});

defineRule({
  id: 'whispering_walls', name: 'Murs bavards', category: 'rooms', flavor: 'boon', weight: 0.7,
  desc: 'Chaque étage cache une salle secrète derrière un mur fissuré, et les gemmes valent 20 % de plus.',
  icon: icon('ic_whispering_walls', 'door', 'n', 'N'),
  modify: (m) => { m.gemMult *= 1.2; },
  onFloorPlan: (_ctx, plan) => {
    if (!plan.specials.includes('secret')) plan.specials.push('secret');
  },
});

defineRule({
  id: 'twin_chests', name: 'Coffres jumeaux', category: 'rooms', flavor: 'boon', weight: 0.7,
  desc: 'Chaque salle de combat nettoyée fait apparaître un coffre de ravitaillement supplémentaire.',
  icon: icon('ic_twin_chests', 'chest', 'n', 'N', 'y'),
  onRoomClear: (ctx, room) => {
    if (!inRun(ctx) || !isCombatRoom(room)) return;
    const spot = ctx.freeSpot(room);
    ctx.spawnChest(spot.x, spot.y, 'supply');
  },
});

defineRule({
  id: 'trapped_doors', name: 'Portes piégées', category: 'rooms', flavor: 'mixed',
  desc: 'Deux secondes après ton entrée dans une salle de combat, ses portes explosent : gros dégâts aux ennemis proches… et 1 dégât si tu traînes à côté.',
  icon: icon('ic_trapped_doors', 'door', 'v', 'V', 'y'),
  onRoomEnter: (ctx, room, s) => {
    if (!inRun(ctx) || !isCombatRoom(room) || !room.doors.length) return;
    const doors = room.doors.slice(0, 16);
    ctx.after(2, () => {
      if (!inRun(ctx)) return;
      const dmg = (25 + 4 * ctx.depth) * Math.min(2, pw(s, 3));
      for (const d of doors) {
        const x = (d.x + 0.5) * 16, y = (d.y + 0.5) * 16;
        ctx.explode(x, y, 30, dmg, 'player', { silent: true });
        for (const p of alivePlayers(ctx)) if (Math.hypot(p.x - x, p.y - y) < 24) ctx.damagePlayer(p, 1, 'explosion');
      }
      ctx.shake(6);
      ctx.sfx('explode');
    });
  },
});

defineRule({
  id: 'endless_waves', name: 'Vagues sans fin', category: 'rooms', flavor: 'mixed',
  desc: 'Chaque salle de combat a une vague d\'ennemis de plus, mais rapporte 1 gemme, de l\'or et de l\'énergie une fois nettoyée.',
  icon: icon('ic_endless_waves', 'wave', 'b', 'B'),
  onRoomEnter: (ctx, room, s) => {
    if (inRun(ctx) && room.type === 'combat') room.waves += Math.max(1, Math.round(Math.min(2, pw(s, 2))));
  },
  onRoomClear: (ctx, room) => {
    if (!inRun(ctx) || room.type !== 'combat') return;
    const c = roomMid(room);
    ctx.spawnPickup('gem', c.x, c.y, 1);
    for (let i = 0; i < 3; i++) ctx.spawnPickup('coin', c.x, c.y, 2);
    for (let i = 0; i < 2; i++) ctx.spawnPickup('energy', c.x, c.y, 4);
  },
});

defineRule({
  id: 'truce', name: 'Trêve', category: 'rooms', flavor: 'boon', weight: 0.8,
  desc: 'Chaque salle nettoyée remplit ton armure et te rend 40 points d\'énergie.',
  icon: icon('ic_truce', 'plus', 'w', '3', 'g'),
  onRoomClear: (ctx, _room, s) => {
    for (const p of alivePlayers(ctx)) {
      ctx.addArmor(p, 99);
      ctx.addEnergy(p, 40 * Math.min(2, pw(s, 2)));
    }
  },
});
