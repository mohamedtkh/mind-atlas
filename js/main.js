// Starts the app: reads the saved settings, the concept pages and the card list, then draws the
// page for the current address and redraws whenever the address changes.
import { parseRoute } from "./router.js";
import { loadPrefs } from "./prefs.js";
import { renderHome, renderGroup, renderEntry, renderAbout } from "./views.js";
import { renderCards, renderCard } from "./cards-view.js";
import { entries } from "../data/content.js";

const main = document.getElementById("main");
const prefs = loadPrefs();
let concepts = {};
let cards = [];
let teardown = null;

async function loadJson(url, fallback) {
  try {
    const response = await fetch(url, { cache: "no-cache" });
    return response.ok ? await response.json() : fallback;
  } catch {
    return fallback;
  }
}

function render() {
  if (teardown) {
    teardown();
    teardown = null;
  }
  const route = parseRoute(location.hash);
  const context = { prefs, concepts, cards, entries };
  let next = null;
  if (route.name === "entry") next = renderEntry(main, route.id, context);
  else if (route.name === "group") renderGroup(main, route.id);
  else if (route.name === "cards") next = renderCards(main, context);
  else if (route.name === "card") next = renderCard(main, route.number, context);
  else if (route.name === "about") renderAbout(main);
  else renderHome(main, context);
  teardown = typeof next === "function" ? next : null;

  const heading = main.querySelector("h1")?.textContent;
  document.title = heading ? `${heading} | Mind Atlas` : "Mind Atlas";
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

document.querySelector(".skip")?.addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
});
window.addEventListener("hashchange", render);

// Each card has its picture (from the card index), and its title and group (from the card titles).
// Cards marked hidden have no picture in the app until they are reviewed (see README, "Content rules").
Promise.all([
  loadJson("assets/concepts/manifest.json", {}),
  loadJson("assets/cards/index.json", []),
  loadJson("data/card-titles.json", []),
]).then(([conceptList, cardIndex, cardTitles]) => {
  const infoByNumber = new Map(cardTitles.map((card) => [card.number, card]));
  concepts = conceptList;
  cards = cardIndex
    .map((card) => {
      const info = infoByNumber.get(card.number) || {};
      return { ...card, title: info.title || "", group: info.group || "", hidden: Boolean(info.hidden) };
    })
    .filter((card) => !card.hidden);
  render();
});
