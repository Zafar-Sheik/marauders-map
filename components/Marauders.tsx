"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { FoldingSheet } from "./FoldingSheet";
import { MapView, type Hit } from "./MapView";
import { SECTIONS, SECTION_BY_ID } from "@/lib/castle";
import { Simulation, type Char } from "@/lib/sim";
import { renderSection, blankFor } from "@/lib/render";
import { sheetPixels } from "@/lib/sheet";
import { coverBlank, coverInk } from "@/lib/cover";
import { setFonts } from "@/lib/palette";
import { speak, hotspotEgg, personEgg, wildfire, OATH, EGG_COUNT, type EggAPI, type Line } from "@/lib/eggs";
import { rustle, scratch, setSound, tap } from "@/lib/audio";
import { spaceCenter } from "@/lib/nav";

type Phase = "loading" | "closed" | "opening" | "open" | "switching" | "closing";

interface Msg extends Line {
  id: number;
}

const LADDER = ["towers", "f7", "f6", "f5", "f4", "f3", "f2", "f1", "f0", "dungeons"];
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

export default function Marauders() {
  const stageRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const peopleRef = useRef<HTMLDivElement>(null);
  const sheet = useRef<FoldingSheet | null>(null);
  const view = useRef<MapView | null>(null);
  const sim = useRef<Simulation | null>(null);
  const bases = useRef(new Map<string, HTMLCanvasElement>());
  const stale = useRef(new Set<string>());
  const flags = useRef(new Set<string>());
  const phaseRef = useRef<Phase>("loading");
  const sectionRef = useRef("grounds");
  const followRef = useRef<string | null>(null);
  const followPause = useRef(0);
  const liveUi = useRef(false);
  const hoverPos = useRef<{ x: number; y: number } | null>(null);
  const covers = useRef<{ ink: HTMLCanvasElement; blank: HTMLCanvasElement } | null>(null);

  const [phase, setPhaseState] = useState<Phase>("loading");
  const [section, setSection] = useState("grounds");
  const [hover, setHover] = useState<{ title: string; sub?: string; x: number; y: number } | null>(null);
  const [card, setCard] = useState<{ kind: "char" | "space"; id: string } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [spell, setSpell] = useState("");
  const [night, setNightState] = useState(false);
  const [lumos, setLumosState] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sound, setSoundState] = useState(true);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [following, setFollowing] = useState<string | null>(null);

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  /* ------------------------------------------------------------ */
  /* messages                                                      */
  const msgId = useRef(0);
  const say = useCallback((lines: Line[]) => {
    setMessages((m) => [...m, ...lines.map((l) => ({ ...l, id: ++msgId.current }))].slice(-6));
  }, []);

  /* ------------------------------------------------------------ */
  /* rendering helpers                                             */
  const baseFor = useCallback((id: string, force = false) => {
    const key = id;
    if (stale.current.has(key)) { force = true; stale.current.delete(key); }
    if (!force && bases.current.has(key)) return bases.current.get(key)!;
    const sec = SECTION_BY_ID[id];
    const { w, h } = sheetPixels(sec);
    const c = bases.current.get(key) ?? document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    renderSection(ctx, sec, { flags: flags.current, width: w, height: h });
    bases.current.set(key, c);
    return c;
  }, []);

  const buildSheet = useCallback((id: string) => {
    const sec = SECTION_BY_ID[id];
    const ink = baseFor(id);
    sheet.current!.build(sec.cols, ink, blankFor(sec), blankFor(sec, true), covers.current!.ink, covers.current!.blank);
  }, [baseFor]);

  const to2D = useCallback(() => {
    const v = view.current!, s = sheet.current!;
    v.resize();
    v.fit = s.openRect();
    v.setSection(SECTION_BY_ID[sectionRef.current], baseFor(sectionRef.current));
    v.flags = flags.current;
    v.fade = 1;
    const canvas = mapRef.current!;
    gsap.fromTo(canvas, { opacity: 0 }, {
      opacity: 1, duration: 0.35, ease: "none", onComplete: () => {
        s.sheetVisible = false;
      },
    });
    v.scheduleDetail();
  }, [baseFor]);

  const to3D = useCallback(async () => {
    const v = view.current!, s = sheet.current!;
    // ease the 2D view back to the resting fit so the swap is seamless
    if (v.zoom > 1.001 || v.pan.x || v.pan.y) {
      cancelFocus();
      const st = { z: v.zoom, x: v.pan.x, y: v.pan.y };
      await new Promise<void>((res) =>
        gsap.to(st, { z: 1, x: 0, y: 0, duration: 0.45, ease: "power2.inOut", onUpdate: () => v.setView(st.z, { x: st.x, y: st.y }), onComplete: () => res() }),
      );
    }
    s.sheetVisible = true;
    await new Promise<void>((res) => gsap.to(mapRef.current, { opacity: 0, duration: 0.25, onComplete: () => res() }));
  }, []);

  /* ------------------------------------------------------------ */
  /* fold / unfold timelines                                       */
  const unfold = useCallback((tl: gsap.core.Timeline, at: number | string = ">") => {
    const s = sheet.current!;
    tl.to(s.state, { tilt: 0, lift: 0, duration: 1.1, ease: "power2.inOut" }, at);
    tl.call(() => rustle(0.9, 0.2), [], "<0.2");
    tl.to(s.state, { accordion: 0, duration: 1.5, ease: "power2.inOut" }, "<0.25");
    tl.call(() => rustle(0.7, 0.16), [], "<0.9");
    tl.to(s.state, { flaps: 0, duration: 1.1, ease: "power2.inOut" }, "<0.9");
    tl.fromTo(s.frontMat.uniforms.uReveal, { value: 0 }, { value: 2.6, duration: 2.4, ease: "power1.in" }, "<0.35");
    return tl;
  }, []);

  const foldUp = useCallback((tl: gsap.core.Timeline, tiltTo = 1) => {
    const s = sheet.current!;
    tl.call(() => rustle(0.6, 0.16));
    tl.to(s.state, { flaps: 1, duration: 0.9, ease: "power2.inOut" });
    tl.call(() => rustle(0.8, 0.2), [], "<0.6");
    tl.to(s.state, { accordion: 1, duration: 1.2, ease: "power2.inOut" }, "<0.55");
    tl.to(s.state, { tilt: tiltTo, duration: 1.0, ease: "power2.inOut" }, "<0.4");
    return tl;
  }, []);

  const openMap = useCallback(() => {
    if (phaseRef.current !== "closed") return;
    setPhase("opening");
    tap();
    const s = sheet.current!;
    s.frontMat.uniforms.uOrigin.value.set(0.5, 0.5);
    s.coverMat.uniforms.uOrigin.value.set(0.5, 0.55);
    const tl = gsap.timeline({
      onComplete: () => {
        setPhase("open");
        to2D();
      },
    });
    tl.to(s.coverMat.uniforms.uReveal, { value: 1.6, duration: 2.2, ease: "power1.inOut", onStart: () => { for (let i = 0; i < 8; i++) setTimeout(() => scratch(0.04), i * 180); } });
    tl.to(s.state, { lift: 0.15, duration: 0.5, ease: "power2.out" }, "+=0.3");
    unfold(tl, ">");
  }, [to2D, unfold]);

  const closeMap = useCallback(async () => {
    if (phaseRef.current !== "open") return;
    setPhase("closing");
    setCard(null);
    setFollowing(null);
    followRef.current = null;
    await to3D();
    const s = sheet.current!;
    s.frontMat.uniforms.uOrigin.value.set(0.5, 0.5);
    const tl = gsap.timeline({ onComplete: () => setPhase("closed") });
    tl.to(s.frontMat.uniforms.uReveal, { value: 0, duration: 1.8, ease: "power1.out" });
    foldUp(tl);
    tl.to(s.coverMat.uniforms.uReveal, { value: 0, duration: 1.4, ease: "power1.out" }, "-=0.6");
  }, [foldUp, to3D]);

  const goSection = useCallback(async (id: string, focus?: { x: number; y: number; zoom: number }) => {
    const v = view.current!;
    if (phaseRef.current !== "open") return;
    if (id === sectionRef.current) {
      if (focus) animateFocus(v, focus);
      return;
    }
    setPhase("switching");
    setCard((c) => (c?.kind === "char" ? c : null));
    setHover(null);
    await to3D();
    const s = sheet.current!;
    const tl = gsap.timeline();
    foldUp(tl, 0.55);
    tl.call(() => {
      sectionRef.current = id;
      setSection(id);
      buildSheet(id);
      s.frontMat.uniforms.uReveal.value = 0;
    });
    unfold(tl, "+=0.15");
    tl.call(() => {
      setPhase("open");
      to2D();
      if (focus) setTimeout(() => animateFocus(view.current!, focus), 380);
    });
  }, [buildSheet, foldUp, to2D, to3D, unfold]);

  /* ------------------------------------------------------------ */
  /* the egg API                                                   */
  const api = useMemo<EggAPI>(() => ({
    say,
    flag: (f) => flags.current.add(f),
    unflag: (f) => flags.current.delete(f),
    has: (f) => flags.current.has(f),
    goto: (sec, focus) => {
      if (sec === sectionRef.current) { if (focus) animateFocus(view.current!, focus); }
      else void goSection(sec, focus);
    },
    current: () => SECTION_BY_ID[sectionRef.current],
    get sim() { return sim.current!; },
    isOpen: () => phaseRef.current === "open",
    open: () => openMap(),
    close: () => void closeMap(),
    setNight: (v) => { setNightState(v); },
    setLumos: (v) => setLumosState(v),
    night: () => sim.current!.night,
    burst: (n) => {
      const v = view.current!;
      const vw = v.canvas.width / v.dpr, vh = v.canvas.height / v.dpr;
      for (let i = 0; i < n; i++)
        setTimeout(() => {
          const p = v.toMetres(vw * (0.2 + Math.random() * 0.6), vh * (0.2 + Math.random() * 0.6));
          v.burst(p.x, p.y);
          scratch(0.08);
        }, i * 220);
    },
    revealNames: () => { view.current!.revealAll = performance.now() + 6000; },
    hideLabels: (s) => { view.current!.hideLabels = true; setTimeout(() => (view.current!.hideLabels = false), s * 1000); },
    rerender: () => {
      // re-ink only the section on show now; the rest refresh lazily when next opened
      for (const id of bases.current.keys()) if (id !== sectionRef.current) stale.current.add(id);
      baseFor(sectionRef.current, true);
      const v = view.current!;
      v.setBase(baseFor(sectionRef.current));
      sheet.current!.setInk(baseFor(sectionRef.current));
    },
    viewCenter: () => {
      const v = view.current!;
      return v.toMetres(v.canvas.width / v.dpr / 2, v.canvas.height / v.dpr / 2);
    },
    found: (id) => setFound((f) => (f.has(id) ? f : new Set(f).add(id))),
  }), [say, goSection, openMap, closeMap, baseFor]);

  const apiRef = useRef(api);
  apiRef.current = api;

  /* ------------------------------------------------------------ */
  /* boot                                                          */
  useEffect(() => {
    let disposed = false;
    (async () => {
      const css = getComputedStyle(document.body);
      const fam = (v: string, fb: string) => (css.getPropertyValue(v).trim() || fb);
      setFonts({
        italic: fam("--font-fell", "'IM Fell English'") + ", Georgia, serif",
        sc: fam("--font-fell-sc", "'IM Fell English SC'") + ", Georgia, serif",
        script: fam("--font-script", "'Pinyon Script'") + ", cursive",
      });
      try {
        await Promise.all([
          document.fonts.load(`20px ${fam("--font-fell", "serif")}`),
          document.fonts.load(`italic 20px ${fam("--font-fell", "serif")}`),
          document.fonts.load(`20px ${fam("--font-fell-sc", "serif")}`),
          document.fonts.load(`20px ${fam("--font-script", "serif")}`),
        ]);
        await document.fonts.ready;
      } catch { /* fonts are a nicety */ }
      if (disposed) return;
      sim.current = new Simulation();
      // let everybody settle into the castle before the map is opened
      const t0 = performance.now();
      for (let i = 0; i < 300 && performance.now() - t0 < 700; i++) sim.current.step(0.1);
      covers.current = { ink: coverInk(), blank: coverBlank() };
      const s = new FoldingSheet(threeRef.current!);
      sheet.current = s;
      buildSheet("grounds");
      const v = new MapView(mapRef.current!);
      v.sim = sim.current;
      view.current = v;
      let last = performance.now();
      let lastTick = 0;
      s.onFrame = () => {
        const now = performance.now();
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        sim.current!.step(dt);
        const vv = view.current!;
        if (phaseRef.current === "open") {
          vv.update(dt);
          const fid = followRef.current;
          if (fid && now > followPause.current) {
            const c = sim.current!.get(fid);
            if (c) {
              if (c.section !== sectionRef.current) void apiRef.current.goto(c.section, { x: c.x, y: c.y, zoom: Math.max(2.2, vv.zoom) });
              else {
                const vw = vv.canvas.width / vv.dpr, vh = vv.canvas.height / vv.dpr;
                const p = vv.toScreen(c.x, c.y);
                const f = 1 - Math.exp(-dt * 3.5);
                vv.setView(vv.zoom, { x: vv.pan.x + (vw / 2 - p.x) * f, y: vv.pan.y + (vh / 2 - p.y) * f });
              }
            }
          }
          vv.draw(sim.current!, now);
        }
        // only re-render React when something on screen shows live locations
        if (now - lastTick > 1000 && (liveUi.current || now - lastTick > 5000)) { lastTick = now; setTick((t) => t + 1); }
      };
      let lastHoverKey = "";
      v.onHover = (h, x, y) => {
        const d = describe(h, x, y);
        const key = d ? d.title : "";
        // avoid re-rendering React on every mouse move unless the hovered thing changed or moved a lot
        if (key !== lastHoverKey || (d && hoverPos.current && Math.hypot(d.x - hoverPos.current.x, d.y - hoverPos.current.y) > 6)) {
          lastHoverKey = key;
          hoverPos.current = d ? { x: d.x, y: d.y } : null;
          setHover(d);
        }
      };
      v.onInteract = () => {
        cancelFocus();
        // the user is steering: let "follow" stop recentring for a few seconds
        followPause.current = performance.now() + 4000;
      };
      v.onClick = (h) => onMapClick(h);
      const onResize = () => {
        if (phaseRef.current === "open") {
          v.resize();
          v.fit = s.openRect();
          v.setView(1, { x: 0, y: 0 });
        }
      };
      window.addEventListener("resize", onResize);
      setPhase("closed");
    })();
    return () => {
      disposed = true;
      sheet.current?.dispose();
      view.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* once open, quietly prepare the other sections in idle time so switching never hitches */
  useEffect(() => {
    if (phase !== "open") return;
    const queue = SECTIONS.map((s) => s.id).filter((id) => !bases.current.has(id) || stale.current.has(id));
    let handle = 0;
    const ric: (cb: () => void) => number = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: object) => number }).requestIdleCallback
      ? (cb) => (window as unknown as { requestIdleCallback: (cb: () => void, o?: object) => number }).requestIdleCallback(cb, { timeout: 2000 })
      : (cb) => window.setTimeout(cb, 300);
    const step = () => {
      if (phaseRef.current !== "open") return;
      const id = queue.shift();
      if (!id) return;
      const sec = SECTION_BY_ID[id];
      sheet.current?.prepare(baseFor(id), blankFor(sec), blankFor(sec, true));
      handle = ric(step);
    };
    handle = ric(step);
    return () => {
      const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (cic) cic(handle); else clearTimeout(handle);
    };
  }, [phase, baseFor]);

  /* sync toggles into the engines */
  useEffect(() => {
    if (!sim.current) return;
    sim.current.night = night;
    const v = view.current;
    const s = sheet.current;
    const st = { n: v?.night ?? 0 };
    gsap.to(st, { n: night ? 1 : 0, duration: 1.2, onUpdate: () => { if (v) v.night = st.n; s?.setNight(st.n * 0.8); } });
  }, [night, phase]);
  useEffect(() => { if (view.current) view.current.lumos = lumos; }, [lumos]);
  useEffect(() => { if (sim.current) sim.current.timeScale = speed; }, [speed]);
  useEffect(() => { setSound(sound); }, [sound]);
  useEffect(() => { if (view.current) view.current.highlight = following ?? (card?.kind === "char" ? card.id : null); }, [following, card]);

  useEffect(() => { liveUi.current = peopleOpen || !!card; }, [peopleOpen, card]);

  /* people drawer animation */
  useEffect(() => {
    if (!peopleRef.current) return;
    gsap.to(peopleRef.current, { x: peopleOpen ? "0%" : "105%", duration: 0.45, ease: "power3.out" });
  }, [peopleOpen]);

  /* message queue: show one at a time */
  const msgRef = useRef<HTMLDivElement>(null);
  const current = messages[0];
  useEffect(() => {
    if (!current || !msgRef.current) return;
    const el = msgRef.current;
    const chars = el.querySelectorAll(".ch");
    const by = el.querySelector(".by");
    gsap.set(el, { opacity: 1, y: 0 });
    const tl = gsap.timeline();
    tl.fromTo(el, { opacity: 0, y: -10, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.35 });
    tl.fromTo(chars, { opacity: 0, filter: "blur(3px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.25, stagger: { each: 0.022 }, onStart: () => { for (let i = 0; i < Math.min(10, chars.length / 6); i++) setTimeout(() => scratch(0.03), i * 140); } }, "<0.1");
    if (by) tl.fromTo(by, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.5 }, ">-0.1");
    const hold = Math.min(9, 2.4 + current.text.length / 26);
    tl.to(el, { opacity: 0, y: -8, duration: 0.6, delay: hold });
    tl.call(() => setMessages((m) => m.slice(1)));
    return () => { tl.kill(); };
  }, [current]);

  /* ------------------------------------------------------------ */
  /* map interaction                                               */
  function describe(h: Hit, x: number, y: number) {
    if (!h) return null;
    if (h.type === "char") {
      const w = sim.current!.where(h.char);
      return { title: h.char.name, sub: `${h.char.def.role} — ${w.room}`, x, y };
    }
    if (h.type === "hotspot") return { title: h.hotspot.name, sub: "something here…", x, y };
    if (h.type === "portal") {
      const to = SECTION_BY_ID[h.portal.to.section];
      return { title: h.portal.name, sub: `leads to ${to.name}`, x, y };
    }
    if (h.type === "space") return { title: h.space.name, sub: h.space.note, x, y };
    return null;
  }

  function onMapClick(h: Hit) {
    if (!h || phaseRef.current !== "open") {
      setCard(null);
      return;
    }
    const a = apiRef.current;
    tap();
    if (h.type === "char") {
      if (personEgg(h.char.id, a)) { setCard({ kind: "char", id: h.char.id }); return; }
      setCard({ kind: "char", id: h.char.id });
    } else if (h.type === "hotspot") {
      hotspotEgg(h.hotspot.egg, a);
    } else if (h.type === "portal") {
      const p = h.portal;
      const dest = SECTION_BY_ID[p.to.section].portals.find((q) => q.id === p.to.portal);
      a.goto(p.to.section, dest ? { x: dest.x, y: dest.y, zoom: p.to.section === "grounds" ? 1.8 : 2.4 } : undefined);
    } else if (h.type === "space") {
      setCard({ kind: "space", id: h.space.id });
    }
  }

  /* typed spells */
  const cast = (text: string) => {
    if (!text.trim()) return;
    const ok = speak(text, apiRef.current);
    if (!ok) {
      const p = text.toLowerCase();
      const c = sim.current?.chars.find((ch) => ch.name.toLowerCase().includes(p.trim()));
      if (c && phaseRef.current === "open") {
        findPerson(c.id);
      } else {
        say([{ text: `"${text.trim()}" — the parchment absorbs your words without comment.`, by: "Moony" }]);
      }
    }
    setSpell("");
  };

  /* keyboard: hidden typing buffer & Konami */
  useEffect(() => {
    let buf = "";
    let kon: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      kon = [...kon, e.key].slice(-KONAMI.length);
      if (kon.join(",").toLowerCase() === KONAMI.join(",").toLowerCase()) {
        kon = [];
        if (phaseRef.current === "open") wildfire(apiRef.current);
      }
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") { setCard(null); setPeopleOpen(false); setFollowing(null); followRef.current = null; return; }
      if (e.key.length === 1) {
        buf = (buf + e.key.toLowerCase()).slice(-64);
        const clean = buf.replace(/[^a-z ]/g, "");
        for (const w of [OATH, "mischief managed", "lumos", "nox", "dissendium", "homenum revelio", "expecto patronum", "pine fresh", "sherbet lemon"]) {
          if (clean.endsWith(w)) { speak(w, apiRef.current); buf = ""; break; }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function findPerson(id: string) {
    const c = sim.current!.get(id);
    if (!c) return;
    setPeopleOpen(false);
    setCard({ kind: "char", id });
    apiRef.current.goto(c.section, { x: c.x, y: c.y, zoom: c.section === "grounds" ? 2.4 : 2.8 });
  }

  function toggleFollow(id: string) {
    const nv = following === id ? null : id;
    setFollowing(nv);
    followRef.current = nv;
    if (nv) {
      const c = sim.current!.get(nv)!;
      apiRef.current.goto(c.section, { x: c.x, y: c.y, zoom: Math.max(2.4, view.current!.zoom) });
    }
  }

  /* tapping the closed map */
  function onStageClick(e: React.MouseEvent) {
    if (phaseRef.current !== "closed" || !sheet.current) return;
    const hit = sheet.current.pick(e.clientX, e.clientY);
    if (!hit) return;
    tap();
    gsap.fromTo(sheet.current.state, { lift: 0 }, { lift: 0.08, duration: 0.12, yoyo: true, repeat: 1 });
    say([{ text: "The parchment waits. Tap it with your wand and solemnly swear…", by: "Moony" }]);
  }

  /* ------------------------------------------------------------ */
  const sec = SECTION_BY_ID[section];
  const cardChar: Char | undefined = card?.kind === "char" ? sim.current?.get(card.id) : undefined;
  const cardSpace = card?.kind === "space" ? sec.spaces.find((s) => s.id === card.id) : undefined;
  const people = useMemo(() => {
    if (!sim.current) return [];
    const q = query.toLowerCase();
    return sim.current.chars
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .map((c) => ({ c, w: sim.current!.where(c) }))
      .sort((a, b) => a.c.name.localeCompare(b.c.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tick, peopleOpen]);
  const occupied = useMemo(() => {
    const m = new Set<string>();
    sim.current?.chars.forEach((c) => m.add(c.section));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  const isOpen = phase === "open";
  const busy = phase === "opening" || phase === "closing" || phase === "switching";

  return (
    <div className="stage" ref={stageRef} onClick={onStageClick}>
      <div className="layer three" ref={threeRef} />
      <div className="layer" style={{ zIndex: 2, pointerEvents: isOpen ? "auto" : "none" }}>
        <canvas ref={mapRef} className="map2d" style={{ opacity: 0 }} aria-label={`Map of ${sec.name}`} />
      </div>

      {phase === "loading" && <div className="loading">Preparing the parchment…</div>}

      <div className="topbar">
        <div className="brand">
          The Marauder&apos;s Map
          <small>{isOpen || phase === "switching" ? `${sec.title} — ${sec.subtitle}` : "Hogwarts School of Witchcraft and Wizardry"}</small>
        </div>
        <div className="topright">
          <button className={`btn ${night ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); setNightState((n) => !n); }} title="Day / night">{night ? "☾ Night" : "☀ Day"}</button>
          <button className="btn pace" onClick={(e) => { e.stopPropagation(); setSpeed((s) => (s >= 4 ? 1 : s * 2)); }} title="How fast the castle moves">{speed}× pace</button>
          <button className={`btn ${sound ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); setSoundState((s) => !s); }} title="Sound">{sound ? "♪" : "–"}</button>
          <button className="btn" disabled={!isOpen} onClick={(e) => { e.stopPropagation(); setPeopleOpen((o) => !o); }}>Find a Person</button>
        </div>
      </div>

      {(isOpen || phase === "switching") && (
        <nav className="ladder" aria-label="Floors" onClick={(e) => e.stopPropagation()}>
          <div className="cap">FLOORS</div>
          {LADDER.map((id) => (
            <button key={id} className={section === id ? "on" : ""} disabled={busy} onClick={() => goSection(id)} aria-label={SECTION_BY_ID[id].name}>
              {SECTION_BY_ID[id].short}
              <span className="tip">{SECTION_BY_ID[id].name}</span>
              {following && sim.current?.get(following)?.section === id && <span className="dot" />}
            </button>
          ))}
          <div className="cap" style={{ marginTop: 6 }}>OUT</div>
          <button className={section === "grounds" ? "on" : ""} disabled={busy} onClick={() => goSection("grounds")} aria-label="The Grounds">
            ⌂<span className="tip">The Grounds & Hogsmeade</span>
          </button>
        </nav>
      )}

      {phase === "closed" && (
        <div className="invite" onClick={(e) => e.stopPropagation()}>
          <p>A blank, worn piece of parchment. Nothing on it at all…</p>
          <button className="btn" onClick={() => { setSpell(OATH); setTimeout(() => { speak(OATH, apiRef.current); setSpell(""); }, 500); }}>
            “I solemnly swear that I am up to no good.”
          </button>
          <span className="hint">or type the words yourself, below</span>
        </div>
      )}

      <div className="messages" aria-live="polite">
        {current && (
          <div className="msg" ref={msgRef} key={current.id} onClick={(e) => { e.stopPropagation(); setMessages((m) => m.slice(1)); }}>
            {splitChars(current.text)}
            {current.by && <span className="by">— Mr {current.by}</span>}
          </div>
        )}
      </div>

      {hover && isOpen && !peopleOpen && (
        <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
          {hover.title}
          {hover.sub && <em>{hover.sub}</em>}
        </div>
      )}

      {isOpen && cardChar && (
        <div className="card" onClick={(e) => e.stopPropagation()}>
          <button className="x" onClick={() => setCard(null)} aria-label="Close">×</button>
          <h3>{cardChar.name}</h3>
          <div className="role">{cardChar.def.role}</div>
          <p>{cardChar.def.desc}</p>
          <div className="where">Now: {sim.current!.where(cardChar).room} · {SECTION_BY_ID[cardChar.section].name}</div>
          <div className="row">
            <button className={`btn ${following === cardChar.id ? "on" : ""}`} onClick={() => toggleFollow(cardChar.id)}>{following === cardChar.id ? "Stop following" : "Follow the footprints"}</button>
            <button className="btn" onClick={() => findPerson(cardChar.id)}>Find</button>
          </div>
        </div>
      )}
      {isOpen && cardSpace && (
        <div className="card" onClick={(e) => e.stopPropagation()}>
          <button className="x" onClick={() => setCard(null)} aria-label="Close">×</button>
          <h3>{cardSpace.name}</h3>
          <div className="role">{sec.name}</div>
          {cardSpace.info && <p>{cardSpace.info}</p>}
          <div className="where">
            {(() => {
              const here = sim.current!.chars.filter((c) => c.section === section && sim.current!.where(c).room === cardSpace.name).map((c) => c.name);
              return here.length ? `Here now: ${here.join(", ")}` : "Nobody here at the moment.";
            })()}
          </div>
          <div className="row">
            <button className="btn" onClick={() => { const [x, y] = spaceCenter(cardSpace); animateFocus(view.current!, { x, y, zoom: section === "grounds" ? 2.6 : 3 }); }}>Look closer</button>
          </div>
        </div>
      )}

      <aside className="people" ref={peopleRef} onClick={(e) => e.stopPropagation()} aria-hidden={!peopleOpen}>
        <button className="close" onClick={() => setPeopleOpen(false)} aria-label="Close">×</button>
        <header>
          <h2>Who is where</h2>
          <p>Every person in the castle and its grounds. The map never lies.</p>
          <input placeholder="Search a name…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </header>
        <ul>
          {people.map(({ c, w }) => (
            <li key={c.id}>
              <button onClick={() => findPerson(c.id)}>
                <span className="nm">{c.name}</span>
                <span className="loc">{w.room}<br />{w.section.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="bottombar" onClick={(e) => e.stopPropagation()}>
        <div className="secrets" title="Easter eggs discovered">
          Secrets<br /><b>{found.size}</b> / {EGG_COUNT}
        </div>
        <form className="spell" onSubmit={(e) => { e.preventDefault(); cast(spell); }}>
          <label className="sr" htmlFor="spell">Speak to the map</label>
          <input id="spell" autoComplete="off" spellCheck={false} value={spell} onChange={(e) => setSpell(e.target.value)}
            placeholder={phase === "closed" ? "Swear the oath…" : "Speak to the map — a spell, a password, a name…"} disabled={busy || phase === "loading"} />
          <button className="btn" type="submit" disabled={busy}>Speak</button>
        </form>
        <button className="btn mm" disabled={!isOpen} onClick={() => speak("mischief managed", apiRef.current)}>Mischief Managed</button>
      </div>
      <span style={{ display: "none" }}>{occupied.size}</span>
    </div>
  );
}

function splitChars(t: string) {
  return t.split(/(\s+)/).map((w, i) =>
    /\s+/.test(w) ? w : (
      <span key={i} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
        {[...w].map((ch, j) => <span className="ch" key={j}>{ch}</span>)}
      </span>
    ),
  );
}

let focusTween: gsap.core.Tween | null = null;
export function cancelFocus() {
  focusTween?.kill();
  focusTween = null;
}

function animateFocus(v: MapView, f: { x: number; y: number; zoom: number }) {
  cancelFocus();
  const start = { z: v.zoom, x: v.pan.x, y: v.pan.y };
  // compute target pan for the focus point at the target zoom
  const saveZ = v.zoom, saveP = { ...v.pan };
  v.focus(f.x, f.y, f.zoom);
  const target = { z: v.zoom, x: v.pan.x, y: v.pan.y };
  v.zoom = saveZ;
  v.pan = saveP;
  const st = { ...start };
  // interpolate zoom geometrically so the motion feels even at every scale
  const lz0 = Math.log(start.z), lz1 = Math.log(target.z);
  const p = { t: 0 };
  focusTween = gsap.to(p, {
    t: 1, duration: 0.9, ease: "power2.inOut",
    onUpdate: () => {
      st.z = Math.exp(lz0 + (lz1 - lz0) * p.t);
      st.x = start.x + (target.x - start.x) * p.t;
      st.y = start.y + (target.y - start.y) * p.t;
      v.setView(st.z, { x: st.x, y: st.y });
    },
    onComplete: () => { focusTween = null; },
  });
}

void SECTIONS;
