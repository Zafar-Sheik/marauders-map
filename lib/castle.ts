/*
 * Hogwarts, as drawn by Messrs Moony, Wormtail, Padfoot & Prongs.
 *
 * All coordinates are in metres. Every castle floor shares the same 360 x 240 m
 * frame so that the floors stack on top of each other exactly (the Grand
 * Staircase, the corridors and the towers line up from floor to floor). The
 * grounds use a 1500 x 800 m frame, the tower tops a 180 x 160 m frame.
 *
 * Room placement follows the books wherever the books commit to a floor
 * (Trophy Room & one-eyed witch: third floor; Library & the mirror passage:
 * fourth; Prefects' bathroom & Boris the Bewildered: fifth; Room of
 * Requirement & Fat Lady: seventh; Potions & Slytherin: dungeons; kitchens
 * under the Great Hall; Hufflepuff by the kitchens; Ravenclaw: west tower;
 * Divination: North Tower; etc). Where canon is silent the layout is ours.
 */
import type { Hotspot, MapText, Passage, Portal, Section, Space, Pt } from "./types";

const CASTLE_OUTLINE: Pt[] = [
  [44, 34], [92, 34], [92, 46], [170, 46], [170, 40], [200, 40], [200, 46], [282, 46],
  [282, 30], [338, 30], [338, 112], [326, 112], [326, 190], [306, 190], [306, 214],
  [256, 214], [256, 200], [116, 200], [116, 214], [44, 214], [44, 150], [14, 150],
  [14, 96], [44, 96],
];

const CASTLE_TOWERS = [
  { cx: 52, cy: 40, r: 13, name: "Ravenclaw Tower (above)" },
  { cx: 318, cy: 34, r: 14, name: "Gryffindor Tower (above)" },
  { cx: 184, cy: 34, r: 9, name: "North Tower" },
  { cx: 316, cy: 202, r: 12, name: "Astronomy Tower" },
  { cx: 52, cy: 208, r: 11, name: "West Tower" },
];

function skeleton(withStair = true): Space[] {
  const s: Space[] = [
    { id: "main", name: "Main Corridor", kind: "corridor", rect: { x: 60, y: 100, w: 240, h: 10 }, label: { x: 230, y: 105.6, size: 2.6 } },
    { id: "east", name: "East Corridor", kind: "corridor", rect: { x: 290, y: 40, w: 10, h: 160 }, label: { x: 295, y: 145, size: 2.6, rot: -Math.PI / 2 } },
    { id: "west", name: "West Corridor", kind: "corridor", rect: { x: 60, y: 100, w: 10, h: 100 }, label: { x: 65, y: 160, size: 2.6, rot: -Math.PI / 2 } },
    { id: "spur", name: "North Passage", kind: "corridor", rect: { x: 180, y: 50, w: 8, h: 60 }, label: false },
    { id: "south", name: "South Gallery", kind: "corridor", rect: { x: 60, y: 192, w: 240, h: 8 }, label: { x: 160, y: 196.4, size: 2.4 } },
  ];
  if (withStair)
    s.push({
      id: "grandstair",
      name: "The Grand Staircase",
      kind: "stairs",
      rect: { x: 96, y: 60, w: 28, h: 40 },
      doors: [[110, 100]],
      decor: "grandstair",
      info: "A shaft of moving staircases that swing between landings when they feel like it. Several have a trick step you must remember to jump.",
      note: "mind the trick step",
    });
  return s;
}

function grandStairPortals(n: number): Portal[] {
  const p: Portal[] = [];
  if (n < 7) p.push({ id: "gs-up", name: "Grand Staircase (up)", x: 104, y: 68, kind: "stairs", to: { section: `f${n + 1}`, portal: "gs-down" }, hint: "up" });
  if (n > 0) p.push({ id: "gs-down", name: "Grand Staircase (down)", x: 116, y: 68, kind: "stairs", to: { section: `f${n - 1}`, portal: "gs-up" }, hint: "down" });
  return p;
}

