import * as THREE from "three";
import { CENTER_H, FLAP_H, PANEL_W, SHEET_H } from "@/lib/sheet";

const EPS = 0.004;

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uInk;
  uniform sampler2D uBlank;
  uniform float uReveal;
  uniform vec2 uOrigin;
  uniform float uAspect;
  uniform float uTime;
  uniform float uNight;
  varying vec2 vUv;
  varying vec3 vNormal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec4 blank = texture2D(uBlank, vUv);
    vec4 ink = texture2D(uInk, vUv);
    vec2 p = (vUv - uOrigin) * vec2(uAspect, 1.0);
    float d = length(p);
    float n = fbm(vUv * vec2(uAspect, 1.0) * 6.0 + uTime * 0.05);
    float front = d + (n - 0.5) * 0.35;
    float m = smoothstep(uReveal, uReveal - 0.09, front);
    vec3 col = mix(blank.rgb, ink.rgb, m);
    // wet ink rim where the ink is still spreading
    float rim = exp(-pow((front - uReveal) / 0.018, 2.0)) * step(0.001, uReveal) * (1.0 - step(2.5, uReveal));
    col = mix(col, col * vec3(0.55, 0.42, 0.3), rim * 0.55);
    // fake candle light
    vec3 L = normalize(vec3(-0.35, 0.55, 1.0));
    float diff = max(dot(normalize(vNormal), L), 0.0);
    col *= 0.62 + 0.42 * diff;
    col *= mix(vec3(1.0), vec3(0.42, 0.36, 0.3), uNight);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

type Col = {
  group: THREE.Group;
  hinge: THREE.Group | null;
  top: THREE.Group;
  bottom: THREE.Group;
};

export interface SheetState {
  accordion: number;
  flaps: number;
  tilt: number;
  lift: number;
}

export class FoldingSheet {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  root = new THREE.Group();
  sheet = new THREE.Group();
  cols: Col[] = [];
  ncols = 4;
  state: SheetState = { accordion: 1, flaps: 1, tilt: 1, lift: 0 };
  sheetVisible = true;
  frontMat: THREE.ShaderMaterial;
  backMat: THREE.ShaderMaterial;
  coverMat: THREE.ShaderMaterial;
  private dust: THREE.Points;
  private shadow: THREE.Mesh;
  private lastT = performance.now();
  private elapsed = 0;
  private raf = 0;
  private container: HTMLElement;
  /** GPU textures are cached per source canvas, so revisiting a section costs nothing */
  private texCache = new Map<HTMLCanvasElement, THREE.CanvasTexture>();
  onFrame?: (dt: number) => void;
  /** extra top / bottom room (CSS px) reserved for UI chrome */
  insets = { top: 70, bottom: 86, side: 24 };

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    this.camera.position.set(0, 0, 14);
    this.scene.add(this.root);
    this.root.add(this.sheet);

