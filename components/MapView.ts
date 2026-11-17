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
  private detail: { canvas: HTMLCanvasElement; zoom: number; pan: { x: number; y: number }; w: number; h: number } | null = null;
  private detailTimer: ReturnType<typeof setTimeout> | null = null;
  private drag: { x: number; y: number; px: number; py: number; moved: boolean } | null = null;
  private pinch: { d: number; zoom: number } | null = null;
  private touches = new Map<number, { x: number; y: number }>();
  private dark: HTMLCanvasElement = document.createElement("canvas");
  onHover?: (h: Hit, x: number, y: number) => void;
  onClick?: (h: Hit, x: number, y: number) => void;
  onViewChange?: () => void;

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
    this.detail = null;
  }

  setSection(sec: Section, base: HTMLCanvasElement) {
    this.sec = sec;
    this.base = base;
    this.k = pxPerMetre(sec);
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.detail = null;
  }

  setBase(base: HTMLCanvasElement) {
    this.base = base;
    this.detail = null;
    this.scheduleDetail();
  }

  /** sheet px → CSS px scale */
  get scale() {
    return (this.fit.w / sheetPixels(this.sec).w) * this.zoom;
  }

  /** matrix sheet px → CSS px */
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
    const sp = sheetPixels(this.sec);
    const s = this.scale;
    const W = sp.w * s, H = sp.h * s;
    const vw = this.canvas.width / this.dpr, vh = this.canvas.height / this.dpr;
    const mx = Math.max(0, (W - vw) / 2 + 60), my = Math.max(0, (H - vh) / 2 + 60);
    const cx0 = this.fit.x + this.fit.w / 2 - vw / 2, cy0 = this.fit.y + this.fit.h / 2 - vh / 2;
    this.pan.x = Math.max(-mx - cx0, Math.min(mx - cx0, this.pan.x));
    this.pan.y = Math.max(-my - cy0, Math.min(my - cy0, this.pan.y));
    if (this.zoom <= 1.001) this.pan = { x: 0, y: 0 };
  }

  zoomAt(cssX: number, cssY: number, factor: number) {
    const before = this.toMetres(cssX, cssY);
    this.zoom = Math.max(1, Math.min(9, this.zoom * factor));
    const after = this.toScreen(before.x, before.y);
    this.pan.x += cssX - after.x;
    this.pan.y += cssY - after.y;
    this.clampPan();
    this.scheduleDetail();
    this.onViewChange?.();
  }

  /** centre on a point (metres) at a zoom level */
  focus(mx: number, my: number, zoom: number) {
    this.zoom = zoom;
    this.pan = { x: 0, y: 0 };
    const p = this.toScreen(mx, my);
    const vw = this.canvas.width / this.dpr, vh = this.canvas.height / this.dpr;
    this.pan.x = vw / 2 - p.x;
    this.pan.y = vh / 2 - p.y;
    this.clampPan();
    this.scheduleDetail();
  }

  scheduleDetail() {
    if (this.detailTimer) clearTimeout(this.detailTimer);
    this.detailTimer = setTimeout(() => this.renderDetail(), 180);
  }

  private renderDetail() {
    if (!this.sec || this.zoom < 1.25) { this.detail = null; return; }
    const c = document.createElement("canvas");
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const ctx = c.getContext("2d")!;
    const m = new DOMMatrix().scale(this.dpr).multiply(this.matrix());
    renderSection(ctx, this.sec, { flags: this.flags, m, width: c.width, height: c.height });
    this.detail = { canvas: c, zoom: this.zoom, pan: { ...this.pan }, w: c.width, h: c.height };
  }

  /* ----------------------------- input ------------------------------ */
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  };

  private onDown = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touches.size === 2) {
      const [a, b] = [...this.touches.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom };
      this.drag = null;
      return;
    }
    this.drag = { x: e.clientX - r.left, y: e.clientY - r.top, px: this.pan.x, py: this.pan.y, moved: false };
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
      const target = Math.max(1, Math.min(9, this.pinch.zoom * (d / this.pinch.d)));
      this.zoomAt(cx, cy, target / this.zoom);
      return;
    }
    if (this.drag) {
      const dx = x - this.drag.x, dy = y - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) this.drag.moved = true;
      if (this.drag.moved && this.zoom > 1) {
        this.pan.x = this.drag.px + dx;
        this.pan.y = this.drag.py + dy;
        this.clampPan();
        this.scheduleDetail();
        this.onViewChange?.();
      }
      this.canvas.style.cursor = this.drag.moved ? "grabbing" : "";
    } else if (this.pointer.inside) {
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

    // shadow
    ctx.save();
    ctx.setTransform(m);
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 60 * this.dpr;
    ctx.shadowOffsetY = 18 * this.dpr;
    ctx.fillStyle = "#c9a970";
    ctx.fillRect(0, 0, sp.w, sp.h);
    ctx.restore();

    const d = this.detail;
    if (d && d.zoom === this.zoom && d.pan.x === this.pan.x && d.pan.y === this.pan.y && d.w === W) {
      ctx.drawImage(d.canvas, 0, 0);
    } else {
      ctx.save();
      ctx.setTransform(m);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(this.base, 0, 0);
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
