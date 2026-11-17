import { PARCH, PARCH_BURN, PARCH_DARK, PARCH_LIGHT, PARCH_MID } from "./palette";

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseCanvas(size: number, cells: number, rnd: () => number) {
  const small = document.createElement("canvas");
  small.width = small.height = cells;
  const sx = small.getContext("2d")!;
  const img = sx.createImageData(cells, cells);
  for (let i = 0; i < cells * cells; i++) {
    const v = Math.floor(rnd() * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  sx.putImageData(img, 0, 0);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const cx = c.getContext("2d")!;
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = "high";
  cx.drawImage(small, 0, 0, size, size);
  return c;
}

const cache = new Map<string, HTMLCanvasElement>();

/**
 * A blank sheet of aged parchment: base tone, multi-octave mottling,
 * fibres, tea stains, darkened edges and fold creases.
 */
export function makeParchment(w: number, h: number, cols: number, rows: number[], seed = 7, back = false): HTMLCanvasElement {
  const key = `${w}x${h}:${cols}:${rows.join(",")}:${seed}:${back}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rnd = mulberry(seed);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, back ? PARCH_MID : PARCH_LIGHT);
  g.addColorStop(0.5, back ? PARCH_MID : PARCH);
  g.addColorStop(1, back ? PARCH_DARK : PARCH_MID);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // mottling
  ctx.globalCompositeOperation = "multiply";
  const octaves: [number, number][] = [
    [6, 0.13],
    [18, 0.1],
    [64, 0.07],
    [220, 0.06],
  ];
  for (const [cells, a] of octaves) {
    const n = noiseCanvas(512, cells, rnd);
    ctx.globalAlpha = a;
    ctx.drawImage(n, 0, 0, w, h);
  }
  ctx.globalAlpha = 1;
  // fine grain
  const grain = noiseCanvas(256, 256, rnd);
  const pat = ctx.createPattern(grain, "repeat")!;
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  // tea stains & foxing
  for (let i = 0; i < 16; i++) {
    const x = rnd() * w, y = rnd() * h, r = (0.02 + rnd() * 0.12) * w;
    const sg = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    const a = 0.02 + rnd() * 0.05;
    sg.addColorStop(0, `rgba(160,110,50,${a * 0.4})`);
    sg.addColorStop(0.82, `rgba(150,100,45,${a})`);
    sg.addColorStop(1, "rgba(150,100,45,0)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 160; i++) {
    const x = rnd() * w, y = rnd() * h, r = 1 + rnd() * 5;
    ctx.fillStyle = `rgba(120,75,30,${0.08 + rnd() * 0.2})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // fibres
  ctx.lineCap = "round";
  for (let i = 0; i < 900; i++) {
    const x = rnd() * w, y = rnd() * h, l = 6 + rnd() * 30, a = rnd() * Math.PI;
    ctx.strokeStyle = `rgba(110,70,30,${0.03 + rnd() * 0.06})`;
    ctx.lineWidth = 0.6 + rnd();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rnd() * 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }

  // folds: darken a soft band on either side of every crease
  const crease = (x0: number, y0: number, x1: number, y1: number) => {
    const vertical = x0 === x1;
    const bw = w * 0.012;
    const lg = vertical ? ctx.createLinearGradient(x0 - bw, 0, x0 + bw, 0) : ctx.createLinearGradient(0, y0 - bw, 0, y0 + bw);
    lg.addColorStop(0, "rgba(120,80,35,0)");
    lg.addColorStop(0.46, "rgba(120,80,35,0.16)");
    lg.addColorStop(0.5, "rgba(90,55,20,0.32)");
    lg.addColorStop(0.54, "rgba(255,245,215,0.10)");
    lg.addColorStop(1, "rgba(120,80,35,0)");
    ctx.fillStyle = lg;
    if (vertical) ctx.fillRect(x0 - bw, y0, bw * 2, y1 - y0);
    else ctx.fillRect(x0, y0 - bw, x1 - x0, bw * 2);
  };
  for (let i = 1; i < cols; i++) crease((w * i) / cols, 0, (w * i) / cols, h);
  for (const r of rows) crease(0, h * r, w, h * r);

  // panel-wise shading so each panel looks slightly differently lit
  for (let i = 0; i < cols; i++) {
    const x0 = (w * i) / cols, x1 = (w * (i + 1)) / cols;
    const pg = ctx.createLinearGradient(x0, 0, x1, 0);
    const dir = i % 2 === 0;
    pg.addColorStop(0, `rgba(90,60,25,${dir ? 0.07 : 0})`);
    pg.addColorStop(1, `rgba(90,60,25,${dir ? 0 : 0.07})`);
    ctx.fillStyle = pg;
    ctx.fillRect(x0, 0, x1 - x0, h);
  }

  // edge burn / vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(0.75, "rgba(130,85,35,0.18)");
  vg.addColorStop(1, "rgba(90,55,20,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  const edge = Math.min(w, h) * 0.018;
  ctx.globalCompositeOperation = "multiply";
  for (const [x, y, ww, hh, gx0, gy0, gx1, gy1] of [
    [0, 0, edge, h, 0, 0, edge, 0],
    [w - edge, 0, edge, h, w, 0, w - edge, 0],
    [0, 0, w, edge, 0, 0, 0, edge],
    [0, h - edge, w, edge, 0, h, 0, h - edge],
  ] as number[][]) {
    const eg = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    eg.addColorStop(0, PARCH_BURN);
    eg.addColorStop(1, "rgba(255,255,255,1)");
    ctx.fillStyle = eg;
    ctx.fillRect(x, y, ww, hh);
  }
  ctx.globalCompositeOperation = "source-over";
  cache.set(key, c);
  return c;
}
