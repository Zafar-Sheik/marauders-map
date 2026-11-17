import type { Hotspot, Pt, Section, Space } from "./types";
import { FONTS, INK, INK_FADED, INK_SOFT, INK_WASH, WATER_INK } from "./palette";
import { makeParchment, mulberry } from "./parchment";
import { pxPerMetre, sheetPixels, FLAP_H, SHEET_H } from "./sheet";

export const FOLD_ROWS = [FLAP_H / SHEET_H, 1 - FLAP_H / SHEET_H];

export function blankFor(sec: Section, back = false) {
  const { w, h } = sheetPixels(sec);
  return makeParchment(w, h, sec.cols, FOLD_ROWS, back ? 99 : 7, back);
}

export interface RenderOpts {
  flags: Set<string>;
  /** sheet-pixel → target-pixel transform */
  m?: DOMMatrix;
  width: number;
  height: number;
  highlight?: string | null;
}

/** Draw a whole section (parchment + ink) into ctx. */
export function renderSection(ctx: CanvasRenderingContext2D, sec: Section, o: RenderOpts) {
  const m = o.m ?? new DOMMatrix();
  ctx.save();
  ctx.setTransform(m);
  ctx.drawImage(blankFor(sec), 0, 0);
  ctx.restore();

  const ink = document.createElement("canvas");
  ink.width = o.width;
  ink.height = o.height;
  const ic = ink.getContext("2d")!;
  drawInk(ic, sec, o, m);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(ink, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

/** Ink only, onto a transparent canvas (used by the 3D sheet & the 2D view). */
export function drawInk(ctx: CanvasRenderingContext2D, sec: Section, o: RenderOpts, m: DOMMatrix) {
  const k = pxPerMetre(sec);
  const P = (px: number) => (px * 1.9) / k; // sheet pixels (thickened for legibility) → metres
  const world = m.multiply(new DOMMatrix().scale(k, k));
  const rnd = mulberry(sec.id.length * 977 + 13);
  const vis = (s: { requires?: string }) => !s.requires || o.flags.has(s.requires);

  ctx.save();
  ctx.setTransform(world);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  /* ---------------- frame decoration (sheet px space) ---------------- */
  ctx.save();
  ctx.setTransform(m);
  drawBorder(ctx, sheetPixels(sec).w, sheetPixels(sec).h, rnd);
  ctx.restore();

  if (sec.openGround) drawGrounds(ctx, sec, P, rnd, o);
  else drawInterior(ctx, sec, P, rnd, o, vis, m, k);

  /* ---------------- passages (dashed secret tunnels) ---------------- */
  for (const ps of sec.passages) {
    if (!vis(ps)) continue;
    const glow = o.flags.has("dissendium") || o.flags.has("willow") || o.flags.has("passages-open");
    ctx.save();
    ctx.strokeStyle = glow ? INK : INK_FADED;
    ctx.lineWidth = P(glow ? 3.2 : 2.2);
    ctx.setLineDash([P(10), P(9)]);
    ctx.beginPath();
    smoothPath(ctx, ps.pts);
    ctx.stroke();
    ctx.setLineDash([]);
    if (ps.caved) {
      const e = ps.pts[ps.pts.length - 1];
      cross(ctx, e[0], e[1], P(14), P(3));
    }
    if (ps.note) {
      const mid = ps.pts[Math.floor(ps.pts.length / 2)];
      const nxt = ps.pts[Math.floor(ps.pts.length / 2) + 1] ?? mid;
      const a = Math.atan2(nxt[1] - mid[1], nxt[0] - mid[0]);
      ctx.translate(mid[0], mid[1]);
      ctx.rotate(Math.abs(a) > Math.PI / 2 ? a + Math.PI : a);
      ctx.font = `italic ${P(26)}px ${FONTS.italic}`;
      ctx.fillStyle = INK_SOFT;
      ctx.textAlign = "center";
      ctx.fillText(ps.note, 0, -P(10));
    }
    ctx.restore();
  }

  /* ---------------- portals ---------------- */
  for (const p of sec.portals) {
    if (p.secret && !(o.flags.has("dissendium") || o.flags.has("willow") || o.flags.has("passages-open"))) continue;
    drawPortal(ctx, p.x, p.y, p.kind, p.hint ?? "", P, sec);
  }

  /* ---------------- hotspot glyphs ---------------- */
  for (const h of sec.hotspots) if (!h.hidden) drawGlyph(ctx, h, P);

  /* ---------------- free texts ---------------- */
  for (const t of sec.texts) {
    if (!vis(t)) continue;
    ctx.save();
    ctx.translate(t.x, t.y);
    if (t.rot) ctx.rotate(t.rot);
    ctx.font = `${t.italic ? "italic " : ""}${t.size ?? 2}px ${t.italic ? FONTS.italic : FONTS.sc}`;
    ctx.fillStyle = INK_SOFT;
    ctx.textAlign = t.align ?? "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }

  /* ---------------- cartouche, compass, scale ---------------- */
  ctx.save();
  ctx.setTransform(m);
  drawFurniture(ctx, sec, k, rnd);
  ctx.restore();
  ctx.restore();
}

/* ================================================================== */

function drawInterior(
  ctx: CanvasRenderingContext2D, sec: Section, P: (n: number) => number, rnd: () => number, o: RenderOpts,
  vis: (s: { requires?: string }) => boolean, m: DOMMatrix, k: number,
) {
  // ghostly castle outline: the floor's footprint
  if (sec.outline) {
    ctx.save();
    ctx.strokeStyle = INK_FADED;
    ctx.lineWidth = P(2);
    ctx.setLineDash([P(3), P(6)]);
    ctx.beginPath();
    sec.outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    // crenellations
    ctx.fillStyle = INK_FADED;
    for (let i = 0; i < sec.outline.length; i++) {
      const a = sec.outline[i], b = sec.outline[(i + 1) % sec.outline.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 3; t < L - 2; t += 6) {
        const x = a[0] + ((b[0] - a[0]) * t) / L, y = a[1] + ((b[1] - a[1]) * t) / L;
        ctx.fillRect(x - P(3), y - P(3), P(6), P(6));
      }
    }
    for (const t of sec.towers ?? []) {
      ctx.strokeStyle = INK_FADED;
      ctx.lineWidth = P(2.2);
      ctx.beginPath();
      ctx.arc(t.cx, t.cy, t.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(t.cx, t.cy, t.r - P(9), 0, Math.PI * 2);
      ctx.stroke();
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        ctx.beginPath();
        ctx.moveTo(t.cx + Math.cos(a) * (t.r - P(9)), t.cy + Math.sin(a) * (t.r - P(9)));
        ctx.lineTo(t.cx + Math.cos(a) * t.r, t.cy + Math.sin(a) * t.r);
        ctx.stroke();
      }
      if (t.name) {
        ctx.font = `italic ${P(22)}px ${FONTS.italic}`;
        ctx.fillStyle = INK_FADED;
        ctx.textAlign = "center";
        ctx.fillText(t.name, t.cx, t.cy + P(8));
      }
    }
    ctx.restore();
  }

  const spaces = sec.spaces.filter((s) => vis(s));
  // washes
  for (const s of spaces) {
    if (s.kind !== "void" || !s.rect) continue;
    const r = s.rect;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.strokeStyle = "rgba(70,42,18,0.22)";
    ctx.lineWidth = P(1);
    ctx.beginPath();
    for (let d = -r.h; d < r.w; d += 2.2) { ctx.moveTo(r.x + d, r.y + r.h); ctx.lineTo(r.x + d + r.h, r.y); }
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = INK_FADED;
    ctx.lineWidth = P(1.2);
    ctx.setLineDash([P(4), P(4)]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  for (const s of spaces) {
    if (s.kind === "corridor" || s.kind === "void") continue;
    ctx.fillStyle = s.kind === "hidden" ? "rgba(92,58,26,0.04)" : s.kind === "open" ? "rgba(92,58,26,0.03)" : INK_WASH;
    shapePath(ctx, s);
    ctx.fill();
  }
  // corridor floor patterns: faint flagstones
  ctx.save();
  ctx.strokeStyle = "rgba(70,42,18,0.16)";
  ctx.lineWidth = P(1.2);
  for (const s of spaces) {
    if (s.kind !== "corridor" || !s.rect) continue;
    const r = s.rect;
    const step = 4;
    ctx.beginPath();
    if (r.w > r.h) {
      for (let x = r.x + step; x < r.x + r.w; x += step) { ctx.moveTo(x, r.y + 1); ctx.lineTo(x, r.y + r.h - 1); }
      ctx.moveTo(r.x + 1, r.y + r.h / 2); ctx.lineTo(r.x + r.w - 1, r.y + r.h / 2);
    } else {
      for (let y = r.y + step; y < r.y + r.h; y += step) { ctx.moveTo(r.x + 1, y); ctx.lineTo(r.x + r.w - 1, y); }
      ctx.moveTo(r.x + r.w / 2, r.y + 1); ctx.lineTo(r.x + r.w / 2, r.y + r.h - 1);
    }
    ctx.stroke();
  }
  ctx.restore();

  // walls: hatched band with two hairlines
  const band = P(7);
  const hatch = makeHatch(ctx, P);
  for (const s of spaces) {
    if (s.kind === "void") continue;
    const hidden = s.kind === "hidden";
    ctx.save();
    if (hidden) ctx.setLineDash([P(6), P(6)]);
    ctx.lineWidth = band;
    ctx.strokeStyle = hidden ? "rgba(56,34,15,0.0)" : hatch;
    shapePath(ctx, s);
    ctx.stroke();
    ctx.lineWidth = P(1.6);
    ctx.strokeStyle = hidden ? INK_FADED : INK;
    shapePath(ctx, s, band / 2);
    ctx.stroke();
    shapePath(ctx, s, -band / 2);
    ctx.stroke();
    ctx.restore();
  }
  // cut junctions: clear the interior of walkable spaces of stray wall lines
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  for (const s of spaces) {
    if (s.kind === "hidden" || s.kind === "void") continue;
    shapePath(ctx, s, -band / 2 - P(1.4));
    ctx.fill();
  }
  // doors
  for (const s of spaces)
    for (const d of s.doors ?? []) {
      ctx.beginPath();
      ctx.arc(d[0], d[1], 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.restore();

  // re-wash corridors faintly after the cut so they read as floor
  for (const s of spaces) {
    if (s.kind !== "corridor" || !s.rect) continue;
    ctx.fillStyle = "rgba(92,58,26,0.035)";
    ctx.fillRect(s.rect.x, s.rect.y, s.rect.w, s.rect.h);
  }

  // door jambs
  ctx.strokeStyle = INK;
  ctx.lineWidth = P(1.6);
  for (const s of spaces)
    for (const d of s.doors ?? []) {
      const horiz = s.rect ? Math.abs(d[1] - s.rect.y) < 0.6 || Math.abs(d[1] - (s.rect.y + s.rect.h)) < 0.6 : true;
      ctx.beginPath();
      if (horiz) {
        ctx.moveTo(d[0] - 1.25, d[1] - band / 2); ctx.lineTo(d[0] - 1.25, d[1] + band / 2);
        ctx.moveTo(d[0] + 1.25, d[1] - band / 2); ctx.lineTo(d[0] + 1.25, d[1] + band / 2);
      } else {
        ctx.moveTo(d[0] - band / 2, d[1] - 1.25); ctx.lineTo(d[0] + band / 2, d[1] - 1.25);
        ctx.moveTo(d[0] - band / 2, d[1] + 1.25); ctx.lineTo(d[0] + band / 2, d[1] + 1.25);
      }
      ctx.stroke();
    }

  // decor & labels
  for (const s of spaces) drawDecor(ctx, s, P, rnd);
  for (const s of spaces) drawLabel(ctx, s, P, s.id === o.highlight);
  void m; void k;
}

function drawGrounds(ctx: CanvasRenderingContext2D, sec: Section, P: (n: number) => number, rnd: () => number, o: RenderOpts) {
  const W = sec.frame.w, H = sec.frame.h;
  // hills: contour lines
  ctx.save();
  ctx.strokeStyle = "rgba(70,42,18,0.18)";
  ctx.lineWidth = P(1.4);
  const hills: [number, number, number][] = [[1420, 300, 90], [1080, 420, 70], [620, 150, 60], [1250, 640, 80]];
  for (const [hx, hy, hr] of hills)
    for (let r = hr; r > 10; r -= 14) {
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.15) {
        const w = 1 + 0.12 * Math.sin(a * 3 + hx) + 0.08 * Math.sin(a * 5 + hy);
        const x = hx + Math.cos(a) * r * w * 1.4, y = hy + Math.sin(a) * r * w * 0.8;
        a ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  ctx.restore();

  // paths
  const paths: Pt[][] = [
    [[790, 228], [760, 200], [640, 220], [520, 250], [480, 252]],
    [[790, 228], [860, 200], [1000, 206], [1120, 190], [1190, 176]],
    [[988, 356], [1100, 370], [1270, 366], [1320, 410], [1360, 440], [1400, 520], [1420, 600], [1428, 712]],
    [[790, 488], [700, 490], [600, 470], [560, 360]],
    [[480, 252], [430, 300], [380, 330]],
  ];
  ctx.save();
  ctx.strokeStyle = INK_SOFT;
  ctx.lineWidth = P(1.6);
  for (const p of paths) {
    for (const off of [-3.5, 3.5]) {
      ctx.beginPath();
      p.forEach(([x, y], i) => {
        const nx = p[Math.min(i + 1, p.length - 1)], px = p[Math.max(i - 1, 0)];
        const a = Math.atan2(nx[1] - px[1], nx[0] - px[0]) + Math.PI / 2;
        const X = x + Math.cos(a) * off, Y = y + Math.sin(a) * off;
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      });
      ctx.setLineDash([P(12), P(5)]);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.restore();

  for (const s of sec.spaces) {
    if (s.kind === "water") {
      // lake: engraved concentric ripples
      ctx.save();
      shapePath(ctx, s);
      ctx.clip();
      ctx.strokeStyle = WATER_INK;
      ctx.lineWidth = P(1.3);
      const [cx, cy] = [780, 636];
      for (let i = 0; i < 46; i++) {
        const f = 1 - i / 48;
        ctx.beginPath();
        s.poly!.forEach(([x, y], j) => {
          const X = cx + (x - cx) * f, Y = cy + (y - cy) * f + Math.sin(j * 0.7 + i) * 1.2;
          j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        });
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = P(3);
      shapePath(ctx, s);
      ctx.stroke();
    } else if (s.kind === "forest") {
      ctx.save();
      shapePath(ctx, s);
      ctx.clip();
      const r = mulberry(42);
      for (let i = 0; i < 1500; i++) {
        const x = r() * 760, y = r() * 740;
        if (!pip(x, y, s.poly!)) continue;
        tree(ctx, x, y, 7 + r() * 7, r, P);
      }
      ctx.restore();
      ctx.strokeStyle = INK_SOFT;
      ctx.lineWidth = P(2);
      ctx.setLineDash([P(4), P(6)]);
      shapePath(ctx, s);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (s.kind === "castle") {
      ctx.save();
      shapePath(ctx, s);
      ctx.fillStyle = "rgba(92,58,26,0.12)";
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = "rgba(56,34,15,0.35)";
      ctx.lineWidth = P(1.2);
      ctx.beginPath();
      for (let d = -600; d < 600; d += 5) { ctx.moveTo(600 + d, 230); ctx.lineTo(600 + d + 260, 490); }
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = P(5);
      shapePath(ctx, s);
      ctx.stroke();
      const tw: [number, number, number][] = [[620, 250, 14], [960, 250, 16], [980, 380, 13], [660, 470, 12], [600, 420, 10], [790, 236, 8], [860, 470, 9]];
      for (const [x, y, r] of tw) {
        ctx.fillStyle = "#e3cc9a";
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = P(4);
        ctx.stroke();
        ctx.lineWidth = P(1.6);
        ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.stroke();
      }
    } else {
      if (s.kind === "building") {
        ctx.fillStyle = "rgba(92,58,26,0.16)";
        shapePath(ctx, s);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = P(3);
        ctx.stroke();
      } else if (s.id === "willow") {
        willow(ctx, s.circle!.cx, s.circle!.cy, P);
      } else if (s.id !== "lawn" && s.id !== "shore" && s.id !== "hogsmeade") {
        ctx.strokeStyle = INK_SOFT;
        ctx.lineWidth = P(2);
        shapePath(ctx, s);
        ctx.stroke();
      }
      drawDecor(ctx, s, P, rnd);
    }
  }
  // village scatter of extra cottages
  const r2 = mulberry(5);
  ctx.strokeStyle = INK_SOFT;
  ctx.lineWidth = P(2);
  for (let i = 0; i < 16; i++) {
    const x = 1310 + r2() * 170, y = 590 + r2() * 110;
    ctx.strokeRect(x, y, 10 + r2() * 8, 8 + r2() * 6);
  }
  // rail line
  ctx.save();
  ctx.strokeStyle = INK_SOFT;
  ctx.lineWidth = P(1.6);
  ctx.beginPath(); ctx.moveTo(1300, 742); ctx.lineTo(W - 10, 742); ctx.stroke();
  for (let x = 1300; x < W - 10; x += 6) { ctx.beginPath(); ctx.moveTo(x, 738); ctx.lineTo(x, 746); ctx.stroke(); }
  ctx.restore();
  for (const s of sec.spaces) drawLabel(ctx, s, P, s.id === o.highlight);
  void H;
}

/* ================================================================== */
/* primitives                                                          */

export function shapePath(ctx: CanvasRenderingContext2D, s: Space, grow = 0) {
  ctx.beginPath();
  if (s.rect) {
    const r = s.rect;
    ctx.rect(r.x - grow, r.y - grow, r.w + grow * 2, r.h + grow * 2);
  } else if (s.circle) {
    ctx.arc(s.circle.cx, s.circle.cy, Math.max(0.1, s.circle.r + grow), 0, Math.PI * 2);
  } else if (s.poly) {
    s.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
}

function makeHatch(ctx: CanvasRenderingContext2D, P: (n: number) => number) {
  const c = document.createElement("canvas");
  c.width = c.height = 8;
  const x = c.getContext("2d")!;
  x.strokeStyle = "rgba(56,34,15,0.85)";
  x.lineWidth = 1.2;
  x.beginPath();
  x.moveTo(0, 8); x.lineTo(8, 0);
  x.moveTo(-2, 2); x.lineTo(2, -2);
  x.moveTo(6, 10); x.lineTo(10, 6);
  x.stroke();
  const pat = ctx.createPattern(c, "repeat")!;
  pat.setTransform(new DOMMatrix().scale(P(1)));
  return pat;
}

function smoothPath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2, yc = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(l[0], l[1]);
}

function cross(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, lw: number) {
  ctx.save();
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
  ctx.stroke();
  ctx.restore();
}

function pip(x: number, y: number, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function tree(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rnd: () => number, P: (n: number) => number) {
  ctx.strokeStyle = rnd() < 0.5 ? INK_SOFT : "rgba(56,34,15,0.75)";
  ctx.lineWidth = P(1.3);
  ctx.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.8 + rnd() * 0.35);
    const X = x + Math.cos(a) * rr, Y = y + Math.sin(a) * rr * 0.85;
    i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
  }
  ctx.stroke();
  // shade on the lower right
  ctx.beginPath();
  ctx.arc(x + r * 0.15, y + r * 0.1, r * 0.55, 0.2, 1.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.85); ctx.lineTo(x, y + r * 1.3);
  ctx.stroke();
}

function willow(ctx: CanvasRenderingContext2D, x: number, y: number, P: (n: number) => number) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = P(2.4);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6 - 4, x + Math.cos(a + 0.5) * 12, y + Math.sin(a + 0.5) * 12, x + Math.cos(a + 0.8) * 16, y + Math.sin(a + 0.8) * 16);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ================================================================== */

function drawDecor(ctx: CanvasRenderingContext2D, s: Space, P: (n: number) => number, rnd: () => number) {
  if (!s.decor) return;
  ctx.save();
  ctx.strokeStyle = INK_SOFT;
  ctx.fillStyle = INK_SOFT;
  ctx.lineWidth = P(1.4);
  const r = s.rect;
  const c = s.circle;
  switch (s.decor) {
    case "greathall": {
      if (!r) break;
      for (let i = 0; i < 4; i++) {
        const y = r.y + 7 + i * 5.2;
        ctx.strokeRect(r.x + 6, y, r.w - 18, 1.4);
        for (let x = r.x + 7; x < r.x + r.w - 13; x += 2.2) {
          ctx.beginPath(); ctx.moveTo(x, y - 0.6); ctx.lineTo(x, y - 0.2); ctx.moveTo(x, y + 1.6); ctx.lineTo(x, y + 2); ctx.stroke();
        }
      }
      ctx.strokeRect(r.x + r.w - 7, r.y + 4, 1.6, r.h - 8);
      // floating candles
      for (let i = 0; i < 60; i++) {
        ctx.beginPath(); ctx.arc(r.x + 4 + rnd() * (r.w - 12), r.y + 3 + rnd() * (r.h - 6), P(1.6), 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case "kitchen": {
      if (!r) break;
      for (let i = 0; i < 4; i++) ctx.strokeRect(r.x + 6, r.y + 7 + i * 5.4, r.w - 18, 1.6);
      ctx.beginPath(); ctx.arc(r.x + r.w - 5, r.y + r.h / 2, 3.5, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
      break;
    }
    case "library":
    case "restricted": {
      if (!r) break;
      const dense = s.decor === "restricted";
      for (let x = r.x + 4; x < r.x + r.w - 3; x += dense ? 4 : 6)
        for (let y = r.y + 6; y < r.y + r.h - 10; y += 6) {
          ctx.fillRect(x, y, 3.2, 0.8);
        }
      if (dense) {
        ctx.setLineDash([P(4), P(4)]);
        ctx.strokeRect(r.x + 1.6, r.y + 1.6, r.w - 3.2, r.h - 3.2);
        ctx.setLineDash([]);
      }
      break;
    }
    case "classroom": {
      if (!r) break;
      for (let x = r.x + 5; x < r.x + r.w - 6; x += 6)
        for (let y = r.y + 8; y < r.y + r.h - 8; y += 5) ctx.strokeRect(x, y, 3.6, 1.8);
      ctx.strokeRect(r.x + r.w / 2 - 4, r.y + 2.6, 8, 2);
      break;
    }
    case "potions": {
      if (!r) break;
      for (let x = r.x + 6; x < r.x + r.w - 4; x += 6)
        for (let y = r.y + 9; y < r.y + r.h - 5; y += 6) {
          ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.stroke();
        }
      break;
    }
    case "hospital": {
      if (!r) break;
      for (let y = r.y + 5; y < r.y + r.h - 5; y += 5) {
        ctx.strokeRect(r.x + 3, y, 5, 2.6);
        ctx.strokeRect(r.x + r.w - 8, y, 5, 2.6);
      }
      break;
    }
    case "trophies": {
      if (!r) break;
      for (let x = r.x + 4; x < r.x + r.w - 3; x += 5)
        for (let y = r.y + 10; y < r.y + r.h - 4; y += 9) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1.5, y + 2); ctx.lineTo(x + 3, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + 1.5, y + 2); ctx.lineTo(x + 1.5, y + 3.4); ctx.stroke();
        }
      break;
    }
    case "armour": {
      if (!r) break;
      for (let x = r.x + 4; x < r.x + r.w - 2; x += 5) {
        for (const y of [r.y + 3, r.y + r.h - 3]) {
          ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.stroke();
        }
      }
      break;
    }
    case "office": {
      if (r) {
        ctx.strokeRect(r.x + r.w / 2 - 4, r.y + r.h / 2 + 2.5, 8, 3);
        ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h / 2 + 7.4, 1.2, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
    case "bathroom": {
      if (!r) break;
      for (let x = r.x + 4; x < r.x + r.w - 3; x += 4.5) { ctx.beginPath(); ctx.arc(x, r.y + r.h - 3.4, 1.2, 0, Math.PI * 2); ctx.stroke(); }
      for (let x = r.x + 2; x < r.x + r.w - 2; x += 5) ctx.strokeRect(x, r.y + 2, 4, 5);
      break;
    }
    case "lakewindows": {
      if (!r) break;
      for (let x = r.x + 5; x < r.x + r.w - 3; x += 7) {
        ctx.beginPath(); ctx.moveTo(x, r.y + r.h - 0.6); ctx.lineTo(x, r.y + r.h - 3); ctx.arc(x + 1.6, r.y + r.h - 3, 1.6, Math.PI, 0); ctx.lineTo(x + 3.2, r.y + r.h - 0.6); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(r.x + r.w - 6, r.y + 6, 3.2, 0, Math.PI); ctx.stroke();
      break;
    }
    case "commonroom": {
      if (r) {
        ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h - 2.5, 3, Math.PI, 0); ctx.stroke();
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(r.x + 6 + i * 6, r.y + r.h - 9, 1.5, 0, Math.PI * 2); ctx.stroke(); }
      } else if (c) {
        ctx.beginPath(); ctx.arc(c.cx, c.cy + c.r - 3, 3, Math.PI, 0); ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI * 0.15 + (i / 6) * Math.PI * 0.7;
          ctx.beginPath(); ctx.arc(c.cx + Math.cos(a) * c.r * 0.62, c.cy + Math.sin(a) * c.r * 0.62, 1.6, 0, Math.PI * 2); ctx.stroke();
        }
      }
      break;
    }
    case "dorm": {
      if (!c) break;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.save();
        ctx.translate(c.cx + Math.cos(a) * c.r * 0.62, c.cy + Math.sin(a) * c.r * 0.62);
        ctx.rotate(a + Math.PI / 2);
        ctx.strokeRect(-1.3, -2.2, 2.6, 4.4);
        ctx.fillRect(-1.3, -2.2, 0.4, 0.4); ctx.fillRect(0.9, -2.2, 0.4, 0.4); ctx.fillRect(-1.3, 1.8, 0.4, 0.4); ctx.fillRect(0.9, 1.8, 0.4, 0.4);
        ctx.restore();
      }
      break;
    }
    case "divination": {
      if (!c) break;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, rr = c.r * (i % 2 ? 0.45 : 0.72);
        ctx.beginPath(); ctx.arc(c.cx + Math.cos(a) * rr, c.cy + Math.sin(a) * rr, 1.1, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
    case "telescope": {
      if (!c) break;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, x = c.cx + Math.cos(a) * c.r * 0.7, y = c.cy + Math.sin(a) * c.r * 0.7;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 0.6, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case "owlery": {
      if (!c) break;
      for (let rr = c.r * 0.45; rr < c.r - 1.5; rr += 2.4) { ctx.beginPath(); ctx.arc(c.cx, c.cy, rr, 0.2, Math.PI * 2 - 0.2); ctx.stroke(); }
      break;
    }
    case "headmaster": {
      if (!c) break;
      ctx.strokeRect(c.cx - 4, c.cy + 2, 8, 3);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(c.cx + Math.cos(a) * c.r * 0.78, c.cy + Math.sin(a) * c.r * 0.78, 0.7, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case "grandstair": {
      if (!r) break;
      // flights criss-crossing the shaft
      for (let i = 0; i < 3; i++) {
        const y0 = r.y + 6 + i * 11;
        const fl = i % 2 ? -1 : 1;
        ctx.save();
        ctx.translate(r.x + r.w / 2, y0 + 3);
        ctx.rotate(fl * 0.35);
        ctx.strokeRect(-10, -2, 20, 4);
        for (let x = -9; x < 10; x += 1.4) { ctx.beginPath(); ctx.moveTo(x, -2); ctx.lineTo(x, 2); ctx.stroke(); }
        ctx.restore();
      }
      break;
    }
    case "fountain": {
      if (!r) break;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2 - 3;
      for (const rr of [5, 3.6, 1.2]) { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); }
      for (let i = 0; i < 220; i++) { ctx.fillRect(r.x + 1 + rnd() * (r.w - 2), r.y + 1 + rnd() * (r.h - 2), P(2), P(2)); }
      break;
    }
    case "trapdoor": {
      if (!r) break;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2 + 2;
      ctx.strokeRect(cx - 3, cy - 3, 6, 6);
      ctx.beginPath(); ctx.moveTo(cx - 3, cy - 3); ctx.lineTo(cx + 3, cy + 3); ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(cx - 3, cy + 3); ctx.stroke();
      break;
    }
    case "pitch": {
      const [cx, cy] = [1200, 140];
      ctx.lineWidth = P(2);
      ctx.beginPath(); ctx.ellipse(cx, cy, 84, 34, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy, 76, 27, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 27); ctx.lineTo(cx, cy + 27); ctx.stroke();
      for (const side of [-1, 1])
        for (const dy of [-6, 0, 6]) { ctx.beginPath(); ctx.arc(cx + side * 66, cy + dy, 2, 0, Math.PI * 2); ctx.stroke(); }
      // stands
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 14) {
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 84, cy + Math.sin(a) * 34); ctx.lineTo(cx + Math.cos(a) * 92, cy + Math.sin(a) * 40); ctx.stroke();
      }
      break;
    }
    case "greenhouse": {
      if (!r) break;
      for (let x = r.x + 4; x < r.x + r.w; x += 4) { ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h / 2); ctx.lineTo(r.x + r.w, r.y + r.h / 2); ctx.stroke();
      break;
    }
    case "hut": {
      if (!c) break;
      ctx.fillRect(c.cx + 3, c.cy - 6, 3, 3);
      ctx.beginPath(); ctx.moveTo(c.cx - c.r, c.cy); ctx.lineTo(c.cx + c.r, c.cy); ctx.stroke();
      break;
    }
    case "pumpkins": {
      if (!r) break;
      for (let i = 0; i < 12; i++) {
        const x = r.x + 5 + (i % 4) * 11, y = r.y + 6 + Math.floor(i / 4) * 9, rr = 2.6 + rnd() * 2;
        ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - rr); ctx.lineTo(x, y + rr); ctx.stroke();
      }
      break;
    }
    case "barrels":
      break;
  }
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, s: Space, P: (n: number) => number, hi: boolean) {
  if (s.label === false) return;
  if (s.kind === "corridor" && !s.label) return;
  const l = s.label ?? {};
  let x = l.x, y = l.y;
  if (x === undefined || y === undefined) {
    if (s.rect) { x = x ?? s.rect.x + s.rect.w / 2; y = y ?? s.rect.y + s.rect.h / 2; }
    else if (s.circle) { x = x ?? s.circle.cx; y = y ?? s.circle.cy; }
    else { x = x ?? 0; y = y ?? 0; }
  }
  const size = (l.size ?? 2.6) * (s.kind === "water" || s.kind === "forest" || s.kind === "castle" || s.kind === "building" || s.kind === "field" ? 1 : 1.18);
  const lines = l.lines ?? [s.name.toUpperCase()];
  ctx.save();
  ctx.translate(x, y);
  if (l.rot) ctx.rotate(l.rot);
  ctx.font = `${size}px ${FONTS.sc}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = s.kind === "hidden" || s.kind === "void" ? INK_SOFT : INK;
  const lh = size * 1.08;
  lines.forEach((t, i) => {
    const yy = (i - (lines.length - 1) / 2) * lh;
    spaced(ctx, t, 0, yy, size * 0.08);
  });
  if (s.note) {
    ctx.font = `italic ${size * 0.62}px ${FONTS.italic}`;
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(s.note, 0, ((lines.length + 1) / 2) * lh + size * 0.1);
  }
  if (hi) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = P(1.5);
    const w = Math.max(...lines.map((t) => ctx.measureText(t).width)) * 1.15;
    ctx.beginPath(); ctx.moveTo(-w / 2, lines.length * lh * 0.62); ctx.lineTo(w / 2, lines.length * lh * 0.62); ctx.stroke();
  }
  ctx.restore();
}

/** letter-spaced text, centred */
export function spaced(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, sp: number) {
  const chars = [...t];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
  let cx = x - total / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + sp;
  });
  ctx.textAlign = prev;
}

function drawPortal(ctx: CanvasRenderingContext2D, x: number, y: number, kind: string, hint: string, P: (n: number) => number, sec: Section) {
  const s = sec.openGround ? 3 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = P(1.6);
  if (kind === "stairs" || kind === "ladder" || kind === "trapdoor") {
    ctx.strokeRect(-1.6 * s, -1.6 * s, 3.2 * s, 3.2 * s);
    for (let i = -1.2; i <= 1.3; i += 0.6) { ctx.beginPath(); ctx.moveTo(-1.6 * s, i * s); ctx.lineTo(1.6 * s, i * s); ctx.stroke(); }
  } else if (kind === "portrait") {
    ctx.strokeRect(-1.4 * s, -1.8 * s, 2.8 * s, 3.6 * s);
    ctx.beginPath(); ctx.ellipse(0, -0.2 * s, 0.7 * s, 1 * s, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (kind === "passage") {
    ctx.beginPath(); ctx.arc(0, 0, 1.6 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 0.6 * s, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(-1.6 * s, 0.8 * s); ctx.lineTo(0, -1.4 * s); ctx.lineTo(1.6 * s, 0.8 * s); ctx.closePath(); ctx.stroke();
  }
  if (hint) {
    ctx.font = `italic ${1.6 * s}px ${FONTS.italic}`;
    ctx.fillStyle = INK_SOFT;
    ctx.textAlign = "center";
    ctx.fillText(hint, 0, 3.4 * s);
  }
  ctx.restore();
}

function drawGlyph(ctx: CanvasRenderingContext2D, h: Hotspot, P: (n: number) => number) {
  const s = h.r / 3;
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = P(1.5);
  switch (h.glyph) {
    case "statue":
      ctx.beginPath(); ctx.arc(0, -1 * s, 0.9 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1.2 * s, 1.6 * s); ctx.lineTo(0, 0); ctx.lineTo(1.2 * s, 1.6 * s); ctx.closePath(); ctx.stroke();
      break;
    case "mirror":
      ctx.beginPath(); ctx.ellipse(0, 0, 1 * s, 1.7 * s, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.4 * s, -0.8 * s); ctx.lineTo(0.3 * s, -1.2 * s); ctx.stroke();
      break;
    case "portrait":
    case "tapestry":
      ctx.strokeRect(-1.5 * s, -1 * s, 3 * s, 2 * s);
      if (h.glyph === "tapestry") for (let x = -1.2; x <= 1.3; x += 0.6) { ctx.beginPath(); ctx.moveTo(x * s, 1 * s); ctx.lineTo(x * s, 1.5 * s); ctx.stroke(); }
      break;
    case "gargoyle":
      ctx.beginPath(); ctx.moveTo(-1.2 * s, 1.2 * s); ctx.lineTo(-1.2 * s, -0.6 * s); ctx.lineTo(-0.5 * s, -1.4 * s); ctx.lineTo(0, -0.8 * s); ctx.lineTo(0.5 * s, -1.4 * s); ctx.lineTo(1.2 * s, -0.6 * s); ctx.lineTo(1.2 * s, 1.2 * s); ctx.closePath(); ctx.stroke();
      break;
    case "pear":
      ctx.strokeRect(-1.4 * s, -1.1 * s, 2.8 * s, 2.2 * s);
      ctx.beginPath(); ctx.arc(0, 0.2 * s, 0.5 * s, 0, Math.PI * 2); ctx.arc(0, -0.4 * s, 0.3 * s, 0, Math.PI * 2); ctx.stroke();
      break;
    case "barrels":
      for (const [bx, by] of [[-0.8, 0.6], [0.8, 0.6], [0, -0.6]]) { ctx.beginPath(); ctx.arc(bx * s, by * s, 0.65 * s, 0, Math.PI * 2); ctx.stroke(); }
      break;
    case "sink":
      ctx.beginPath(); ctx.arc(0, 0, 1 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.5 * s, 0); ctx.bezierCurveTo(-0.2 * s, -0.4 * s, 0.2 * s, 0.4 * s, 0.5 * s, 0); ctx.stroke();
      break;
    case "writing":
      ctx.font = `italic ${1.2 * s}px ${FONTS.italic}`;
      ctx.textAlign = "center";
      ctx.fillStyle = INK_FADED;
      ctx.fillText("~ ~ ~ ~", 0, 0);
      break;
    case "cabinet":
      ctx.strokeRect(-1 * s, -1.4 * s, 2 * s, 2.8 * s);
      for (const y of [-0.5, 0.4]) { ctx.beginPath(); ctx.moveTo(-1 * s, y * s); ctx.lineTo(1 * s, y * s); ctx.stroke(); }
      break;
    case "eagle":
      ctx.beginPath(); ctx.moveTo(-1.5 * s, 0); ctx.quadraticCurveTo(-0.7 * s, -1.2 * s, 0, 0); ctx.quadraticCurveTo(0.7 * s, -1.2 * s, 1.5 * s, 0); ctx.stroke();
      break;
    case "squid":
      ctx.beginPath(); ctx.ellipse(0, -0.6 * s, 0.8 * s, 1.2 * s, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 0.25 * s, 0.5 * s); ctx.quadraticCurveTo(i * 0.5 * s, 1.4 * s, i * 0.3 * s, 2 * s); ctx.stroke(); }
      break;
    case "spider":
      ctx.beginPath(); ctx.arc(0, 0, 0.5 * s, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 1.1 * s, Math.sin(a) * 0.9 * s - 0.3 * s); ctx.lineTo(Math.cos(a) * 1.6 * s, Math.sin(a) * 1.4 * s); ctx.stroke();
      }
      break;
    case "hippogriff":
      ctx.beginPath(); ctx.moveTo(-1.4 * s, 0.8 * s); ctx.lineTo(-0.6 * s, -0.2 * s); ctx.lineTo(0.8 * s, -0.2 * s); ctx.lineTo(1.4 * s, -1 * s); ctx.moveTo(-0.6 * s, -0.2 * s); ctx.lineTo(0, -1.2 * s); ctx.stroke();
      break;
    case "boar":
      for (const x of [-1.6, 1.6]) { ctx.strokeRect((x - 0.4) * s, -1.4 * s, 0.8 * s, 2.8 * s); ctx.beginPath(); ctx.arc(x * s, -1.8 * s, 0.5 * s, 0, Math.PI * 2); ctx.stroke(); }
      break;
    case "knot":
      break;
    default:
      ctx.beginPath(); ctx.arc(0, 0, 0.5 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* ================================================================== */
/* frame furniture (sheet-pixel space)                                 */

function drawBorder(ctx: CanvasRenderingContext2D, W: number, H: number, rnd: () => number) {
  ctx.save();
  ctx.strokeStyle = INK;
  const m1 = 34, m2 = 48;
  ctx.lineWidth = 3;
  ctx.strokeRect(m1, m1, W - m1 * 2, H - m1 * 2);
  ctx.lineWidth = 1.4;
  ctx.strokeRect(m2, m2, W - m2 * 2, H - m2 * 2);
  // rope pattern between the lines
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = INK_SOFT;
  const rope = (x0: number, y0: number, x1: number, y1: number) => {
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    for (let t = 0; t < L; t += 10) {
      const x = x0 + ux * t, y = y0 + uy * t;
      ctx.beginPath();
      ctx.moveTo(x - uy * 5 - ux * 3, y + ux * 5 - uy * 3);
      ctx.lineTo(x + uy * 5 + ux * 3, y - ux * 5 + uy * 3);
      ctx.stroke();
    }
  };
  const mm = (m1 + m2) / 2;
  rope(mm, mm, W - mm, mm);
  rope(mm, H - mm, W - mm, H - mm);
  rope(mm, mm, mm, H - mm);
  rope(W - mm, mm, W - mm, H - mm);
  // corner flourishes
  for (const [cx, cy, sx, sy] of [[m2, m2, 1, 1], [W - m2, m2, -1, 1], [m2, H - m2, 1, -1], [W - m2, H - m2, -1, -1]]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 70);
    ctx.bezierCurveTo(6, 30, 30, 6, 70, 6);
    ctx.moveTo(14, 40);
    ctx.bezierCurveTo(22, 22, 22, 22, 40, 14);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(26, 26, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  void rnd;
}

function drawFurniture(ctx: CanvasRenderingContext2D, sec: Section, k: number, rnd: () => number) {
  const { w: W, h: H } = sheetPixels(sec);
  ctx.save();
  // title cartouche
  let tx: number, ty: number, tw: number;
  if (sec.id === "grounds") { tx = W - 560; ty = 150; tw = 900; }
  else if (sec.id === "towers") { tx = W / 2; ty = H - 230; tw = 1400; }
  else { tx = 132 * k; ty = 22 * k; tw = 72 * k; }
  scroll(ctx, tx, ty, tw, 170);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fs = 68;
  ctx.font = `${fs}px ${FONTS.sc}`;
  const tWidth = ctx.measureText(sec.title.toUpperCase()).width + sec.title.length * 5;
  if (tWidth > tw - 90) { fs *= (tw - 90) / tWidth; ctx.font = `${fs}px ${FONTS.sc}`; }
  spaced(ctx, sec.title.toUpperCase(), tx, ty - 18, 5 * (fs / 68));
  ctx.font = `italic ${32}px ${FONTS.italic}`;
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(sec.subtitle, tx, ty + 42);

  // the Marauders' header on the grounds sheet
  if (sec.id === "grounds") {
    const hx = 2450 * (W / 4096), hy = 170;
    ctx.fillStyle = INK;
    ctx.font = `italic 40px ${FONTS.italic}`;
    ctx.fillText("Messrs Moony, Wormtail, Padfoot & Prongs", hx, hy - 70);
    ctx.font = `italic 30px ${FONTS.italic}`;
    ctx.fillText("Purveyors of Aids to Magical Mischief-Makers", hx, hy - 24);
    ctx.fillText("are proud to present", hx, hy + 14);
    ctx.font = `96px ${FONTS.sc}`;
    spaced(ctx, "THE MARAUDER'S MAP", hx, hy + 90, 6);
    flourish(ctx, hx, hy + 150, 520);
  }

  // compass rose
  let cx: number, cy: number, cr: number;
  if (sec.id === "grounds") { cx = 1440 * k; cy = 210 * k; cr = 110; }
  else if (sec.id === "towers") { cx = W - 200; cy = 220; cr = 110; }
  else { cx = 344 * k; cy = 224 * k; cr = 11 * k; }
  compass(ctx, cx, cy, cr);

  // scale bar
  const sb = sec.scaleBar * k;
  const sx = 120, sy = H - 110;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const x = sx + (sb / 4) * i;
    if (i % 2 === 0) ctx.fillRect(x, sy - 6, sb / 4, 12);
    else ctx.strokeRect(x, sy - 6, sb / 4, 12);
  }
  ctx.font = `italic 28px ${FONTS.italic}`;
  ctx.textAlign = "center";
  ctx.fillText("0", sx, sy - 26);
  ctx.fillText(`${sec.scaleBar} metres`, sx + sb, sy - 26);
  ctx.textAlign = "left";
  ctx.font = `italic 24px ${FONTS.italic}`;
  ctx.fillStyle = INK_SOFT;
  ctx.fillText("drawn to scale by careful pacing", sx, sy + 34);

  // signatures
  ctx.textAlign = "center";
  ctx.font = `44px ${FONTS.script}`;
  ctx.fillStyle = INK_SOFT;
  const sig = ["Moony", "Wormtail", "Padfoot", "Prongs"];
  const base = W / 2 - 540;
  sig.forEach((s, i) => {
    ctx.save();
    ctx.translate(base + i * 360, H - 70);
    ctx.rotate(-0.03 + rnd() * 0.06);
    ctx.fillText(s, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

function scroll(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.fillStyle = "rgba(240,224,185,0.65)";
  const l = x - w / 2, r = x + w / 2, t = y - h / 2, b = y + h / 2;
  ctx.beginPath();
  ctx.moveTo(l + 30, t);
  ctx.lineTo(r - 30, t);
  ctx.quadraticCurveTo(r, t, r, t + 30);
  ctx.lineTo(r, b - 30);
  ctx.quadraticCurveTo(r, b, r - 30, b);
  ctx.lineTo(l + 30, b);
  ctx.quadraticCurveTo(l, b, l, b - 30);
  ctx.lineTo(l, t + 30);
  ctx.quadraticCurveTo(l, t, l + 30, t);
  ctx.fill();
  ctx.stroke();
  // curled ends
  for (const sx of [l, r]) {
    const d = sx === l ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(sx, t + 30);
    ctx.bezierCurveTo(sx + d * 50, t + 10, sx + d * 50, b - 10, sx, b - 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx + d * 22, y, 14, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function flourish(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.bezierCurveTo(x - w / 4, y - 30, x - w / 8, y + 30, x, y);
  ctx.bezierCurveTo(x + w / 8, y - 30, x + w / 4, y + 30, x + w / 2, y);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function compass(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.84, Math.sin(a) * r * 0.84); ctx.lineTo(Math.cos(a) * r * (i % 4 ? 0.92 : 1), Math.sin(a) * r * (i % 4 ? 0.92 : 1)); ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const L = i % 2 ? r * 0.5 : r * 0.8;
    const ww = r * 0.11;
    const ax = Math.cos(a), ay = Math.sin(a), px = -ay, py = ax;
    ctx.beginPath();
    ctx.moveTo(ax * L, ay * L);
    ctx.lineTo(px * ww, py * ww);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ax * L, ay * L);
    ctx.lineTo(-px * ww, -py * ww);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.font = `${r * 0.3}px ${FONTS.sc}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", 0, -r * 1.18);
  ctx.restore();
}
