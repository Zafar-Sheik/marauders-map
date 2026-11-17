import { SECTIONS, SECTION_BY_ID, spaceById } from "./castle";
import { NavGrid, locate } from "./nav";
import type { Pt, Portal, Section } from "./types";
import { pxPerMetre } from "./sheet";

export type PrintKind = "shoe" | "boot" | "heel" | "small" | "paw" | "dog" | "wolf" | "rat" | "wisp" | "drip" | "bare" | "hoof";

export interface Print {
  x: number;
  y: number;
  a: number;
  foot: 0 | 1;
  t: number;
  kind: PrintKind;
  who: string;
}

export interface CharDef {
  id: string;
  name: string;
  kind: PrintKind;
  role: string;
  desc: string;
  start: string;
  day: string[];
  night?: string[];
  speed?: number;
  secretOK?: boolean;
  follow?: string;
  /** probability of choosing a destination inside the same room again */
  linger?: number;
}


/* Destinations are "section:spaceId". Repeat an entry to weight it. */
export const CHARACTERS: CharDef[] = [
  { id: "harry", name: "Harry Potter", kind: "shoe", role: "Gryffindor, third year", desc: "Seeker. Has a lightning-bolt scar, his father's untidy hair and, as of this year, a certain piece of parchment.", start: "towers:gcommon", secretOK: true,
    day: ["f0:greathall", "f0:greathall", "f3:dada", "dungeons:potions", "f1:transfig", "grounds:hut", "grounds:pitch", "grounds:pitch", "f4:library", "towers:gcommon", "grounds:honeydukes", "towers:owlery", "towers:div"],
    night: ["towers:gboys", "towers:gcommon", "f4:restricted", "f4:erised", "f3:trophy", "grounds:hut", "f7:main", "dungeons:kitchens"] },
  { id: "ron", name: "Ronald Weasley", kind: "shoe", role: "Gryffindor, third year", desc: "Keeper (eventually). Hand-me-down robes, a broken wand and a pet rat called Scabbers.", start: "towers:gcommon",
    day: ["f0:greathall", "f0:greathall", "f0:greathall", "f3:dada", "dungeons:potions", "towers:div", "grounds:hut", "towers:gcommon", "dungeons:kitchens", "grounds:broomsticks"],
    night: ["towers:gboys", "towers:gboys", "towers:gcommon"] },
  { id: "hermione", name: "Hermione Granger", kind: "heel", role: "Gryffindor, third year", desc: "Taking every subject this year. Nobody can quite work out how she gets to all her lessons.", start: "f4:library",
    day: ["f4:library", "f4:library", "f4:library", "f1:transfig", "f2:runes", "f2:arith", "f1:muggle", "f3:charms", "f0:greathall", "grounds:hut", "towers:gcommon"],
    night: ["towers:ggirls", "towers:gcommon", "f4:library"] },
  { id: "ginny", name: "Ginevra Weasley", kind: "heel", role: "Gryffindor, second year", desc: "Chaser. Bat-Bogey Hex specialist.", start: "towers:gcommon",
    day: ["f0:greathall", "f3:charms", "grounds:pitch", "towers:gcommon", "f1:hom", "f2:myrtle"], night: ["towers:ggirls", "towers:gcommon"] },
  { id: "neville", name: "Neville Longbottom", kind: "shoe", role: "Gryffindor, third year", desc: "Writes the passwords down. Brilliant at Herbology. Owns a toad called Trevor who is usually missing.", start: "towers:gcommon",
    day: ["grounds:gh3", "grounds:gh3", "grounds:gh1", "f0:greathall", "dungeons:potions", "f1:transfig", "towers:gcommon", "f1:hospital"], night: ["towers:gboys", "towers:gcommon"] },
  { id: "fred", name: "Fred Weasley", kind: "shoe", role: "Gryffindor, fifth year", desc: "Beater. Liberated the map from Filch's filing cabinet in his first year.", start: "towers:gcommon", secretOK: true,
    day: ["grounds:zonkos", "grounds:honeydukes", "grounds:pitch", "f0:greathall", "dungeons:kitchens", "f0:filch", "f3:main", "f7:main", "grounds:broomsticks"],
    night: ["dungeons:kitchens", "towers:gcommon", "f3:main", "grounds:honeydukes"] },
  { id: "george", name: "George Weasley", kind: "shoe", role: "Gryffindor, fifth year", desc: "Beater. The other half of the Weasley twins.", start: "towers:gcommon", secretOK: true, follow: "fred", day: [] },
  { id: "draco", name: "Draco Malfoy", kind: "shoe", role: "Slytherin, third year", desc: "His father will be hearing about this.", start: "dungeons:slyth",
    day: ["dungeons:slyth", "f0:greathall", "f0:greathall", "dungeons:potions", "grounds:pitch", "grounds:hut", "f6:boysbath", "f7:main"], night: ["dungeons:slyth"] },
  { id: "crabbe", name: "Vincent Crabbe", kind: "boot", role: "Slytherin, third year", desc: "Follows Malfoy. Fond of cakes left lying around.", start: "dungeons:slyth", follow: "draco", day: [] },
  { id: "goyle", name: "Gregory Goyle", kind: "boot", role: "Slytherin, third year", desc: "Follows Malfoy. Also fond of cakes.", start: "dungeons:slyth", follow: "crabbe", day: [] },
  { id: "luna", name: "Luna Lovegood", kind: "bare", role: "Ravenclaw, second year", desc: "Wears Butterbeer corks as a necklace. Often barefoot — somebody keeps hiding her shoes.", start: "towers:rav",
    day: ["towers:rav", "grounds:forest", "grounds:shore", "f0:greathall", "f3:charms", "grounds:lawn"], night: ["towers:rav", "towers:rav", "towers:astro"] },
  { id: "cho", name: "Cho Chang", kind: "heel", role: "Ravenclaw, fourth year", desc: "Ravenclaw Seeker.", start: "towers:rav",
    day: ["grounds:pitch", "towers:rav", "f0:greathall", "f4:library", "towers:owlery"], night: ["towers:rav"] },
  { id: "cedric", name: "Cedric Diggory", kind: "shoe", role: "Hufflepuff, fifth year", desc: "Hufflepuff Seeker and Prefect. Annoyingly handsome; annoyingly decent.", start: "dungeons:huff",
    day: ["dungeons:huff", "f0:greathall", "grounds:pitch", "f5:prefects", "f4:library", "grounds:gh1"], night: ["dungeons:huff"] },
  { id: "snape", name: "Severus Snape", kind: "boot", role: "Potions Master, Head of Slytherin", desc: "Has wanted the Defence post for years. Never caught out after dark — or so he thinks.", start: "dungeons:snape", secretOK: false, speed: 1.15,
    day: ["dungeons:potions", "dungeons:potions", "dungeons:snape", "dungeons:store", "f0:greathall", "f0:staffroom", "f3:lupin", "dungeons:slyth"],
    night: ["f3:main", "f4:main", "f7:main", "f0:entrance", "dungeons:snape", "f2:main", "f5:main", "f6:main"] },
  { id: "dumbledore", name: "Albus Dumbledore", kind: "heel", role: "Headmaster", desc: "Order of Merlin, First Class. Fond of sherbet lemons and woollen socks.", start: "towers:head",
    day: ["towers:head", "towers:head", "f0:greathall", "f0:staffroom", "f2:main", "grounds:hut", "f4:erised"], night: ["towers:head", "f4:erised", "f7:main"] },
  { id: "mcgonagall", name: "Minerva McGonagall", kind: "heel", role: "Deputy Headmistress, Head of Gryffindor", desc: "Registered Animagus (tabby cat, spectacle markings). Do not be late.", start: "f1:mcg",
    day: ["f1:transfig", "f1:transfig", "f1:mcg", "f0:greathall", "f0:staffroom", "towers:gcommon", "grounds:pitch"], night: ["f1:mcg", "f7:main", "towers:gcommon"] },
  { id: "hagrid", name: "Rubeus Hagrid", kind: "boot", role: "Keeper of Keys and Grounds", desc: "Care of Magical Creatures teacher. Should not have told you that.", start: "grounds:hut", speed: 0.85, linger: 0.5,
    day: ["grounds:hut", "grounds:hut", "grounds:pumpkins", "grounds:forest", "grounds:forest", "f0:greathall", "grounds:shore", "grounds:broomsticks"], night: ["grounds:hut", "grounds:forest"] },
  { id: "filch", name: "Argus Filch", kind: "boot", role: "Caretaker", desc: "Knows four of the seven secret passages. Wants the old punishments back.", start: "f0:filch", speed: 0.8,
    day: ["f0:filch", "f0:entrance", "f1:main", "f2:main", "f3:main", "f3:forbidden", "f4:main", "f5:main", "f6:main", "f7:main", "f0:main", "dungeons:dcorr"],
    night: ["f1:main", "f2:main", "f3:main", "f4:main", "f4:library", "f5:main", "f6:main", "f7:main", "f3:trophy", "f0:entrance"] },
  { id: "norris", name: "Mrs Norris", kind: "paw", role: "Filch's cat", desc: "If she spots you out of bounds, Filch is never far behind.", start: "f0:filch", speed: 1.2,
    day: ["f1:main", "f2:main", "f3:main", "f4:main", "f5:main", "f6:main", "f7:main", "f0:main", "f0:entrance", "f3:trophy"] },
  { id: "lupin", name: "Remus Lupin", kind: "shoe", role: "Defence Against the Dark Arts (1993–94)", desc: "Shabby robes, a chocolate in every pocket. Moony.", start: "f3:lupin", secretOK: true,
    day: ["f3:dada", "f3:dada", "f3:lupin", "f0:greathall", "f0:staffroom", "grounds:hut"], night: ["f3:lupin"] },
  { id: "sirius", name: "Sirius Black", kind: "dog", role: "Escaped prisoner (an enormous black dog)", desc: "Padfoot. Has been sleeping rough in the Shrieking Shack and in the forest.", start: "grounds:shack", secretOK: true, speed: 1.3,
    day: ["grounds:shack", "grounds:forest", "grounds:forest", "grounds:hut", "grounds:pitch", "grounds:hogsmeade"], night: ["grounds:shack", "grounds:forest", "grounds:willow"] },
  { id: "pettigrew", name: "Peter Pettigrew", kind: "rat", role: "Supposedly dead since 1981", desc: "Wormtail. The map never lies.", start: "towers:gboys", secretOK: true, speed: 0.9, linger: 0.7,
    day: ["towers:gboys", "towers:gboys", "towers:gcommon", "dungeons:kitchens", "f0:greathall", "grounds:hut"], night: ["towers:gboys", "dungeons:kitchens"] },
  { id: "crookshanks", name: "Crookshanks", kind: "paw", role: "Hermione's cat (part Kneazle)", desc: "Ginger, clever and suspicious. Has been chasing a certain rat.", start: "towers:gcommon", follow: "pettigrew", day: [] },
  { id: "crouch", name: "Bartemius Crouch", kind: "boot", role: "...?", desc: "The map cannot lie about who you really are — whatever your face says.", start: "f3:lupin", secretOK: false,
    day: ["f3:dada", "f3:lupin", "f0:greathall"], night: ["dungeons:snape", "dungeons:store", "dungeons:snape", "f0:entrance"] },
  { id: "peeves", name: "Peeves", kind: "wisp", role: "Poltergeist", desc: "Only the Bloody Baron can control him. Will drop a walking-stick on your head.", start: "f3:trophy", speed: 1.6, linger: 0.1,
    day: ["f1:main", "f2:main", "f3:main", "f4:library", "f5:main", "f6:main", "f7:main", "f0:entrance", "f0:greathall", "f3:armour", "f1:hom", "f3:trophy"] },
  { id: "myrtle", name: "Moaning Myrtle", kind: "drip", role: "Ghost", desc: "Haunts the U-bend. Occasionally the Prefects' bathroom.", start: "f2:myrtle", speed: 0.7, linger: 0.8,
    day: ["f2:myrtle", "f2:myrtle", "f2:myrtle", "f5:prefects", "f6:boysbath"] },
  { id: "flitwick", name: "Filius Flitwick", kind: "small", role: "Charms Master, Head of Ravenclaw", desc: "Duelling champion in his youth. Stands on a pile of books.", start: "f3:charms",
    day: ["f3:charms", "f3:charms", "f7:flitwick", "f0:greathall", "f0:staffroom", "towers:rav"], night: ["f7:flitwick"] },
  { id: "trelawney", name: "Sybill Trelawney", kind: "heel", role: "Divination", desc: "Rarely descends from her tower. Predicts a death every year.", start: "towers:div", linger: 0.8,
    day: ["towers:div", "towers:div", "towers:div", "f0:greathall"], night: ["towers:div"] },
  { id: "sprout", name: "Pomona Sprout", kind: "boot", role: "Herbology, Head of Hufflepuff", desc: "Usually somewhere near a Mandrake.", start: "grounds:gh3",
    day: ["grounds:gh1", "grounds:gh2", "grounds:gh3", "f0:greathall", "dungeons:huff"], night: ["dungeons:huff"] },
  { id: "pomfrey", name: "Poppy Pomfrey", kind: "heel", role: "Matron", desc: "Chocolate after dementors. No visitors after eight.", start: "f1:hospital", linger: 0.8,
    day: ["f1:hospital", "f1:hospital", "f1:pomfrey", "f0:greathall"], night: ["f1:hospital", "f1:pomfrey"] },
  { id: "pince", name: "Irma Pince", kind: "heel", role: "Librarian", desc: "Protective of every book in her care. Very protective.", start: "f4:library", linger: 0.8,
    day: ["f4:library", "f4:library", "f4:restricted"], night: ["f4:library"] },
  { id: "hooch", name: "Rolanda Hooch", kind: "boot", role: "Flying instructor & referee", desc: "Sharp-eyed and quick with a whistle.", start: "grounds:pitch",
    day: ["grounds:pitch", "grounds:pitch", "f0:greathall"], night: ["grounds:pitch"] },
  { id: "dobby", name: "Dobby", kind: "small", role: "Free elf", desc: "Paid a Galleon a week and a day off a month. Wears all the hats Hermione knits.", start: "dungeons:kitchens", speed: 1.3,
    day: ["dungeons:kitchens", "dungeons:kitchens", "towers:gcommon", "f7:main", "f0:greathall"] },
  /* ---- the rest of the school: more footsteps in the corridors ---- */
  { id: "dean", name: "Dean Thomas", kind: "shoe", role: "Gryffindor, third year", desc: "Draws brilliantly. Supports West Ham.", start: "towers:gcommon",
    day: ["f0:greathall", "f3:dada", "f1:transfig", "f7:c7a", "grounds:pitch", "f3:s1", "f2:s1"], night: ["towers:gboys"] },
  { id: "seamus", name: "Seamus Finnigan", kind: "shoe", role: "Gryffindor, third year", desc: "Has a way of making things explode.", start: "towers:gcommon", follow: "dean", day: [] },
  { id: "lavender", name: "Lavender Brown", kind: "heel", role: "Gryffindor, third year", desc: "Trelawney's most devoted pupil.", start: "towers:gcommon",
    day: ["towers:div", "f0:greathall", "f1:transfig", "f5:s1", "towers:ggirls"], night: ["towers:ggirls"] },
  { id: "parvati", name: "Parvati Patil", kind: "heel", role: "Gryffindor, third year", desc: "Usually found with Lavender.", start: "towers:gcommon", follow: "lavender", day: [] },
  { id: "padma", name: "Padma Patil", kind: "heel", role: "Ravenclaw, third year", desc: "Parvati's twin, sorted into Ravenclaw.", start: "towers:rav",
    day: ["towers:rav", "f4:library", "f3:charms", "f0:greathall", "f6:c6a"], night: ["towers:rav"] },
  { id: "percy", name: "Percy Weasley", kind: "shoe", role: "Gryffindor Head Boy", desc: "Head Boy. Polishes his badge.", start: "towers:gcommon",
    day: ["f4:library", "f5:prefects", "f1:s3", "f0:greathall", "f7:main", "f6:main", "f5:main"], night: ["f7:main", "f4:main", "towers:gcommon"] },
  { id: "oliver", name: "Oliver Wood", kind: "boot", role: "Gryffindor Quidditch Captain", desc: "Has never once stopped thinking about Quidditch.", start: "towers:gcommon",
    day: ["grounds:pitch", "grounds:pitch", "grounds:pitch", "f0:greathall", "towers:gcommon"], night: ["towers:gcommon"] },
  { id: "lee", name: "Lee Jordan", kind: "shoe", role: "Gryffindor, fifth year", desc: "Quidditch commentator; friend of the twins; frequently told off by McGonagall.", start: "towers:gcommon",
    day: ["grounds:pitch", "f0:greathall", "dungeons:kitchens", "f3:main", "f7:main"], night: ["towers:gcommon"] },
  { id: "angelina", name: "Angelina Johnson", kind: "heel", role: "Gryffindor Chaser", desc: "Fast and fearless.", start: "towers:gcommon",
    day: ["grounds:pitch", "grounds:pitch", "f0:greathall", "f4:library"], night: ["towers:ggirls"] },
  { id: "katie", name: "Katie Bell", kind: "heel", role: "Gryffindor Chaser", desc: "Never misses training.", start: "towers:gcommon", follow: "angelina", day: [] },
  { id: "colin", name: "Colin Creevey", kind: "small", role: "Gryffindor, second year", desc: "Owns a camera. Uses it constantly.", start: "towers:gcommon",
    day: ["f0:greathall", "grounds:pitch", "f1:main", "f2:main", "f3:main", "f0:entrance", "f1:s1"], night: ["towers:gboys"] },
  { id: "pansy", name: "Pansy Parkinson", kind: "heel", role: "Slytherin, third year", desc: "Laughs at Malfoy's jokes.", start: "dungeons:slyth",
    day: ["dungeons:slyth", "f0:greathall", "dungeons:potions", "grounds:hut", "f2:s1"], night: ["dungeons:slyth"] },
  { id: "flint", name: "Marcus Flint", kind: "boot", role: "Slytherin Quidditch Captain", desc: "Repeating a year. Plays dirty.", start: "dungeons:slyth",
    day: ["grounds:pitch", "grounds:pitch", "dungeons:slyth", "f0:greathall"], night: ["dungeons:slyth"] },
  { id: "ernie", name: "Ernie Macmillan", kind: "shoe", role: "Hufflepuff, third year", desc: "Pompous but loyal.", start: "dungeons:huff",
    day: ["dungeons:huff", "grounds:gh3", "f0:greathall", "f4:library", "f3:s1", "f2:arith"], night: ["dungeons:huff"] },
  { id: "hannah", name: "Hannah Abbott", kind: "heel", role: "Hufflepuff, third year", desc: "Pink-faced, kind, easily alarmed.", start: "dungeons:huff", follow: "ernie", day: [] },
  { id: "justin", name: "Justin Finch-Fletchley", kind: "shoe", role: "Hufflepuff, third year", desc: "Was down for Eton.", start: "dungeons:huff",
    day: ["dungeons:huff", "f1:muggle", "f0:greathall", "grounds:gh1", "f2:main"], night: ["dungeons:huff"] },
  { id: "susan", name: "Susan Bones", kind: "heel", role: "Hufflepuff, third year", desc: "From a family that has seen a great deal.", start: "dungeons:huff",
    day: ["dungeons:huff", "f0:greathall", "f6:s1", "f4:library", "grounds:gh2"], night: ["dungeons:huff"] },
  { id: "terry", name: "Terry Boot", kind: "shoe", role: "Ravenclaw, third year", desc: "Bookish; good at Charms.", start: "towers:rav",
    day: ["towers:rav", "f4:library", "f4:c4b", "f3:charms", "f0:greathall", "f5:c5b"], night: ["towers:rav"] },
  { id: "binns", name: "Cuthbert Binns", kind: "wisp", role: "History of Magic (ghost)", desc: "Has been teaching the same lessons, at the same pace, for a very long time.", start: "f1:hom", speed: 0.5, linger: 0.95,
    day: ["f1:hom"] },
  { id: "nick", name: "Nearly Headless Nick", kind: "wisp", role: "Gryffindor house ghost", desc: "Sir Nicholas. Ask him about the Headless Hunt — on second thoughts, don't.", start: "towers:gcommon", speed: 0.8,
    day: ["towers:gcommon", "f0:greathall", "f7:main", "f1:main", "dungeons:dungeon5", "f3:trophy"] },
  { id: "baron", name: "The Bloody Baron", kind: "wisp", role: "Slytherin house ghost", desc: "Silver-stained and silent. Peeves is terrified of him.", start: "dungeons:slyth", speed: 0.7,
    day: ["dungeons:slyth", "dungeons:dcorr", "f0:greathall", "towers:astro", "f7:main"] },
  { id: "greylady", name: "The Grey Lady", kind: "wisp", role: "Ravenclaw house ghost", desc: "Tall and proud. Rarely speaks to anyone.", start: "towers:rav", speed: 0.7,
    day: ["towers:rav", "f5:main", "f6:main", "f4:library", "f7:nw"] },
  { id: "friar", name: "The Fat Friar", kind: "wisp", role: "Hufflepuff house ghost", desc: "Jolly, forgiving, and fond of the kitchens.", start: "dungeons:huff", speed: 0.7,
    day: ["dungeons:huff", "dungeons:kitchens", "f0:greathall", "f2:main"] },
  { id: "rosmerta", name: "Madam Rosmerta", kind: "heel", role: "Landlady, The Three Broomsticks", desc: "Serves the best Butterbeer in the village.", start: "grounds:broomsticks", linger: 0.85,
    day: ["grounds:broomsticks", "grounds:broomsticks", "grounds:postoffice"] },
  { id: "winky", name: "Winky", kind: "small", role: "House-elf", desc: "Misses Mr Crouch terribly.", start: "dungeons:kitchens", linger: 0.9, day: ["dungeons:kitchens"] },
];

