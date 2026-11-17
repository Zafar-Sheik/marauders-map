import type { Section } from "./types";
import type { Simulation } from "./sim";
import { CHARACTERS } from "./sim";
import { harp } from "./audio";

export interface Line {
  text: string;
  by?: string;
}

export interface EggAPI {
  say(lines: Line[]): void;
  flag(f: string): void;
  unflag(f: string): void;
  has(f: string): boolean;
  goto(section: string, focus?: { x: number; y: number; zoom: number }): void;
  current(): Section;
  sim: Simulation;
  isOpen(): boolean;
  open(): void;
  close(): void;
  setNight(v: boolean): void;
  setLumos(v: boolean): void;
  night(): boolean;
  burst(n: number): void;
  revealNames(): void;
  hideLabels(seconds: number): void;
  rerender(): void;
  viewCenter(): { x: number; y: number };
  found(id: string): void;
}

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

export const OATH = "i solemnly swear that i am up to no good";

const FAT_LADY_PASSWORDS = [
  "caput draconis", "pig snout", "fortuna major", "scurvy cur", "oddsbodikins", "flibbertigibbet", "banana fritters",
  "fairy lights", "balderdash", "mimbulus mimbletonia", "dilligrout", "abstinence", "baubles", "tapeworm", "quid agis",
];

let awaiting: string | null = null;
let awaitingUntil = 0;
let tapestryClicks: number[] = [];

export const EGG_COUNT = 24;

function expect(what: string, secs = 40) {
  awaiting = what;
  awaitingUntil = performance.now() + secs * 1000;
}

