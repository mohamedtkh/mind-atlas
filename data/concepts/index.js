// The concept pages. Every card title that is not already covered by a hand-written condition page
// (data/content.js) becomes one entry here. Each concept has one row in batch-NN.js
// ([name, group code, short, feels, looks, misreading, help]) and one line in coping-NN.js.
// Titles that mean the same thing are merged by groups.js.
import masterCards from "../concept-cards.js";
import { conceptGroups } from "./groups.js";
import extra from "./extra.js";

// A batch or coping file that is still being written, or has a mistake, must not stop the whole app.
// It loads as empty, and its concepts are reported by conceptGaps() and by the tests instead.
async function load(name, empty) {
  try {
    return (await import(`./${name}.js`)).default;
  } catch (error) {
    console.warn(`${name}.js not loaded: ${error.message}`);
    return empty;
  }
}

// One entry per group. The code is the letter used in the batch rows. `style` is the 3D motion
// for the group's cards and entries.
export const groups = [
  { id: "phobias", code: "P", name: "Phobias and fears", blurb: "Strong, specific fears and the things that set them off.", style: "flashback" },
  { id: "anxieties", code: "A", name: "Worry and anxiety", blurb: "Worry, tension, and the body's alarm system.", style: "jitter" },
  { id: "mood", code: "M", name: "Mood and emotion", blurb: "Low, high, flat, and changing moods, and how they feel from the inside.", style: "heavy" },
  { id: "disorders", code: "D", name: "Conditions and disorders", blurb: "Longer-lasting conditions that affect thinking, feeling, and daily life.", style: "loop" },
  { id: "thinking", code: "T", name: "Thinking patterns", blurb: "Habits of mind that can make life harder, and how to notice them.", style: "swing" },
  { id: "tactics", code: "C", name: "Control and manipulation", blurb: "Ways people pressure, confuse, or control others, and how to protect yourself.", style: "scatter" },
  { id: "traits", code: "R", name: "Traits and relationships", blurb: "How people hold on, pull away, and relate to others.", style: "glass" },
  { id: "habits", code: "V", name: "Harmful habits", blurb: "Habits and urges that cause harm, and how they can change.", style: "spotlight" },
  { id: "virtues", code: "U", name: "Strengths and virtues", blurb: "Qualities that support wellbeing and good relationships.", style: "pulse" },
  { id: "tools", code: "K", name: "Practices and tools", blurb: "Simple things you can do to settle the mind and body.", style: "night" },
  { id: "fascinations", code: "F", name: "Interests and urges", blurb: "Fascinations, pulls, and obsessions, from harmless to harmful.", style: "loop" },
  { id: "medical", code: "B", name: "Body and medical", blurb: "Physical conditions and reactions where the body and mind meet.", style: "jitter" },
];

const groupByCode = new Map(groups.map((group) => [group.code, group]));

// Particles that go with each motion style.
export const PARTICLES_FOR = {
  heavy: "fog",
  jitter: "sparks",
  pulse: "none",
  loop: "none",
  swing: "dust",
  scatter: "sparks",
  flashback: "dust",
  spotlight: "dust",
  glass: "fog",
  night: "dust",
};

// Used when a row leaves its help or coping text empty.
const DEFAULT_HELP = {
  P: "Phobias usually respond well to treatment, such as gradual exposure with a trained therapist. A doctor or counselor can help you choose a first step. In the US, call or text 988 if you are in crisis.",
  A: "Worry and anxiety are treatable. A doctor or counselor can suggest therapy and, when needed, medicine. In the US, call or text 988 if you are in crisis.",
  M: "Mood changes that last, or that stop you from working, eating, or sleeping, deserve a doctor's or counselor's attention. In the US, call or text 988 any time, day or night.",
  D: "A doctor, psychiatrist, or psychologist can assess this and suggest treatment. In the US, call or text 988 any time, day or night.",
  T: "Thinking patterns like this often change with practice, for example through cognitive behavioral therapy. A counselor can help you practice. In the US, call or text 988 if you are in crisis.",
  C: "If someone is using this against you, a counselor, advocate, or trusted person can help you plan your next step. The National Domestic Violence Hotline is 1-800-799-7233 in the US. In an emergency, call 911. In the US, call or text 988 if you are in crisis.",
  R: "Patterns in close relationships often ease with therapy and time. A counselor can help you understand where they come from. In the US, call or text 988 if you are in crisis.",
  V: "Habits like this are easier to change with support from a doctor, counselor, or trusted person. In the US, call or text 988 if you are in crisis.",
  U: "This is a strength rather than an illness, so it needs no treatment. If a hard time makes daily life difficult, a doctor or counselor can help. In the US, call or text 988 if you are in crisis.",
  K: "These practices support wellbeing, but they are not treatment on their own. A doctor or counselor can help you choose what fits. In the US, call or text 988 if you are in crisis.",
  F: "Interests and urges are easier to manage when you talk about them with a therapist or doctor. If an interest is causing harm, or you are worried about your own thoughts or actions, confidential help is available. In the US, call or text 988.",
  B: "This is a medical matter, so please talk with a doctor, who can test and treat it. If it is affecting your mood or safety, call or text 988 in the US. In an emergency, call 911.",
};

