// Génère docs/CONTENU.md depuis les registres : `npm run docs`. Ignoré dans `npm test`.
import { it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { R } from '../src/core/registry';
import { RARITY_NAMES } from '../src/core/damage';
import './helpers';

const CAT: Record<string, string> = { weapons: 'Armes', hero: 'Héros', enemies: 'Ennemis', rooms: 'Salles', visual: 'Visuel', economy: 'Économie', meta: 'Méta' };
const FLAV: Record<string, string> = { boon: 'Bénédiction', curse: 'Malédiction', mixed: 'Pacte' };
const cell = (s: unknown) => String(s ?? '').replace(/\|/g, '\|').replace(/\n/g, ' ');

it.skipIf(!process.env.GEN_DOCS)('génère docs/CONTENU.md', () => {
  const L: string[] = ['# Contenu d\'Edictfall', '', '> Fichier généré par `npm run docs` à partir des données du jeu. Ne pas éditer à la main.', ''];
  const heroes = [...R.heroes.values()];
  L.push(`## Héros (${heroes.length})`, '', '| Héros | PV | Armure | Énergie | Coût ◆ | Compétence |', '|---|---|---|---|---|---|');
  for (const h of heroes) L.push(`| **${cell(h.name)}**, ${cell(h.title)} | ${h.hp} | ${h.armor} | ${h.energy} | ${h.cost} | **${cell(h.skill.name)}** (${h.skill.cooldown} s) : ${cell(h.skill.desc)} |`);
  const weapons = [...R.weapons.values()].sort((a, b) => a.rarity - b.rarity || a.type.localeCompare(b.type));
  L.push('', `## Armes (${weapons.length})`, '', '| Arme | Rareté | Type | Énergie | Dégâts | Description |', '|---|---|---|---|---|---|');
  for (const w of weapons) L.push(`| ${cell(w.name)}${w.unlock !== undefined ? ` (Arsenal, ${w.unlock} ◆)` : ''} | ${RARITY_NAMES[w.rarity]} | ${w.type} | ${w.energy} | ${w.damage}${(w.count ?? 1) > 1 ? '×' + w.count : ''} | ${cell(w.desc)} |`);
  const mods = [...R.mods.values()];
  const rules = mods.filter((m) => m.kind === 'rule');
  L.push('', `## Édits — règles qui modifient la partie (${rules.length})`, '');
  for (const c of Object.keys(CAT)) {
    const rs = rules.filter((r) => r.category === c);
    if (!rs.length) continue;
    L.push(`### ${CAT[c]} (${rs.length})`, '', '| Édit | Type | Effet |', '|---|---|---|');
    for (const r of rs) L.push(`| **${cell(r.name)}**${(r.maxStacks ?? 1) > 1 ? ` (×${r.maxStacks})` : ''} | ${FLAV[r.flavor ?? 'mixed']} | ${cell(r.desc)} |`);
    L.push('');
  }
  const syn = mods.filter((m) => m.kind === 'synergy');
  L.push(`## Synergies cachées (${syn.length})`, '', '| Synergie | Combinaison | Effet |', '|---|---|---|');
  for (const s of syn) L.push(`| **${cell(s.name)}** | ${(s.requires ?? []).map((id) => R.mods.get(id)?.name ?? id).join(' + ')} | ${cell(s.desc)} |`);
  const pas = mods.filter((m) => m.kind === 'passive');
  L.push('', `## Passifs (${pas.length})`, '', '| Passif | Effet |', '|---|---|');
  for (const p of pas) L.push(`| **${cell(p.name)}** | ${cell(p.desc)} |`);
  L.push('', `## Familiers (${R.pets.size})`, '', '| Familier | Coût ◆ | Effet |', '|---|---|---|');
  for (const p of R.pets.values()) L.push(`| **${cell(p.name)}** | ${p.cost} | ${cell(p.desc)} |`);
  for (const wn of [1, 2, 3]) {
    const es = [...R.enemies.values()].filter((e) => e.world === wn);
    const boss = es.filter((e) => e.boss);
    L.push('', `## Monde ${wn} — ${R.themes.get(wn)?.name ?? ''} (${es.length - boss.length} ennemis)`, '');
    L.push(es.filter((e) => !e.boss).map((e) => e.name).join(' · '), '');
    for (const b of boss) L.push(`**Boss : ${b.name}** — ${b.boss!.title} (${b.boss!.phases.length} phases)`, '');
  }
  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/CONTENU.md', L.join('\n') + '\n');
  console.log(`docs: ${heroes.length} héros, ${weapons.length} armes, ${rules.length} édits, ${syn.length} synergies, ${pas.length} passifs`);
});