const ORD = ["Ground", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh"];

const FILL: Record<number, [string, string, string, string, string]> = {
  0: ["", "", "Cloakroom", "Caretaker's Store", "Gamekeeper's Store"],
  1: ["Classroom 1C", "Prefects' Room", "Classroom 1D", "Linen Store", "Portrait Hall"],
  2: ["Classroom 2E", "Muggle Artefacts Store", "Classroom 2F", "Broom Cupboard", "Tapestry Hall"],
  3: ["Classroom 3C", "Broom Cupboard", "Classroom 3D", "Defence Store", "Statue Gallery"],
  4: ["Study Alcoves", "Classroom 4E", "Classroom 4F", "Book Store", "Map Room"],
  5: ["Classroom 5C", "Store Room", "Classroom 5D", "Prefects' Store", "Long Gallery"],
  6: ["Classroom 6B", "Old Classroom", "Classroom 6C", "Linen Store", "Tapestry Hall"],
  7: ["Classroom 7C", "Linen Store", "Classroom 7D", "Store Room", "Portrait Gallery (West)"],
};

function fillers(n: number): Space[] {
  const [s1, s3, e1, e2, nw] = FILL[n];
  const out: Space[] = [];
  const room = (id: string, name: string, x: number, y: number, w: number, h: number, door: Pt, decor?: Space["decor"]): Space =>
    ({ id, name, kind: "room", rect: { x, y, w, h }, doors: [door], decor, label: { size: 2, lines: name.toUpperCase().split(" ").length > 2 ? [name.toUpperCase().split(" ").slice(0, 2).join(" "), name.toUpperCase().split(" ").slice(2).join(" ")] : [name.toUpperCase()] } });
  if (s1) out.push(room("s1", s1, 120, 162, 70, 30, [155, 192], s1.startsWith("Classroom") ? "classroom" : undefined));
  if (s3) out.push(room("s3", s3, 262, 158, 28, 34, [276, 192]));
  if (e1) out.push(room("e1", e1, 300, 120, 30, 30, [300, 135], e1.startsWith("Classroom") ? "classroom" : undefined));
  if (e2) out.push(room("e2", e2, 300, 160, 26, 26, [300, 172]));
  if (nw) out.push(room("nw", nw, 20, 140, 40, 30, [60, 155], "armour"));
  if (n > 0) {
    out.push({ id: "tvoid", name: "Transfiguration Courtyard (below)", kind: "void", rect: { x: 70, y: 130, w: 46, h: 50 }, label: { size: 1.9, lines: ["OPEN TO THE SKY", "courtyard below"] } });
    out.push({ id: "cvoid", name: "Clock Tower Courtyard (below)", kind: "void", rect: { x: 200, y: 162, w: 56, h: 30 }, label: { size: 1.9, lines: ["OPEN TO THE SKY", "courtyard below"] } });
  }
  return out;
}

function floor(
  n: number,
  rooms: Space[],
  portals: Portal[] = [],
  hotspots: Hotspot[] = [],
  texts: MapText[] = [],
  passages: Passage[] = [],
): Section {
  return {
    id: `f${n}`,
    name: `${ORD[n]} Floor`,
    short: n === 0 ? "G" : `${n}`,
    title: `The ${ORD[n]} Floor`,
    subtitle: "Hogwarts School of Witchcraft and Wizardry",
    frame: { w: 360, h: 240 },
    cols: 4,
    scaleBar: 20,
    navRes: 1,
    pace: 1,
    spaces: [...skeleton(), ...fillers(n), ...rooms],
    portals: [...grandStairPortals(n), ...portals],
    hotspots,
    texts,
    passages,
    outline: CASTLE_OUTLINE,
    towers: CASTLE_TOWERS,
  };
}

/* ------------------------------------------------------------------ */
/* Ground floor                                                        */
/* ------------------------------------------------------------------ */
const groundFloor = floor(
  0,
  [
    { id: "entrance", name: "Entrance Hall", kind: "room", rect: { x: 150, y: 110, w: 36, h: 40 }, doors: [[167, 110], [186, 128], [167, 150]], info: "Stone-flagged and torch-lit, with the marble staircase rising from it. Four giant hourglasses keep the house points in gemstones.", label: { x: 168, y: 131, size: 3.2 } },
    { id: "greathall", name: "The Great Hall", kind: "room", rect: { x: 186, y: 112, w: 70, h: 30 }, doors: [[186, 128], [256, 126]], decor: "greathall", info: "Where the whole school eats. Its ceiling is charmed to mirror the weather outside; the teachers sit at a table across the far end.", label: { x: 221, y: 115.2, size: 4 } },
    { id: "antechamber", name: "Antechamber", kind: "room", rect: { x: 256, y: 116, w: 14, h: 20 }, doors: [[256, 126]], info: "The small chamber off the Great Hall where the Triwizard champions were gathered.", label: { size: 2, lines: ["ANTE-", "CHAMBER"] } },
    { id: "classroom11", name: "Classroom Eleven", kind: "room", rect: { x: 118, y: 110, w: 28, h: 24 }, doors: [[132, 110]], decor: "classroom", info: "Enchanted by Dumbledore to resemble a forest glade so that Firenze the centaur could teach Divination indoors.", note: "Firenze's glade" },
    { id: "staffroom", name: "Staff Room", kind: "room", rect: { x: 200, y: 66, w: 34, h: 34 }, doors: [[217, 100]], decor: "office", info: "A long panelled room full of mismatched dark wooden chairs, and an old wardrobe full of teachers' robes. A boggart once lived in it." },
    { id: "broom", name: "Broom Cupboard", kind: "room", rect: { x: 140, y: 86, w: 12, h: 14 }, doors: [[146, 100]], label: { size: 1.8, lines: ["BROOM", "CUPBD."] }, info: "Several of them, actually. Good for hiding in." },
    { id: "tcourt", name: "Transfiguration Courtyard", kind: "open", rect: { x: 70, y: 130, w: 46, h: 50 }, doors: [[70, 155]], decor: "fountain", label: { x: 93, y: 172, size: 2.6, lines: ["TRANSFIGURATION", "COURTYARD"] } },
    { id: "clockcourt", name: "Clock Tower Courtyard", kind: "open", rect: { x: 196, y: 148, w: 60, h: 44 }, doors: [[256, 164]], decor: "fountain", label: { x: 226, y: 184, size: 2.6, lines: ["CLOCK TOWER", "COURTYARD"] } },
    { id: "clockpass", name: "Clock Tower Passage", kind: "corridor", rect: { x: 256, y: 160, w: 34, h: 8 }, doors: [[290, 164], [256, 164]], label: false },
    { id: "filch", name: "Argus Filch's Office", kind: "room", rect: { x: 300, y: 60, w: 30, h: 30 }, doors: [[300, 75]], decor: "office", info: "Cramped, gloomy and full of filing cabinets recording every detention ever handed out. One drawer holds the things Filch considers far too dangerous to return.", label: { size: 2.4, lines: ["FILCH'S", "OFFICE"] } },
  ],
  [
    { id: "front", name: "Oak Front Doors", x: 167, y: 146, kind: "door", to: { section: "grounds", portal: "front" }, hint: "to the grounds" },
    { id: "marble-up", name: "Marble Staircase", x: 156, y: 116, kind: "stairs", to: { section: "f1", portal: "marble" }, hint: "up" },
    { id: "dungeon", name: "Stone Steps to the Dungeons", x: 154, y: 144, kind: "stairs", to: { section: "dungeons", portal: "stairs" }, hint: "down" },
    { id: "kitchen", name: "Stairs to the Kitchens", x: 182, y: 144, kind: "stairs", to: { section: "dungeons", portal: "kstairs" }, hint: "down" },
    { id: "bridge", name: "Wooden Bridge", x: 226, y: 190, kind: "door", to: { section: "grounds", portal: "bridge" }, hint: "the bridge" },
    { id: "boathouse", name: "Steps to the Boathouse", x: 295, y: 44, kind: "stairs", to: { section: "grounds", portal: "boathouse" }, hint: "boathouse" },
    { id: "west-stair", name: "West Tower Stair", x: 65, y: 196, kind: "stairs", to: { section: "towers", portal: "owlery" }, hint: "owlery" },
  ],
  [
    { id: "hourglass", x: 180, y: 122, r: 4, name: "House-Point Hourglasses", egg: "hourglass", glyph: "egg" },
    { id: "cabinet", x: 322, y: 66, r: 4, name: "Filing cabinet: 'Confiscated and Highly Dangerous'", egg: "cabinet", glyph: "cabinet" },
  ],
  [{ x: 221, y: 141, text: "staff table at the top", size: 1.8, italic: true }],
);

/* ------------------------------------------------------------------ */
/* Dungeons                                                            */
/* ------------------------------------------------------------------ */
const dungeons: Section = {
  id: "dungeons",
  name: "The Dungeons",
  short: "D",
  title: "The Dungeons",
  subtitle: "Beneath the Entrance Hall, the Great Hall and the Lake",
  frame: { w: 360, h: 240 },
  cols: 4,
  scaleBar: 20,
  navRes: 1,
  pace: 1,
  outline: CASTLE_OUTLINE,
  towers: [],
  spaces: [
    { id: "dcorr", name: "Dungeon Corridor", kind: "corridor", rect: { x: 80, y: 100, w: 200, h: 10 }, label: { x: 250, y: 105.6, size: 2.6 } },
    { id: "slyspur", name: "Slytherin Passage", kind: "corridor", rect: { x: 100, y: 100, w: 8, h: 50 }, label: false },
    { id: "potions", name: "Potions Classroom", kind: "room", rect: { x: 130, y: 64, w: 40, h: 36 }, doors: [[150, 100]], decor: "potions", info: "Chilly, dim and lined with specimen jars. Cauldrons bubble; points are lost." },
    { id: "store", name: "Potions Store Cupboard", kind: "room", rect: { x: 116, y: 78, w: 14, h: 22 }, doors: [[123, 100]], label: { size: 1.7, lines: ["PRIVATE", "STORES"] }, info: "Boomslang skin, bicorn horn, gillyweed... Somebody keeps helping themselves." },
    { id: "snape", name: "Professor Snape's Office", kind: "room", rect: { x: 170, y: 74, w: 18, h: 26 }, doors: [[179, 100]], decor: "office", label: { size: 2, lines: ["SNAPE'S", "OFFICE"] }, info: "Strictly private. The map has been known to show someone in here who is most definitely not Professor Snape." },
    { id: "dungeon5", name: "Dungeon Five", kind: "room", rect: { x: 200, y: 64, w: 40, h: 36 }, doors: [[220, 100]], info: "One of the larger dungeons, hung with black velvet for Nearly Headless Nick's five-hundredth deathday party.", note: "deathday parties held here" },
    { id: "kitchens", name: "The Kitchens", kind: "room", rect: { x: 186, y: 110, w: 70, h: 32 }, doors: [[206, 110]], decor: "kitchen", info: "Right under the Great Hall. Every meal is cooked here by the castle's house-elves and sent up through the floor to the tables above." },
    { id: "huff", name: "Hufflepuff Common Room", kind: "room", rect: { x: 262, y: 112, w: 36, h: 32 }, doors: [[270, 110]], decor: "commonroom", info: "Snug, round and full of plants, near the kitchens. Tap the right barrel in the right rhythm — get it wrong and you'll smell of vinegar for a week.", label: { size: 2.4, lines: ["HUFFLEPUFF", "COMMON ROOM"] } },
    { id: "slyth", name: "Slytherin Common Room", kind: "room", rect: { x: 70, y: 150, w: 62, h: 36 }, doors: [[104, 150]], decor: "lakewindows", info: "Deep under the lake, so the light comes in green and the windows look out on whatever is swimming past.", label: { x: 101, y: 166, size: 3, lines: ["SLYTHERIN", "COMMON ROOM"] }, note: "beneath the lake" },
    { id: "chamber", name: "The Chamber of Secrets", kind: "hidden", rect: { x: 170, y: 168, w: 90, h: 32 }, requires: "chamber", info: "Not on the map. Not on any map. Only a Parselmouth may open it.", label: { size: 3, lines: ["THE CHAMBER", "OF SECRETS"] } },
  ],
  portals: [
    { id: "stairs", name: "Steps up to the Entrance Hall", x: 152, y: 104, kind: "stairs", to: { section: "f0", portal: "dungeon" }, hint: "up" },
    { id: "kstairs", name: "Stairs up to the Entrance Hall", x: 184, y: 104, kind: "stairs", to: { section: "f0", portal: "kitchen" }, hint: "up" },
  ],
  hotspots: [
    { id: "pear", x: 206, y: 106, r: 3, name: "Painting of a Bowl of Fruit", egg: "pear", glyph: "pear" },
    { id: "barrels", x: 276, y: 106, r: 3, name: "A Stack of Barrels", egg: "barrels", glyph: "barrels" },
  ],
  texts: [
    { x: 101, y: 194, text: "~ the Black Lake above ~", size: 2, italic: true },
    { x: 206, y: 102, text: "tickle the pear", size: 1.5, italic: true, requires: "pear" },
  ],
  passages: [],
};

/* ------------------------------------------------------------------ */
/* Upper floors                                                        */
/* ------------------------------------------------------------------ */
const f1 = floor(
  1,
  [
    { id: "hospital", name: "Hospital Wing", kind: "room", rect: { x: 300, y: 46, w: 44, h: 44 }, doors: [[300, 68]], decor: "hospital", info: "Madam Pomfrey can mend bones in seconds. Regrowing them takes all night, and Skele-Gro tastes foul." },
    { id: "pomfrey", name: "Madam Pomfrey's Office", kind: "room", rect: { x: 300, y: 92, w: 22, h: 14 }, doors: [[300, 99]], label: { size: 1.6, lines: ["POMFREY'S", "OFFICE"] } },
    { id: "transfig", name: "Transfiguration (1B)", kind: "room", rect: { x: 126, y: 62, w: 48, h: 38 }, doors: [[150, 100]], decor: "classroom", info: "Professor McGonagall's classroom. Late arrivals may find a tabby cat sitting on the desk watching the door.", label: { size: 2.8, lines: ["TRANSFIGURATION", "CLASSROOM 1B"] } },
    { id: "mcg", name: "Professor McGonagall's Office", kind: "room", rect: { x: 190, y: 72, w: 26, h: 28 }, doors: [[203, 100]], decor: "office", label: { size: 2, lines: ["McGONAGALL'S", "OFFICE"] }, info: "Tartan biscuit tins of Ginger Newts, and a crackling fire." },
    { id: "hom", name: "History of Magic", kind: "room", rect: { x: 220, y: 62, w: 46, h: 38 }, doors: [[243, 100]], decor: "classroom", info: "Professor Binns fell asleep in front of the staff-room fire and got up the next morning to teach, leaving his body behind.", label: { size: 2.6, lines: ["HISTORY OF", "MAGIC"] } },
    { id: "muggle", name: "Muggle Studies", kind: "room", rect: { x: 190, y: 110, w: 50, h: 30 }, doors: [[215, 110]], decor: "classroom", label: { size: 2.6, lines: ["MUGGLE", "STUDIES"] } },
  ],
  [{ id: "marble", name: "Top of the Marble Staircase", x: 160, y: 104, kind: "stairs", to: { section: "f0", portal: "marble-up" }, hint: "down" }],
  [{ id: "gregory", x: 86, y: 104, r: 3, name: "Statue of Gregory the Smarmy", egg: "gregory", glyph: "statue" }],
);

const f2 = floor(
  2,
  [
    { id: "myrtle", name: "Girls' Lavatory", kind: "room", rect: { x: 130, y: 110, w: 30, h: 24 }, doors: [[145, 110]], decor: "bathroom", info: "Out of order. Haunted by Moaning Myrtle, who died here in 1943. One of the taps has a tiny snake scratched on it.", label: { size: 2.2, lines: ["GIRLS'", "LAVATORY"] }, note: "out of order" },
    { id: "runes", name: "Study of Ancient Runes", kind: "room", rect: { x: 126, y: 62, w: 48, h: 38 }, doors: [[150, 100]], decor: "classroom", label: { size: 2.6, lines: ["ANCIENT", "RUNES"] } },
    { id: "lockhart", name: "Defence Professor's Office (1992)", kind: "room", rect: { x: 200, y: 62, w: 40, h: 38 }, doors: [[220, 100]], decor: "office", label: { size: 2.2, lines: ["LOCKHART'S", "OLD OFFICE"] }, info: "Every wall once covered in pictures of its owner, all of them smiling." },
    { id: "arith", name: "Arithmancy", kind: "room", rect: { x: 180, y: 110, w: 46, h: 30 }, doors: [[203, 110]], decor: "classroom" },
  ],
  [{ id: "gargoyle", name: "Stone Gargoyle", x: 295, y: 120, kind: "door", to: { section: "towers", portal: "gargoyle" }, hint: "headmaster" }],
  [
    { id: "sink", x: 152, y: 128, r: 3, name: "The Sinks", egg: "chamber", glyph: "sink" },
    { id: "writing", x: 172, y: 105, r: 4, name: "Writing on the Wall", egg: "writing", glyph: "writing" },
    { id: "gargoyleegg", x: 300, y: 120, r: 3, name: "Stone Gargoyle", egg: "sherbet", glyph: "gargoyle" },
  ],
);

const f3 = floor(
  3,
  [
    { id: "trophy", name: "Trophy Room", kind: "room", rect: { x: 126, y: 62, w: 48, h: 38 }, doors: [[150, 100]], decor: "trophies", info: "Glass cases of cups, shields and medals. One fifty-year-old award for Special Services to the School is worth a closer look.", label: { size: 3 } },
    { id: "charms", name: "Charms Classroom", kind: "room", rect: { x: 190, y: 62, w: 40, h: 38 }, doors: [[210, 100]], decor: "classroom", info: "Professor Flitwick teaches standing on a pile of books. Wingardium Leviosa — swish and flick.", label: { size: 2.6, lines: ["CHARMS", "CLASSROOM"] } },
    { id: "dada", name: "Defence Against the Dark Arts", kind: "room", rect: { x: 234, y: 62, w: 52, h: 38 }, doors: [[260, 100]], decor: "classroom", info: "No teacher has lasted more than a year in this post. Nobody likes to say why.", label: { size: 2.4, lines: ["DEFENCE AGAINST", "THE DARK ARTS"] } },
    { id: "lupin", name: "Defence Professor's Office", kind: "room", rect: { x: 300, y: 60, w: 26, h: 24 }, doors: [[300, 72]], decor: "office", label: { size: 1.8, lines: ["DEFENCE", "OFFICE"] }, info: "A grindylow in a tank in the corner. Tea, but no tea leaves worth reading." },
    { id: "armour", name: "Armour Gallery", kind: "room", rect: { x: 126, y: 110, w: 50, h: 18 }, doors: [[150, 110]], decor: "armour", label: { size: 2.4 } },
    { id: "forbidden", name: "Third-Floor Corridor", kind: "corridor", rect: { x: 220, y: 110, w: 70, h: 12 }, doors: [[255, 110], [290, 116]], label: { x: 255, y: 116.6, size: 2.2, lines: ["THE RIGHT-HAND CORRIDOR — OUT OF BOUNDS"] }, info: "Out of bounds to everyone who does not wish to die a most painful death (1991–92)." },
    { id: "fluffy", name: "Chamber of the Three-Headed Dog", kind: "room", rect: { x: 238, y: 124, w: 34, h: 28 }, doors: [[255, 124]], decor: "trapdoor", label: { size: 2, lines: ["A LOCKED", "DOOR"] }, info: "Behind the locked door: an enormous three-headed dog standing on a trapdoor. Play him a little music." },
  ],
  [{ id: "witch", name: "Hump of the One-Eyed Witch", x: 112, y: 104.5, kind: "passage", secret: true, to: { section: "grounds", portal: "honeydukes" }, hint: "passage" }],
  [
    { id: "witchegg", x: 112, y: 104, r: 3.2, name: "Statue of the One-Eyed Witch", egg: "dissendium", glyph: "statue" },
    { id: "fluffyegg", x: 255, y: 140, r: 4, name: "Trapdoor", egg: "fluffy", glyph: "egg" },
  ],
);

const f4 = floor(
  4,
  [
    { id: "library", name: "The Library", kind: "room", rect: { x: 124, y: 110, w: 90, h: 50 }, doors: [[150, 110]], decor: "library", info: "Row upon row of shelves. Madam Pince watches every page you turn.", label: { x: 169, y: 152, size: 4 } },
    { id: "restricted", name: "The Restricted Section", kind: "room", rect: { x: 214, y: 118, w: 32, h: 38 }, doors: [[214, 137]], decor: "restricted", info: "Behind a rope: books that need a teacher's signed note. Some of them object to being read.", label: { size: 2.1, lines: ["RESTRICTED", "SECTION"] } },
    { id: "erised", name: "Disused Classroom", kind: "room", rect: { x: 200, y: 62, w: 36, h: 38 }, doors: [[218, 100]], info: "An unused classroom with the furniture stacked aside — and a very tall, very old mirror that does not show you your reflection.", label: { size: 2.2, lines: ["DISUSED", "CLASSROOM"] } },
    { id: "c4b", name: "Classroom 4B", kind: "room", rect: { x: 126, y: 62, w: 48, h: 38 }, doors: [[150, 100]], decor: "classroom" },
  ],
  [],
  [
    { id: "erisedegg", x: 218, y: 74, r: 4, name: "A Mirror on Clawed Feet", egg: "erised", glyph: "mirror" },
    { id: "mirrorpass", x: 84, y: 104, r: 3, name: "A Large Mirror", egg: "mirror", glyph: "mirror" },
  ],
  [{ x: 169, y: 114.5, text: "silence!  — I. Pince", size: 1.7, italic: true }],
);

const f5 = floor(
  5,
  [
    { id: "prefects", name: "Prefects' Bathroom", kind: "room", rect: { x: 214, y: 62, w: 40, h: 38 }, doors: [[234, 100]], decor: "bathroom", info: "Marble, candle-lit and enormous, with a bath like a small pool and dozens of taps that each run a different bubble. Fourth door left of Boris the Bewildered.", label: { size: 2.4, lines: ["PREFECTS'", "BATHROOM"] } },
    { id: "c5b", name: "Classroom 5B", kind: "room", rect: { x: 126, y: 62, w: 48, h: 38 }, doors: [[150, 100]], decor: "classroom" },
    { id: "c5c", name: "Old Study", kind: "room", rect: { x: 150, y: 110, w: 50, h: 28 }, doors: [[175, 110]], decor: "office" },
  ],
  [],
  [{ id: "boris", x: 266, y: 104, r: 3, name: "Statue of Boris the Bewildered", egg: "boris", glyph: "statue" }],
  [{ x: 234, y: 66, text: "password: pine fresh", size: 1.7, italic: true, requires: "pinefresh" }],
);

const f6 = floor(
  6,
  [
    { id: "boysbath", name: "Boys' Bathroom", kind: "room", rect: { x: 130, y: 110, w: 30, h: 24 }, doors: [[145, 110]], decor: "bathroom", label: { size: 2.2, lines: ["BOYS'", "BATHROOM"] }, info: "Where Myrtle sometimes drifts when she is lonely." },
    { id: "slug", name: "Professor Slughorn's Study", kind: "room", rect: { x: 190, y: 62, w: 44, h: 38 }, doors: [[212, 100]], decor: "office", label: { size: 2.2, lines: ["SLUGHORN'S", "STUDY"] }, info: "Comfortable chairs, good sweets, and a shelf of photographs of former favourites." },
    { id: "c6a", name: "Classroom 6A", kind: "room", rect: { x: 126, y: 62, w: 48, h: 38 }, doors: [[150, 100]], decor: "classroom" },
  ],
);

const f7 = floor(
  7,
  [
    { id: "ror", name: "Room of Requirement", kind: "hidden", rect: { x: 170, y: 62, w: 50, h: 38 }, requires: "ror", info: "It is not on the map. It never was. A room that only appears when a person is in great need — and it becomes whatever they need.", label: { size: 2.6, lines: ["ROOM OF", "REQUIREMENT"] } },
    { id: "flitwick", name: "Professor Flitwick's Office", kind: "room", rect: { x: 20, y: 110, w: 40, h: 24 }, doors: [[60, 122]], decor: "office", label: { size: 2, lines: ["FLITWICK'S", "OFFICE"] }, info: "Thirteenth window from the right of the West Tower — where a certain escaped prisoner was once locked up." },
    { id: "c7a", name: "Classroom 7A", kind: "room", rect: { x: 126, y: 62, w: 40, h: 38 }, doors: [[146, 100]], decor: "classroom" },
    { id: "c7b", name: "Seventh-Floor Gallery", kind: "room", rect: { x: 226, y: 62, w: 56, h: 38 }, doors: [[254, 100]], decor: "armour", label: { size: 2.2, lines: ["PORTRAIT", "GALLERY"] } },
  ],
  [
    { id: "fatlady", name: "Portrait of the Fat Lady", x: 295, y: 46, kind: "portrait", to: { section: "towers", portal: "fatlady" }, hint: "Gryffindor" },
    { id: "ravenclaw", name: "Ravenclaw Tower Stair", x: 64, y: 196, kind: "stairs", to: { section: "towers", portal: "ravenclaw" }, hint: "Ravenclaw" },
    { id: "ladder", name: "Silver Ladder & Trapdoor", x: 184, y: 54, kind: "ladder", to: { section: "towers", portal: "northtower" }, hint: "Divination" },
    { id: "astro", name: "Astronomy Tower Stair", x: 295, y: 176, kind: "stairs", to: { section: "towers", portal: "astronomy" }, hint: "Astronomy" },
  ],
  [
    { id: "tapestry", x: 195, y: 109, r: 4, name: "Tapestry of Barnabas the Barmy", egg: "ror", glyph: "tapestry" },
    { id: "fatladyegg", x: 300, y: 46, r: 3, name: "The Fat Lady", egg: "fatlady", glyph: "portrait" },
  ],
  [{ x: 195, y: 113, text: "Barnabas the Barmy teaching trolls ballet", size: 1.5, italic: true }],
);

/* ------------------------------------------------------------------ */
/* Tower tops                                                          */
/* ------------------------------------------------------------------ */
const towers: Section = {
  id: "towers",
  name: "The Towers",
  short: "T",
  title: "The Towers",
  subtitle: "Common rooms, dormitories & the highest places in the castle",
  frame: { w: 180, h: 160 },
  cols: 3,
  scaleBar: 10,
  navRes: 0.5,
  pace: 0.8,
  spaces: [
    { id: "gcommon", name: "Gryffindor Common Room", kind: "tower", circle: { cx: 36, cy: 46, r: 18 }, decor: "commonroom", info: "Red and gold, round and warm, with a crackling fire. Reached through the portrait hole. The password changes often; Neville writes it down.", label: { x: 36, y: 38, size: 2.4, lines: ["GRYFFINDOR", "COMMON ROOM"] } },
    { id: "gstair", name: "Boys' Staircase", kind: "corridor", rect: { x: 40, y: 26, w: 42, h: 6 }, label: false },
    { id: "gboys", name: "Boys' Dormitory", kind: "tower", circle: { cx: 90, cy: 29, r: 11 }, decor: "dorm", info: "Curtained four-poster beds. A family pet rat has been sleeping here for an unusually long time.", label: { size: 1.8, lines: ["BOYS'", "DORMITORY"] } },
    { id: "gstair2", name: "Girls' Staircase", kind: "corridor", rect: { x: 40, y: 60, w: 42, h: 6 }, label: false },
    { id: "ggirls", name: "Girls' Dormitory", kind: "tower", circle: { cx: 90, cy: 63, r: 11 }, decor: "dorm", info: "The founders thought boys less trustworthy than girls. The staircase agrees.", label: { size: 1.8, lines: ["GIRLS'", "DORMITORY"] } },
    { id: "head", name: "Headmaster's Office", kind: "tower", circle: { cx: 146, cy: 46, r: 16 }, decor: "headmaster", info: "Round, crowded with whirring silver instruments and the portraits of past heads, who pretend to be asleep. A phoenix keeps watch by the desk.", label: { x: 146, y: 36, size: 2.2, lines: ["HEADMASTER'S", "OFFICE"] } },
    { id: "rav", name: "Ravenclaw Common Room", kind: "tower", circle: { cx: 32, cy: 118, r: 17 }, decor: "commonroom", info: "Blue and bronze, high and bright, with a starry domed ceiling. No password here — the door knocker asks you a question instead.", label: { x: 32, y: 112, size: 2.2, lines: ["RAVENCLAW", "COMMON ROOM"] } },
    { id: "div", name: "Divination Classroom", kind: "tower", circle: { cx: 76, cy: 118, r: 14 }, decor: "divination", info: "Reached by a ladder through a trapdoor. Hot, dim, heavily perfumed, crammed with little round tables and teacups.", label: { x: 76, y: 110, size: 2, lines: ["DIVINATION", "(NORTH TOWER)"] } },
    { id: "astro", name: "Astronomy Tower", kind: "tower", circle: { cx: 116, cy: 120, r: 15 }, decor: "telescope", info: "The tallest tower. Midnight lessons, telescopes, and a long way down.", label: { x: 116, y: 113, size: 2, lines: ["ASTRONOMY", "TOWER"] } },
    { id: "owlery", name: "The Owlery", kind: "tower", circle: { cx: 156, cy: 120, r: 13 }, decor: "owlery", info: "Cold, windy and full of owls — the school's and everyone else's. Watch where you step.", label: { x: 156, y: 114, size: 2, lines: ["THE", "OWLERY"] } },
  ],
  portals: [
    { id: "fatlady", name: "Portrait Hole", x: 26, y: 56, kind: "portrait", to: { section: "f7", portal: "fatlady" }, hint: "portrait hole" },
    { id: "gargoyle", name: "Spiral Staircase", x: 146, y: 57, kind: "stairs", to: { section: "f2", portal: "gargoyle" }, hint: "gargoyle" },
    { id: "ravenclaw", name: "Spiral Stair", x: 32, y: 131, kind: "stairs", to: { section: "f7", portal: "ravenclaw" }, hint: "down" },
    { id: "northtower", name: "Trapdoor", x: 76, y: 128, kind: "trapdoor", to: { section: "f7", portal: "ladder" }, hint: "down" },
    { id: "astronomy", name: "Tower Stair", x: 116, y: 131, kind: "stairs", to: { section: "f7", portal: "astro" }, hint: "down" },
    { id: "owlery", name: "West Tower Stair", x: 156, y: 129, kind: "stairs", to: { section: "f0", portal: "west-stair" }, hint: "down" },
  ],
  hotspots: [
    { id: "slide", x: 62, y: 63, r: 3, name: "The Girls' Staircase", egg: "slide", glyph: "egg" },
    { id: "eagle", x: 32, y: 100, r: 3, name: "Eagle-Shaped Knocker", egg: "eagle", glyph: "eagle" },
    { id: "fawkes", x: 157, y: 38, r: 3, name: "A Golden Perch", egg: "fawkes", glyph: "egg" },
    { id: "pettigrew-bed", x: 96, y: 32, r: 3, name: "Ron's Four-Poster", egg: "scabbers", glyph: "egg", hidden: true },
  ],
  texts: [
    { x: 64, y: 23.8, text: "boys' stair", size: 1.4, italic: true },
    { x: 64, y: 69.6, text: "girls' stair — boys beware", size: 1.4, italic: true },
  ],
  passages: [],
};

/* ------------------------------------------------------------------ */
/* The grounds                                                         */
/* ------------------------------------------------------------------ */
function ellipse(cx: number, cy: number, rx: number, ry: number, n = 48, wob = 0): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 1 + wob * (Math.sin(a * 3 + 1.3) * 0.6 + Math.sin(a * 7 + 0.4) * 0.4);
    p.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]);
  }
  return p;
}

