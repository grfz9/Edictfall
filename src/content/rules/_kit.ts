// Outils partagés par les fichiers de règles : formes d'icônes 10×10 recolorables, dosage de la puissance, petits utilitaires.
// Aucune règle n'est définie ici. Aucun état de module : tout l'état vit dans self.state / e.data / p.data.
import { defineSprite } from '../../core/registry';
import type { ModInst, Player, Bullet, BulletSpec, Room } from '../../core/types';
import type { Ctx } from '../../sim/ctx';

/** Formes 10×10 : A = couleur principale, B = ombre, C = reflet. '0'/'1' = noir/blanc de la palette. */
const SHAPES: Record<string, string[]> = {
  bolt: ['......AA..', '.....AAB..', '....AAB...', '...AAB....', '..AAAAAAB.', '.BBBBAAB..', '....AAB...', '...AAB....', '..AAB.....', '..AB......'],
  heart: ['..........', '.AAA..AAA.', 'AACAAAAAAB', 'ACAAAAAAAB', 'AAAAAAAAAB', '.AAAAAAAB.', '..AAAAAB..', '...AAAB...', '....AB....', '..........'],
  shield: ['.BBBBBBBB.', 'BAAAAAAAAB', 'BACCAAAAAB', 'BACAAAAAAB', 'BAAAAAAAAB', 'BAAAAAAAAB', '.BAAAAAAB.', '..BAAAAB..', '...BAAB...', '....BB....'],
  skull: ['..BBBBBB..', '.BAAAAAAB.', 'BAAAAAAAAB', 'BA00AA00AB', 'BA00AA00AB', 'BAAAA0AAAB', '.BAAAAAAB.', '..BA1A1B..', '..BABABB..', '...BBBB...'],
  coin: ['...BBBB...', '..BAAAAB..', '.BACAAAAB.', 'BACAABAAAB', 'BAAAABAAAB', 'BAAAABAAAB', 'BAAAABAAAB', '.BAAAAAAB.', '..BAAAAB..', '...BBBB...'],
  eye: ['..........', '...BBBB...', '.BB1111BB.', 'B11AAAA11B', 'B1AA00AA1B', 'B1AA00AA1B', 'B11AAAA11B', '.BB1111BB.', '...BBBB...', '..........'],
  star: ['....AA....', '....AA....', '...ACCA...', 'AAAACAAAAA', '.AAAAAAAA.', '..AAAAAA..', '..AAAAAA..', '.AAB..BAA.', '.AB....BA.', '..........'],
  arrow: ['..........', '.....A....', '.....AA...', 'AAAAAAAA..', 'ACCCCCCAA.', 'ABBBBBBAA.', 'BBBBBBBA..', '.....AA...', '.....A....', '..........'],
  target: ['...AAAA...', '..A....A..', '.A..BB..A.', 'A..B..B..A', 'A.B.CC.B.A', 'A.B.CC.B.A', 'A..B..B..A', '.A..BB..A.', '..A....A..', '...AAAA...'],
  drop: ['....AB....', '....AB....', '...AAAB...', '..ACAAAB..', '.ACAAAAAB.', '.AAAAAAAB.', '.AAAAAAAB.', '..AAAAAB..', '...BBBB...', '..........'],
  hourglass: ['BBBBBBBBBB', '.BAAAAAAB.', '..BAAAAB..', '...BAAB...', '....BB....', '....BB....', '...B.AB...', '..B.AAAB..', '.BAAAAAAB.', 'BBBBBBBBBB'],
  chest: ['..........', '.BBBBBBBB.', 'BAAAAAAAAB', 'BAAAAAAAAB', 'BCCCC0CCCB', 'BBBBC0BBBB', 'BAAAAAAAAB', 'BAAAAAAAAB', 'BAAAAAAAAB', '.BBBBBBBB.'],
  door: ['..BBBBBB..', '.BAAAAAAB.', 'BAABAABAAB', 'BAABAABAAB', 'BAABAABAAB', 'BAABAAB1AB', 'BAABAABAAB', 'BAABAABAAB', 'BAABAABAAB', 'BBBBBBBBBB'],
  gem: ['..........', '..BBBBBB..', '.BCCAAAAB.', 'BCAAAAAAAB', 'BBBBBBBBBB', '.BAAAAAAB.', '..BAAAAB..', '...BAAB...', '....BB....', '..........'],
  swirl: ['..AAAAA...', '.A.....A..', 'A..BBB..A.', 'A.B...B.A.', 'A.B.C.B.A.', 'A.B..CB.A.', 'A..BBB..A.', '.A.....A..', '..AAAAAAA.', '..........'],
  sword: ['........AC', '.......ACA', '......ACA.', '.....ACA..', '....ACA...', '.B.ACA....', '..BBA.....', '..BB......', '.B..B.....', 'B.........'],
  dots: ['..........', '.AA....AA.', '.AC....AC.', '..........', '....AA....', '....AC....', '..........', '.AA....AA.', '.AC....AC.', '..........'],
  plus: ['...AAAA...', '...ACCA...', '...ACAA...', 'AAAAAAAAAA', 'ACCAAAAAAB', 'AAAAAAAAAB', 'BBBAAAABBB', '...AAAB...', '...AAAB...', '...BBBB...'],
  moon: ['...AAAA...', '..AACC....', '.AAC......', 'AAC.......', 'AAC.......', 'AAA.......', 'AAAA......', '.AAAA...B.', '..AAAAAB..', '...AAAA...'],
  flame: ['....A.....', '...AA.....', '...AAA..A.', '..AACA.AA.', '..ACCAAAA.', '.ACCCCAAA.', '.ACC11CAA.', '.AC111CCA.', '..AC11CA..', '...AAAA...'],
  bigdot: ['..........', '..BBBBBB..', '.BAAAAAAB.', '.BACCAAAB.', '.BACAAAAB.', '.BAAAAAAB.', '.BAAAAAAB.', '.BAAAAAAB.', '..BBBBBB..', '..........'],
  twin: ['..........', '.AA....BB.', 'ACCA..BAAB', 'ACAA..BAAB', '.AA....BB.', '..........', '..A....B..', '.AAA..BBB.', 'AAAAABBBBB', '..........'],
  cross: ['A........A', '.A......A.', '..A....A..', '...ACCA...', '....CC....', '....CC....', '...ACCA...', '..A....A..', '.A......A.', 'A........A'],
  wave: ['..........', '..........', '.AA....AA.', 'A..A..A..A', '....AA....', '..........', '.BB....BB.', 'B..B..B..B', '....BB....', '..........'],
};

