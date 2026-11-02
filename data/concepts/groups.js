// Works out which card titles belong to one concept entry. Titles that differ only in spacing,
// hyphens, punctuation, bracketed notes, a leading "THE", or a -PHOBE/-PHOBIA, -PHILE/-PHILIA or
// -MANIAC/-MANIA ending are one concept. aliases.js adds titles that use different words.
import aliases from "./aliases.js";

export function normalize(name) {
  return name
    .replace(/\([^)]*\)/g, "")
    .replace(/^THE\s+/, "")
    .replace(/PHOBIA$|PHOBE$/, "PHOB")
    .replace(/PHILIA$|PHILE$/, "PHIL")
    .replace(/MANIAC$|MANIA$/, "MANI")
    .replace(/[^A-Z0-9]/g, "");
}

const redirect = new Map();
for (const [canonical, list] of Object.entries(aliases)) {
  for (const alias of list) redirect.set(normalize(alias), normalize(canonical));
}

function resolve(id) {
  let current = id;
  while (redirect.has(current) && redirect.get(current) !== current) current = redirect.get(current);
  return current;
}

// Prefers a plain name over one with brackets or "THE", then the longer word (PHOBIA over PHOBE).
function pickCanonical(names) {
  const rank = (name) => (name.includes("(") ? 2 : 0) + (name.startsWith("THE ") ? 1 : 0);
  return [...names].sort((a, b) => rank(a) - rank(b) || b.length - a.length || (a < b ? -1 : 1))[0];
}

// One record per concept: { canonical, names, claimed }. A concept is "claimed" when a hand-written
// entry already lists one of its titles; the concept builder leaves those out.
export function conceptGroups(keys, curatedTitles) {
  const curated = new Set(curatedTitles);
  const curatedIds = new Set(curatedTitles.map(normalize));
  const buckets = new Map();
  for (const key of keys) {
    const id = resolve(normalize(key));
    if (!buckets.has(id)) buckets.set(id, []);
    buckets.get(id).push(key);
  }
  return [...buckets.values()].map((names) => {
    const explicit = names.find((name) => Object.hasOwn(aliases, name));
    return {
      canonical: explicit ?? pickCanonical(names),
      names,
      claimed: names.some((name) => curated.has(name) || curatedIds.has(normalize(name))),
    };
  });
}
