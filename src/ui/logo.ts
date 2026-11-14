// Logo « EDICTFALL » dessiné en pixel art (police 5×7 maison, dégradé or, contour et ombre portée).
const GLYPHS: Record<string, string[]> = {
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  D: ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
  I: ['111', '010', '010', '010', '010', '010', '111'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
};
const CROWN = ['1.1.1', '11111', '12121', '11111'];
const ROWS = ['#fff6c0', '#ffe680', '#ffd23a', '#ffc02a', '#f0a020', '#d07818', '#b04a18'];

export function drawLogo(text = 'EDICTFALL'): HTMLCanvasElement {
  const top = 5, pad = 2;
  const widths = [...text].map((ch) => GLYPHS[ch]?.[0].length ?? 3);
  const W = widths.reduce((a, b) => a + b + 1, 0) - 1 + pad * 2;
  const H = top + 7 + 3 + pad;
  const S = 1;
  const c = document.createElement('canvas');
  c.width = W * S; c.height = H * S;
  c.className = 'logo-cv';
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', 'Edictfall');
  const g = c.getContext('2d')!;
  // carte des pixels : 1 = lettre, 2 = joyau de la couronne
  const grid: (string | null)[][] = Array.from({ length: H }, () => Array(W).fill(null));
  let x = pad;
  [...text].forEach((ch, i) => {
    const gl = GLYPHS[ch];
    if (gl) gl.forEach((row, yy) => [...row].forEach((v, xx) => { if (v === '1') grid[top + yy][x + xx] = ROWS[yy]; }));
    // couronne au-dessus du I
    if (ch === 'I') CROWN.forEach((row, yy) => [...row].forEach((v, xx) => {
      if (v !== '.') grid[top - 5 + yy][x - 1 + xx] = v === '2' ? '#ff5577' : '#ffd23a';
    }));
    x += widths[i] + 1;
  });
  const solid = (xx: number, yy: number) => yy >= 0 && yy < H && xx >= 0 && xx < W && grid[yy][xx] !== null;
  const px = (xx: number, yy: number, col: string) => { g.fillStyle = col; g.fillRect(xx * S, yy * S, S, S); };
  // ombre portée (2 px vers le bas)
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    if (solid(xx, yy - 2) && !solid(xx, yy)) px(xx, yy, '#1b1326');
    else if (solid(xx, yy - 1) && !solid(xx, yy)) px(xx, yy, '#6a2a10');
  }
  // contour
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    if (solid(xx, yy)) continue;
    if (solid(xx - 1, yy) || solid(xx + 1, yy) || solid(xx, yy - 1) || (solid(xx, yy + 1) && !solid(xx, yy - 1))) px(xx, yy, '#1b1326');
  }
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (grid[yy][xx]) px(xx, yy, grid[yy][xx]!);
  // reflets
  g.fillStyle = 'rgba(255,255,255,.9)';
  x = pad;
  [...text].forEach((ch, i) => { if (GLYPHS[ch] && i % 3 === 0) g.fillRect(x * S, top * S, S, S); x += widths[i] + 1; });
  return c;
}
