// Wassim Hadmi : marchand ambulant interdimensionnel, sans patente, sans scrupules, sans boussole.
// Il apparaît dans la salle de départ de chaque run et propose 3 marchés tirés de ce tableau.
// Ajouter un marché = ajouter une entrée. `apply` passe uniquement par ctx (règles, PV, or, armes, pactes…).
import type { Ctx } from '../../sim/ctx';
import type { Player } from '../../core/types';
import { R, allRules } from '../../core/registry';

export interface WassimDeal {
  id: string;
  /** Titre du marché (bouton). */
  title: string;
  /** Le boniment. */
  pitch: string;
  /** Sa réplique une fois le marché conclu. */
  accept: string;
  weight?: number;
  /** Proposable seulement si vrai. */
  can?: (ctx: Ctx, p: Player) => boolean;
  apply: (ctx: Ctx, p: Player) => void;
}

/** Héros « grenouille » ajouté par un autre lot (recherche souple par id / nom / titre). */
export function frogHeroId(): string | null {
  for (const h of R.heroes.values()) if (/grenouille|frog|crapaud|rainette|croa|coa/i.test(`${h.id} ${h.name} ${h.title}`)) return h.id;
  return null;
}
/** Tire n règles maudites encore éligibles. */
function curses(ctx: Ctx, n: number): string[] {
  const w = ctx.world, out: string[] = [];
  const pool = w.eligibleRules().filter((d) => d.flavor === 'curse');
  for (let i = 0; i < n && pool.length; i++) {
    const d = ctx.lootRng.pick(pool);
    pool.splice(pool.indexOf(d), 1);
    out.push(d.id);
  }
  return out;
}

export const WASSIM_DEALS: WassimDeal[] = [
  {
    id: 'hp_for_legend', title: 'Tous tes PV contre une arme légendaire',
    pitch: 'Tous. Tes. PV. Enfin, tu gardes le dernier, je ne suis pas un monstre. Juste un commerçant.',
    accept: 'Topé ! Ne cours pas avec, c\'est pointu. Et toi, t\'es fragile.',
    apply: (ctx, p) => {
      p.hp = 1; p.armor = 0;
      ctx.giveWeapon(p, ctx.randomWeaponId(10), 4);
      ctx.flash(0xff9a30, 0.35);
    },
  },
  {
    id: 'double_gold', title: 'Je double ton or. Et les ennemis.',
    pitch: 'Double or ! Double ennemis ! Double plaisir ! Les ennemis aussi sont contents, ils seront plus nombreux à te voir.',
    accept: 'Marché conclu. J\'ai prévenu les monstres, ils arrivent en car.',
    apply: (ctx) => {
      ctx.addCoins(10);
      ctx.addPact({ id: 'double_gold', name: 'Double ou rien', desc: 'Or ×2, ennemis ×1,6.', modify: (m) => { m.coinMult *= 2; m.enemyCount *= 1.6; } });
    },
  },
  {
    id: 'frog_swap', title: 'Ton héros contre une grenouille… attends, non',
    pitch: 'Je t\'échange ton héros contre une grenouille. Attends, non. Si ? La grenouille hoche la tête. Elle a une cravate, c\'est sérieux.',
    accept: '…bon, la grenouille a dit oui, moi j\'ai dit non, elle a gagné. Elle négocie mieux que moi.',
    apply: (ctx, p) => {
      const id = frogHeroId();
      if (id && id !== p.hero.id && ctx.swapHero(p, id)) return;
      // pas de grenouille disponible : une grenouille en peluche (+1 PV max) et des excuses sonnantes
      ctx.addPact({ id: 'plush_frog', name: 'Grenouille en peluche', desc: '+1 PV max. Elle te regarde.', modify: (m) => { m.maxHp += 1; } });
      ctx.addCoins(15);
      ctx.heal(p, 1);
    },
  },
  {
    id: 'gem_curses', title: '1 gemme contre 3 édits maudits',
    pitch: 'Une gemme ! Une vraie ! Brillante ! En échange, trois petits édits maudits. Tout petits. Presque mignons.',
    accept: 'Félicitations, tu es maintenant l\'heureux propriétaire d\'une gemme. Et de trois problèmes.',
    can: (ctx) => ctx.world.eligibleRules().some((d) => d.flavor === 'curse'),
    apply: (ctx) => {
      ctx.addGems(1);
      for (const id of curses(ctx, 3)) ctx.grantRule(id);
    },
  },
  {
    id: 'half_life', title: 'La moitié de ta vie contre des dégâts doublés',
    pitch: 'La moitié de tes PV max. L\'autre moitié, tu la gardes, je suis généreux. En échange, tu tapes comme deux.',
    accept: 'Vendu ! Tu vis deux fois moins, mais deux fois plus fort. C\'est mathématique. Je crois.',
    apply: (ctx, p) => {
      const half = Math.floor(p.hero.hp / 2);
      ctx.addPact({ id: 'half_life', name: 'Demi-vie', desc: 'PV max −50 %, dégâts ×1,8.', modify: (m) => { m.maxHp -= half; m.damage *= 1.8; } });
    },
  },
  {
    id: 'shadow', title: 'Ton ombre contre 60 pièces',
    pitch: 'Je t\'achète ton ombre. Et la lumière, tant qu\'on y est, ça fait un lot. Tu n\'en avais pas besoin, si ?',
    accept: 'Merci ! Je la revends aux vampires, ils adorent. Fais attention dans le noir.',
    apply: (ctx) => {
      ctx.addCoins(60);
      ctx.addPact({ id: 'shadow', name: 'Sans ombre', desc: 'Vision réduite, butin plus rare.', modify: (m) => { m.darkness = m.darkness ? Math.min(m.darkness, 130) : 130; m.weaponRarityBonus += 0.6; } });
    },
  },
  {
    id: 'mystery_gun', title: 'Ton arme contre une arme surprise',
    pitch: 'Ton arme contre… SURPRISE ! Ça peut être une merveille. Ou une cuillère. Moi-même je ne sais pas, c\'est ça le frisson.',
    accept: 'Et voilà ! Ne me dis pas ce que c\'est, je préfère rêver.',
    apply: (ctx, p) => {
      const rar = ctx.lootRng.pick([0, 1, 2, 3, 3, 4]);
      const old = p.weapons[p.cur];
      const id = ctx.randomWeaponId(rar);
      const wi = ctx.makeWeapon(id, rar);
      if (!wi) return;
      if (old) p.weapons[p.cur] = wi; else p.weapons.push(wi);
      ctx.text(p.x, p.y - 16, wi.def.name.toUpperCase(), 0xffd23a);
    },
  },
  {
    id: 'tiny', title: 'Je te rétrécis (gratuitement !)',
    pitch: 'Plus petit = plus dur à toucher. Les ennemis grossissent par solidarité, mais c\'est leur problème. Enfin, un peu le tien.',
    accept: 'Pouf ! Tu es adorable. Les monstres aussi ont pris du ventre.',
    apply: (ctx) => {
      ctx.addPact({ id: 'tiny', name: 'Format poche', desc: 'Tu rétrécis, les ennemis grossissent (+15 % PV).', modify: (m) => { m.playerScale *= 0.7; m.enemyScale *= 1.3; m.enemyHp *= 1.15; } });
    },
  },
  {
    id: 'armor_energy', title: 'Ton armure contre 90 s d\'énergie infinie',
    pitch: 'Ton armure, pour toujours, contre de l\'énergie infinie. Pendant 90 secondes. Le « pour toujours » est un peu plus long, oui.',
    accept: 'Tire ! Tire tant que c\'est gratuit ! Le chrono tourne, l\'armure ne reviendra pas.',
    apply: (ctx, p) => {
      const until = ctx.time + 90;
      const armor = p.hero.armor;
      p.armor = 0;
      ctx.addPact({ id: 'armor_energy', name: 'Sans cuirasse', desc: 'Plus d\'armure. Énergie infinie les 90 premières secondes.', modify: (m, c) => { m.maxArmor -= armor; if (c.time < until) m.energyInfinite = true; } });
    },
  },
  {
    id: 'hug', title: 'Un câlin gratuit',
    pitch: 'Un câlin. Juste un câlin. Gratuit. Pourquoi tu recules ? C\'est le marché le plus honnête que j\'aie jamais fait.',
    accept: 'Voilà. Tu te sens mieux ? Moi oui. Ça fera… non, je rigole. Garde le PV.',
    apply: (ctx, p) => {
      ctx.addPact({ id: 'hug', name: 'Câlin de Wassim', desc: '+1 PV max. Ça sent le patchouli.', modify: (m) => { m.maxHp += 1; } });
      ctx.heal(p, 99);
    },
  },
  {
    id: 'shortcut', title: 'Un raccourci vers l\'étage suivant',
    pitch: 'Un raccourci ! Je connais un trou derrière cette porte. Il coûte 2 PV, c\'est le péage. Le trou est très privé.',
    accept: 'Saute ! …Non, pas comme ça. Bon, ça ira.',
    can: (ctx) => ctx.world.floorNum < 3,
    apply: (ctx, p) => {
      p.hp = Math.max(1, p.hp - 2);
      ctx.skipFloor();
    },
  },
];

