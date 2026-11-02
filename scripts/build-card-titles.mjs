// Rebuilds data/card-titles.json from the card title master (data/concept-cards.js) and the pages in
// data/content.js. Each card gets its corrected title and the group of the page that covers it.
// Run with: node scripts/build-card-titles.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cards from "../data/concept-cards.js";
import { entries } from "../data/content.js";

const here = dirname(fileURLToPath(import.meta.url));
const path = join(here, "..", "data", "card-titles.json");
const existing = JSON.parse(readFileSync(path, "utf8"));

const titleOf = new Map();
for (const card of cards) for (const number of card.numbers) titleOf.set(number, card.key);

const groupOf = new Map();
for (const entry of entries) {
  for (const title of entry.titles ?? []) if (!groupOf.has(title)) groupOf.set(title, entry.group);
}

// Cards on these topics keep their written page but show no picture in the app, until Mo has reviewed
// the pictures. Eating and body-image cards follow his memory notes. Self-harm, suicide, choking, and
// self-injury follow the README rules. Cannibalism, mutilation, and gore are a conservative default.
// The pictures were checked on a contact sheet on 2 Nov. Remove a pattern here to show its cards.
const HIDDEN = /ANOREXIA|BULIMIA|BINGE|EATING DISORDER|AVOIDANT\/RESTRICTIVE|ORTHOREXIA|PURGING|DYSMORPH|BODY CHECKING|INTEGRITY IDENTITY|APOTEMNO|SUICID|SELF-HARM|SELF-INJURY|SELF-DESTRUCTIVE|AUTOASSASSIN|ASPHYXIO|EVISCEROPHIL|MUTILOPHIL|CANNIBAL|GOREPHILE|ANTHROPOPHAG|GROTESQUOPHILE/;

let untitled = 0;
let ungrouped = 0;
let hidden = 0;
const rows = existing.map((row) => {
  const title = titleOf.get(row.number) ?? "";
  const group = title ? groupOf.get(title) ?? "" : "";
  if (!title) untitled++;
  else if (!group) ungrouped++;
  const isHidden = HIDDEN.test(title);
  if (isHidden) hidden++;
  return { number: row.number, source: row.source, title, group, ...(isHidden ? { hidden: true } : {}) };
});

writeFileSync(path, JSON.stringify(rows, null, 1) + "\n", "utf8");
console.log(`cards ${rows.length}, untitled ${untitled}, titled but without a page ${ungrouped}, hidden pictures ${hidden}`);
