# Mind Atlas

A calm, plain-language guide to mental health. It covers conditions, fears, thinking patterns, control and manipulation tactics, harmful habits, strengths, and practices that help. Each topic has a short description, what it can feel and look like from outside, common misunderstandings, what can help, where to get help, and a 3D view built from its card. The app works in any modern browser, including Safari on iPhone.

The working name is Mind Atlas. The DSM is the manual this idea is modeled on, but the app does not use its text (see "Content rules").

## Run it

On Windows, double-click `start-mind-atlas.bat`. It starts a small local server and opens the app at http://127.0.0.1:5173/.

Or from a terminal in this folder:

```bash
npm install
npm start
```

Then open http://127.0.0.1:5173/ in a browser.

## Test it

```bash
npm test
```

The tests check that every group and topic has its text and 3D settings, that every topic has a "what can help" line and a crisis line, that every titled card leads to a topic page, and that the opacity of the 3D views changes slowly enough not to flash.

## Where the text lives

- `data/concepts/batch-01.js` to `batch-11.js`: one row per topic. A row is `[name, group code, short, feels, looks, misreading, help]`. An empty `help` uses the group's default crisis text.
- `data/concepts/coping-01.js` to `coping-11.js`: one "what can help" line per topic, keyed by the same name.
- `data/concepts/extra.js`: coping skills and tactics that the card deck does not name. These topics have no card.
- `data/concepts/aliases.js`: card titles that mean the same thing as another title, so they share one page.
- `data/concepts/groups.js`: works out which card titles belong to one topic.
- `data/concepts/index.js`: the groups (name, code, and 3D motion), the default help and coping text, and the builder that turns rows into pages.
- `data/content.js`: the ten hand-written condition pages, and the page list the app uses.
- `data/concept-cards.js`: every card title, with the card numbers that carry it.

After changing a title or a group, run:

```bash
npm run titles
```

It rebuilds `data/card-titles.json`, which the app reads.

## Card pictures

Mo's card pictures are in `C:\Users\2\Claude\Projects\Suits\Mind Atlas concepts\DSM.zip`. `scripts/prepare-cards.py` converts them into `assets/cards/`, and each card gets a depth map that becomes its 3D relief. The card titles were read from the title lettering and checked against each picture.

Some cards print DSM criteria as text. Those criteria are not shown anywhere in the app.

## How the 3D views work

Each card is lifted into 3D from its own picture and moves in the style of its group. The motion styles are in `js/motion.js`. Each group's style is set in `data/concepts/index.js`. Topics without a card show a simple figure in the group's style.

Controls on each page:

- **Pause motion** freezes the scene. The camera can still be moved.
- **Calm mode** slows the motion, stops the camera from turning by itself, and is remembered on the device. If the phone asks for reduced motion, calm mode starts on.
- **Reset view** returns the camera to its starting position.

## Android app and web version

The app can be wrapped as an Android app with Capacitor, and published as a website with GitHub Pages. Both use the same files, copied into `www/` by:

```bash
npm run www
```

**Android (APK).** Needs Java 17 or newer and the Android SDK (set `ANDROID_HOME`, or write `sdk.dir=...` in `android/local.properties`). Then:

```bash
npm run android:apk
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. It is signed with the debug key, which is fine for installing on your own phone (allow "install from unknown sources" when asked). It is about 380 MB because it carries every card picture and depth map, so the app works fully offline. The depth model in `models/` is not included; it is only used when preparing the cards.

**Website.** `.github/workflows/pages.yml` publishes `www/` to GitHub Pages on every push to `main`. To turn it on: GitHub repository Settings, then Pages, then set Source to "GitHub Actions". The site appears at `https://<user>.github.io/mind-atlas/`. GitHub Pages on a private repository needs a paid GitHub plan; making the repository public is the free route.

## Content rules

- **The text is original.** It is written in plain language. Do not paste text from the DSM or any other manual or website. Names are used as names only.
- **Honest and plain.** Harmful patterns are described as harmful, including manipulation and abuse. The text does not make them sound harmless or clever, and it does not give tips for using them on other people.
- **Not a diagnosis.** Every page says this, and the About page says what the app is not.
- **A crisis line on every topic.** Each help section gives 988 (US Suicide and Crisis Lifeline) or 911. Entries about sexual interest in children also give the Stop It Now helpline, 1-888-773-8368. The tests check this.
- **Pictures held back.** 40 of the 2,031 cards keep their written page, but their pictures are not shown in the app. They cover eating and body image, self-harm, suicide, choking, self-injury, cannibalism, mutilation, and gore. The list is `HIDDEN` in `scripts/build-card-titles.mjs`. The pictures were checked on a contact sheet on 2 Nov. Most are abstract, so the topic is what holds them back. Mo has not reviewed them yet, so the list can be changed after that review.
- **No flashing.** Opacity changes take seconds, and no motion repeats faster than about twice a second.
- **No data is collected.** Nothing you do in the app is sent to a server. Calm mode is the only saved setting, and it stays on the device.

## Files

- `index.html`: the page shell. Loads the app and the Three.js import map.
- `css/app.css`: all styles. Colors follow the phone or computer's dark mode.
- `js/main.js`: starts the app, merges the cards with their titles and groups, and draws the page for the current address.
- `js/router.js`: reads the address, for example `#/entry/panic`.
- `js/views.js`: builds the home, group, topic, and About pages.
- `js/cards-view.js`: the card gallery and the card pages.
- `js/scene.js`: the 3D view (figure, effects, camera, and clean-up when a page closes).
- `js/motion.js`: the motion for each view. No DOM or Three.js, so the tests can run it.
- `js/prefs.js`: saves calm mode on the device.
- `data/`: the text, groups, and card titles (see "Where the text lives").
- `scripts/build-card-titles.mjs`: rebuilds the card titles and groups.
- `scripts/prepare-cards.py`: converts the card pictures and builds their depth maps.
- `assets/cards/`: the web-sized card pictures, depth maps, and the card index.
- `vendor/three/`: Three.js, copied from npm so the app works offline. Refresh it with `npm run vendor`.
- `server.mjs`: a small static server with no dependencies.
- `test/`: tests for the content and the motion.

Three.js is pinned to version 0.186.1 in `package.json`.

## Next steps

- Mo reviews the topic text, and the pictures that are held back.
- A clinician or mental health professional reviews the text before the app is shared more widely.
- Check the app on an iPhone in Safari, and add it to the Home Screen.
- Add an app icon and offline support (a service worker), so it works without a connection.
- Host it somewhere (for example GitHub Pages or Netlify) so it has a web address.
