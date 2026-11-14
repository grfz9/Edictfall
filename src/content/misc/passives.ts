// Passifs : bénédictions de statue, de début d'étage ou achetées en boutique. Tous positifs.
import { definePassive, defineSprite } from '../../core/registry';
import type { Player } from '../../core/types';

// ------------------------------------------------------------------ gabarits d'icônes 10×10 (X = teinte, Z = ombre)
const SHAPES: Record<string, string[]> = {
  heart: ['..........', '.XXX..XXX.', 'X1XXXXXXXZ', 'X1XXXXXXXZ', 'XXXXXXXXXZ', '.XXXXXXXZ.', '..XXXXXZ..', '...XXXZ...', '....XZ....', '..........'],
  shield: ['.ZZZZZZZZ.', 'ZX1XXXXXXZ', 'ZX1XXXXXXZ', 'ZXXXXXXXXZ', 'ZXXXXXXXXZ', '.ZXXXXXXZ.', '.ZXXXXXXZ.', '..ZXXXXZ..', '...ZXXZ...', '....ZZ....'],
  bolt: ['.....XXZ..', '....XXZ...', '...XXZ....', '..XXXXXXZ.', '.XXXXXXZ..', '....XXZ...', '...XXZ....', '..XXZ.....', '.XZ.......', 'XZ........'],
  star: ['....XX....', '....XX....', '...X1XZ...', 'XXXX1XXXXZ', '.XXXXXXXZ.', '..XXXXXZ..', '..XXZXXZ..', '.XXZ..XXZ.', '.XZ....XZ.', '..........'],
  arrow: ['..........', '..........', '.....X....', '.....XX...', 'XXXXXX1X..', 'X11111111X', 'ZZZZZZXZ..', '.....XZ...', '.....Z....', '..........'],
  boot: ['...XXXX...', '...X1XZ...', '...X1XZ...', '...XXXZ...', '...XXXZ...', '...XXXXX..', '..XXXXXXXZ', '..XXXXXXXZ', '..ZZZZZZZZ', '..........'],
  orb: ['...XXXX...', '..X11XXZ..', '.X1XXXXXZ.', '.X1XXXXXZ.', '.XXXXXXXZ.', '.XXXXXXXZ.', '.XXXXXXZZ.', '..XXXXZZ..', '...ZZZZ...', '..........'],
  cross: ['...XXXX...', '...X11X...', '...X1XZ...', 'XXXX1XXXXX', 'X111XXXXXZ', 'XXXXXXXXXZ', 'ZZZZXXZZZZ', '...XXXZ...', '...XXXZ...', '...ZZZZ...'],
  clock: ['..ZZZZZZ..', '.ZX1XXXXZ.', 'ZX1XX0XXXZ', 'ZXXXX0XXXZ', 'ZXXXX000XZ', 'ZXXXXXXXXZ', 'ZXXXXXXXXZ', '.ZXXXXXXZ.', '..ZZZZZZ..', '..........'],
  ankh: ['...XXXX...', '..X1..XZ..', '..X1..XZ..', '...XXXZ...', 'XXXXXXXXXZ', 'ZZZZXXZZZZ', '....XXZ...', '....XXZ...', '....XXZ...', '....ZZZ...'],
  coin: ['..XXXXXX..', '.X1XXXXXZ.', 'X1XXZZXXXZ', 'X1XZXXXXXZ', 'XXXZXXXXXZ', 'XXXXZZXXXZ', 'XXXXXXZXXZ', 'XXXZZZXXXZ', '.XXXXXXXZ.', '..ZZZZZZ..'],
  reticle: ['....XX....', '..XXZZXX..', '.XZ....ZX.', '.X..XX..X.', 'XZ.X11X.ZX', 'XZ.XXXX.ZX', '.X..XX..X.', '.XZ....ZX.', '..XXZZXX..', '....XX....'],
  flame: ['....X.....', '...XX.....', '...XXX..X.', '..XX1XX.X.', '..X11XXXX.', '.XX11XXXXZ', '.XX1XXXXXZ', '.XXXXXXXZ.', '..XXXXXZ..', '...ZZZZ...'],
};
function icon(id: string, shape: keyof typeof SHAPES, main: string, dark: string): string {
  return defineSprite(id, SHAPES[shape], { pal: { X: main, Z: dark } });
}

const alive = (ps: Player[]) => ps.filter((p) => !p.downed);