export const WASSIM_GREETINGS = [
  'Ah ! Un client ! Ou un mur avec des jambes. Non, un client ! Wassim Hadmi, marchand interdimensionnel. Sans patente.',
  'Bienvenue, bienvenue ! Tout est à vendre, même moi. Surtout moi. Enfin, non, pas moi. Quoique.',
  'Approche ! J\'ai des affaires si bonnes qu\'elles sont probablement illégales dans deux mondes sur trois.',
  'Tu tombes bien, je viens d\'ouvrir. Et de fermer. Et de rouvrir. C\'est un commerce dynamique.',
];
export const WASSIM_REFUSE = [
  'Tu refuses ? Personne ne refuse Wassim ! …Enfin si, tout le monde. Mais toi, ça me vexe particulièrement.',
  'Pas de marché ? Très bien. Je garde mes affaires. Elles ne voulaient pas partir de toute façon.',
  'Sage décision. Ou pas. On ne saura jamais. Moi je sais. Mais je ne dirai rien.',
];
export const WASSIM_IDLE = ['Psst !', 'Satisfait ou… satisfait.', 'Pas de retour, pas d\'échange, pas de questions.', 'J\'ai une grenouille en stock.', 'Prix d\'ami ! Tu n\'es pas mon ami, mais quand même.'];
export const WASSIM_BYE = ['Au plaisir ! Surtout le mien.', 'Reviens à la prochaine run !', 'Pouf !'];

/** Tous les marchés proposables (utilisé par le moteur et les tests). */
export function dealsFor(ctx: Ctx, p: Player): WassimDeal[] {
  return WASSIM_DEALS.filter((d) => { try { return !d.can || d.can(ctx, p); } catch { return false; } });
}
export const hasRules = () => allRules().length > 0;
