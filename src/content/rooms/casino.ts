// Casino des Ratures : on parie son or (et ses gemmes) contre des machines au sourire suspect.
import { defineSprite } from '../../core/registry';
import { HOOD } from '../misc/npcs';
import { defineSpecialRoom, type RoomKit } from './_kit';
import type { Interactable } from '../../core/types';

defineSprite('npc_croupier', HOOD, { pal: { H: '#9c2038', h: '#5a0a1e', y: '#ffd23a' } });
defineSprite('room_slot', [
  '..yyyyyyyy..', '.yrrrrrrrry.', '.yr1rr1rrry.', '.yyyyyyyyyy.', '.y22y22y22y.', '.y2ry2gy2by.', '.y22y22y22y.', '.yyyyyyyyyy.',
  '.yrrrrrrrry3', '.yrrr00rrry3', '.yrrrrrrrry3', '.yyyyyyyyyy.', '.RRRRRRRRRR.', '.RRRRRRRRRR.', '..dd....dd..',
]);

function deny(k: RoomKit, it: Interactable, s: string): false {
  k.say(it, s, 2);
  k.ctx.sfx('deny');
  return false;
}

defineSpecialRoom({
  id: 'casino', name: 'Casino des Ratures', weight: 1.2,
  build(k) {
    const { cx, cy, ctx } = k;
    const w = ctx.world;
    k.npc(cx, cy - 40, {
      sprite: 'npc_croupier', label: 'Croupière Lunette', sub: 'La maison gagne toujours. Presque.', radius: 0,
      greet: 'Faites vos jeux ! Rien ne va plus ! Surtout pour vous.',
      lines: ['La chance sourit aux audacieux. Elle rit des autres.', 'Encore une ? Allez, encore une.', 'Je ne triche pas. Les machines, si.'],
    });
    k.npc(cx - 50, cy + 6, {
      sprite: 'room_slot', label: 'Bandit manchot', sub: 'Mise : 5 or · 45 % de gagner 12 or', radius: 16, tint: 0xffe0e0,
      use: (_c, p, self) => {
        if (w.coins < 5) return deny(k, self, 'Pas de pièce, pas de chocolat.');
        ctx.addCoins(-5);
        const r = ctx.lootRng.next();
        if (r < 0.05) { ctx.spawnPickup('gem', self.x, self.y + 14, 1); k.say(self, 'JACKPOT ! Une gemme !', 2.5); ctx.sfx('gem'); }
        else if (r < 0.5) { ctx.addCoins(12); k.say(self, 'Gagné ! +12', 2); ctx.sfx('coin'); ctx.burst(self.x, self.y, 0xffd23a, 10, 60); }
        else k.say(self, ctx.lootRng.pick(['Perdu !', 'Presque !', 'La machine ricane.', 'Rejoue, tu vas te refaire.']), 1.8);
        void p;
      },
    });
    k.npc(cx, cy + 6, {
      sprite: 'room_slot', label: 'Roulette du tout ou rien', sub: 'Mise : TOUT ton or · 47 % de le doubler', radius: 16, tint: 0xd0d0ff,
      use: (_c, _p, self) => {
        const bet = w.coins;
        if (bet < 1) return deny(k, self, 'Tout ton or ? Tu n\'en as pas. Respect.');
        if (ctx.lootRng.chance(0.47)) { ctx.addCoins(bet); k.say(self, `DOUBLÉ ! +${bet}`, 2.5); ctx.sfx('buy'); ctx.flash(0xffd23a, 0.25); }
        else { ctx.addCoins(-bet); k.say(self, 'Tout perdu. Magnifique.', 2.5); ctx.sfx('deny'); }
      },
    });
    k.npc(cx + 50, cy + 6, {
      sprite: 'room_slot', label: 'Machine dorée', sub: 'Mise : 1 gemme · 25 % : arme légendaire', radius: 16, tint: 0xfff0a0,
      use: (_c, _p, self) => {
        if (w.gems < 1) return deny(k, self, 'Elle ne mange que des gemmes. Elle est au régime.');
        ctx.addGems(-1);
        if (ctx.lootRng.chance(0.25)) { ctx.dropWeapon(ctx.randomWeaponId(10), self.x, self.y + 22, 4); k.say(self, 'LÉGENDAIRE !', 2.5); ctx.sfx('unlock'); ctx.flash(0xff9a30, 0.3); }
        else k.say(self, 'Elle a mangé ta gemme. Elle dit merci.', 2.2);
      },
    });
  },
  enter(k) {
    k.ctx.spawnPickup('coin', k.cx - 20, k.cy + 40, 3);
    k.ctx.spawnPickup('coin', k.cx + 20, k.cy + 40, 3);
  },
});