/** Returns true if the phrase meant something. */
export function speak(raw: string, api: EggAPI): boolean {
  const p = norm(raw);
  if (!p) return false;
  const waiting = awaiting && performance.now() < awaitingUntil ? awaiting : null;

  if (p === OATH || p.replace(/ /g, "") === OATH.replace(/ /g, "")) {
    if (!api.isOpen()) api.open();
    else api.say([{ text: "Mr Prongs is aware. Mr Prongs has never doubted it for a moment.", by: "Prongs" }]);
    return true;
  }
  if (p === "mischief managed") {
    if (api.isOpen()) api.close();
    else api.say([{ text: "Nothing to manage yet.", by: "Wormtail" }]);
    return true;
  }
  if (!api.isOpen()) {
    if (p.startsWith("reveal your secret") || p.includes("reveal")) {
      insults(api, "you");
      api.found("insults");
      return true;
    }
    if (p === "messrs" || ["moony", "wormtail", "padfoot", "prongs"].includes(p)) {
      api.say([{ text: "The parchment stays politely blank. Perhaps it is waiting for a particular solemn promise.", by: "Moony" }]);
      return true;
    }
    api.say([{ text: "Mr Padfoot is unimpressed. This parchment only opens for those who solemnly swear something.", by: "Padfoot" }]);
    return true;
  }

  // ----- passwords -----
  if (waiting === "sherbet" || p === "sherbet lemon" || p === "sherbet lemons") {
    if (p.includes("sherbet") || p.includes("lemon drop") || p.includes("cockroach cluster") || p.includes("acid pop")) {
      api.say([{ text: "The gargoyle springs aside. A spiral staircase carries you up and up, round and round…", by: "Moony" }]);
      api.flag("sherbet");
      api.found("sherbet");
      awaiting = null;
      api.goto("towers", { x: 146, y: 46, zoom: 2.6 });
      return true;
    }
  }
  if (waiting === "fatlady" || FAT_LADY_PASSWORDS.includes(p)) {
    if (FAT_LADY_PASSWORDS.includes(p)) {
      api.say([{ text: `"${cap(p)}" — the Fat Lady swings forward to reveal the round hole in the wall.`, by: "Prongs" }]);
      api.found("fatlady");
      awaiting = null;
      api.goto("towers", { x: 36, y: 46, zoom: 2.4 });
      return true;
    }
    api.say([{ text: "No password, no entry! — The Fat Lady", by: "Padfoot" }]);
    return true;
  }
  if (p === "dissendium") {
    api.flag("dissendium");
    api.found("dissendium");
    api.rerender();
    api.say([
      { text: "The witch's hump opens wide enough for a fairly thin person. Down a stone slide into a low, earthy passage…", by: "Wormtail" },
      { text: "All seven secret passages are now inked boldly. Mr Wormtail recommends Honeydukes' cellar.", by: "Wormtail" },
    ]);
    api.goto("grounds", { x: 1180, y: 450, zoom: 2 });
    return true;
  }
  if (p === "pine fresh" || p === "pine-fresh" || p === "golden egg") {
    api.flag("pinefresh");
    api.found("pinefresh");
    api.rerender();
    api.say([{ text: "The door to the Prefects' bathroom swings open. Mr Padfoot suggests bubbles.", by: "Padfoot" }]);
    api.goto("f5", { x: 234, y: 82, zoom: 2.6 });
    return true;
  }
  if (waiting === "eagle" || p === "footsteps" || p === "footprints") {
    if (p.includes("footstep") || p.includes("footprint") || p.includes("steps")) {
      api.say([{ text: "\"Well reasoned,\" says the eagle, and the door swings open.", by: "Moony" }]);
      api.found("eagle");
      awaiting = null;
      api.goto("towers", { x: 32, y: 118, zoom: 2.6 });
      return true;
    }
    if (waiting === "eagle") {
      api.say([{ text: "The eagle waits. A Ravenclaw would wait for a better answer too.", by: "Moony" }]);
      return true;
    }
  }
  if (waiting === "chamber" && (/^(s|h)+s+/.test(p.replace(/ /g, "")) || p === "open" || p === "open up")) {
    api.flag("chamber");
    api.found("chamber");
    api.rerender();
    api.say([
      { text: "The sink sinks. A pipe wide enough for a man to slide down yawns open…", by: "Moony" },
      { text: "The Marauders never drew this place. It draws itself, in hissing ink, for those who speak to snakes.", by: "Prongs" },
    ]);
    awaiting = null;
    api.goto("dungeons", { x: 215, y: 184, zoom: 2.2 });
    return true;
  }

  // ----- spells -----
  if (p === "lumos") {
    api.setNight(true);
    api.setLumos(true);
    api.found("lumos");
    api.say([{ text: "Lumos. Your wand-tip glows; move it over the parchment.", by: "Moony" }]);
    return true;
  }
  if (p === "nox") {
    api.setLumos(false);
    api.say([{ text: "Nox.", by: "Wormtail" }]);
    return true;
  }
  if (p === "lumos maxima" || p === "lumos solem") {
    api.setNight(false);
    api.setLumos(false);
    api.say([{ text: "Daylight floods the parchment.", by: "Prongs" }]);
    return true;
  }
  if (p.startsWith("accio ")) {
    const who = p.slice(6);
    const c = api.sim.chars.find((ch) => norm(ch.name).includes(who) || ch.id === who);
    if (!c) {
      api.say([{ text: `Mr Moony cannot find anyone called "${who}". Try a first name.`, by: "Moony" }]);
      return true;
    }
    const v = api.viewCenter();
    api.sim.summon(c.id, api.current().id, [v.x, v.y], 60);
    api.found("accio");
    api.say([{ text: `${c.name} feels an irresistible urge to come and see what you're looking at.`, by: "Padfoot" }]);
    return true;
  }
  if (p === "homenum revelio") {
    api.revealNames();
    api.found("homenum");
    api.say([{ text: "Every soul in the castle is underlined — the map's favourite spell.", by: "Moony" }]);
    return true;
  }
  if (p === "expecto patronum") {
    const sec = api.current();
    const v = api.viewCenter();
    const def = { id: "prongs-" + Date.now(), name: "Prongs", kind: "hoof" as const, role: "Patronus", desc: "A silvery stag.", start: "", day: [] };
    const nav = api.sim.navs[sec.id];
    const [x, y] = nav.nearestWalkable(v.x, v.y);
    const ch = api.sim.addChar({ ...def, start: `${sec.id}:${sec.spaces.find((s) => s.kind !== "hidden")!.id}`, speed: 3.2 }, { section: sec.id, x, y });
    api.found("patronus");
    api.say([{ text: "A silver stag erupts from your wand and gallops across the parchment. Prongs approves.", by: "Prongs" }]);
    setTimeout(() => api.sim.removeChar(ch.id), 25000);
    return true;
  }
  if (p === "obliviate") {
    api.hideLabels(10);
    api.say([{ text: "Who are all these people? Who are you?", by: "Wormtail" }]);
    return true;
  }
  if (p === "alohomora") {
    api.say([{ text: "The map is not a door, but Mr Moony appreciates the effort.", by: "Moony" }]);
    return true;
  }
  if (p === "full moon") {
    const on = !api.sim.fullMoon;
    api.sim.fullMoon = on;
    if (on) api.setNight(true);
    api.found("moon");
    api.say([{ text: on ? "The moon is full. Mr Moony has gone for a little walk — through a certain tunnel." : "The moon wanes. Mr Moony returns, somewhat scratched.", by: "Moony" }]);
    if (on) {
      const l = api.sim.get("lupin");
      if (l) api.goto(l.section, { x: l.x, y: l.y, zoom: 1.6 });
    }
    return true;
  }
  if (p === "time turner" || p === "timeturner") {
    timeTurner(api);
    return true;
  }
  if (p.startsWith("reveal your secret")) {
    insults(api, "you");
    api.found("insults");
    return true;
  }
  if (p === "riddikulus") {
    api.say([{ text: "Somewhere in the staff room wardrobe, a boggart is now wearing a very tall hat.", by: "Padfoot" }]);
    return true;
  }
  if (p === "moony" || p === "padfoot" || p === "prongs" || p === "wormtail" || p === "messrs") {
    const replies: Record<string, Line> = {
      moony: { text: "Mr Moony presents his compliments and reminds you that the library closes at eight.", by: "Moony" },
      padfoot: { text: "Mr Padfoot wags his tail. Figuratively.", by: "Padfoot" },
      prongs: { text: "Mr Prongs would like it known he is an excellent Chaser and a better stag.", by: "Prongs" },
      wormtail: { text: "Mr Wormtail is… busy. Somewhere. Small.", by: "Wormtail" },
      messrs: { text: "Messrs Moony, Wormtail, Padfoot and Prongs, at your service.", by: "Moony" },
    };
    api.say([replies[p]]);
    api.found("messrs");
    return true;
  }
  if (p === "up up down down left right left right b a" || p === "konami") {
    wildfire(api);
    return true;
  }
  return false;
}

