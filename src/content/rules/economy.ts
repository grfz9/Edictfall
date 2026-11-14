// Édits « économie » : or, gemmes, boutique, coffres, énergie.
import { defineRule } from '../../core/registry';
import type { Interactable } from '../../core/types';
import { icon, pw, inRun } from './_kit';

defineRule({
  id: 'golden_gravity', name: 'Gravité dorée', category: 'economy', flavor: 'mixed',
  desc: 'Les pièces filent vers toi de très loin et rapportent 25 % de plus… mais les balles ennemies proches sont attirées vers toi aussi.',
  icon: icon('ic_golden_gravity', 'coin', 'y', 'Y'),
  modify: (m, _c, s) => {
    const k = Math.min(2, pw(s, 2));
    m.coinMagnet *= 5;
    m.coinMult *= 1.25;
    m.bulletMagnet += 70 * k;
  },
});

defineRule({
  id: 'toothy_chests', name: 'Coffres à dents', category: 'economy', flavor: 'mixed',
  desc: 'Un coffre sur trois est un mimic qu\'il faut abattre, mais il garde un butin enrichi : une arme de plus, 2 gemmes et de l\'or.',
  icon: icon('ic_toothy_chests', 'chest', 'r', 'R', 'w'),
  modify: (m, _c, s) => { m.mimicChance += Math.min(0.6, 0.33 * pw(s, 2)); },
  onChestOpen: (ctx, ev) => {
    if (!ev.mimic) return;
    const id = ctx.randomWeaponId(1);
    if (id) ev.loot.push({ t: 'weapon', id });
    ev.loot.push({ t: 'gem', n: 2 }, { t: 'coin', n: 8 });
  },
});

defineRule({
  id: 'blood_market', name: 'Marché du sang', category: 'economy', flavor: 'mixed', priority: 200, excludes: ['gem_tithe'],
  desc: 'La boutique ne demande plus d\'or : chaque achat se paie en PV (1 pour une potion, 2 pour le reste), sans jamais descendre sous 1 PV.',
  icon: icon('ic_blood_market', 'drop', 'r', 'R', 'y'),
  modify: (m) => { m.shopPrice = 0; },
  onTick: (ctx, _dt, s) => {
    if (!inRun(ctx)) return;
    const paid: Record<number, 1> = (s.state.paid ??= {});
    for (const it of ctx.world.items as Interactable[]) {
      if (it.kind !== 'shopitem' || !it.dead || paid[it.id]) continue;
      paid[it.id] = 1;
      const p = ctx.nearestPlayer(it.x, it.y);
      if (!p) continue;
      let cost = it.loot?.t === 'hp' || it.loot?.t === 'energy' ? 1 : 2;
      if (ctx.mods.flags.bloodDiscount) cost--;
      const lost = Math.min(cost, Math.max(0, p.hp - 1));
      if (lost > 0) {
        p.hp -= lost;
        p.flash = 0.15;
        ctx.text(p.x, p.y - 14, '-' + lost + ' PV', 0xff4455);
        ctx.sfx('hurt', 0.6);
      }
    }
  },
  onFloorStart: (_c, s) => { s.state.paid = {}; },
});

defineRule({
  id: 'golden_balm', name: 'Baume doré', category: 'economy', flavor: 'mixed',
  desc: 'Quand tu es blessé, l\'or ramassé ne va pas dans ta bourse : chaque tranche de 10 pièces te rend 1 PV.',
  icon: icon('ic_golden_balm', 'heart', 'y', 'Y'),
  onPickup: (ctx, ev, s) => {
    if (ev.kind !== 'coin' || ev.amount <= 0) return;
    const p = ev.player;
    if (!p || p.downed || p.hp >= ctx.maxHp(p)) return;
    s.state.acc = (s.state.acc ?? 0) + ev.amount;
    ev.amount = 0;
    const step = Math.max(4, Math.round(10 / Math.min(2, pw(s, 2))));
    while (s.state.acc >= step) {
      s.state.acc -= step;
      ctx.heal(p, 1);
    }
  },
});

defineRule({
  id: 'compound_interest', name: 'Intérêts composés', category: 'economy', flavor: 'boon', maxStacks: 2,
  desc: 'Chaque salle nettoyée te verse 8 % de l\'or que tu possèdes (20 pièces max).',
  icon: icon('ic_compound_interest', 'coin', 'g', 'G'),
  onRoomClear: (ctx, _room, s) => {
    if (!inRun(ctx)) return;
    const boost = ctx.mods.flags.interestBoost ? 2 : 1;
    const k = pw(s, 3);
    const gain = Math.min(20 * k * boost, Math.floor(ctx.coins * 0.08 * k * boost));
    if (gain <= 0) return;
    ctx.addCoins(gain);
    const p = ctx.player;
    if (p) ctx.text(p.x, p.y - 20, '+' + gain + ' intérêts', 0xffd23a);
  },
});

defineRule({
  id: 'gem_tithe', name: 'Dîme des gemmes', category: 'economy', flavor: 'mixed', excludes: ['blood_market'],
  desc: 'Les gemmes comptent double, mais la boutique est 50 % plus chère.',
  icon: icon('ic_gem_tithe', 'gem', 'p', 'P'),
  modify: (m, _c, s) => {
    m.gemMult *= 1 + Math.min(2, pw(s, 2));
    m.shopPrice *= 1.5;
  },
});

defineRule({
  id: 'energy_well', name: 'Puits d\'énergie', category: 'economy', flavor: 'mixed',
  desc: 'Les ennemis lâchent 80 % d\'énergie en plus et ta réserve gagne 60 points, mais l\'or rapporte 40 % de moins.',
  icon: icon('ic_energy_well', 'drop', 'c', 'B', '1'),
  modify: (m, _c, s) => {
    const k = Math.min(2, pw(s, 2));
    m.energyDrop *= 1 + 0.8 * k;
    m.maxEnergy += 60 * k;
    m.coinMult *= 0.6;
  },
});