export interface Char {
  def: CharDef;
  id: string;
  name: string;
  section: string;
  x: number;
  y: number;
  path: Pt[];
  goal: { section: string; pt: Pt } | null;
  wait: number;
  heading: number;
  sinceStep: number;
  foot: 0 | 1;
  kind: PrintKind;
  hidden: boolean;
  speedMul: number;
  /** temporary forced goal */
  override?: { section: string; pt: Pt; until: number };
  lastSeenAt: number;
}

export class Simulation {
  navs: Record<string, NavGrid> = {};
  chars: Char[] = [];
  prints: Record<string, Print[]> = {};
  time = 0;
  night = false;
  fullMoon = false;
  flags = new Set<string>();
  timeScale = 1;
  private rnd: () => number;
  listeners: ((ev: { type: string; char: Char; portal?: Portal }) => void)[] = [];

  constructor(seed = 1234) {
    let s = seed;
    this.rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (const sec of SECTIONS) {
      this.navs[sec.id] = new NavGrid(sec);
      this.prints[sec.id] = [];
    }
    for (const def of CHARACTERS) this.addChar(def);
  }

  addChar(def: CharDef, at?: { section: string; x: number; y: number }) {
    const [secId, spId] = def.start.split(":");
    const sec = SECTION_BY_ID[secId];
    const sp = spaceById(sec, spId)!;
    const pt = at ? [at.x, at.y] : this.navs[secId].randomPointIn(sp, this.rnd);
    const c: Char = {
      def, id: def.id, name: def.name, section: at?.section ?? secId, x: pt[0], y: pt[1], path: [], goal: null,
      wait: this.rnd() * 6, heading: this.rnd() * Math.PI * 2, sinceStep: 0, foot: 0, kind: def.kind,
      hidden: false, speedMul: def.speed ?? 1, lastSeenAt: 0,
    };
    this.chars.push(c);
    return c;
  }

