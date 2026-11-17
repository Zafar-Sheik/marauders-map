import type { Section, Hotspot, Portal, Space } from "@/lib/types";
import type { Char, Simulation } from "@/lib/sim";
import { pxPerMetre, sheetPixels } from "@/lib/sheet";
import { renderSection } from "@/lib/render";
import { drawNameFlag, drawPrints } from "@/lib/footprints";
import { inSpace } from "@/lib/nav";

export type Hit =
  | { type: "char"; char: Char }
  | { type: "hotspot"; hotspot: Hotspot }
  | { type: "portal"; portal: Portal }
  | { type: "space"; space: Space }
  | null;

interface Burst { x: number; y: number; t: number; hue: number }

const TILE = 512;
const MAX_TILES = 96;
const MIN_ZOOM = 1;
const MAX_ZOOM = 9;

/**
 * The flat, interactive map. Zoom eases toward a target, drags carry momentum,
 * and sharp detail is painted in 512px tiles a few at a time each frame (never
 * blocking input) on top of the always-available base texture.
 */
export class MapView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  sec!: Section;
  base!: HTMLCanvasElement;
  k = 1;
  /** CSS px rect of the sheet at zoom 1 */
  fit = { x: 0, y: 0, w: 100, h: 100 };
  zoom = 1;
  pan = { x: 0, y: 0 };
  dpr = 1;
  night = 0;
  lumos = false;
  pointer = { x: -9999, y: -9999, inside: false };
  highlight: string | null = null;
  hideLabels = false;
  flags: Set<string> = new Set();
  bursts: Burst[] = [];
  revealAll = 0;
  fade = 1;
  private zTarget = 1;
  private zAnchor = { x: 0, y: 0 };
  private vel = { x: 0, y: 0 };
  private lastMove = { x: 0, y: 0, t: 0 };
  private tiles = new Map<string, { c: HTMLCanvasElement; used: number }>();
  private tileVersion = 0;
  private drag: { x: number; y: number; px: number; py: number; moved: boolean } | null = null;
  private pinch: { d: number; zoom: number } | null = null;
  private touches = new Map<number, { x: number; y: number }>();
  private dark: HTMLCanvasElement = document.createElement("canvas");
  private shadow: HTMLCanvasElement | null = null;
  onHover?: (h: Hit, x: number, y: number) => void;
  onClick?: (h: Hit, x: number, y: number) => void;
  onViewChange?: () => void;
  /** fired on any direct user manipulation (lets callers cancel animations) */
  onInteract?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("pointerleave", () => { this.pointer.inside = false; });
  }

  dispose() {
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
  }

  resize() {
    const r = this.canvas.parentElement!.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.canvas.style.width = r.width + "px";
    this.canvas.style.height = r.height + "px";
    this.dark.width = this.canvas.width;
    this.dark.height = this.canvas.height;
  }

  setSection(sec: Section, base: HTMLCanvasElement) {
    this.sec = sec;
    this.base = base;
    this.k = pxPerMetre(sec);
    this.shadow = null;
    this.clearTiles();
    this.setView(1, { x: 0, y: 0 });
  }

  setBase(base: HTMLCanvasElement) {
    this.base = base;
    this.clearTiles();
  }

  private clearTiles() {
    this.tiles.clear();
    this.tileVersion++;
  }

  /** set zoom & pan immediately (stops easing and momentum) */
  setView(zoom: number, pan: { x: number; y: number }) {
    this.zoom = this.zTarget = zoom;
    this.pan = { ...pan };
    this.vel = { x: 0, y: 0 };
    this.clampPan();
  }

  /** stop any easing / momentum in progress */
  halt() {
    this.zTarget = this.zoom;
    this.vel = { x: 0, y: 0 };
  }

  /** kept for callers; detail tiles are painted continuously now */
  scheduleDetail() {}

  get scale() {
    return (this.fit.w / sheetPixels(this.sec).w) * this.zoom;
  }

  matrix() {
    const s = this.scale;
    const cx = this.fit.x + this.fit.w / 2, cy = this.fit.y + this.fit.h / 2;
    const sp = sheetPixels(this.sec);
    return new DOMMatrix().translate(cx + this.pan.x, cy + this.pan.y).scale(s).translate(-sp.w / 2, -sp.h / 2);
  }

  toMetres(cssX: number, cssY: number) {
    const p = this.matrix().inverse().transformPoint(new DOMPoint(cssX, cssY));
    return { x: p.x / this.k, y: p.y / this.k };
  }

  toScreen(mx: number, my: number) {
    const p = this.matrix().transformPoint(new DOMPoint(mx * this.k, my * this.k));
    return { x: p.x, y: p.y };
  }

  private clampPan() {
    if (!this.sec) return;
    const sp = sheetPixels(this.sec);
    const s = this.scale;
    const W = sp.w * s, H = sp.h * s;
    const vw = this.canvas.width / this.dpr, vh = this.canvas.height / this.dpr;
    const mx = Math.max(0, (W - vw) / 2 + 60), my = Math.max(0, (H - vh) / 2 + 60);
    const cx0 = this.fit.x + this.fit.w / 2 - vw / 2, cy0 = this.fit.y + this.fit.h / 2 - vh / 2;
    // near zoom 1 the allowed range shrinks smoothly to "centred", so zooming out never snaps
    const t = Math.min(1, Math.max(0, (this.zoom - 1) / 0.3));
    this.pan.x = Math.max((-mx - cx0) * t, Math.min((mx - cx0) * t, this.pan.x));
    this.pan.y = Math.max((-my - cy0) * t, Math.min((my - cy0) * t, this.pan.y));
  }

  /** zoom immediately about a screen point */
  zoomAt(cssX: number, cssY: number, factor: number) {
    const before = this.toMetres(cssX, cssY);
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor));
    const after = this.toScreen(before.x, before.y);
    this.pan.x += cssX - after.x;
    this.pan.y += cssY - after.y;
    this.clampPan();
    this.onViewChange?.();
  }

  /** centre on a point (metres) at a zoom level — immediate */
  focus(mx: number, my: number, zoom: number) {
    this.zoom = zoom;
    this.pan = { x: 0, y: 0 };
    const p = this.toScreen(mx, my);
    const vw = this.canvas.width / this.dpr, vh = this.canvas.height / this.dpr;
    this.pan.x = vw / 2 - p.x;
    this.pan.y = vh / 2 - p.y;
    this.clampPan();
    this.halt();
  }

  /** per-frame easing: zoom toward its target, momentum after a flick */
  update(dt: number) {
    if (!this.sec) return;
    if (Math.abs(this.zTarget - this.zoom) > 1e-4) {
      const f = 1 - Math.exp(-dt * 16);
      let nz = this.zoom + (this.zTarget - this.zoom) * f;
      if (Math.abs(this.zTarget - nz) < 2e-3) nz = this.zTarget;
      this.zoomAt(this.zAnchor.x, this.zAnchor.y, nz / this.zoom);
    }
    if (!this.drag && (Math.abs(this.vel.x) > 3 || Math.abs(this.vel.y) > 3)) {
      this.pan.x += this.vel.x * dt;
      this.pan.y += this.vel.y * dt;
      const decay = Math.exp(-dt * 5);
      this.vel.x *= decay;
      this.vel.y *= decay;
      this.clampPan();
    }
  }

  /* ----------------------------- tiles ------------------------------ */
  private tileLevel() {
    const s = this.scale * this.dpr; // device px per sheet px
    if (s <= 1.15) return 0;
    return Math.min(16, Math.pow(2, Math.ceil(Math.log2(s - 0.05))));
  }

  private renderTile(level: number, tx: number, ty: number) {
    const c = document.createElement("canvas");
    c.width = c.height = TILE;
    const ctx = c.getContext("2d")!;
    const span = TILE / level;
    const m = new DOMMatrix().scale(level).translate(-tx * span, -ty * span);
    const k = this.k;
    renderSection(ctx, this.sec, {
      flags: this.flags, m, width: TILE, height: TILE,
      clip: { x0: (tx * span) / k, y0: (ty * span) / k, x1: ((tx + 1) * span) / k, y1: ((ty + 1) * span) / k },
    });
    return c;
  }

  private paintTiles(ctx: CanvasRenderingContext2D, m: DOMMatrix, budgetMs: number) {
    const level = this.tileLevel();
    if (!level) return;
    const span = TILE / level;
    const sp = sheetPixels(this.sec);
    const inv = m.inverse();
    const W = this.canvas.width, H = this.canvas.height;
    const a = inv.transformPoint(new DOMPoint(0, 0)), b = inv.transformPoint(new DOMPoint(W, H));
    const tx0 = Math.max(0, Math.floor(a.x / span)), ty0 = Math.max(0, Math.floor(a.y / span));
    const tx1 = Math.min(Math.ceil(sp.w / span) - 1, Math.floor(b.x / span));
    const ty1 = Math.min(Math.ceil(sp.h / span) - 1, Math.floor(b.y / span));
    const now = performance.now();
    const missing: [number, number, number][] = [];
    const ccx = (a.x + b.x) / 2, ccy = (a.y + b.y) / 2;
    ctx.save();
    ctx.setTransform(m);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.tiles.get(`${level}:${tx}:${ty}`);
        if (t) {
          t.used = now;
          ctx.drawImage(t.c, tx * span, ty * span, span, span);
        } else missing.push([tx, ty, Math.hypot((tx + 0.5) * span - ccx, (ty + 0.5) * span - ccy)]);
      }
    if (missing.length) {
      missing.sort((p, q) => p[2] - q[2]);
      const start = performance.now();
      const ver = this.tileVersion;
      for (const [tx, ty] of missing) {
        if (performance.now() - start > budgetMs) break;
        const c = this.renderTile(level, tx, ty);
        if (ver !== this.tileVersion) break;
        this.tiles.set(`${level}:${tx}:${ty}`, { c, used: performance.now() });
        ctx.drawImage(c, tx * span, ty * span, span, span);
      }
    }
    ctx.restore();
    if (this.tiles.size > MAX_TILES) {
      const old = [...this.tiles.entries()].sort((p, q) => p[1].used - q[1].used).slice(0, this.tiles.size - MAX_TILES);
      for (const [key] of old) this.tiles.delete(key);
    }
  }

  private shadowSprite() {
    if (this.shadow) return this.shadow;
    const sp = sheetPixels(this.sec);
    const w = 256, h = Math.round((256 * sp.h) / sp.w), pad = 40;
    const c = document.createElement("canvas");
    c.width = w + pad * 2;
    c.height = h + pad * 2;
    const x = c.getContext("2d")!;
    x.shadowColor = "rgba(0,0,0,0.6)";
    x.shadowBlur = 16;
    x.shadowOffsetY = 5;
    x.fillStyle = "#000";
    x.fillRect(pad, pad, w, h);
    this.shadow = c;
    return c;
  }

  /* ----------------------------- input ------------------------------ */
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.onInteract?.();
    const r = this.canvas.getBoundingClientRect();
    // trackpads send many small deltas, mice a few big ones — normalise both
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const f = Math.exp(-Math.max(-120, Math.min(120, dy)) * (e.ctrlKey ? 0.01 : 0.0022));
    this.zTarget = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zTarget * f));
    this.zAnchor = { x: e.clientX - r.left, y: e.clientY - r.top };
    this.vel = { x: 0, y: 0 };
  };

  private onDown = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.onInteract?.();
    this.halt();
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touches.size === 2) {
      const [a, b] = [...this.touches.values()];
      this.pinch = { d: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), zoom: this.zoom };
      this.drag = null;
      return;
    }
    this.drag = { x: e.clientX - r.left, y: e.clientY - r.top, px: this.pan.x, py: this.pan.y, moved: false };
    this.lastMove = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    this.pointer = { x, y, inside: x >= 0 && y >= 0 && x <= r.width && y <= r.height };
    if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.touches.size === 2) {
      const [a, b] = [...this.touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
      const target = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.pinch.zoom * (d / this.pinch.d)));
      this.zoomAt(cx, cy, target / this.zoom);
      this.zTarget = this.zoom;
      return;
    }
    if (this.drag) {
      const dx = x - this.drag.x, dy = y - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) this.drag.moved = true;
      if (this.drag.moved && this.zoom > 1.001) {
        const now = performance.now();
        const dtm = Math.max(1, now - this.lastMove.t);
        this.vel.x = this.vel.x * 0.6 + ((e.clientX - this.lastMove.x) / dtm) * 1000 * 0.4;
        this.vel.y = this.vel.y * 0.6 + ((e.clientY - this.lastMove.y) / dtm) * 1000 * 0.4;
        this.lastMove = { x: e.clientX, y: e.clientY, t: now };
        this.pan.x = this.drag.px + dx;
        this.pan.y = this.drag.py + dy;
        this.clampPan();
        this.onViewChange?.();
      }
      this.canvas.style.cursor = this.drag.moved ? "grabbing" : "";
    } else if (this.pointer.inside && !this.touches.size) {
      this.onHover?.(this.hitTest(x, y), x, y);
    }
  };

  private onUp = (e: PointerEvent) => {
    this.touches.delete(e.pointerId);
    if (this.touches.size < 2) this.pinch = null;
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    this.canvas.style.cursor = "";
    if (performance.now() - this.lastMove.t > 80) this.vel = { x: 0, y: 0 };
    if (!d.moved && e.type === "pointerup") {
      const r = this.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      this.onClick?.(this.hitTest(x, y), x, y);
    }
  };

  sim?: Simulation;

  hitTest(x: number, y: number): Hit {
    if (!this.sec) return null;
    const m = this.toMetres(x, y);
    const pxPerM = this.scale * this.k;
    if (this.sim) {
      let best: Char | null = null, bd = 18;
      for (const c of this.sim.chars) {
        if (c.section !== this.sec.id || c.hidden) continue;
        const s = this.toScreen(c.x, c.y);
        // the flag sits up and to the right of the dot
        const d = Math.min(Math.hypot(s.x - x, s.y - y), Math.hypot(s.x + 40 - x, s.y - 22 - y) * 1.3);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) return { type: "char", char: best };
    }
    for (const h of this.sec.hotspots) {
      if (h.hidden) continue;
      if (Math.hypot(h.x - m.x, h.y - m.y) * pxPerM < Math.max(h.r * pxPerM, 10)) return { type: "hotspot", hotspot: h };
    }
    const secretShown = this.flags.has("dissendium") || this.flags.has("willow") || this.flags.has("passages-open");
    for (const p of this.sec.portals) {
      if (p.secret && !secretShown) continue;
      const r = this.sec.openGround ? 7 : 2.4;
      if (Math.hypot(p.x - m.x, p.y - m.y) * pxPerM < Math.max(r * pxPerM, 10)) return { type: "portal", portal: p };
    }
    const order = (s: Space) => (s.kind === "corridor" || s.kind === "field" || s.kind === "forest" ? 1 : 0);
    const cands = this.sec.spaces.filter((s) => (!s.requires || this.flags.has(s.requires)) && (s.info || s.kind !== "corridor")).sort((a, b) => order(a) - order(b));
    for (const s of cands) if (inSpace(s, m.x, m.y) && s.id !== "lawn" && s.id !== "shore") return { type: "space", space: s };
    return null;
  }

  burst(mx: number, my: number) {
    this.bursts.push({ x: mx, y: my, t: performance.now(), hue: Math.random() });
  }

  /* ----------------------------- draw ------------------------------- */
  draw(sim: Simulation, now: number) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!this.sec || !this.base) return;
    ctx.globalAlpha = this.fade;
    const m = new DOMMatrix().scale(this.dpr).multiply(this.matrix());
    const sp = sheetPixels(this.sec);

    // soft shadow from a tiny pre-blurred sprite — no per-frame blur
    const sh = this.shadowSprite();
    const padX = (40 / 256) * sp.w, padY = padX;
    ctx.save();
    ctx.setTransform(m);
    ctx.drawImage(sh, -padX, -padY + sp.w * 0.008, sp.w + padX * 2, sp.h + padY * 2);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.base, 0, 0);
    ctx.restore();
    // sharp detail, painted progressively within a per-frame time budget
    this.paintTiles(ctx, m, this.drag || this.pinch ? 3 : 8);

    // the Grand Staircase: flights that swing to new landings every so often
    for (const sp2 of this.sec.spaces) {
      if (sp2.decor !== "grandstair" || !sp2.rect) continue;
      const r = sp2.rect;
      ctx.save();
      ctx.setTransform(m.multiply(new DOMMatrix().scale(this.k)));
      ctx.strokeStyle = "rgba(56,34,15,0.9)";
      ctx.fillStyle = "rgba(233,214,168,0.85)";
      ctx.lineWidth = 2.2 / this.k;
      const t = now / 1000;
      for (let i = 0; i < 3; i++) {
        const period = 13 + i * 4;
        const phase = Math.floor((t + i * 5) / period);
        const local = ((t + i * 5) % period) / period;
        const choose = (n: number) => [-0.55, -0.25, 0.25, 0.55][Math.abs(Math.floor(Math.sin(n * 91.7 + i * 13.1) * 1000)) % 4];
        const from = choose(phase), to = choose(phase + 1);
        const e = local < 0.82 ? 0 : (1 - Math.cos(((local - 0.82) / 0.18) * Math.PI)) / 2;
        const ang = from + (to - from) * e;
        ctx.save();
        ctx.translate(r.x + r.w / 2, r.y + 8 + i * 12);
        ctx.rotate(ang);
        ctx.fillRect(-9, -1.8, 18, 3.6);
        ctx.strokeRect(-9, -1.8, 18, 3.6);
        ctx.beginPath();
        for (let x = -8; x < 9; x += 1.15) { ctx.moveTo(x, -1.8); ctx.lineTo(x, 1.8); }
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // footprints & names
    ctx.save();
    ctx.setTransform(m);
    const s = this.scale;
    const boost = Math.max(1, Math.min(2.4, 0.5 / s));
    const vwCss = this.canvas.width / this.dpr;
    const ui = (1 / s) * Math.min(1, Math.sqrt(vwCss / 1000));
    drawPrints(ctx, sim.prints[this.sec.id], sim.time, this.k, boost, this.highlight);
    if (!this.hideLabels) {
      const here = sim.chars.filter((c) => c.section === this.sec.id && !c.hidden);
      // draw highlighted last so it sits on top
      here.sort((a, b) => (a.id === this.highlight ? 1 : 0) - (b.id === this.highlight ? 1 : 0));
      for (const c of here) {
        const em = c.id === this.highlight || this.revealAll > now;
        const a = this.highlight && !em ? 0.45 : 1;
        drawNameFlag(ctx, c, this.k, ui, a, em);
      }
    }
    ctx.restore();

    // fireworks (Weasleys' Wildfire Whiz-bangs, in ink)
    this.bursts = this.bursts.filter((b) => now - b.t < 2600);
    for (const b of this.bursts) {
      const t = (now - b.t) / 2600;
      const p = this.toScreen(b.x, b.y);
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.strokeStyle = `rgba(56,34,15,${(1 - t) * 0.9})`;
      ctx.lineWidth = 1.6;
      const R = 20 + t * 110;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + b.hue;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(a) * R * 0.55, p.y + Math.sin(a) * R * 0.55 + t * t * 30);
        ctx.lineTo(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R + t * t * 40);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R + t * t * 40, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }
      ctx.restore();
    }

    // night & lumos
    if (this.night > 0.01) {
      const dc = this.dark.getContext("2d")!;
      dc.setTransform(1, 0, 0, 1, 0, 0);
      dc.globalCompositeOperation = "source-over";
      dc.clearRect(0, 0, W, H);
      dc.fillStyle = `rgba(8,6,14,${0.78 * this.night})`;
      dc.fillRect(0, 0, W, H);
      if (this.lumos && this.pointer.inside) {
        dc.globalCompositeOperation = "destination-out";
        const px = this.pointer.x * this.dpr, py = this.pointer.y * this.dpr, R = 170 * this.dpr;
        const g = dc.createRadialGradient(px, py, R * 0.15, px, py, R);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(0.6, "rgba(0,0,0,0.75)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        dc.fillStyle = g;
        dc.beginPath();
        dc.arc(px, py, R, 0, Math.PI * 2);
        dc.fill();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.dark, 0, 0);
      if (this.lumos && this.pointer.inside) {
        const px = this.pointer.x * this.dpr, py = this.pointer.y * this.dpr, R = 190 * this.dpr;
        const g = ctx.createRadialGradient(px, py, 0, px, py, R);
        g.addColorStop(0, "rgba(255,236,190,0.22)");
        g.addColorStop(1, "rgba(255,236,190,0)");
        ctx.fillStyle = g;
        ctx.globalCompositeOperation = "screen";
        ctx.fillRect(px - R, py - R, R * 2, R * 2);
        ctx.globalCompositeOperation = "source-over";
      }
    }
    ctx.globalAlpha = 1;
  }
}
