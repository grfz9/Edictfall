// Première règle du cœur. Modèle à suivre : une règle = des métadonnées + des hooks, rien d'autre.
import { defineRule, defineSprite } from '../../core/registry';

defineSprite('ic_boom', ['....y.....', '.y..yy..y.', '..yyooyy..', '..yorroy..', 'yyor11royy', '.yor11roy.', '..yorroy..', '..yyooyy..', '.y..yy..y.', '.....y....']);
defineRule({
  id: 'volatile_dead', name: 'Morts volatiles', desc: 'Les ennemis explosent en mourant et blessent leurs voisins.',
  icon: 'ic_boom', category: 'enemies', flavor: 'boon',
  onEnemyDeath: (ctx, e, self) => {
    ctx.explode(e.x, e.y, 26 * Math.sqrt(self.power) + e.radius * e.scale, 10 + 2 * ctx.depth, 'player', { silent: ctx.enemies.length > 12 });
  },
});