  removeChar(id: string) {
    this.chars = this.chars.filter((c) => c.id !== id);
  }

  get(id: string) {
    return this.chars.find((c) => c.id === id);
  }

  /** first portal on the shortest section-hop route */
  private nextPortal(from: string, to: string, secretOK: boolean): Portal | null {
    if (from === to) return null;
    const prev: Record<string, { sec: string; portal: Portal } | null> = { [from]: null };
    const q = [from];
    while (q.length) {
      const cur = q.shift()!;
      for (const p of SECTION_BY_ID[cur].portals) {
        if (p.secret && !secretOK) continue;
        const n = p.to.section;
        if (n in prev) continue;
        prev[n] = { sec: cur, portal: p };
        if (n === to) {
          let node = n;
          let step = prev[node]!;
          while (step.sec !== from) {
            node = step.sec;
            step = prev[node]!;
          }
          return step.portal;
        }
        q.push(n);
      }
    }
    return null;
  }

  private chooseGoal(c: Char) {
    const def = c.def;
    if (c.override && c.override.until > this.time) {
      c.goal = { section: c.override.section, pt: c.override.pt };
      return;
    }
    if (def.follow) {
      const lead = this.get(def.follow);
      if (lead) {
        const ang = this.rnd() * Math.PI * 2;
        const off = this.navs[lead.section].res * 3 + 1.5;
        c.goal = { section: lead.section, pt: [lead.x + Math.cos(ang) * off, lead.y + Math.sin(ang) * off] };
        c.wait = 0.5 + this.rnd() * 1.5;
        return;
      }
    }
    // Moony at full moon
    if (def.id === "lupin" && this.fullMoon && this.night) {
      const sec = SECTION_BY_ID.grounds;
      c.goal = { section: "grounds", pt: this.navs.grounds.randomPointIn(spaceById(sec, "shack")!, this.rnd) };
      return;
    }
    let list = (this.night && def.night?.length ? def.night : def.day) || [];
    if (!list.length) list = [def.start];
    let secId: string | undefined, spId: string | undefined;
    if (this.rnd() < (def.linger ?? 0.25)) {
      const here = SECTION_BY_ID[c.section].spaces.find(
        (s) => s.kind !== "corridor" && s.kind !== "castle" && s.kind !== "water" && s.kind !== "hidden" && insideLoose(s, c.x, c.y),
      );
      if (here) { secId = c.section; spId = here.id; }
    }
    if (!secId || !spId) [secId, spId] = list[Math.floor(this.rnd() * list.length)].split(":");
    const sec = SECTION_BY_ID[secId];
    const sp = spaceById(sec, spId);
    if (!sp) return;
    c.goal = { section: secId, pt: this.navs[secId].randomPointIn(sp, this.rnd) };
  }

