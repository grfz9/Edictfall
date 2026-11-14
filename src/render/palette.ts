// Palette partagée par tous les sprites ASCII. Un caractère = une couleur.
// '.' et ' ' = transparent. Un sprite peut surcharger/ajouter des lettres via `pal`.
export const PAL: Record<string, string> = {
  '0': '#1b1326', // quasi-noir violet (contours)
  '1': '#ffffff',
  '2': '#c8d0e0', // gris clair
  '3': '#8a93a8', // gris
  '4': '#555c70', // gris foncé
  '5': '#2e3244', // ardoise sombre
  k: '#000000',
  w: '#f4f0e0', // blanc cassé
  r: '#e0404a', R: '#9c2038', // rouge
  o: '#f08030', O: '#b04a18', // orange
  y: '#ffd23a', Y: '#c8901c', // jaune / or
  g: '#58d858', G: '#2c8a44', // vert
  l: '#a8f070', // citron vert
  f: '#3a7a3a', F: '#1e4a2a', // vert forêt
  t: '#30c0b0', T: '#1a7880', // turquoise
  b: '#48a8ff', B: '#2858c8', // bleu
  c: '#9ae8ff', C: '#58c0e8', // cyan
  i: '#d8f0ff', I: '#88b8e0', // glace
  p: '#c070ff', P: '#7038b8', // violet
  m: '#ff70b8', M: '#b83878', // rose
  n: '#b98a52', N: '#7a5030', d: '#4a3020', // bruns
  s: '#ffd8b0', S: '#e0a078', // peau
  a: '#a0a8c0', A: '#687088', // acier
  v: '#ff9a30', V: '#d83a20', // lave
  e: '#ff5566', E: '#c02848', // rouge "danger" (balles ennemies)
};
export const OUTLINE = '#1b1326';
