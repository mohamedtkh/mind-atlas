import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { groups, entries, curated } from "../data/content.js";
import { conceptGaps, copingGaps, displayName } from "../data/concepts/index.js";
import { STYLES } from "../js/motion.js";

const HEX = /^#[0-9a-f]{6}$/i;
const CODES = ["P", "A", "M", "D", "T", "C", "R", "V", "U", "K", "F", "B"];
const CHILD_RELATED = ["PEDOPHILIA", "EPHEBOPHILIA", "HEBEPHILIA", "INFANTOPHILIA", "NEPIOPHILIA"];
const groupIds = new Set(groups.map((g) => g.id));
const here = dirname(fileURLToPath(import.meta.url));
const cardTitles = JSON.parse(readFileSync(join(here, "..", "data", "card-titles.json"), "utf8"));

test("group ids are unique and URL-safe, and each group has a code, text and motion", () => {
  assert.equal(new Set(groups.map((g) => g.id)).size, groups.length);
  for (const g of groups) {
    assert.match(g.id, /^[a-z0-9-]+$/, g.id);
    assert.ok(CODES.includes(g.code), `${g.id}: unknown code "${g.code}"`);
    assert.ok(g.name.length > 2 && g.blurb.length > 20, `${g.id}: name or blurb is missing`);
    assert.ok(STYLES.includes(g.style), `${g.id}: unknown style "${g.style}"`);
  }
});

test("entry ids are unique, URL-safe, and point at a real group", () => {
  assert.equal(new Set(entries.map((e) => e.id)).size, entries.length);
  for (const e of entries) {
    assert.match(e.id, /^[a-z0-9-]+$/, e.id);
    assert.ok(groupIds.has(e.group), `${e.id}: unknown group "${e.group}"`);
  }
});

test("every concept has its text and its own what-can-help line", () => {
  assert.deepEqual(conceptGaps(curated), []);
  assert.deepEqual(copingGaps(curated), []);
});

test("every entry has the text each page needs, including what can help", () => {
  for (const e of entries) {
    assert.ok(typeof e.name === "string" && e.name.trim().length > 2, `${e.id}.name is missing`);
    assert.ok(!/undefined|\s{2,}/.test(e.name), `${e.id}.name is malformed: ${e.name}`);
    for (const field of ["short", "feels", "looks", "misreadings", "help", "coping"]) {
      const min = field === "short" ? 15 : 40;
      assert.ok(typeof e[field] === "string" && e[field].trim().length > min, `${e.id}.${field} is missing or too short`);
    }
  }
});

test("every entry's help section gives a crisis line (988 or 911)", () => {
  for (const e of entries) assert.match(e.help, /988|911/, `${e.id} help must include 988 or 911`);
});

test("entries about sexual interest in children give the Stop It Now helpline", () => {
  for (const e of entries) {
    if (CHILD_RELATED.includes(e.name.toUpperCase())) assert.match(e.help, /1-888-773-8368/, `${e.id} help`);
  }
});

test("every 3D scene has a known motion, palette and particle kind", () => {
  for (const e of entries) {
    const s = e.scene;
    assert.ok(STYLES.includes(s.style), `${e.id}: unknown style "${s.style}"`);
    assert.ok(["fog", "sparks", "dust", "none"].includes(s.particles), `${e.id}: unknown particles "${s.particles}"`);
    for (const key of ["background", "fog", "figure", "ground", "accent"]) {
      assert.match(s.palette[key], HEX, `${e.id}: palette.${key}`);
    }
    assert.ok(s.caption.length > 10, `${e.id}: caption is too short`);
  }
});

test("every titled card leads to a page", () => {
  for (const card of cardTitles) {
    if (!card.title) continue;
    assert.ok(entries.some((e) => (e.titles || []).includes(card.title)), `card ${card.number} (${card.title}) has no page`);
  }
});

test("display names keep acronyms, Roman numerals and small words right", () => {
  assert.equal(displayName("ATTENTION-DEFICIT/HYPERACTIVITY DISORDER (ADHD)"), "Attention-Deficit/Hyperactivity Disorder (ADHD)");
  assert.equal(displayName("BIPOLAR I DISORDER"), "Bipolar I Disorder");
  assert.equal(displayName("THE LOOSE"), "The Loose");
  assert.equal(displayName("WINDOW OF TOLERANCE EXPANSION"), "Window of Tolerance Expansion");
  assert.equal(displayName("CREUTZFELDT-JAKOB DISEASE"), "Creutzfeldt-Jakob Disease");
});
