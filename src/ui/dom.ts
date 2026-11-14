// Outils DOM partagés par l'interface : sélecteurs, échappement, icônes (sprites du jeu + pictos pixel art propres à l'UI).
import type { ModifierDef, WeaponDef, WeaponInst } from '../core/types';
import { R } from '../core/registry';
import { rarityDamageMult } from '../core/damage';
import { spriteCanvas } from '../render/sprites';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
export const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const FLAVOR: Record<string, string> = { boon: 'Bénédiction', curse: 'Malédiction', mixed: 'Pacte' };
export const FLAVOR_COLOR: Record<string, string> = { boon: '#6ee06e', curse: '#ff5577', mixed: '#c9a0ff' };
export const CATEGORY: Record<string, string> = { weapons: 'Armes', hero: 'Héros', enemies: 'Ennemis', rooms: 'Salles', visual: 'Visuel', economy: 'Économie', meta: 'Méta' };
export const CATEGORY_ORDER = ['weapons', 'hero', 'enemies', 'rooms', 'visual', 'economy', 'meta'];
export const WEAPON_TYPES: Record<string, string> = {
  pistol: 'Pistolet', rifle: 'Fusil', shotgun: 'Fusil à pompe', laser: 'Laser', bow: 'Arc', launcher: 'Lanceur',
  sword: 'Épée', spear: 'Lance', staff: 'Bâton', weird: 'Étrange',
};

/** Libellé court du type d'un modificateur. */
export function modKindLabel(d: ModifierDef): string {
  if (d.kind === 'synergy') return 'Synergie';
  if (d.kind === 'passive') return 'Passif';
  return `${FLAVOR[d.flavor ?? 'mixed']} · ${CATEGORY[d.category ?? ''] ?? 'Édit'}`;
}
export function modColor(d: ModifierDef): string {
  if (d.kind === 'synergy') return '#ffd23a';
  if (d.kind === 'passive') return '#48a8ff';
  return FLAVOR_COLOR[d.flavor ?? 'mixed'];
}

// ------------------------------------------------------------------ icônes de sprites du jeu
/** Canvas d'un sprite du jeu, à l'échelle entière la plus grande qui tient dans `box` px. */
export function spriteFit(id: string, box: number): HTMLCanvasElement {
  const probe = spriteCanvas(id, 1);
  const s = Math.max(1, Math.floor(box / Math.max(probe.width, probe.height, 1)));
  return s === 1 ? probe : spriteCanvas(id, s);
}
/** Remplit les éléments [data-icon] (data-fit = boîte en px, sinon data-scale) encore vides. */
export function fillIcons(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    if (el.firstChild) return;
    const id = el.dataset.icon!;
    try {
      el.appendChild(el.dataset.fit ? spriteFit(id, Number(el.dataset.fit)) : spriteCanvas(id, Number(el.dataset.scale ?? 3)));
    } catch {
      el.textContent = '?';
    }
  });
}

// ------------------------------------------------------------------ pictos pixel art de l'UI
const PIX_PAL: Record<string, string> = {
  w: '#ffffff', r: '#e0404a', R: '#9c2038', a: '#c8d0e0', A: '#687088', y: '#ffd23a', Y: '#c8901c', o: '#f08030',
  c: '#9ae8ff', b: '#48a8ff', B: '#2858c8', p: '#c070ff', P: '#7038b8', k: '#1b1326', g: '#6ee06e', G: '#2c8a44', m: '#ff5577',
};
const PIX: Record<string, string[]> = {
  heart: ['.rr.rr.', 'rwrrrrr', 'rwrrrrR', 'rrrrrrR', '.rrrrR.', '..rrR..', '...R...'],
  heartEmpty: ['.AA.AA.', 'A..A..A', 'A.....A', 'A.....A', '.A...A.', '..A.A..', '...A...'],
  shield: ['aaaaaaa', 'awaaaaA', 'awaaaaA', 'awaaaaA', '.aaaaA.', '..aaA..', '...A...'],
  bolt: ['...cc', '..cc.', '.cc..', 'ccccc', '..cc.', '.cc..', 'cc...'],
  coin: ['.yyy.', 'ywyyY', 'yyyyY', 'yyyYY', '.YYY.'],
  gem: ['.ppp.', 'pwppP', 'ppppP', '.ppP.', '..P..'],
  skull: ['.www.', 'wwwww', 'wkwkw', 'wwwww', '.w.w.'],
  star: ['..y..', '..y..', 'yyyyy', '.yyy.', '.y.y.'],
  crown: ['y.y.y', 'yyyyy', 'yoyoy', 'yyyyy'],
  loop: ['.bbb.', 'b...b', 'b.b.b', '...bb', '.bbb.'],
  pause: ['ww.ww', 'ww.ww', 'ww.ww', 'ww.ww', 'ww.ww'],
  swords: ['a...a', '.a.a.', '..a..', '.a.a.', 'o...o'],
  hourglass: ['yyyyy', '.yay.', '..a..', '.yay.', 'yyyyy'],
  door: ['.AAA.', 'AaaaA', 'AaayA', 'AaaaA', 'AaaaA'],
};
const pixCache = new Map<string, string>();
/** URL data: d'un picto pixel art de l'UI, avec contour sombre. */
export function pixUrl(name: string, scale = 2): string {
  const key = name + scale;
  const hit = pixCache.get(key);
  if (hit) return hit;
  const rows = PIX[name] ?? PIX.star;
  const w = rows[0].length + 2, h = rows.length + 2;
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const g = c.getContext('2d')!;
  const solid = (x: number, y: number) => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== '.';
  for (let y = -1; y <= rows.length; y++)
    for (let x = -1; x <= rows[0].length; x++) {
      let col: string | null = null;
      if (solid(x, y)) col = PIX_PAL[rows[y][x]] ?? '#fff';
      else if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) col = '#1b1326';
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
    }
  const url = c.toDataURL();
  pixCache.set(key, url);
  return url;
}
/** <img> d'un picto UI (décoratif). */
export const pix = (name: string, scale = 2, cls = 'px') => `<img class="${cls}" src="${pixUrl(name, scale)}" alt="" draggable="false">`;

// ------------------------------------------------------------------ armes
export interface WeaponStats { dmg: number; count: number; total: number; energy: number; rate: number }
export function weaponStats(def: WeaponDef, rarity: number = def.rarity): WeaponStats {
  const count = (def.count ?? 1) * (def.burst?.count ?? 1);
  const dmg = Math.round(def.damage * rarityDamageMult(def.rarity, rarity) * 10) / 10;
  return { dmg, count, total: dmg * count, energy: def.energy, rate: Math.round((1 / Math.max(0.01, def.cooldown)) * 10) / 10 };
}
export const instStats = (w: WeaponInst) => weaponStats(w.def, w.rarity);
export const fmt = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');

export function modDef(id: string): ModifierDef | undefined {
  return R.mods.get(id);
}

/** Copie un texte dans le presse-papiers (avec repli). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Relance une animation CSS (retire/ajoute la classe). */
export function replay(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
