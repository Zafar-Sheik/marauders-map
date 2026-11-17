import type { Section } from "./types";

/** Physical layout of a section's folding sheet, in 3D units. */
export const PANEL_W = 2.4;
export const CENTER_H = 3.2;
export const FLAP_H = 1.6;
export const SHEET_H = CENTER_H + FLAP_H * 2;

export function sheetWorldSize(sec: Section) {
  return { w: sec.cols * PANEL_W, h: SHEET_H };
}

/** pixel size of the section's master ink canvas */
export function sheetPixels(sec: Section) {
  const { w, h } = sheetWorldSize(sec);
  const aspect = w / h;
  const maxSide = 4096;
  if (aspect >= 1) return { w: maxSide, h: Math.round(maxSide / aspect) };
  return { w: Math.round(maxSide * aspect), h: maxSide };
}

export function pxPerMetre(sec: Section) {
  return sheetPixels(sec).w / sec.frame.w;
}