function cap(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function insults(api: EggAPI, who: string) {
  api.say([
    { text: `Mr Moony presents his compliments to ${who}, and wonders whether anybody ever taught ${who === "you" ? "you" : "them"} the word "please".`, by: "Moony" },
    { text: "Mr Prongs agrees with Mr Moony, and would like to add that this parchment does not reveal itself to just anybody.", by: "Prongs" },
    { text: "Mr Padfoot would like to register his astonishment that anyone would try that line on a piece of parchment.", by: "Padfoot" },
    { text: "Mr Wormtail bids you good day, and advises you to try a little mischief first.", by: "Wormtail" },
  ]);
}

export function wildfire(api: EggAPI) {
  api.found("wildfire");
  api.burst(14);
  api.say([{ text: "Weasleys' Wildfire Whiz-Bangs! Fred and George send their regards — and their price list.", by: "Padfoot" }]);
}

function timeTurner(api: EggAPI) {
  const h = api.sim.get("hermione");
  if (!h || api.sim.get("hermione-2")) {
    api.say([{ text: "One Hermione at a time, please.", by: "Moony" }]);
    return;
  }
  const def = CHARACTERS.find((c) => c.id === "hermione")!;
  api.sim.addChar({ ...def, id: "hermione-2", desc: "Hermione Granger — again. She has been taking a lot of classes this year." }, { section: h.section, x: h.x, y: h.y });
  api.found("timeturner");
  api.say([{ text: "Hermione Granger appears… twice. She has been taking a great many classes this year.", by: "Prongs" }]);
  api.goto(h.section, { x: h.x, y: h.y, zoom: 2.4 });
  setTimeout(() => api.sim.removeChar("hermione-2"), 60000);
}

/** clicking a marked spot on the map */
export function hotspotEgg(egg: string, api: EggAPI) {
  switch (egg) {
    case "hourglass": {
      const pts = [312, 352, 426, 352].map((n) => n + Math.floor(Math.random() * 40));
      api.say([{ text: `Gryffindor ${pts[0]} · Slytherin ${pts[1]} · Ravenclaw ${pts[2]} · Hufflepuff ${pts[3]}. Ten points from whoever keeps poking the hourglasses.`, by: "Moony" }]);
      api.found("hourglass");
      break;
    }
    case "cabinet":
      api.say([{ text: "CONFISCATED AND HIGHLY DANGEROUS. Fred and George liberated this very map from that drawer in their first year. Mr Padfoot salutes them.", by: "Padfoot" }]);
      api.found("cabinet");
      break;
    case "gregory":
      api.say([{ text: "Behind Gregory the Smarmy: a passage the Weasley twins found in their very first week.", by: "Prongs" }]);
      api.found("gregory");
      break;
    case "chamber":
      expect("chamber");
      api.say([{ text: "One of the copper taps has a tiny snake scratched on it. It doesn't work. Perhaps if you asked it nicely — in its own language?", by: "Moony" }]);
      break;
    case "writing":
      api.say([{ text: "Something is daubed on the wall here in foot-high letters — a warning about a chamber, and its heir.", by: "Wormtail" }, { text: "It was painted, they say, in something rather redder than ink.", by: "Wormtail" }]);
      api.found("writing");
      break;
    case "sherbet":
      expect("sherbet");
      api.say([{ text: "An ugly stone gargoyle. It wants a password. The Headmaster is partial to sweets.", by: "Moony" }]);
      break;
    case "dissendium":
      api.say([{ text: "A humpbacked, one-eyed witch. Tap her hump with your wand and say the word… it begins with \"Diss\".", by: "Wormtail" }]);
      break;
    case "fluffy":
      harp();
      api.say([{ text: "You play a little tune. Somewhere beneath your feet, three enormous heads begin to snore.", by: "Padfoot" }]);
      api.found("fluffy");
      break;
    case "erised": {
      api.say([
        { text: "There is an inscription carved round the top of the frame. It only makes sense backwards.", by: "Moony" },
        { text: "It does not show your face — it shows what you want most. Mr Moony advises you not to stand there all night.", by: "Moony" },
      ]);
      const sec = api.current();
      if (sec.id === "f4" && !api.sim.get("visitor")) {
        api.sim.addChar({ id: "visitor", name: "You", kind: "shoe", role: "Reader of this map", desc: "The map knows exactly who is looking at it.", start: "f4:erised", day: ["f4:erised"], linger: 1 }, { section: "f4", x: 218, y: 80 });
        setTimeout(() => api.sim.removeChar("visitor"), 40000);
      }
      api.found("erised");
      break;
    }
    case "mirror":
      api.say([{ text: "Behind this mirror: a passage. Caved in last winter. Completely blocked.", by: "Padfoot" }]);
      api.found("mirror");
      break;
    case "boris":
      api.say([{ text: "Boris the Bewildered, wearing his gloves on the wrong hands. Fourth door to the left. It wants a password — something that smells of pine…", by: "Prongs" }]);
      break;
    case "ror": {
      const now = performance.now();
      tapestryClicks = tapestryClicks.filter((t) => now - t < 12000);
      tapestryClicks.push(now);
      if (tapestryClicks.length >= 3) {
        tapestryClicks = [];
        if (!api.has("ror")) {
          api.flag("ror");
          api.found("ror");
          api.rerender();
          api.say([
            { text: "You walk past the blank stretch of wall three times, thinking hard about what you need…", by: "Moony" },
            { text: "A door appears. The Room of Requirement — the one place in this castle the map has never shown. Not even we found it.", by: "Prongs" },
          ]);
        } else {
          api.unflag("ror");
          api.rerender();
          api.say([{ text: "The door melts back into the wall.", by: "Wormtail" }]);
        }
      } else {
        api.say([{ text: `Barnabas the Barmy's trolls pirouette. (Walk past the wall opposite… ${3 - tapestryClicks.length} more time${tapestryClicks.length === 2 ? "" : "s"}.)`, by: "Moony" }]);
      }
      break;
    }
    case "fatlady":
      expect("fatlady");
      api.say([{ text: "The portrait of a very fat woman in a pink silk dress. \"Password?\"", by: "Prongs" }]);
      break;
    case "slide":
      api.say([{ text: "A boy sets foot on the girls' staircase — there is a loud wailing klaxon and the steps melt into a long, smooth stone slide.", by: "Padfoot" }]);
      api.found("slide");
      break;
    case "eagle":
      expect("eagle");
      api.say([{ text: "The bronze eagle knocker speaks: \"The more you take, the more you leave behind. What am I?\"", by: "Moony" }]);
      break;
    case "fawkes":
      api.burst(3);
      api.say([{ text: "Fawkes bursts into flame and is reborn from the ashes. He does that.", by: "Prongs" }]);
      api.found("fawkes");
      break;
    case "willow":
      api.flag("willow");
      api.rerender();
      api.say([{ text: "Press the knot at the roots with a long stick and the Willow freezes. Underneath: a tunnel, all the way to a certain shack.", by: "Moony" }]);
      api.found("willow");
      break;
    case "squid":
      api.say([{ text: "The Giant Squid surfaces, takes a piece of toast from a passing student, and sinks again.", by: "Padfoot" }]);
      api.found("squid");
      break;
    case "aragog":
      api.say([{ text: "Follow the spiders. On second thoughts — don't.", by: "Wormtail" }]);
      api.found("aragog");
      break;
    case "buckbeak":
      api.say([{ text: "A hippogriff, tethered by the pumpkins. Be polite: a deep bow, and wait for one in return.", by: "Prongs" }]);
      api.found("buckbeak");
      break;
    case "gates":
      api.say([{ text: "The gates, flanked by winged boars. This year, Dementors stand guard beyond them. Mr Moony suggests chocolate.", by: "Moony" }]);
      api.found("gates");
      break;
  }
}

/** clicking certain people */
export function personEgg(id: string, api: EggAPI): boolean {
  if (id === "pettigrew") {
    api.say([
      { text: "Peter Pettigrew? But Peter Pettigrew has been dead for twelve years…", by: "Padfoot" },
      { text: "The map never lies.", by: "Moony" },
    ]);
    api.found("pettigrew");
    return true;
  }
  if (id === "crouch") {
    api.say([{ text: "Bartemius Crouch — prowling about at this hour? The map cannot be fooled by a borrowed face.", by: "Prongs" }]);
    api.found("crouch");
    return true;
  }
  if (id === "hermione" && !api.sim.get("hermione-2") && Math.random() < 0.5) {
    timeTurner(api);
    return true;
  }
  if (id === "sirius") {
    api.say([{ text: "Padfoot. Mr Padfoot would like to point out that he is innocent, and that he is a very good dog.", by: "Padfoot" }]);
    api.found("sirius");
    return true;
  }
  if (id === "visitor") {
    api.say([{ text: "Yes, you. Mischief, remember?", by: "Prongs" }]);
    return true;
  }
  return false;
}
