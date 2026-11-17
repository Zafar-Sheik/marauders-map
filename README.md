# The Marauder's Map

An interactive, animated, folding Marauder's Map of Hogwarts, built with **Next.js 15**, **three.js** and **GSAP**.

Swear the oath, and a blank sheet of parchment inks its own title, lifts off the desk and unfolds panel by panel (an accordion of columns, each with top and bottom flaps) while the ink bleeds out across it. Every floor of the castle, the dungeons, the tower tops and the grounds are separate sections of the sheet; moving between them folds the map shut and opens it again on a new section.

```bash
npm install
npm run dev     # http://localhost:3000
```

## What's on it

| Section | Contents |
| --- | --- |
| **The Grounds** | Castle footprint, Black Lake, Forbidden Forest, Hagrid's hut and pumpkin patch, Whomping Willow, greenhouses 1–3, Quidditch pitch, boathouse, the gates, Shrieking Shack, Hogsmeade (Honeydukes, Three Broomsticks, Zonko's, Hog's Head, Post Office, Gladrags, station), and the seven secret passages |
| **Dungeons** | Potions classroom, Snape's office, the private stores, Dungeon Five, the kitchens under the Great Hall, Hufflepuff and Slytherin common rooms |
| **Ground floor** | Entrance Hall, Great Hall (house tables, staff table, floating candles), antechamber, Classroom Eleven, staff room, Filch's office, Transfiguration and Clock Tower courtyards |
| **Floors 1–7** | Hospital Wing, Transfiguration, McGonagall's office, History of Magic, Moaning Myrtle's lavatory, Trophy Room, Charms, Defence Against the Dark Arts, the out-of-bounds third-floor corridor, the Library and Restricted Section, the mirror classroom, Prefects' bathroom, Flitwick's office, the Fat Lady, the Room of Requirement (hidden) and more |
| **The Towers** | Gryffindor common room and dormitories, Ravenclaw common room, Divination (North Tower), Astronomy Tower, Headmaster's office, the Owlery |

### Scale
Everything is laid out in metres, with a scale bar on each sheet. All castle floors share one 360 × 240 m frame, so the Grand Staircase, the corridors and the towers sit in the same place on every floor. The grounds use a 1500 × 800 m frame and the tower tops a 180 × 160 m frame. The books never give an architectural plan, so the floor each room sits on follows canon where canon says (see below), and the rest of the layout is our own.

### Footsteps
Around 60 people walk the castle in real time. Each has a routine (classes, meals, common room, the pitch, Hagrid's hut, Hogsmeade) that changes after dark; they path-find with A* over a 1 m navigation grid, climb staircases and ladders between sections, and some of them (the twins, Harry, Lupin, Sirius, Wormtail…) know the secret passages. They leave fading inked footprints with a name flag: shoes, boots, heels, bare feet, cat paws, a dog, a rat, a hippogriff-sized stag Patronus, and the drifting wisps of ghosts and Peeves.

Click a name to see where they are, then **Follow the footprints** — the map follows them from floor to floor. **Find a Person** lists everyone and their current room.

## Lore notes used for the layout

- Created by Moony, Wormtail, Padfoot and Prongs. Opened with *"I solemnly swear that I am up to no good"*, wiped with *"Mischief managed"*; it insults anyone who demands it reveal itself.
- Shows every person in the grounds by name, wherever they are, and cannot be fooled by disguises, Polyjuice or Animagus forms — which is how it gives away Peter Pettigrew and Barty Crouch Jr.
- Shows seven secret passages out of the castle: Filch knows four, one behind the fourth-floor mirror has caved in, one runs from the Whomping Willow to the Shrieking Shack, and one runs from the one-eyed witch on the third floor to Honeydukes' cellar.
- Does **not** show the Room of Requirement (seventh floor, opposite the tapestry of Barnabas the Barmy) or the Chamber of Secrets.
- Floor placements from the books: Trophy Room, one-eyed witch and the forbidden corridor on the third floor; Library and caved-in mirror passage on the fourth; Prefects' bathroom and Boris the Bewildered on the fifth; Fat Lady and Room of Requirement on the seventh; Ravenclaw in the west tower, Divination at the top of the North Tower; kitchens beneath the Great Hall with Hufflepuff nearby; Potions and Slytherin in the dungeons under the lake.
- Colour: the map is drawn as dark iron-gall style brown ink on warm, yellowed parchment that darkens at the edges and along its creases.

## Things to try (no spoilers beyond this list)

Type into the bar at the bottom, or just type anywhere:
`lumos`, `nox`, `homenum revelio`, `accio <name>`, `expecto patronum`, `dissendium`, `full moon`, `time turner`, a Fat Lady password, a Prefects' bathroom password, the gargoyle's password, the Konami code… and click on anything that looks like a statue, a painting, a mirror, a sink or a tapestry. There are 24 secrets to find.

## Code map

```
app/                 Next.js app router entry, fonts, global styles
components/
  Marauders.tsx      state machine (closed → opening → open ⇄ switching → closing), UI, eggs API
  FoldingSheet.ts    three.js sheet: hinged column/flap hierarchy, ink-bleed shader, dust motes
  MapView.ts         2D canvas view: pan/zoom/pinch, live footprints, hit-testing, lumos
lib/
  castle.ts          every section, room, door, portal, passage and hotspot (metres)
  sim.ts             characters and their routines; section-hopping route planner
  nav.ts             navigation grid, A*, string-pulling
  render.ts          parchment + ink renderer (walls, hatching, decor, labels, cartouche, compass)
  parchment.ts       procedural aged parchment
  footprints.ts      footprint shapes & name flags
  eggs.ts            spells, passwords and easter eggs
  audio.ts           synthesised paper rustles, quill scratches and a harp
```

This is an unofficial fan project. All artwork is drawn procedurally in code; no film or book assets are used.
