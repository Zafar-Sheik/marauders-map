/**
 * Colours sampled from the prop map seen on screen and in photographs of the
 * printed replicas: a warm, yellowed parchment that browns toward the edges and
 * creases, with iron-gall style brown-black ink that fades to sepia.
 */
export const INK = "#38220f";
export const INK_SOFT = "#5c3b1e";
export const INK_FADED = "rgba(74, 46, 22, 0.55)";
export const INK_WASH = "rgba(92, 58, 26, 0.07)";
export const PARCH_LIGHT = "#efdfb6";
export const PARCH = "#e3cc9a";
export const PARCH_MID = "#d4b47d";
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