const DEFAULT_COPING = {
  P: "Take small, planned steps toward the thing you fear, and slow your breathing while you do. A therapist trained in exposure can help you go at a pace you can manage.",
  A: "Give worries a set time once a day, write them down, and ask what you can do about each one. Slow breathing and regular movement help the body settle.",
  M: "Keep a simple daily routine for sleep, meals, and one small activity. Tell someone you trust how you are doing, and talk with a doctor if it lasts.",
  D: "Work with your care team on treatment and keep regular appointments. Steady sleep, food, and one small daily routine make other treatment work better.",
  T: "Notice the thought, write it down, and ask what the evidence is for and against it. Practice a more balanced version a few times a week.",
  C: "Write down what happened, with dates and the words used, and keep it somewhere safe. Set a clear limit, tell a trusted person, and get support from a counselor or advocate.",
  R: "Name the pattern to yourself and notice what it costs you. Practice one clear, calm sentence you can say, and consider a counselor who works with relationships.",
  V: "Pick one small change you can keep this week, and tell someone who can help you stick to it. Notice what sets the urge off, and plan a different step for those moments.",
  U: "Practice this quality in one small, everyday moment, and notice how it feels. Write down one recent time you showed it.",
  K: "Practice this for two or three minutes a day when you are calm, so it is easier to use under stress. Notice what changes in your body afterward.",
  F: "Notice when the interest pulls you, and choose one healthy outlet for it. If it is taking over or causing harm, talk with a therapist.",
  B: "Keep a simple log of symptoms, sleep, and what makes them better or worse, and bring it to your doctor. Gentle daily routines help while you wait for care.",
};

const DEFAULT_PALETTE = { background: "#15181e", fog: "#1c2028", figure: "#b8bec8", ground: "#1e232b", accent: "#c9a46c" };

const batchNames = ["batch-01", "batch-02", "batch-03", "batch-04", "batch-05", "batch-06", "batch-07", "batch-08", "batch-09", "batch-10", "batch-11"];
const copingNames = ["coping-01", "coping-02", "coping-03", "coping-04", "coping-05", "coping-06", "coping-07", "coping-08", "coping-09", "coping-10", "coping-11"];
const batches = await Promise.all(batchNames.map((name) => load(name, [])));
const copingFiles = await Promise.all(copingNames.map((name) => load(name, {})));
const rowByName = new Map();
for (const batch of batches) for (const row of batch) rowByName.set(row[0], row);
const copingByName = Object.assign({}, ...copingFiles);

const ACRONYMS = ["ADD", "ADHD", "BPD", "C-PTSD", "DARVO", "DID", "GAD", "OCD", "PTSD", "RSD", "SAD", "TIPP"];
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "vs", "with"]);

// Turns a card title into a readable name: "ATTENTION-DEFICIT/HYPERACTIVITY DISORDER (ADHD)" becomes
// "Attention-Deficit/Hyperactivity Disorder (ADHD)". Acronyms and Roman numerals stay in capitals.
export function displayName(name) {
  return name
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      if (i > 0 && SMALL_WORDS.has(word)) return word;
      return word
        .split(/([-/()])/)
        .map((part) => {
          if (ACRONYMS.includes(part.toUpperCase())) return part.toUpperCase();
          if (/^(i|ii|iii|iv)$/.test(part)) return part.toUpperCase();
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join("");
    })
    .join(" ");
}

export function slugOf(name) {
  return name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Builds the concept entries. `curated` is the list of hand-written condition pages, whose titles
// are left out here. Returns the entries and the names that still have no text (should be empty).
function build(curated) {
  const curatedTitles = curated.flatMap((entry) => entry.titles ?? []);
  const usedIds = new Set(curated.map((entry) => entry.id));
  const entries = [];
  const gaps = [];
  const copingMissing = [];
  for (const group of conceptGroups(masterCards.map((card) => card.key), curatedTitles)) {
    if (group.claimed) continue;
    const row = rowByName.get(group.canonical);
    const kind = row ? groupByCode.get(row[1]) : undefined;
    if (!row || !kind) {
      gaps.push(group.canonical);
      continue;
    }
    if (!copingByName[group.canonical]) copingMissing.push(group.canonical);
    let id = slugOf(group.canonical);
    for (let n = 2; usedIds.has(id); n++) id = `${slugOf(group.canonical)}-${n}`;
    usedIds.add(id);
    entries.push({
      id,
      group: kind.id,
      name: displayName(group.canonical),
      titles: group.names,
      short: row[2],
      feels: row[3],
      looks: row[4],
      misreadings: row[5],
      help: row[6] || DEFAULT_HELP[kind.code],
      coping: copingByName[group.canonical] || DEFAULT_COPING[kind.code],
      scene: {
        style: kind.style,
        particles: PARTICLES_FOR[kind.style],
        palette: DEFAULT_PALETTE,
        caption: "Each card for this concept, lifted from its own picture.",
      },
    });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return { entries, gaps, copingMissing };
}

export function buildConcepts(curated) {
  return build(curated).entries;
}

export function conceptGaps(curated) {
  return build(curated).gaps;
}

// Concepts that have no line of their own in a coping file (they would show the group's general line).
export function copingGaps(curated) {
  return build(curated).copingMissing;
}

// Pages that are not card titles (coping skills and tactics the deck does not name). They have no cards.
export function buildExtras() {
  return extra.map((row) => {
    const kind = groupByCode.get(row[1]);
    return {
      id: slugOf(row[0]),
      group: kind.id,
      name: displayName(row[0]),
      titles: [],
      short: row[2],
      feels: row[3],
      looks: row[4],
      misreadings: row[5],
      help: row[6] || DEFAULT_HELP[kind.code],
      coping: row[7] || DEFAULT_COPING[kind.code],
      scene: {
        style: kind.style,
        particles: PARTICLES_FOR[kind.style],
        palette: DEFAULT_PALETTE,
        caption: "A way of thinking or acting that helps, or a pattern to notice. It is not a picture of anyone.",
      },
    };
  });
}
