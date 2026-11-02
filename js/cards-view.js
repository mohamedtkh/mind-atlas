// The card pages: a gallery of every card, and one page per card with its 3D animated relief.
// Each card is lifted into 3D from its own picture and moves in the style of its group.
import { createFeelView } from "./scene.js";
import { savePrefs } from "./prefs.js";
import { STYLES } from "./motion.js";
import { groups } from "../data/content.js";
import { PARTICLES_FOR, displayName } from "../data/concepts/index.js";

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(4, "0");

// A card moves in the style of its group. A card with no group yet moves in a style that follows
// its number, so the cards still move differently from one another.
function motionFor(card) {
  const group = groups.find((g) => g.id === card.group);
  if (group) return group.style;
  return STYLES[(card.number - 1) % STYLES.length];
}

function cardEntry(card, title) {
  const style = motionFor(card);
  return {
    id: `card-${pad(card.number)}`,
    name: title,
    scene: {
      style,
      particles: PARTICLES_FOR[style],
      palette: card.palette,
      caption: `Card ${pad(card.number)}, lifted into 3D and moving in a ${style} motion.`,
    },
  };
}

export function renderCards(root, ctx) {
  const thumbs = ctx.cards
    .map(
      (card) => `
      <li><a class="thumb" href="#/card/${card.number}" data-number="${card.number}">
        <img src="assets/cards/${esc(card.color)}" alt="" loading="lazy">
        <span>Card ${pad(card.number)}</span>
      </a></li>`,
    )
    .join("");

  root.innerHTML = `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a></nav>
    <h1>All cards</h1>
    <p class="lede">${ctx.cards.length} cards. Each one is lifted into 3D from its own picture. Open a card to watch it move.</p>
    <label class="search">
      <span class="visually-hidden">Find a card by number</span>
      <input id="cardsearch" type="search" inputmode="numeric" placeholder="Find a card by number" autocomplete="off">
    </label>
    <ul class="thumbs">${thumbs}</ul>`;

  const input = root.querySelector("#cardsearch");
  const items = [...root.querySelectorAll(".thumbs > li")];
  input.addEventListener("input", () => {
    const query = input.value.trim();
    for (const item of items) {
      const link = item.querySelector("a");
      item.hidden = Boolean(query) && !link.dataset.number.includes(query);
    }
  });
  return null;
}

export function renderCard(root, number, ctx) {
  const index = ctx.cards.findIndex((card) => card.number === number);
  if (index < 0) {
    root.innerHTML = `<h1>Card not found</h1><p>There is no card with that number. <a href="#/cards">Back to all cards</a>.</p>`;
    return null;
  }
  const card = ctx.cards[index];
  const prev = ctx.cards[index - 1];
  const next = ctx.cards[index + 1];
  const title = card.title ? displayName(card.title) : `Card ${pad(card.number)}`;
  const condition = card.title ? ctx.entries.find((entry) => (entry.titles || []).includes(card.title)) : null;

  root.innerHTML = `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a> / <a href="#/cards">All cards</a></nav>
    <h1>${esc(title)}</h1>
    <p class="lede">Card ${pad(card.number)}, lifted into 3D from its own picture. Drag to turn it, pinch or scroll to zoom.</p>
    ${condition ? `<p><a href="#/entry/${esc(condition.id)}">Read about ${esc(condition.name)}</a></p>` : ""}

    <section class="scene-card" aria-label="3D view">
      <div class="scene" data-scene></div>
      <div class="controls" role="group" aria-label="3D view controls">
        <button type="button" data-pause aria-pressed="false">Pause motion</button>
        <button type="button" data-calm aria-pressed="${ctx.prefs.calm ? "true" : "false"}">Calm mode</button>
        <button type="button" data-reset>Reset view</button>
      </div>
    </section>

    <nav class="pager" aria-label="Other cards">
      ${prev ? `<a href="#/card/${prev.number}">← Card ${pad(prev.number)}</a>` : "<span></span>"}
      ${next ? `<a href="#/card/${next.number}">Card ${pad(next.number)} →</a>` : "<span></span>"}
    </nav>`;

  const sceneBox = root.querySelector("[data-scene]");
  const pauseButton = root.querySelector("[data-pause]");
  const calmButton = root.querySelector("[data-calm]");
  const view = createFeelView(sceneBox, {
    entry: cardEntry(card, title),
    calm: ctx.prefs.calm,
    relief: { color: `assets/cards/${card.color}`, depth: card.depth ? `assets/cards/${card.depth}` : null },
  });
  if (!view) {
    sceneBox.innerHTML = `<p class="scene-fallback">The 3D view needs WebGL, which this browser or device does not offer.</p>`;
  }

  pauseButton.addEventListener("click", () => {
    const paused = pauseButton.getAttribute("aria-pressed") !== "true";
    pauseButton.setAttribute("aria-pressed", String(paused));
    view?.setPaused(paused);
  });
  calmButton.addEventListener("click", () => {
    ctx.prefs.calm = !ctx.prefs.calm;
    savePrefs(ctx.prefs);
    calmButton.setAttribute("aria-pressed", String(ctx.prefs.calm));
    view?.setCalm(ctx.prefs.calm);
  });
  root.querySelector("[data-reset]").addEventListener("click", () => view?.resetView());

  return () => view?.dispose();
}