/** Définit une icône de règle à partir d'une forme et de 3 lettres de palette. Retourne l'id. */
export function icon(id: string, shape: keyof typeof SHAPES, a: string, b: string, c = '1'): string {
  const sub: Record<string, string> = { A: a, B: b, C: c };
  const px = SHAPES[shape].map((row) => row.replace(/[ABC]/g, (ch) => sub[ch]));
  return defineSprite(id, px);
}
export const ICON_SHAPES = Object.keys(SHAPES);

/** Puissance bornée (les règles méta peuvent la pousser jusqu'à 8). */
export function pw(self: ModInst, max = 3): number {
  const p = self.power;
  return Number.isFinite(p) ? Math.min(max, Math.max(0.25, p)) : 1;
}
export const inRun = (ctx: Ctx) => ctx.world.mode === 'run';
export const alivePlayers = (ctx: Ctx): Player[] => ctx.players.filter((p) => !p.downed && !p.dead);
export const roomMid = (r: Room) => ({ x: (r.x + r.w / 2) * 16, y: (r.y + r.h / 2) * 16 });
export const isCombatRoom = (r: Room | null) => !!r && (r.type === 'combat' || r.type === 'guardian' || r.type === 'boss');
export const clampN = (v: number, a: number, b: number) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a);

/** Copie « assainie » d'un tir du joueur pour un tireur ennemi : dégâts 1, vitesse raisonnable, aucun callback ni effet. */
export function sanitizeCopy(src: BulletSpec): BulletSpec {
  const r = clampN(src.radius ?? 3, 2.5, 4.5);
  const spec: BulletSpec = {
    kind: 'shot',
    damage: 1,
    speed: clampN((src.speed ?? 200) * 0.5, 70, 115),
    life: clampN(src.life ?? 1.4, 0.8, 2.2),
    radius: r,
    sprite: r > 3.4 ? 'eb_round' : 'eb_small',
  };
  if (src.wave && Number.isFinite(src.wave.amp) && Number.isFinite(src.wave.freq)) spec.wave = { amp: clampN(src.wave.amp, 0, 20), freq: clampN(src.wave.freq, 0, 12) };
  return spec;
}

/** Marque privée sur une balle (sans toucher b.data, potentiellement partagé avec la spec de l'arme). */
export function tag(b: Bullet): Record<string, number> {
  const B = b as any;
  return (B.__edict ??= {});
}
