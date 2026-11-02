// Maps the address-bar hash to a page. For example, "#/entry/panic" opens the Panic attacks page,
// and "#/card/12" opens card 12. A hash router is used so the app works from any folder and as a
// Home Screen app on iPhone.

const safeDecode = (part) => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
};

export function parseRoute(hash) {
  const [first, second] = String(hash || "")
    .replace(/^#/, "")
    .split("/")
    .filter(Boolean)
    .map(safeDecode);
  if (first === "group" && second) return { name: "group", id: second };
  if (first === "entry" && second) return { name: "entry", id: second };
  if (first === "card" && second) return { name: "card", number: Number(second) };
  if (first === "cards") return { name: "cards" };
  if (first === "about") return { name: "about" };
  return { name: "home" };
}
