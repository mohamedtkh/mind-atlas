// The page builders. Each one fills the <main> element. A condition page returns a teardown
// function, so its WebGL view is released when the reader leaves the page.
import { groups, entries } from "../data/content.js";
import { createFeelView } from "./scene.js";
import { savePrefs } from "./prefs.js";

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(4, "0");
const groupById = (id) => groups.find((g) => g.id === id);
const entryById = (id) => entries.find((e) => e.id === id);
const countIn = (groupId) => entries.filter((e) => e.group === groupId).length;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const entryLink = (entry) =>
  `<li><a class="item" href="#/entry/${esc(entry.id)}"><strong>${esc(entry.name)}</strong><span>${esc(entry.short)}</span></a></li>`;

export function renderNotFound(root) {
  root.innerHTML = `
    <h1>Page not found</h1>
    <p>That page does not exist. <a href="#/">Go to the start</a>.</p>`;
  return null;
}

export function renderHome(root, ctx = { cards: [] }) {
  const cards = groups
    .map(
      (g) => `
      <a class="card" href="#/group/${esc(g.id)}">
        <h3>${esc(g.name)}</h3>
        <p>${esc(g.blurb)}</p>
        <span class="count">${plural(countIn(g.id), "topic")}</span>
      </a>`,
    )
    .join("");

  root.innerHTML = `
    <section class="intro">
      <h1>Mind Atlas</h1>
      <p class="lede">A calm, plain-language guide to mental health: conditions, fears, thinking patterns, strengths, and what helps. Choose a topic to read about it, then turn the 3D view to see how it can feel.</p>
      <label class="search">
        <span class="visually-hidden">Search conditions</span>
        <input id="search" type="search" placeholder="Search, for example worry or sleep" autocomplete="off">
      </label>
      <div id="results" class="results" aria-live="polite"></div>
      ${ctx.cards.length ? `<p class="all-cards"><a href="#/cards">Browse all ${ctx.cards.length} cards in 3D</a></p>` : ""}
    </section>
    <section aria-labelledby="browse">
      <h2 id="browse">Browse by group</h2>
      <div class="groups">${cards}</div>
    </section>`;

  const input = root.querySelector("#search");
  const results = root.querySelector("#results");
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      results.innerHTML = "";
      return;
    }
    const hits = entries.filter((e) => {
      const group = groupById(e.group);
      return `${e.name} ${e.short} ${group ? group.name : ""}`.toLowerCase().includes(query);
    });
    results.innerHTML = hits.length
      ? `<ul class="list">${hits.map(entryLink).join("")}</ul>`
      : `<p class="muted">No matches for "${esc(input.value.trim())}". Try a simpler word.</p>`;
  });
  return null;
}

export function renderGroup(root, id) {
  const group = groupById(id);
  if (!group) return renderNotFound(root);
  const list = entries.filter((e) => e.group === id);
  root.innerHTML = `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a></nav>
    <h1>${esc(group.name)}</h1>
    <p class="lede">${esc(group.blurb)}</p>
    <ul class="list">${list.map(entryLink).join("")}</ul>`;
  return null;
}