const grounds: Section = {
  id: "grounds",
  name: "The Grounds",
  short: "⌂",
  title: "The Grounds of Hogwarts",
  subtitle: "With the Village of Hogsmeade & the Forbidden Forest",
  frame: { w: 1500, h: 800 },
  cols: 5,
  scaleBar: 100,
  navRes: 4,
  openGround: true,
  pace: 3,
  spaces: [
    { id: "lake", name: "The Black Lake", kind: "water", poly: ellipse(780, 636, 430, 122, 64, 0.08), info: "Deep and cold. Home to a giant squid, merpeople and grindylows. New first-years arrive across it by boat.", label: { x: 780, y: 640, size: 22 } },
    { id: "castle", name: "Hogwarts Castle", kind: "castle", poly: [[620, 250], [700, 250], [700, 236], [880, 236], [880, 250], [960, 250], [960, 330], [980, 330], [980, 380], [940, 380], [940, 470], [660, 470], [660, 420], [600, 420], [600, 320], [620, 320]], label: { x: 790, y: 360, size: 20, lines: ["HOGWARTS", "CASTLE"] }, info: "Founded around a thousand years ago by Godric Gryffindor, Helga Hufflepuff, Rowena Ravenclaw and Salazar Slytherin. Unplottable." },
    { id: "forest", name: "The Forbidden Forest", kind: "forest", walkable: true, poly: [[0, 40], [260, 30], [420, 60], [560, 40], [700, 70], [720, 120], [560, 150], [440, 170], [400, 260], [380, 360], [420, 470], [360, 560], [260, 620], [140, 700], [0, 720]], label: { x: 170, y: 380, size: 24, lines: ["THE", "FORBIDDEN", "FOREST"] }, info: "Out of bounds to all students. Centaurs, unicorns, giant spiders, thestrals — and worse.", note: "out of bounds" },
    { id: "hut", name: "Hagrid's Hut", kind: "building", walkable: true, circle: { cx: 470, cy: 250, r: 12 }, decor: "hut", info: "A one-room house at the forest's edge, with a big dog, a bigger kettle and baking best admired rather than eaten.", label: { x: 470, y: 280, size: 11, lines: ["HAGRID'S HUT"] } },
    { id: "pumpkins", name: "Pumpkin Patch", kind: "field", walkable: true, rect: { x: 486, y: 222, w: 46, h: 30 }, decor: "pumpkins", label: false },
    { id: "pitch", name: "Quidditch Pitch", kind: "field", walkable: true, poly: ellipse(1200, 140, 84, 34, 40), decor: "pitch", info: "An oval pitch with towering stands and three tall hoops at each end.", label: { x: 1200, y: 196, size: 13 } },
    { id: "gh1", name: "Greenhouse One", kind: "building", walkable: true, rect: { x: 1010, y: 196, w: 40, h: 20 }, decor: "greenhouse", label: { size: 7, lines: ["1"] } },
    { id: "gh2", name: "Greenhouse Two", kind: "building", walkable: true, rect: { x: 1056, y: 196, w: 40, h: 20 }, decor: "greenhouse", label: { size: 7, lines: ["2"] } },
    { id: "gh3", name: "Greenhouse Three", kind: "building", walkable: true, rect: { x: 1102, y: 196, w: 40, h: 20 }, decor: "greenhouse", label: { size: 7, lines: ["3"] }, info: "Mandrakes. Earmuffs are compulsory." },
    { id: "lawn", name: "The Lawns", kind: "field", walkable: true, rect: { x: 600, y: 160, w: 380, h: 70 }, label: false },
    { id: "shore", name: "Lake Shore", kind: "field", walkable: true, rect: { x: 560, y: 476, w: 460, h: 28 }, label: false },
    { id: "boatyard", name: "Boathouse", kind: "building", walkable: true, rect: { x: 770, y: 478, w: 40, h: 20 }, label: { size: 8, lines: ["BOATHOUSE"] } },
    { id: "willow", name: "The Whomping Willow", kind: "field", walkable: true, circle: { cx: 560, cy: 340, r: 14 }, info: "Planted the year a certain boy with a furry little problem started school. Press the knot at the roots and it freezes.", label: { x: 560, y: 368, size: 10, lines: ["WHOMPING WILLOW"] } },
    { id: "hogsmeade", name: "Hogsmeade Village", kind: "field", walkable: true, rect: { x: 1300, y: 420, w: 190, h: 180 }, info: "The only entirely non-Muggle settlement in Britain. Third-years may visit on certain weekends — with a signed permission form.", label: { x: 1395, y: 606, size: 14, lines: ["HOGSMEADE"] } },
    { id: "honeydukes", name: "Honeydukes", kind: "building", walkable: true, rect: { x: 1330, y: 450, w: 44, h: 26 }, info: "The sweetshop. Shelves of improbable confectionery — and a trapdoor in the cellar floor.", label: { size: 7, lines: ["HONEYDUKES"] } },
    { id: "broomsticks", name: "The Three Broomsticks", kind: "building", walkable: true, rect: { x: 1392, y: 450, w: 52, h: 26 }, info: "The village inn. Butterbeer, served by Madam Rosmerta.", label: { size: 6.4, lines: ["THREE", "BROOMSTICKS"] } },
    { id: "zonkos", name: "Zonko's Joke Shop", kind: "building", walkable: true, rect: { x: 1330, y: 500, w: 40, h: 22 }, label: { size: 6.6, lines: ["ZONKO'S"] } },
    { id: "hogshead", name: "The Hog's Head", kind: "building", walkable: true, rect: { x: 1440, y: 534, w: 40, h: 22 }, label: { size: 6, lines: ["HOG'S", "HEAD"] }, info: "A shabby little pub where nobody asks questions. The landlord keeps goats." },
    { id: "postoffice", name: "Post Office", kind: "building", walkable: true, rect: { x: 1386, y: 500, w: 40, h: 22 }, label: { size: 6, lines: ["POST", "OFFICE"] } },
    { id: "gladrags", name: "Gladrags Wizardwear", kind: "building", walkable: true, rect: { x: 1330, y: 546, w: 46, h: 22 }, label: { size: 6, lines: ["GLADRAGS"] } },
    { id: "shack", name: "The Shrieking Shack", kind: "building", walkable: true, rect: { x: 1400, y: 300, w: 46, h: 30 }, info: "Said to be the most haunted house in Britain. The screams were never ghosts.", label: { x: 1423, y: 342, size: 8, lines: ["THE SHRIEKING", "SHACK"] } },
    { id: "station", name: "Hogsmeade Station", kind: "building", walkable: true, rect: { x: 1380, y: 716, w: 96, h: 18 }, label: { x: 1428, y: 748, size: 8, lines: ["HOGSMEADE STATION"] } },
  ],
  portals: [
    { id: "front", name: "Oak Front Doors", x: 790, y: 228, kind: "door", to: { section: "f0", portal: "front" }, hint: "into the castle" },
    { id: "bridge", name: "Wooden Bridge", x: 988, y: 356, kind: "door", to: { section: "f0", portal: "bridge" }, hint: "the bridge" },
    { id: "boathouse", name: "Boathouse Steps", x: 790, y: 488, kind: "stairs", to: { section: "f0", portal: "boathouse" }, hint: "boathouse" },
    { id: "willow", name: "Knot at the Roots", x: 560, y: 352, kind: "passage", secret: true, to: { section: "grounds", portal: "shack" }, hint: "tunnel" },
    { id: "shack", name: "Shrieking Shack", x: 1423, y: 316, kind: "passage", secret: true, to: { section: "grounds", portal: "willow" }, hint: "tunnel" },
    { id: "honeydukes", name: "Honeydukes Cellar Trapdoor", x: 1352, y: 463, kind: "passage", secret: true, to: { section: "f3", portal: "witch" }, hint: "cellar" },
  ],
  hotspots: [
    { id: "knot", x: 560, y: 340, r: 14, name: "The Whomping Willow", egg: "willow", glyph: "knot" },
    { id: "squid", x: 660, y: 680, r: 16, name: "Something large in the lake", egg: "squid", glyph: "squid" },
    { id: "aragog", x: 110, y: 170, r: 16, name: "A Hollow in the Forest", egg: "aragog", glyph: "spider" },
    { id: "buckbeak", x: 520, y: 290, r: 12, name: "A Hippogriff, tethered", egg: "buckbeak", glyph: "hippogriff" },
    { id: "gates", x: 1270, y: 366, r: 12, name: "Gates with Winged Boars", egg: "gates", glyph: "boar" },
  ],
  texts: [
    { x: 1270, y: 392, text: "the gates — winged boars", size: 7, italic: true },
    { x: 260, y: 470, text: "here be centaurs", size: 9, italic: true },
    { x: 1350, y: 386, text: "to Hogsmeade", size: 8, italic: true },
    { x: 1010, y: 610, text: "merpeople", size: 8, italic: true },
    { x: 560, y: 690, text: "grindylows", size: 8, italic: true },
  ],
  passages: [
    { id: "p-willow", name: "Passage under the Whomping Willow", pts: [[560, 340], [580, 440], [700, 506], [1000, 506], [1250, 420], [1423, 316]], note: "Whomping Willow → Shrieking Shack" },
    { id: "p-witch", name: "One-Eyed Witch Passage", pts: [[940, 400], [1060, 430], [1200, 440], [1352, 463]], note: "witch's hump → Honeydukes cellar" },
    { id: "p-mirror", name: "Behind the Mirror (4th floor)", pts: [[930, 270], [1010, 290], [1080, 310]], caved: true, note: "caved in last winter" },
    { id: "p-f1", name: "Filch knows this one", pts: [[960, 300], [1100, 340], [1240, 400], [1320, 440]], note: "Filch knows" },
    { id: "p-f2", name: "Filch knows this one", pts: [[940, 450], [1100, 520], [1240, 560], [1320, 560]], note: "Filch knows" },
    { id: "p-f3", name: "Filch knows this one", pts: [[860, 470], [1000, 560], [1180, 640], [1380, 712]], note: "Filch knows" },
    { id: "p-f4", name: "Filch knows this one", pts: [[880, 240], [1000, 170], [1200, 230], [1300, 420]], note: "Filch knows" },
  ],
};

export const SECTIONS: Section[] = [grounds, dungeons, groundFloor, f1, f2, f3, f4, f5, f6, f7, towers];
export const SECTION_BY_ID: Record<string, Section> = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

export function spaceById(sec: Section, id: string) {
  return sec.spaces.find((s) => s.id === id);
}
