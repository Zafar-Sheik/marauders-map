export type Pt = [number, number];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SpaceKind =
  | "room"
  | "corridor"
  | "stairs"
  | "open"
  | "tower"
  | "hidden"
  | "water"
  | "forest"
  | "field"
  | "building"
  | "castle"
  | "void";

export type Decor =
  | "greathall"
  | "library"
  | "restricted"
  | "classroom"
  | "dorm"
  | "commonroom"
  | "bathroom"
  | "kitchen"
  | "grandstair"
  | "fountain"
  | "trophies"
  | "hospital"
  | "potions"
  | "office"
  | "pitch"
  | "greenhouse"
  | "hut"
  | "telescope"
  | "owlery"
  | "divination"
  | "headmaster"
  | "trapdoor"
  | "armour"
  | "barrels"
  | "lakewindows"
  | "pumpkins";

export interface Space {
  id: string;
  name: string;
  kind: SpaceKind;
  rect?: Rect;
  circle?: { cx: number; cy: number; r: number };
  poly?: Pt[];
  doors?: Pt[];
  info?: string;
  /** label placement override; false hides */
  label?: false | { x?: number; y?: number; size?: number; rot?: number; lines?: string[] };
  note?: string;
  decor?: Decor;
  /** only drawn once an easter egg flag is set */
  requires?: string;
  /** walkable even though not normally (eg forest) */
  walkable?: boolean;
}

export type PortalKind = "stairs" | "door" | "passage" | "ladder" | "trapdoor" | "portrait";

export interface Portal {
  id: string;
  name: string;
  x: number;
  y: number;
  to: { section: string; portal: string };
  kind: PortalKind;
  /** characters may only use if flag set or char allowed */
  secret?: boolean;
  /** draw arrow label */
  hint?: string;
}

export interface Hotspot {
  id: string;
  x: number;
  y: number;
  r: number;
  name: string;
  egg: string;
  /** small inked glyph drawn at the location */
  glyph?: "statue" | "mirror" | "portrait" | "tapestry" | "gargoyle" | "pear" | "sink" | "knot" | "barrels" | "cabinet" | "eagle" | "squid" | "spider" | "writing" | "egg" | "hippogriff" | "stone" | "boar";
  hidden?: boolean;
}

export interface MapText {
  x: number;
  y: number;
  text: string;
  size?: number;
  rot?: number;
  italic?: boolean;
  requires?: string;
  align?: CanvasTextAlign;
}

export interface Passage {
  id: string;
  name: string;
  pts: Pt[];
  note?: string;
  requires?: string;
  caved?: boolean;
}

export interface Section {
  id: string;
  name: string;
  short: string;
  title: string;
  subtitle: string;
  frame: { w: number; h: number };
  cols: number;
  scaleBar: number;
  navRes: number;
  /** if true, everything is walkable unless a space blocks it */
  openGround?: boolean;
  /** multiplier on character walking speed for this section */
  pace: number;
  spaces: Space[];
  portals: Portal[];
  hotspots: Hotspot[];
  texts: MapText[];
  passages: Passage[];
  outline?: Pt[];
  towers?: { cx: number; cy: number; r: number; name?: string }[];
}
