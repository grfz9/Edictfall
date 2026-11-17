// Salle du Sceau : un sceau d'Ascelin retient le boss secret. Le briser = combat + édit bonus.
import { defineSprite, R } from '../../core/registry';
import { defineSpecialRoom } from './_kit';
import type { EnemyDef } from '../../core/types';

defineSprite('room_seal', [
  '.....RRRRRR.....', '...RRrrrrrrRR...', '..RrrR....RrrR..', '.RrR..eeee..RrR.', '.Rr..e....e..rR.', 'Rr..e..ee..e..rR',
  'Rr.e..e11e..e.rR', 'Rr.e.e1yy1e.e.rR', 'Rr.e.e1yy1e.e.rR', 'Rr.e..e11e..e.rR', 'Rr..e..ee..e..rR', '.Rr..e....e..rR.',
  '.RrR..eeee..RrR.', '..RrrR....RrrR..', '...RRrrrrrrRR...', '.....RRRRRR.....',
], { outline: false });

/** Le boss secret (lot Boss) ; à défaut, un Seigneur d'un autre monde. */
export function secretBoss(world: number): EnemyDef | null {
  const all = [...R.enemies.values()];
  return all.find((d) => d.id.startsWith('boss_secret')) ?? all.find((d) => d.boss && d.world > 0 && d.world !== world) ?? all.find((d) => d.boss) ?? null;
}

const VOICE = { who: 'Sceau d\'Ascelin', portrait: 'room_seal', color: '#ff5566' };

defineSpecialRoom({
  id: 'seal', name: 'Salle du Sceau', weight: 0.7, minDepth: 3,
  build(k) {
    const { cx, cy, ctx } = k;
    k.npc(cx, cy - 10, {
      sprite: 'room_seal', label: 'Sceau d\'Ascelin', sub: 'Quelque chose gratte de l\'autre côté', radius: 22, kind: 'altar',
      lines: ['…gratte… gratte…', 'Laisse-moi sortir. J\'ai des pages pour toi.'],
      use: (_c, _p, self) => {
        if (self.data?.broken) return false;
        k.dialog({
          lines: [{ ...VOICE, text: 'Ce sceau retient une page que même Ascelin n\'osait pas lire. Le briser libérera ce qu\'il garde. Et l\'Édit qu\'il porte.' }],
          options: [
            { label: 'Briser le sceau', act: () => {
              self.data = { ...self.data, broken: true, lines: undefined };
              self.tint = 0x444455; self.sub = 'Brisé';
              k.fight(() => {
                const def = secretBoss(ctx.worldNum);
                if (!def) return null;
                const e = ctx.spawnEnemy(def.id, cx, cy - 20, { delay: 1.4, champion: !def.boss });
                ctx.banner(def.name.toUpperCase(), def.boss?.title ?? 'Gardien scellé', '#ff3355');
                ctx.shake(10); ctx.flash(0xff3355, 0.4);
                return e;
              });
            } },
            { label: 'Ne rien toucher (sage)', cancel: true },
          ],
        });
      },
    });
    for (const dx of [-70, 70]) k.deco('deco_torch', cx + dx, cy - 60, 0xff8080);
  },
  enter(k) { k.ctx.shake(3); k.ctx.sfx('boss', 0.4); },
});
