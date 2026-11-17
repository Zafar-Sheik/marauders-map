import type { Pt, Section, Space } from "./types";

export function pointInPoly(x: number, y: number, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** inside test with an inset (positive shrinks the shape) */
export function inSpace(s: Space, x: number, y: number, inset = 0) {
  if (s.rect) {
    const r = s.rect;
    return x >= r.x + inset && x <= r.x + r.w - inset && y >= r.y + inset && y <= r.y + r.h - inset;
  }
  if (s.circle) {
    const c = s.circle;
    const d = Math.hypot(x - c.cx, y - c.cy);
    return d <= c.r - inset;
  }
  if (s.poly) return pointInPoly(x, y, s.poly);
  return false;
}

export function spaceCenter(s: Space): Pt {
  if (s.rect) return [s.rect.x + s.rect.w / 2, s.rect.y + s.rect.h / 2];
  if (s.circle) return [s.circle.cx, s.circle.cy];
  if (s.poly) {
    let x = 0, y = 0;
    for (const p of s.poly) { x += p[0]; y += p[1]; }
    return [x / s.poly.length, y / s.poly.length];
  }
  return [0, 0];
}

const isWalkableKind = (s: Space) =>
  s.walkable ?? (s.kind === "room" || s.kind === "corridor" || s.kind === "stairs" || s.kind === "open" || s.kind === "tower");

export class NavGrid {
  w: number;
  h: number;
  res: number;
  cells: Uint8Array;
  sec: Section;

  constructor(sec: Section) {
    this.sec = sec;
    this.res = sec.navRes;
    this.w = Math.ceil(sec.frame.w / this.res);
    this.h = Math.ceil(sec.frame.h / this.res);
    this.cells = new Uint8Array(this.w * this.h);
    this.build();
  }

  private build() {
    const { sec, res } = this;
    const walk = sec.spaces.filter((s) => s.kind !== "hidden" && isWalkableKind(s));
    const block = sec.spaces.filter((s) => s.kind === "water" || s.kind === "castle");
    const inset = sec.openGround ? 0 : 0.75;
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const x = (i + 0.5) * res;
        const y = (j + 0.5) * res;
        let ok = false;
        if (sec.openGround) {
          ok = x > 8 && y > 8 && x < sec.frame.w - 8 && y < sec.frame.h - 8;
          if (ok) for (const b of block) if (inSpace(b, x, y)) { ok = false; break; }
        } else {
          for (const s of walk) if (inSpace(s, x, y, inset)) { ok = true; break; }
        }
        this.cells[j * this.w + i] = ok ? 1 : 0;
      }
    }
    // carve doors
    const carve = (px: number, py: number, rad: number) => {
      const r = Math.ceil(rad / res);
      const ci = Math.floor(px / res), cj = Math.floor(py / res);
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          if (di * di + dj * dj > r * r) continue;
          const i = ci + di, j = cj + dj;
          if (i >= 0 && j >= 0 && i < this.w && j < this.h) this.cells[j * this.w + i] = 1;
        }
    };
    for (const s of walk) for (const d of s.doors ?? []) carve(d[0], d[1], 1.6);
    for (const p of sec.portals) carve(p.x, p.y, Math.max(0.8, res));
  }

  walkable(x: number, y: number) {
    const i = Math.floor(x / this.res), j = Math.floor(y / this.res);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return false;
    return this.cells[j * this.w + i] === 1;
  }

  nearestWalkable(x: number, y: number): Pt {
    if (this.walkable(x, y)) return [x, y];
    const ci = Math.floor(x / this.res), cj = Math.floor(y / this.res);
    for (let r = 1; r < 200; r++) {
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          if (Math.abs(di) !== r && Math.abs(dj) !== r) continue;
          const i = ci + di, j = cj + dj;
          if (i >= 0 && j >= 0 && i < this.w && j < this.h && this.cells[j * this.w + i])
            return [(i + 0.5) * this.res, (j + 0.5) * this.res];
        }
    }
    return [x, y];
  }

  lineOfSight(a: Pt, b: Pt) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.ceil(d / (this.res * 0.5));
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      if (!this.walkable(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
    }
    return true;
  }

  /** A* over the 8-connected grid, then string-pulled */
  findPath(from: Pt, to: Pt): Pt[] | null {
    const { w, h, res, cells } = this;
    const a = this.nearestWalkable(from[0], from[1]);
    const b = this.nearestWalkable(to[0], to[1]);
    const si = Math.floor(a[0] / res), sj = Math.floor(a[1] / res);
    const ti = Math.floor(b[0] / res), tj = Math.floor(b[1] / res);
    const N = w * h;
    const start = sj * w + si, goal = tj * w + ti;
    if (start === goal) return [b];
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();
    g[start] = 0;
    const hx = (i: number, j: number) => {
      const dx = Math.abs(i - ti), dy = Math.abs(j - tj);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    heap.push(start, hx(si, sj));
    let found = false;
    let iter = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (++iter > 400000) break;
      const ci = cur % w, cj = (cur / w) | 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
          const n = nj * w + ni;
          if (!cells[n] || closed[n]) continue;
          if (di && dj && (!cells[cj * w + ni] || !cells[nj * w + ci])) continue;
          const ng = g[cur] + (di && dj ? Math.SQRT2 : 1);
          if (ng < g[n]) {
            g[n] = ng;
            came[n] = cur;
            heap.push(n, ng + hx(ni, nj));
          }
        }
    }
    if (!found) return null;
    const raw: Pt[] = [];
    for (let c = goal; c !== -1; c = came[c]) raw.push([((c % w) + 0.5) * res, (((c / w) | 0) + 0.5) * res]);
    raw.reverse();
    raw[raw.length - 1] = b;
    // string pull
    const out: Pt[] = [];
    let anchor: Pt = a;
    let k = 0;
    while (k < raw.length) {
      let far = k;
      for (let m = raw.length - 1; m > k; m--) {
        if (this.lineOfSight(anchor, raw[m])) { far = m; break; }
      }
      out.push(raw[far]);
      anchor = raw[far];
      k = far + 1;
    }
    return out;
  }

  randomPointIn(s: Space, rnd: () => number = Math.random): Pt {
    let bx = 0, by = 0, bw = 0, bh = 0;
    if (s.rect) ({ x: bx, y: by, w: bw, h: bh } = s.rect);
    else if (s.circle) { bx = s.circle.cx - s.circle.r; by = s.circle.cy - s.circle.r; bw = bh = s.circle.r * 2; }
    else if (s.poly) {
      const xs = s.poly.map((p) => p[0]), ys = s.poly.map((p) => p[1]);
      bx = Math.min(...xs); by = Math.min(...ys); bw = Math.max(...xs) - bx; bh = Math.max(...ys) - by;
    }
    for (let t = 0; t < 40; t++) {
      const x = bx + rnd() * bw, y = by + rnd() * bh;
      if (inSpace(s, x, y, this.sec.openGround ? 0 : 2) && this.walkable(x, y)) return [x, y];
    }
    const c = spaceCenter(s);
    return this.nearestWalkable(c[0], c[1]);
  }
}