// ------------------------------------------------------------------ stats simples
definePassive({
  id: 'p_oak_heart', name: 'Cœur de chêne', desc: '+1 PV max.', icon: icon('ip_oak_heart', 'heart', '#e0404a', '#9c2038'),
  maxStacks: 3, modify: (m, _c, self) => { m.maxHp += self.power; },
  onAcquire: (ctx) => { for (const p of alive(ctx.players)) ctx.heal(p, 1); },
});
definePassive({
  id: 'p_double_plate', name: 'Plaques doublées', desc: '+1 armure max.', icon: icon('ip_double_plate', 'shield', '#a0a8c0', '#555c70'),
  maxStacks: 3, modify: (m, _c, self) => { m.maxArmor += self.power; },
});
definePassive({
  id: 'p_deep_flask', name: 'Gourde sans fond', desc: '+50 énergie max.', icon: icon('ip_deep_flask', 'orb', '#9ae8ff', '#2858c8'),
  maxStacks: 3, modify: (m, _c, self) => { m.maxEnergy += 50 * self.power; },
  onAcquire: (ctx) => { for (const p of alive(ctx.players)) ctx.addEnergy(p, 50); },
});
definePassive({
  id: 'p_keen_eye', name: 'Œil de pie', desc: '+8 % de chances de coup critique.', icon: icon('ip_keen_eye', 'reticle', '#ffd23a', '#c8901c'),
  maxStacks: 3, modify: (m, _c, self) => { m.crit += 0.08 * self.power; },
});
definePassive({
  id: 'p_light_feet', name: 'Semelles de plume', desc: '+10 % de vitesse de déplacement.', icon: icon('ip_light_feet', 'boot', '#58d858', '#2c8a44'),
  maxStacks: 2, modify: (m, _c, self) => { m.speed *= 1 + 0.1 * self.power; },
});
definePassive({
  id: 'p_twitchy_trigger', name: 'Gâchette nerveuse', desc: '+12 % de cadence de tir.', icon: icon('ip_twitchy_trigger', 'bolt', '#ffd23a', '#f08030'),
  maxStacks: 3, modify: (m, _c, self) => { m.fireRate *= 1 + 0.12 * self.power; },
});
definePassive({
  id: 'p_lead_heart', name: 'Plomb béni', desc: '+12 % de dégâts infligés.', icon: icon('ip_lead_heart', 'star', '#f08030', '#b04a18'),
  maxStacks: 3, modify: (m, _c, self) => { m.damage *= 1 + 0.12 * self.power; },
});
definePassive({
  id: 'p_steady_hand', name: 'Main sûre', desc: 'Tirs plus précis et balles plus rapides.', icon: icon('ip_steady_hand', 'reticle', '#f4f0e0', '#8a93a8'),
  maxStacks: 2, modify: (m, _c, self) => { m.bulletSpread *= Math.pow(0.7, self.power); m.bulletSpeed *= 1 + 0.15 * self.power; },
});
definePassive({
  id: 'p_quick_forge', name: 'Forge de poche', desc: "L'armure se recharge plus tôt et plus vite.", icon: icon('ip_quick_forge', 'shield', '#f08030', '#b04a18'),
  maxStacks: 2, modify: (m, _c, self) => { m.armorDelay *= Math.pow(0.7, self.power); m.armorRate *= 1 + 0.3 * self.power; },
});
definePassive({
  id: 'p_wound_spring', name: "Ressort d'horloger", desc: 'La compétence se recharge 15 % plus vite.', icon: icon('ip_wound_spring', 'clock', '#c070ff', '#7038b8'),
  maxStacks: 2, modify: (m, _c, self) => { m.skillCd *= Math.pow(0.85, self.power); },
});
definePassive({
  id: 'p_magnet_pockets', name: 'Poches aimantées', desc: 'Le butin est attiré de bien plus loin.', icon: icon('ip_magnet_pockets', 'bolt', '#ff70b8', '#b83878'),
  maxStacks: 2, modify: (m, _c, self) => { m.pickupRange *= 1 + 0.6 * self.power; m.coinMagnet *= 1 + 0.5 * self.power; },
});
definePassive({
  id: 'p_lucky_purse', name: 'Bourse porte-bonheur', desc: '+20 % d\'or ramassé sur les ennemis.', icon: icon('ip_lucky_purse', 'coin', '#ffd23a', '#c8901c'),
  maxStacks: 2, modify: (m, _c, self) => { m.coinMult *= 1 + 0.2 * self.power; },
});
definePassive({
  id: 'p_victory_thirst', name: 'Soif de victoire', desc: 'Chaque ennemi vaincu a 4 % de chances de rendre 1 PV.', icon: icon('ip_victory_thirst', 'heart', '#c02848', '#5a0a1e'),
  maxStacks: 2, modify: (m, _c, self) => { m.lifeSteal += 0.04 * self.power; },
});

// ------------------------------------------------------------------ effets de balles
definePassive({
  id: 'p_iron_tips', name: 'Pointes de fer', desc: 'Les balles traversent un ennemi de plus.', icon: icon('ip_iron_tips', 'arrow', '#a0a8c0', '#4a3020'),
  maxStacks: 2, modify: (m, _c, self) => { m.bulletPierce += self.power; },
});
definePassive({
  id: 'p_rubber_rounds', name: 'Balles caoutchouc', desc: 'Les balles rebondissent une fois de plus sur les murs.', icon: icon('ip_rubber_rounds', 'arrow', '#58d858', '#1e4a2a'),
  maxStacks: 2, modify: (m, _c, self) => { m.bulletBounce += self.power; },
});
definePassive({
  id: 'p_hound_rounds', name: 'Balles flaireuses', desc: 'Les balles s\'incurvent légèrement vers les ennemis.', icon: icon('ip_hound_rounds', 'arrow', '#ff70b8', '#7038b8'),
  maxStacks: 2, modify: (m, _c, self) => { m.bulletHoming += 1.2 * self.power; },
});

