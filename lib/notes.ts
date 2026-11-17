/**
 * Handwritten marginalia, scribbled into the rooms by Messrs M, W, P & P.
 * Keyed "section:spaceId". Each line is placed inside the room along its walls.
 */
export const NOTES: Record<string, string[]> = {
  /* ---------------- ground floor ---------------- */
  "f0:entrance": ["hourglasses — do NOT nick the rubies", "front doors bolted at night", "Filch's lantern usually lurks here", "marble stairs ↑ — dungeon steps ↓"],
  "f0:greathall": ["Gryffindor table", "Hufflepuff table", "Ravenclaw table", "Slytherin table", "ceiling shows the sky — bring no umbrella", "best seat: nearest the toast", "owl post arrives at breakfast"],
  "f0:antechamber": ["fireplace", "portraits gossip"],
  "f0:classroom11": ["moss floor, real trees", "lie back & watch the stars"],
  "f0:staffroom": ["old wardrobe — rattles", "teachers' robes", "mismatched chairs"],
  "f0:broom": ["mops, buckets", "excellent for hiding"],
  "f0:tcourt": ["fountain", "a good place to revise", "benches round the edge"],
  "f0:clockcourt": ["the big clock", "pendulum bridge →", "beware snowball ambushes"],
  "f0:filch": ["CONFISCATED drawer", "chains in the corner (unused, he says)", "Mrs Norris's basket", "detention records"],
  "f0:s1": [],
  "f0:e1": ["cloaks & umbrellas"],
  "f0:e2": ["Filch's buckets"],
  "f0:nw": ["oilskins, lanterns, stout boots"],

  /* ---------------- dungeons ---------------- */
  "dungeons:potions": ["cauldrons — pewter, size 2", "ingredients cupboard", "Snape's desk", "pickled things — don't look", "sinks at the back"],
  "dungeons:store": ["boomslang skin", "bicorn horn", "gillyweed (well hidden)"],
  "dungeons:snape": ["jars of slimy things", "his private fire", "fireplace — Floo?"],
  "dungeons:dungeon5": ["black velvet drapes", "orchestra of musical saws", "rotten food — ghosts only"],
  "dungeons:kitchens": ["four tables under the four above", "house-elves, about a hundred", "great hearth", "ask for éclairs — always yes", "tea towels as uniforms"],
  "dungeons:huff": ["barrels near the kitchen corridor", "copper plant pots", "round doors to the dormitories", "smells of good soil"],
  "dungeons:slyth": ["green lamps on chains", "carved chairs", "windows into the lake", "skull-ish fireplace", "dormitories ↓"],
  "dungeons:dcorr": ["torches", "drafty", "the long way to the kitchens"],

  /* ---------------- first floor ---------------- */
  "f1:hospital": ["beds — twelve of them", "screens for the poorly", "Skele-Gro cupboard", "chocolate for shocks", "no visitors after eight"],
  "f1:pomfrey": ["potions, bandages", "her cat-sized kettle"],
  "f1:transfig": ["desks in pairs", "cages of things to transfigure", "McGonagall's desk", "tabby cat on the desk = she's here"],
  "f1:mcg": ["tartan tins of biscuits", "fire in the grate", "shelves of marking"],
  "f1:hom": ["the ghost teaches from the blackboard", "best place for a nap", "goblin rebellions, all of them"],
  "f1:muggle": ["plugs, a rubber duck, a toaster"],
  "f1:main": ["Gregory the Smarmy — passage behind", "portraits, sleepy"],

  /* ---------------- second floor ---------------- */
  "f2:myrtle": ["sinks in a ring", "OUT OF ORDER", "the third tap won't turn", "she listens from the U-bend", "cubicles"],
  "f2:runes": ["rune charts", "dictionaries, very heavy"],
  "f2:lockhart": ["portraits of himself", "lilac ink", "fan mail in sacks"],
  "f2:arith": ["number charts", "Vector's desk"],
  "f2:main": ["writing on the wall was here", "a puddle that never dries"],

  /* ---------------- third floor ---------------- */
  "f3:trophy": ["Quidditch cups", "medals, polished by detention", "one shield worth reading", "a suit of armour that clanks"],
  "f3:charms": ["Flitwick's pile of books", "feathers for levitating", "cushions — Summoning practice"],
  "f3:dada": ["skeleton of a dragon (or similar)", "wardrobe — boggart?", "projector", "stairs to the office →"],
  "f3:lupin": ["grindylow tank", "chocolate drawer", "kettle always on"],
  "f3:armour": ["suits of armour", "they sing at Christmas"],
  "f3:forbidden": ["locked door — Alohomora", "do not follow the growling"],
  "f3:fluffy": ["three heads", "harp", "trapdoor ↓ — Devil's Snare below"],
  "f3:main": ["one-eyed witch — DISSENDIUM", "hump opens"],

  /* ---------------- fourth floor ---------------- */
  "f4:library": ["Madam Pince's desk", "reading tables", "card catalogue", "quills squeak — silence!", "Hermione's usual table", "History section", "Herbology section"],
  "f4:restricted": ["rope — keep out", "book that screams", "need a teacher's note", "lamps go out at curfew"],
  "f4:erised": ["piled desks", "wastepaper basket", "the mirror — tall, gold, clawed feet"],
  "f4:c4b": ["Ancient Runes overflow"],
  "f4:main": ["the big mirror — passage caved in"],

  /* ---------------- fifth floor ---------------- */
  "f5:prefects": ["bath like a pool", "a hundred taps", "mermaid in the window", "fluffy white towels", "golden egg sings here"],
  "f5:main": ["Boris the Bewildered — count four doors left"],
  "f5:c5b": ["broken globes"],
  "f5:c5c": ["dusty bookcases", "a chessboard, mid-game"],

  /* ---------------- sixth floor ---------------- */
  "f6:boysbath": ["sinks", "cracked mirror", "Myrtle visits"],
  "f6:slug": ["crystallised pineapple", "hourglass on the desk", "photos of favourites"],
  "f6:c6a": ["Apparition lessons? no — Great Hall"],

  /* ---------------- seventh floor ---------------- */
  "f7:ror": ["walk past three times", "think hard about what you need", "the door appears here"],
  "f7:flitwick": ["thirteenth window from the right", "a very tall stool"],
  "f7:c7a": ["moving portraits outside"],
  "f7:c7b": ["portraits — some empty, some visiting"],
  "f7:main": ["Barnabas the Barmy, opposite", "trolls in tutus", "the Fat Lady → east"],

  /* ---------------- towers ---------------- */
  "towers:gcommon": ["squashy armchairs", "fireplace — Sirius once appeared in it", "notice board", "best chair: by the fire", "portrait hole"],
  "towers:gboys": ["four-posters, red curtains", "trunks at the foot", "a rat sleeps here (suspicious)"],
  "towers:ggirls": ["four-posters", "staircase turns into a slide"],
  "towers:head": ["silver instruments", "portraits of heads", "Sorting Hat on the shelf", "Pensieve cabinet", "phoenix perch", "sherbet lemons"],
  "towers:rav": ["starry dome", "statue of the founder", "bookcases", "door knocker asks riddles"],
  "towers:div": ["little round tables", "crystal balls", "teacups — read the leaves", "trapdoor & silver ladder", "far too warm"],
  "towers:astro": ["telescopes", "star charts", "a long, long way down"],
  "towers:owlery": ["perches to the roof", "straw underfoot", "school owls", "windows unglazed — cold"],

  /* ---------------- grounds ---------------- */
  "grounds:hut": ["Fang's basket", "kettle", "rock cakes — avoid", "dragon egg (once)"],
  "grounds:pitch": ["hoops", "Gryffindor stand", "Slytherin stand", "teachers' box", "changing rooms"],
  "grounds:willow": ["press the knot", "it hits back"],
  "grounds:shack": ["boarded windows", "bloodstains — not ghosts", "the tunnel comes up here"],
  "grounds:honeydukes": ["cellar trapdoor", "sugar quills", "Fizzing Whizzbees"],
  "grounds:broomsticks": ["Butterbeer", "Madam Rosmerta"],
  "grounds:hogshead": ["goats", "nobody asks questions"],
  "grounds:boatyard": ["boats for the first-years"],
  "grounds:station": ["Hogwarts Express — 11 o'clock from London"],
};