    const mk = () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uInk: { value: null },
          uBlank: { value: null },
          uReveal: { value: 0 },
          uOrigin: { value: new THREE.Vector2(0.5, 0.5) },
          uAspect: { value: 1.5 },
          uTime: { value: 0 },
          uNight: { value: 0 },
        },
      });
    this.frontMat = mk();
    this.backMat = mk();
    this.backMat.uniforms.uReveal.value = 10;
    this.coverMat = mk();

    // soft shadow under the sheet
    const sc = document.createElement("canvas");
    sc.width = sc.height = 128;
    const sx = sc.getContext("2d")!;
    const g = sx.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    sx.fillStyle = g;
    sx.fillRect(0, 0, 128, 128);
    const st = new THREE.CanvasTexture(sc);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false }));
    this.shadow.position.z = -0.6;
    this.root.add(this.shadow);

    // drifting dust in the candle light
    const N = 420;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 2] = Math.random() * 6 - 1;
      seed[i] = Math.random() * 100;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dg.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    const dm = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
      vertexShader: /* glsl */ `
        attribute float seed;
        uniform float uTime;
        uniform float uPx;
        varying float vA;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.07 + seed) * 1.2;
          p.y += mod(uTime * 0.12 + seed, 14.0) - 7.0;
          p.z += cos(uTime * 0.05 + seed * 1.7) * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * (2.0 + 3.0 * fract(seed)) * (12.0 / -mv.z);
          vA = 0.25 + 0.5 * fract(seed * 3.1);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA;
          gl_FragColor = vec4(1.0, 0.82, 0.55, a * 0.5);
        }`,
    });
    this.dust = new THREE.Points(dg, dm);
    this.scene.add(this.dust);

    this.resize();
    window.addEventListener("resize", this.resize);
    this.loop();
  }

  private resize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.insets = w < 720 ? { top: 104, bottom: 76, side: 12 } : { top: 70, bottom: 86, side: 24 };
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + "px";
    this.renderer.domElement.style.height = h + "px";
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  /** (re)build the panels for a section */
  build(cols: number, ink: HTMLCanvasElement, blank: HTMLCanvasElement, back: HTMLCanvasElement, coverInk: HTMLCanvasElement, coverBlank: HTMLCanvasElement) {
    this.sheet.traverse((o) => {
      if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
    });
    this.sheet.clear();
    this.cols = [];
    this.ncols = cols;

    const tex = (c: HTMLCanvasElement) => this.texture(c);
    const tInk = tex(ink), tBlank = tex(blank), tBack = tex(back), tCI = tex(coverInk), tCB = tex(coverBlank);
    const aspect = (cols * PANEL_W) / SHEET_H;
    Object.assign(this.frontMat.uniforms, {});
    this.frontMat.uniforms.uInk.value = tInk;
    this.frontMat.uniforms.uBlank.value = tBlank;
    this.frontMat.uniforms.uAspect.value = aspect;
    this.backMat.uniforms.uInk.value = tBack;
    this.backMat.uniforms.uBlank.value = tBack;
    this.coverMat.uniforms.uInk.value = tCI;
    this.coverMat.uniforms.uBlank.value = tCB;
    this.coverMat.uniforms.uAspect.value = PANEL_W / CENTER_H;

    const W = cols * PANEL_W;
    const plane = (w: number, h: number, cx: number, cy: number, u0: number, u1: number, v0: number, v1: number) => {
      const g = new THREE.PlaneGeometry(w, h, 8, 8);
      g.translate(cx, cy, 0);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
      }
      uv.needsUpdate = true;
      return g;
    };
    const vOf = (ySheet: number) => (ySheet + SHEET_H / 2) / SHEET_H;

    let parent: THREE.Object3D = this.sheet;
    for (let i = 0; i < cols; i++) {
      const u0 = (i * PANEL_W) / W, u1 = ((i + 1) * PANEL_W) / W;
      const group = new THREE.Group();
      let hinge: THREE.Group | null = null;
      if (i === 0) parent.add(group);
      else {
        hinge = new THREE.Group();
        hinge.position.x = PANEL_W;
        parent.add(hinge);
        hinge.add(group);
      }
      // centre panel
      const cf = new THREE.Mesh(plane(PANEL_W, CENTER_H, PANEL_W / 2, 0, u0, u1, vOf(-CENTER_H / 2), vOf(CENTER_H / 2)), this.frontMat);
      group.add(cf);
      const cb = new THREE.Mesh(plane(PANEL_W, CENTER_H, 0, 0, u1, u0, 0, 1), this.backMat);
      cb.rotation.y = Math.PI;
      cb.position.set(PANEL_W / 2, 0, -0.0005);
      group.add(cb);
      // top flap
      const top = new THREE.Group();
      top.position.y = CENTER_H / 2;
      group.add(top);
      top.add(new THREE.Mesh(plane(PANEL_W, FLAP_H, PANEL_W / 2, FLAP_H / 2, u0, u1, vOf(CENTER_H / 2), 1), this.frontMat));
      const tb = new THREE.Mesh(
        i === 0 ? plane(PANEL_W, FLAP_H, 0, 0, 0, 1, 0.5, 1) : plane(PANEL_W, FLAP_H, 0, 0, u0, u1, 0.5, 1),
        i === 0 ? this.coverMat : this.backMat,
      );
      tb.rotation.x = Math.PI;
      tb.position.set(PANEL_W / 2, FLAP_H / 2, -0.0005);
      top.add(tb);
      // bottom flap
      const bottom = new THREE.Group();
      bottom.position.y = -CENTER_H / 2;
      group.add(bottom);
      bottom.add(new THREE.Mesh(plane(PANEL_W, FLAP_H, PANEL_W / 2, -FLAP_H / 2, u0, u1, 0, vOf(-CENTER_H / 2)), this.frontMat));
      const bb = new THREE.Mesh(
        i === 0 ? plane(PANEL_W, FLAP_H, 0, 0, 0, 1, 0, 0.5) : plane(PANEL_W, FLAP_H, 0, 0, u0, u1, 0, 0.5),
        i === 0 ? this.coverMat : this.backMat,
      );
      bb.rotation.x = Math.PI;
      bb.position.set(PANEL_W / 2, -FLAP_H / 2, -0.0005);
      bottom.add(bb);
      this.cols.push({ group, hinge, top, bottom });
      parent = group;
    }
    this.applyState();
  }

  private texture(c: HTMLCanvasElement) {
    let t = this.texCache.get(c);
    if (!t) {
      t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      this.texCache.set(c, t);
    }
    return t;
  }

  /** create & upload a section's textures ahead of time (call during idle) */
  prepare(...canvases: HTMLCanvasElement[]) {
    for (const c of canvases) {
      const fresh = !this.texCache.has(c);
      const t = this.texture(c);
      if (fresh) this.renderer.initTexture(t);
    }
  }

  setInk(ink: HTMLCanvasElement) {
    const cached = this.texCache.get(ink);
    if (cached) cached.needsUpdate = true;
    const t = this.frontMat.uniforms.uInk.value as THREE.CanvasTexture;
    if (t && t.image === ink) t.needsUpdate = true;
  }

  private ease(t: number) {
    t = Math.min(1, Math.max(0, t));
    return t * t * (3 - 2 * t);
  }

  private applyState() {
    const { accordion, flaps } = this.state;
    const n = this.cols.length;
    for (let i = 0; i < n; i++) {
      const c = this.cols[i];
      // flaps close from the outer columns inward
      const fl = this.ease(flaps * 1.35 - (n > 1 ? ((n - 1 - i) / (n - 1)) * 0.35 : 0));
      c.top.rotation.x = Math.PI * fl * 0.995;
      c.bottom.rotation.x = -Math.PI * fl * 0.995;
      c.top.position.z = EPS * fl * 1.2;
      c.bottom.position.z = EPS * fl * 0.6;
      if (c.hinge) {
        const a = this.ease(accordion * 1.25 - ((i - 1) / Math.max(1, n - 1)) * 0.25);
        const sign = i % 2 === 1 ? 1 : -1;
        c.hinge.rotation.y = sign * Math.PI * a * 0.997;
        const sParent = (i - 1) % 2 === 0 ? 1 : -1;
        c.hinge.position.z = -EPS * 4 * sParent * a;
      }
    }
  }

  private bbox = new THREE.Box3();
  private rootInv = new THREE.Matrix4();
  private frameNo = 0;
  private tmp = new THREE.Vector3();

  private frameSheet(dt: number) {
    const { tilt, lift } = this.state;
    this.root.rotation.set(-0.42 * tilt, 0.05 * tilt, 0.06 * tilt);
    this.root.position.y = -0.2 * tilt + lift;
    this.sheet.position.set(0, 0, 0);
    this.sheet.updateMatrixWorld(true);
    // centre the visible extent
    this.rootInv.copy(this.root.matrixWorld).invert();
    const b = this.bbox.makeEmpty();
    for (const c of this.cols) {
      for (const [x, y] of [[0, -CENTER_H / 2], [PANEL_W, -CENTER_H / 2], [0, CENTER_H / 2], [PANEL_W, CENTER_H / 2]]) {
        this.tmp.set(x, y, 0).applyMatrix4(c.group.matrixWorld);
        this.tmp.applyMatrix4(this.rootInv);
        b.expandByPoint(this.tmp);
      }
    }
    const fl = this.ease(1 - this.state.flaps);
    const hx = (b.max.x - b.min.x) / 2;
    const hy = CENTER_H / 2 + FLAP_H * fl;
    this.sheet.position.x = -(b.min.x + b.max.x) / 2;
    this.shadow.scale.set(hx * 2 * 1.25 + 0.6, hy * 2 * 1.25 + 0.6, 1);
    // camera fit
    const want = this.fitDistance(hx * 2, hy * 2) * (1 + 0.35 * tilt);
    this.camera.position.z += (want - this.camera.position.z) * Math.min(1, dt * 60);
    this.camera.lookAt(0, 0, 0);
  }

  fitDistance(w: number, h: number) {
    const el = this.container;
    const vw = el.clientWidth, vh = el.clientHeight;
    const availH = Math.max(100, vh - this.insets.top - this.insets.bottom);
    const availW = Math.max(100, vw - this.insets.side * 2);
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    // world units visible vertically at distance d: 2 d t; we need h to take availH of vh
    const dH = (h * vh) / (availH * 2 * t);
    const dW = (w * vw) / (availW * 2 * t * (vw / vh));
    return Math.max(dH, dW);
  }

  /** CSS-pixel rect the fully-open sheet occupies */
  openRect() {
    const vw = this.container.clientWidth, vh = this.container.clientHeight;
    const W = this.ncols * PANEL_W, H = SHEET_H;
    const d = this.fitDistance(W, H);
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const ppu = vh / (2 * d * t);
    return { x: vw / 2 - (W * ppu) / 2, y: vh / 2 - (H * ppu) / 2, w: W * ppu, h: H * ppu };
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const nowT = performance.now();
    const dt = Math.min(0.05, (nowT - this.lastT) / 1000);
    this.lastT = nowT;
    this.elapsed += dt;
    const t = this.elapsed;
    this.frontMat.uniforms.uTime.value = t;
    this.coverMat.uniforms.uTime.value = t;
    (this.dust.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    this.sheet.visible = this.sheetVisible;
    this.shadow.visible = this.sheetVisible;
    if (this.sheetVisible) {
      this.applyState();
      this.frameSheet(dt);
    }
    this.onFrame?.(dt);
    // while the flat map is up, only dust is drawn here — 30fps is plenty for it
    this.frameNo++;
    if (this.sheetVisible || this.frameNo % 2 === 0) this.renderer.render(this.scene, this.camera);
  };

  /** ray-pick the sheet, returning the UV on whatever was hit */
  pick(clientX: number, clientY: number): { uv: THREE.Vector2; cover: boolean } | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.camera);
    const hits = rc.intersectObjects(this.sheet.children, true);
    const h = hits.find((x) => x.uv);
    if (!h || !h.uv) return null;
    return { uv: h.uv.clone(), cover: (h.object as THREE.Mesh).material === this.coverMat };
  }

  setNight(v: number) {
    this.frontMat.uniforms.uNight.value = v;
    this.backMat.uniforms.uNight.value = v;
    this.coverMat.uniforms.uNight.value = v;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