  private plan(c: Char) {
    if (!c.goal) return;
    const nav = this.navs[c.section];
    if (c.goal.section === c.section) {
      c.path = nav.findPath([c.x, c.y], c.goal.pt) ?? [];
      if (!c.path.length) c.goal = null;
      return;
    }
    const portal = this.nextPortal(c.section, c.goal.section, !!c.def.secretOK || this.flags.has("passages-open"));
    if (!portal) {
      c.goal = null;
      return;
    }
    const p = nav.findPath([c.x, c.y], [portal.x, portal.y]);
    c.path = p ?? [];
    (c as Char & { viaPortal?: Portal }).viaPortal = portal;
  }

  /** send a character somewhere for a while */
  summon(id: string, section: string, pt: Pt, seconds = 40) {
    const c = this.get(id);
    if (!c) return;
    c.override = { section, pt, until: this.time + seconds };
    c.goal = null;
    c.path = [];
    c.wait = 0;
  }

  step(dt: number) {
    const sdt = dt * this.timeScale;
    this.time += sdt;
    for (const c of this.chars) this.stepChar(c, sdt);
    // fade old prints
    for (const k in this.prints) {
      const arr = this.prints[k];
      let cut = 0;
      while (cut < arr.length && this.time - arr[cut].t > 14) cut++;
      if (cut) arr.splice(0, cut);
    }
  }

