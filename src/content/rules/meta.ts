// Édits « méta » : des règles qui agissent sur les autres règles. Priorité 900+ (voir PLAN.md).
import { defineRule } from '../../core/registry';
import type { ModifierDef } from '../../core/types';
import type { Ctx } from '../../sim/ctx';
import { icon, pw, inRun } from './_kit';

/** Règles non méta, éligibles, tirées avec le RNG dédié aux règles (rejouable par seed). */
function drawRules(ctx: Ctx, n: number, exclude: string[] = []): ModifierDef[] {
  const pool = ctx.world.eligibleRules().filter((d) => d.category !== 'meta' && !exclude.includes(d.id));
  const out: ModifierDef[] = [];
  const rng = ctx.world.rng.rules;
  while (out.length < n && pool.length) {
    const d = rng.weighted(pool, (x) => x.weight ?? 1);
    pool.splice(pool.indexOf(d), 1);
    out.push(d);
  }
  return out;
}

defineRule({
  id: 'abundance', name: 'Embarras du choix', category: 'meta', flavor: 'boon', priority: 900, weight: 0.6, maxStacks: 2,
  desc: 'Chaque offre d\'édit propose une carte de plus.',
  icon: icon('ic_abundance', 'plus', 'p', 'P', 'y'),
  onRuleOffer: (_ctx, ev, s) => { ev.count += Math.max(1, Math.round(Math.min(2, pw(s, 2)))); },
});

defineRule({
  id: 'double_edict', name: 'Double décret', category: 'meta', flavor: 'boon', priority: 901, weight: 0.5,
  desc: 'À chaque offre d\'édit, tu en choisis deux (parmi au moins quatre cartes).',
  icon: icon('ic_double_edict', 'twin', 'y', 'p'),
  onRuleOffer: (_ctx, ev) => {
    ev.count = Math.max(ev.count, 4);
    ev.picks = Math.max(ev.picks, 2);
  },
});

defineRule({
  id: 'amplifier', name: 'Amplificateur', category: 'meta', flavor: 'mixed', priority: 900, weight: 0.6,
  desc: 'Toutes tes autres règles et synergies agissent 1,5 fois plus fort — bonus comme malus.',
  icon: icon('ic_amplifier', 'bolt', 'y', 'O', 'w'),
  modifyPower: (_ctx, target, power) => (target.def.kind === 'passive' ? power : power * 1.5),
});

defineRule({
  id: 'extremism', name: 'Extrémisme', category: 'meta', flavor: 'mixed', priority: 905, weight: 0.6,
  desc: 'Tes bénédictions et tes malédictions sont deux fois plus fortes ; les pactes mixtes ne changent pas.',
  icon: icon('ic_extremism', 'cross', 'r', 'g', 'w'),
  modifyPower: (_ctx, target, power) => (target.def.kind === 'rule' && (target.def.flavor === 'boon' || target.def.flavor === 'curse') ? power * 2 : power),
});

defineRule({
  id: 'mutation', name: 'Mutation', category: 'meta', flavor: 'mixed', priority: 910, weight: 0.7,
  desc: 'Au début de chaque étage, une de tes règles (hors méta) est remplacée par une autre au hasard, et tu gagnes 15 pièces.',
  icon: icon('ic_mutation', 'swirl', 'l', 'G', 'm'),
  onFloorStart: (ctx, self) => {
    if (!inRun(ctx)) return;
    const cands = ctx.rules.list.filter((i) => i.def.kind === 'rule' && i !== self && i.def.category !== 'meta');
    if (!cands.length) return;
    const rng = ctx.world.rng.rules;
    const victim = rng.pick(cands);
    ctx.removeModifier(victim.def.id);
    const [next] = drawRules(ctx, 1, [victim.def.id]);
    if (next) ctx.addModifier(next.id);
    ctx.addCoins(15);
    ctx.banner('MUTATION', next ? `${victim.def.name} → ${next.name}` : `${victim.def.name} s'efface`, '#c9a0ff');
  },
});

defineRule({
  id: 'echo', name: 'Écho', category: 'meta', flavor: 'boon', priority: 920, weight: 0.7,
  desc: 'La prochaine règle que tu acquiers est prise deux fois (si elle se cumule) ; sinon tu reçois 25 pièces.',
  icon: icon('ic_echo', 'wave', 'c', 'p'),
  onRuleAcquired: (ctx, inst, self) => {
    if (self.state.done || inst === self || inst.def.kind !== 'rule') return;
    self.state.done = true;
    if (inst.stacks < (inst.def.maxStacks ?? 1)) {
      ctx.addModifier(inst.def.id);
      ctx.banner('ÉCHO', inst.def.name + ' ×2', '#9ad8ff');
    } else ctx.addCoins(25);
  },
});

defineRule({
  id: 'amnesia', name: 'Amnésie', category: 'meta', flavor: 'mixed', priority: 930, weight: 0.5,
  desc: 'Oublie toutes tes autres règles. Pour chacune oubliée (au moins une) : +1 PV max et +15 % de dégâts.',
  icon: icon('ic_amnesia', 'skull', 'i', '3'),
  onAcquire: (ctx, self) => {
    if (self.state.n !== undefined) return;
    const victims = ctx.rules.list.filter((i) => i.def.kind === 'rule' && i !== self);
    let n = 0;
    for (const v of victims) { n += v.stacks; ctx.removeModifier(v.def.id); }
    self.state.n = Math.max(1, Math.min(6, n));
  },
  modify: (m, _ctx, self) => {
    const n = self.state.n ?? 1;
    m.maxHp += n;
    m.damage *= 1 + 0.15 * n;
  },
});

defineRule({
  id: 'dice_roll', name: 'Coup de dés', category: 'meta', flavor: 'mixed', priority: 940, weight: 0.6,
  desc: 'En la prenant, tu reçois aussitôt deux autres règles tirées au hasard, bonnes ou mauvaises.',
  icon: icon('ic_dice_roll', 'dots', 'w', '3', 'r'),
  onAcquire: (ctx, self) => {
    if (self.state.rolled) return;
    self.state.rolled = true;
    const got = drawRules(ctx, 2, ['dice_roll']);
    for (const d of got) ctx.addModifier(d.id);
    if (got.length) ctx.banner('COUP DE DÉS', got.map((d) => d.name).join(' + '), '#ffd23a');
  },
});
