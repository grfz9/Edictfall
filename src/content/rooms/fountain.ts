// Fontaine des souhaits : une pièce pour un petit vœu, une gemme pour un Édit.
import { T, TILE } from '../../sim/dungeon';
import { defineSpecialRoom } from './_kit';

const SPIRIT = { who: 'Esprit de la fontaine', portrait: 'deco_fountain', color: '#9ae8ff' };

defineSpecialRoom({
  id: 'fountain', name: 'Fontaine des souhaits', weight: 1.1,
  build(k) {
    const { cx, cy, ctx } = k;
    const w = ctx.world;
    for (const dx of [-12, 0, 12]) k.setTile(Math.floor((cx + dx) / TILE), Math.floor((cy + 4) / TILE), T.BLOCK);
    k.deco('deco_plant', cx - 70, cy - 40); k.deco('deco_plant', cx + 70, cy - 40);
    k.npc(cx, cy - 2, {
      sprite: 'deco_fountain', label: 'Fontaine des souhaits', sub: 'Jeter quelque chose dedans', radius: 26, kind: 'altar',
      lines: ['Plic.', 'Ploc.', 'Un vœu ? Deux vœux ? Trois, c\'est un abonnement.'],
      use: (_c, p) => k.dialog({
        lines: [{ ...SPIRIT, text: 'Bloup. Jette une pièce, je fais un petit miracle. Jette une gemme, je réécris un bout du monde.' }],
        options: [
          { label: 'Jeter 5 pièces', sub: `Tu as ${w.coins} or`, act: () => {
            if (w.coins < 5) { k.dialog({ lines: [{ ...SPIRIT, text: 'Tu essaies de jeter… du vide ? Poétique, mais non.' }] }); return; }
            ctx.addCoins(-5);
            const r = ctx.lootRng.int(0, 4);
            const txt = [
              () => { ctx.heal(p, 2); return 'Tu te sens mieux. Beaucoup mieux. Deux PV de mieux.'; },
              () => { ctx.addEnergy(p, 999); return 'Énergie pleine ! L\'eau était gazeuse.'; },
              () => { ctx.addArmor(p, 3); return 'Une fine pellicule d\'eau durcit sur toi. C\'est de l\'armure. Ne pose pas de questions.'; },
              () => { ctx.addCoins(12); return 'La fontaine te rend la monnaie. Avec les intérêts.'; },
              () => { w.offerPassives(); return 'Une bénédiction remonte des profondeurs !'; },
            ][r]();
            ctx.burst(k.cx, k.cy, 0x9ae8ff, 14, 60);
            k.dialog({ lines: [{ ...SPIRIT, text: txt }] });
          } },
          { label: 'Jeter une gemme', sub: `Gemmes de la run : ${w.gems}`, act: () => {
            if (w.gems < 1) { k.dialog({ lines: [{ ...SPIRIT, text: 'Pas de gemme, pas d\'Édit. C\'est écrit quelque part. Dans le Registre, sans doute.' }] }); return; }
            ctx.addGems(-1);
            ctx.flash(0x9ae8ff, 0.4);
            ctx.offerRules('VŒU EXAUCÉ', 'La fontaine réécrit une règle pour toi.');
          } },
          { label: 'Garder ses sous', cancel: true },
        ],
      }),
    });
  },
});
