import type { Char, Print, PrintKind } from "./sim";
import { FONTS, INK, INK_SOFT } from "./palette";

const SIZE: Record<PrintKind, number> = {
  shoe: 11, boot: 15, heel: 10, small: 7, paw: 6, dog: 9, wolf: 12, rat: 4.5, wisp: 9, drip: 6, bare: 9, hoof: 10,
};

/** Draw a footprint at the current transform's origin, pointing along +x. */
function shape(ctx: CanvasRenderingContext2D, kind: PrintKind, L: number) {
  ctx.beginPath();
  switch (kind) {
    case "paw":
    case "dog":
    case "wolf":
    case "rat": {
      const pad = L * 0.32;
      ctx.ellipse(0, 0, pad, pad * 1.1, 0, 0, Math.PI * 2);
      const toes = kind === "rat" ? 5 : 4;
      for (let i = 0; i < toes; i++) {
        const a = -0.9 + (1.8 * i) / (toes - 1);
        const tx = Math.cos(a) * L * 0.62, ty = Math.sin(a) * L * 0.55;
        ctx.moveTo(tx + L * 0.14, ty);
        ctx.ellipse(tx, ty, L * 0.14, L * 0.12, a, 0, Math.PI * 2);
        if (kind === "wolf" || kind === "dog") {
          ctx.moveTo(tx + L * 0.22, ty);
          ctx.lineTo(tx + L * 0.36, ty + Math.sin(a) * L * 0.08);
        }
      }
      break;
    }
    case "hoof": {
      ctx.ellipse(L * 0.1, -L * 0.14, L * 0.3, L * 0.12, -0.15, 0, Math.PI * 2);
      ctx.moveTo(L * 0.4, L * 0.14);
      ctx.ellipse(L * 0.1, L * 0.14, L * 0.3, L * 0.12, 0.15, 0, Math.PI * 2);
      break;
    }
    case "heel": {
      ctx.ellipse(L * 0.22, 0, L * 0.3, L * 0.2, 0, 0, Math.PI * 2);
      ctx.moveTo(-L * 0.3 + L * 0.09, 0);
      ctx.ellipse(-L * 0.3, 0, L * 0.09, L * 0.09, 0, 0, Math.PI * 2);
      break;
    }
    case "bare": {
      ctx.ellipse(L * 0.05, 0, L * 0.4, L * 0.17, 0, 0, Math.PI * 2);
      for (let i = 0; i < 5; i++) {
        const y = -L * 0.16 + i * L * 0.08;
        ctx.moveTo(L * 0.52 + L * 0.05, y);
        ctx.arc(L * 0.52, y, L * 0.045, 0, Math.PI * 2);
      }
      break;
    }
    case "wisp": {
      ctx.moveTo(-L * 0.4, 0);
      ctx.bezierCurveTo(-L * 0.1, -L * 0.5, L * 0.2, L * 0.5, L * 0.5, 0);
      break;
    }
    case "drip": {
      ctx.moveTo(L * 0.4, 0);
      ctx.bezierCurveTo(L * 0.1, -L * 0.3, -L * 0.3, -L * 0.25, -L * 0.3, 0);
      ctx.bezierCurveTo(-L * 0.3, L * 0.25, L * 0.1, L * 0.3, L * 0.4, 0);
      break;
    }
    default: {
      // shoe / boot / small: sole with a separate heel
      const wSole = kind === "boot" ? 0.24 : 0.2;
      ctx.ellipse(L * 0.18, 0, L * 0.34, L * wSole, 0, 0, Math.PI * 2);
      ctx.moveTo(-L * 0.3 + L * 0.16, 0);
      ctx.ellipse(-L * 0.3, 0, L * 0.16, L * (wSole - 0.03), 0, 0, Math.PI * 2);
    }
  }
}

export function drawPrints(
  ctx: CanvasRenderingContext2D, prints: Print[], now: number, k: number, boost: number, highlight: string | null,
) {
  ctx.save();
  for (const p of prints) {
    const age = now - p.t;
    if (age < 0) continue;
    const life = p.kind === "wisp" ? 5 : 11;
    let a = 1 - age / life;
    if (a <= 0) continue;
    a = Math.pow(a, 1.4);
    if (highlight && p.who !== highlight) a *= 0.35;
    const L = SIZE[p.kind] * boost;
    const side = p.kind === "wisp" || p.kind === "drip" ? 0 : (p.foot ? 1 : -1) * L * 0.32;
    const x = p.x * k - Math.sin(p.a) * side;
    const y = p.y * k + Math.cos(p.a) * side;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.a + (p.foot ? 0.08 : -0.08));
    if (p.foot && p.kind !== "wisp") ctx.scale(1, -1);
    ctx.globalAlpha = a * 0.92;
    shape(ctx, p.kind, L);
    if (p.kind === "wisp") {
      ctx.strokeStyle = INK_SOFT;
      ctx.lineWidth = L * 0.12;
      ctx.stroke();
    } else {
      ctx.fillStyle = INK;
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** The little inked flag with a name on it, drawn just ahead of the newest print. */
export function drawNameFlag(
  ctx: CanvasRenderingContext2D, c: Char, k: number, ui: number, alpha: number, emphasised: boolean,
) {
  const x = c.x * k, y = c.y * k;
  const fs = 11.5 * ui * (emphasised ? 1.25 : 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${fs}px ${FONTS.sc}`;
  const text = c.name;
  const tw = ctx.measureText(text).width;
  const padX = fs * 0.55, h = fs * 1.45;
  const bx = x + fs * 0.9, by = y - fs * 2.1;
  // staff
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1 * ui;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(bx, by + h);
  ctx.stroke();
  // a little unfurled scroll: body plus curled ends
  const w = tw + padX * 2;
  ctx.fillStyle = "rgba(240,226,188,0.94)";
  ctx.lineWidth = (emphasised ? 1.6 : 1.1) * ui;
  ctx.beginPath();
  ctx.moveTo(bx, by + h * 0.12);
  ctx.quadraticCurveTo(bx + w / 2, by - h * 0.18, bx + w, by + h * 0.12);
  ctx.lineTo(bx + w, by + h * 0.92);
  ctx.quadraticCurveTo(bx + w / 2, by + h * 0.62, bx, by + h * 0.92);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const [ex, dir] of [[bx, -1], [bx + w, 1]] as [number, number][]) {
    ctx.beginPath();
    ctx.ellipse(ex + dir * h * 0.16, by + h * 0.52, h * 0.2, h * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex + dir * h * 0.16, by + h * 0.52, h * 0.08, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, bx + padX, by + h * 0.5);
  // the dot
  ctx.beginPath();
  ctx.arc(x, y, 2.2 * ui, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return { x: bx, y: by, w, h };
}