  private stepChar(c: Char, dt: number) {
    const sec = SECTION_BY_ID[c.section];
    if (c.id === "lupin") c.kind = this.fullMoon && this.night ? "wolf" : "shoe";
    if (c.wait > 0) {
      c.wait -= dt;
      return;
    }
    if (!c.path.length) {
      const via = (c as Char & { viaPortal?: Portal }).viaPortal;
      if (via) {
        // arrived at a portal: hop to the other side
        (c as Char & { viaPortal?: Portal }).viaPortal = undefined;
        const dest = SECTION_BY_ID[via.to.section].portals.find((p) => p.id === via.to.portal);
        if (dest) {
          this.listeners.forEach((l) => l({ type: "leave", char: c, portal: via }));
          c.section = via.to.section;
          c.x = dest.x;
          c.y = dest.y;
          c.wait = 0.6 + this.rnd();
          this.listeners.forEach((l) => l({ type: "arrive", char: c, portal: dest }));
          this.plan(c);
          return;
        }
      }
      if (c.goal && c.goal.section === c.section && Math.hypot(c.goal.pt[0] - c.x, c.goal.pt[1] - c.y) < 1.5) {
        c.goal = null;
        c.wait = c.def.follow ? 0.3 + this.rnd() : 4 + this.rnd() * 14;
        return;
      }
      this.chooseGoal(c);
      this.plan(c);
      if (!c.path.length) c.wait = 1 + this.rnd() * 2;
      return;
    }
    const speed = 2.4 * sec.pace * c.speedMul;
    let move = speed * dt;
    const stride = 26 / pxPerMetre(sec) * (c.kind === "boot" ? 1.25 : c.kind === "small" || c.kind === "rat" ? 0.6 : c.kind === "paw" ? 0.7 : 1);
    while (move > 0 && c.path.length) {
      const [tx, ty] = c.path[0];
      const dx = tx - c.x, dy = ty - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-3) { c.path.shift(); continue; }
      const m = Math.min(d, move);
      const want = Math.atan2(dy, dx);
      // ease the heading for nicer turns
      let dh = want - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += dh * Math.min(1, 0.35 + m * 0.4);
      c.x += (dx / d) * m;
      c.y += (dy / d) * m;
      move -= m;
      c.sinceStep += m;
      if (d - m < 1e-3) c.path.shift();
      if (c.sinceStep >= stride) {
        c.sinceStep = 0;
        c.foot = c.foot ? 0 : 1;
        this.prints[c.section].push({ x: c.x, y: c.y, a: c.heading, foot: c.foot, t: this.time, kind: c.kind, who: c.id });
      }
    }
  }

  where(c: Char) {
    const sec = SECTION_BY_ID[c.section];
    return { section: sec, room: locate(sec, c.x, c.y, this.flags) };
  }

  sectionOf(id: string): Section {
    return SECTION_BY_ID[id];
  }
}

function insideLoose(s: { rect?: { x: number; y: number; w: number; h: number }; circle?: { cx: number; cy: number; r: number } }, x: number, y: number) {
  if (s.rect) return x >= s.rect.x && y >= s.rect.y && x <= s.rect.x + s.rect.w && y <= s.rect.y + s.rect.h;
  if (s.circle) return Math.hypot(x - s.circle.cx, y - s.circle.cy) <= s.circle.r;
  return false;
}

