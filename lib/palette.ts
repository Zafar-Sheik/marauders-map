/**
 * Light, warm cream parchment that browns toward the edges and creases, with
 * near-black brown ink fading to sepia — the general look of the on-screen map.
 */
export const INK = "#2e1b0c";
export const INK_SOFT = "#5c3b1e";
export const INK_FADED = "rgba(74, 46, 22, 0.55)";
export const INK_WASH = "rgba(92, 58, 26, 0.07)";
export const PARCH_LIGHT = "#f3e6c3";
export const PARCH = "#ead7a9";
export const PARCH_MID = "#dcc08a";
export const PARCH_DARK = "#a97f47";
export const PARCH_BURN = "#6e4a24";
export const WATER_INK = "rgba(56, 34, 15, 0.42)";

export const FONTS = {
  sc: "'IM Fell English SC', Georgia, serif",
  italic: "'IM Fell English', Georgia, serif",
  script: "'Pinyon Script', 'IM Fell English', cursive",
  hand: "'Henny Penny', 'IM Fell English', serif",
};

export function setFonts(f: Partial<typeof FONTS>) {
  Object.assign(FONTS, f);
}