// ------------------------------------------------------------------ effets spéciaux
definePassive({
  id: 'p_mirror_plate', name: 'Plaque miroir', desc: 'Quand ton armure encaisse un coup, elle renvoie une balle.', icon: icon('ip_mirror_plate', 'shield', '#c070ff', '#7038b8'),
  onDamage: (ctx, ev, self) => {
    const p = ev.target as Player;
    if (p.team !== 'player' || ev.cancel || !(ev.amount > 0) || p.armor <= 0) return;
    if (ctx.time - (self.state.t ?? -9) < 0.6) return;
    self.state.t = ctx.time;
    const e = ctx.nearestEnemy(p.x, p.y, 280);
    const a = e ? Math.atan2(e.y - p.y, e.x - p.x) : p.aim;
    ctx.spawnBullet({ damage: 14 * self.power, speed: 280, sprite: 'b_energy', color: 0xd0a0ff, pierce: 1, homing: 3, life: 1.2 }, p.x, p.y, a, 'player', p);
    ctx.burst(p.x, p.y, 0xc070ff, 6, 60, 0.3);
  },
});
definePassive({
  id: 'p_shrapnel_armor', name: "Éclats d'armure", desc: "Quand ton armure se brise, elle explose et balaie les balles.", icon: icon('ip_shrapnel_armor', 'flame', '#f08030', '#9c2038'),
  onDamage: (ctx, ev, self) => {
    const p = ev.target as Player;
    if (p.team !== 'player' || ev.cancel || ev.pierceArmor || p.armor <= 0 || ev.amount < p.armor) return;
    const r = 52;
    ctx.explode(p.x, p.y, r, (18 + 3 * ctx.depth) * self.power, 'player', { owner: p });
    for (const b of ctx.bullets) if (!b.dead && b.team === 'enemy' && b.kind !== 'beam' && Math.hypot(b.x - p.x, b.y - p.y) < r) b.dead = true;
  },
});
definePassive({
  id: 'p_field_kit', name: 'Trousse de campagne', desc: 'Toutes les 3 salles nettoyées, rend 1 PV.', icon: icon('ip_field_kit', 'cross', '#6ee06e', '#2c8a44'),
  onRoomClear: (ctx, _room, self) => {
    self.state.n = (self.state.n ?? 0) + 1;
    if (self.state.n % 3 !== 0) return;
    for (const p of alive(ctx.players)) ctx.heal(p, 1);
  },
});
definePassive({
  id: 'p_greedy_orbs', name: 'Orbes gourmands', desc: "Plus d'orbes d'énergie, et chacun rend 2 de plus.", icon: icon('ip_greedy_orbs', 'orb', '#48a8ff', '#1a7880'),
  maxStacks: 2,
  modify: (m, _c, self) => { m.energyDrop *= 1 + 0.4 * self.power; },
  onPickup: (_ctx, ev, self) => { if (ev.kind === 'energy') ev.amount += 2 * self.power; },
});
definePassive({
  id: 'p_cool_blood', name: 'Sang-froid', desc: 'Brûlure, gel, poison et choc ne durent jamais plus d\'une demi-seconde.', icon: icon('ip_cool_blood', 'cross', '#9ae8ff', '#2858c8'),
  onTick: (ctx) => {
    for (const p of ctx.players) {
      const s = p.status;
      for (const k in s) { const kk = k as keyof typeof s; if ((s[kk] ?? 0) > 0.5) s[kk] = 0.5; }
    }
  },
});
definePassive({
  id: 'p_second_wind', name: 'Second souffle', desc: 'Une fois par run, refuse la mort et revient avec la moitié de ses PV.', icon: icon('ip_second_wind', 'ankh', '#ffd23a', '#b04a18'),
  weight: 0.6,
  onPlayerDeath: (ctx, ev, self) => {
    if (self.state.used || ev.cancel) return;
    self.state.used = true;
    ev.cancel = true;
    const p = ev.player;
    p.hp = Math.max(1, Math.ceil(ctx.maxHp(p) / 2));
    p.invuln = Math.max(p.invuln, 3);
    for (const b of ctx.bullets) if (b.team === 'enemy') b.dead = true;
    ctx.flash(0xffd23a, 0.5);
    ctx.ring(p.x, p.y, 50, 0xffd23a);
    ctx.burst(p.x, p.y, 0xffd23a, 24, 110, 0.8);
    ctx.banner('SECOND SOUFFLE', 'Pas aujourd\'hui.', '#ffd23a');
  },
});
