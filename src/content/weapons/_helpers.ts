// Outils partagés par les fichiers d'armes (aucune arme définie ici).
import { defineSprite } from '../../core/registry';
import type { ShootEvent, SpriteDef, Enemy } from '../../core/types';
import type { Ctx } from '../../sim/ctx';

/** defineSprite qui complète les lignes courtes avec du transparent (largeurs toujours égales). */
export function spr(id: string, rows: string[], opts: Partial<Omit<SpriteDef, 'id' | 'px'>> = {}): string {
  const w = Math.max(...rows.map((r) => r.length));
  return defineSprite(id, rows.map((r) => r.padEnd(w, '.')), opts);
}

/** Vise un tir en cloche : sur l'ennemi le plus proche dans le cône de visée, sinon à `range` px. */
export function aimLob(ctx: Ctx, ev: ShootEvent, range: number): void {
  const p = ev.player;
  let best: Enemy | null = null, bd = range * range;
  for (const e of ctx.enemies) {
    if (e.dead || e.spawnT > 0 || e.charmed) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d2 = dx * dx + dy * dy;
    if (d2 > bd) continue;
    let da = Math.atan2(dy, dx) - ev.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > 0.6) continue;
    bd = d2; best = e;
  }
  for (const s of ev.specs) {
    const a = ev.angle + (s.angle ?? 0);
    const tx = best ? best.x : p.x + Math.cos(a) * range;
    const ty = best ? best.y : p.y + Math.sin(a) * range;
    s.tx = tx + (best && ev.specs.length > 1 ? Math.cos(a) * 8 * (s.angle ?? 0) * 10 : 0);
    s.ty = ty + (best && ev.specs.length > 1 ? Math.sin(a) * 8 * (s.angle ?? 0) * 10 : 0);
    s.life = Math.max(0.35, Math.min(0.9, Math.hypot(s.tx - p.x, s.ty - p.y) / 170));
  }
}

/** Distance bornée (évite les divisions par zéro). */
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.max(1, Math.hypot(bx - ax, by - ay));

/** Gerbe de bouche de canon « stylée » (étincelles + anneau optionnel), à appeler depuis onFire. */
export function muzzleFx(ctx: Ctx, ev: ShootEvent, color: number, n = 5, ring = 0, reach = 14): void {
  const p = ev.player, a = ev.angle;
  const x = p.x + Math.cos(a) * reach, y = p.y + Math.sin(a) * reach;
  ctx.burst(x, y, color, n, 80, 0.2, 2);
  if (ring > 0) ctx.ring(x, y, ring, color);
}

/** Dégâts « de base » d'une balle déjà créée (retire les mods du tireur, pour respawner sans double-compter). */
export function baseDamage(b: { damage: number; owner: unknown; kind?: string }): number {
  const m = (b.owner as { mods?: { damage: number; meleeDamage: number } } | null)?.mods;
  if (!m) return b.damage;
  return b.damage / Math.max(0.01, m.damage * (b.kind === 'slash' ? m.meleeDamage : 1));
}

// ------------------------------------------------------------------ balles partagées (plus détaillées que les génériques)
defineSprite('b_slug', ['.YYy1.', 'YYyy11', '.YYy1.']);
defineSprite('b_pellet', ['.Y1', 'Yy1', '.Y1']);
defineSprite('b_bolt_c', ['..cc..', 'CCc111', '..cc..']);
defineSprite('b_fist', ['.4aaaa.', '4a2222a', '4aa2a2a', '4a2222a', '.4aaaa.']);