// A condition page. Its 3D view shows each of its cards in turn, lifted from the card's own picture.
export function renderEntry(root, id, ctx) {
  const entry = entryById(id);
  if (!entry) return renderNotFound(root);
  const group = groupById(entry.group);
  const siblings = entries.filter((e) => e.group === entry.group);
  const index = siblings.indexOf(entry);
  const prev = siblings[index - 1];
  const next = siblings[index + 1];

  const cards = entry.titles ? ctx.cards.filter((card) => entry.titles.includes(card.title)) : [];
  const fallback = ctx.concepts[entry.id];
  let current = 0;
  let paused = false;

  root.innerHTML = `
    <article class="entry">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a> / <a href="#/group/${esc(group.id)}">${esc(group.name)}</a></nav>
      <h1>${esc(entry.name)}</h1>
      <p class="lede">${esc(entry.short)}</p>

      <section class="scene-card" aria-label="3D view">
        <div class="scene" data-scene></div>
        <div class="switcher" data-switcher ${cards.length > 1 ? "" : "hidden"}>
          <button type="button" data-prev>← Previous card</button>
          <span data-count></span>
          <button type="button" data-next>Next card →</button>
        </div>
        <p class="scene-caption">${esc(entry.scene.caption)}</p>
        <div class="controls" role="group" aria-label="3D view controls">
          <button type="button" data-pause aria-pressed="false">Pause motion</button>
          <button type="button" data-calm aria-pressed="${ctx.prefs.calm ? "true" : "false"}">Calm mode</button>
          <button type="button" data-reset>Reset view</button>
        </div>
        <p class="hint">Drag to turn. Pinch or scroll to zoom.</p>
      </section>

      <section><h2>What it can feel like</h2><p>${esc(entry.feels)}</p></section>
      <section><h2>What it can look like from outside</h2><p>${esc(entry.looks)}</p></section>
      <section><h2>Common misunderstandings</h2><p>${esc(entry.misreadings)}</p></section>
      ${entry.coping ? `<section><h2>What can help</h2><p>${esc(entry.coping)}</p></section>` : ""}
      <section><h2>Where to get help</h2><p>${esc(entry.help)}</p></section>

      ${
        cards.length
          ? `<section>
        <h2>All cards for this condition</h2>
        <ul class="thumbs">${cards
          .map(
            (card) => `<li><a class="thumb" href="#/card/${card.number}"><img src="assets/cards/${esc(card.color)}" alt="" loading="lazy"><span>Card ${pad(card.number)}</span></a></li>`,
          )
          .join("")}</ul>
      </section>`
          : fallback
            ? `<figure class="concept">
        <img src="assets/concepts/${esc(fallback.color)}" alt="Concept art for ${esc(entry.name)}" loading="lazy">
        <figcaption>Concept art</figcaption>
      </figure>`
            : ""
      }

      <p class="fineprint">General information, not a diagnosis. The 3D view is a metaphor, not a medical picture or a picture of any one person.</p>

      <nav class="pager" aria-label="Other conditions in this group">
        ${prev ? `<a href="#/entry/${esc(prev.id)}">← ${esc(prev.name)}</a>` : "<span></span>"}
        ${next ? `<a href="#/entry/${esc(next.id)}">${esc(next.name)} →</a>` : "<span></span>"}
      </nav>
    </article>`;

  const sceneBox = root.querySelector("[data-scene]");
  const pauseButton = root.querySelector("[data-pause]");
  const calmButton = root.querySelector("[data-calm]");
  const count = root.querySelector("[data-count]");
  let view = null;

  // Shows the card at `current` in the 3D view. The page's own picture is used when it has no cards.
  const mount = () => {
    view?.dispose();
    const card = cards[current];
    const source = card ?? fallback;
    const relief = source
      ? {
          color: card ? `assets/cards/${card.color}` : `assets/concepts/${fallback.color}`,
          depth: source.depth ? `assets/${card ? "cards" : "concepts"}/${source.depth}` : null,
        }
      : null;
    const scene = { ...entry.scene, palette: card ? card.palette : entry.scene.palette };
    view = createFeelView(sceneBox, { entry: { ...entry, scene }, calm: ctx.prefs.calm, paused, relief });
    if (!view) {
      sceneBox.innerHTML = `<p class="scene-fallback">The 3D view needs WebGL, which this browser or device does not offer. The text and any concept art still apply.</p>`;
    }
    if (cards.length) count.textContent = `Card ${current + 1} of ${cards.length}`;
  };
  mount();

  root.querySelector("[data-prev]").addEventListener("click", () => {
    current = (current - 1 + cards.length) % cards.length;
    mount();
  });
  root.querySelector("[data-next]").addEventListener("click", () => {
    current = (current + 1) % cards.length;
    mount();
  });
  pauseButton.addEventListener("click", () => {
    paused = pauseButton.getAttribute("aria-pressed") !== "true";
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

export function renderAbout(root) {
  root.innerHTML = `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a></nav>
    <h1>About Mind Atlas</h1>
    <p class="lede">A calm, plain-language guide to mental health: conditions, fears, thinking patterns, strengths, and practices. Each topic has a 3D view of how it can feel.</p>

    <section><h2>What it is not</h2>
      <p>It does not diagnose anyone, and it does not replace a doctor, a therapist, or emergency care. The 3D views are metaphors. They do not show how any one person experiences a condition.</p></section>

    <section><h2>How the text was written</h2>
      <p>The descriptions were written for this app in everyday language, using the words people commonly use to describe these experiences. They are not copied from any manual or diagnostic book. Some topic names come from the card art in the deck.</p></section>

    <section><h2>Your privacy</h2>
      <p>The app does not collect data or send anything to a server. The one setting it remembers, calm mode, is saved on this device only.</p></section>

    <section><h2>Comfort settings</h2>
      <p>Calm mode slows the motion and stops the camera from turning by itself. Pause motion freezes a 3D view. If your phone asks for reduced motion, the app starts in calm mode.</p></section>

    <section><h2>Crisis support (US)</h2>
      <p>Call or text <strong>988</strong>, the Suicide and Crisis Lifeline, any time. If you are in danger, call <strong>911</strong>.</p></section>`;
  return null;
}