class MinHeap {
  private ids: number[] = [];
  private pr: number[] = [];
  get size() { return this.ids.length; }
  push(id: number, p: number) {
    const { ids, pr } = this;
    ids.push(id); pr.push(p);
    let i = ids.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (pr[par] <= pr[i]) break;
      [ids[par], ids[i]] = [ids[i], ids[par]];
      [pr[par], pr[i]] = [pr[i], pr[par]];
      i = par;
    }
  }
  pop(): number {
    const { ids, pr } = this;
    const top = ids[0];
    const li = ids.pop()!, lp = pr.pop()!;
    if (ids.length) {
      ids[0] = li; pr[0] = lp;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < ids.length && pr[l] < pr[m]) m = l;
        if (r < ids.length && pr[r] < pr[m]) m = r;
        if (m === i) break;
        [ids[m], ids[i]] = [ids[i], ids[m]];
        [pr[m], pr[i]] = [pr[i], pr[m]];
        i = m;
      }
    }
    return top;
  }
}

/** name of the room a point is in (rooms take priority over corridors) */
export function locate(sec: Section, x: number, y: number, flags: Set<string>): string {
  const order = (s: Space) => (s.kind === "corridor" || s.kind === "field" || s.kind === "forest" ? 1 : 0);
  const cands = sec.spaces
    .filter((s) => (!s.requires || flags.has(s.requires)) && s.kind !== "water")
    .sort((a, b) => order(a) - order(b));
  for (const s of cands) if (inSpace(s, x, y)) return s.name;
  return sec.openGround ? "the grounds" : sec.name;
}
