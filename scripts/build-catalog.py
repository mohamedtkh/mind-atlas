"""Builds the card catalog: which title each card carries, and how many cards share it.

Reads:
  - assets/cards/index.json (written by prepare-cards.py): each card's number and source file name,
  - the title readings from the Windows OCR run (titles-jpeg.csv and titles-png.csv), which hold the
    title printed on each picture.

Writes:
  - data/card-titles.json: for each card number, the cleaned title (or "" when none could be read),
  - a list of every distinct title with its card count, printed so the titles can be checked.

Usage (from the mind-atlas folder):
    python scripts/build-catalog.py <folder with titles-jpeg.csv and titles-png.csv>
"""

import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "assets" / "cards" / "index.json"
OUT = ROOT / "data" / "card-titles.json"


def read_titles(folder):
    readings = {}
    for name in ("titles-jpeg.csv", "titles-png.csv"):
        path = folder / name
        if not path.exists():
            continue
        with open(path, encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                readings[row["File"]] = row["Title"]
    return readings


def clean(raw):
    text = re.sub(r"[•·*‘’“”\"]", " ", raw or "")
    text = re.sub(r"\s+", " ", text).strip(" -–—.,:;")
    text = re.sub(r"^THE\s+", "", text, flags=re.IGNORECASE)
    return text.upper()


# Each card is sorted into one group by its title. The order matters: the first match wins.
GROUP_RULES = [
    ("tactics", r"GASLIGHT|LOVE BOMB|BREADCRUMB|STONEWALL|NEGG|SILENT TREATMENT|TRIANGULAT|HOOVER|FLYING MONKEY|GHOST|DISCARD|DEVALU|BAIT AND SWITCH|MOVING THE GOAL|GOALPOST|FUTURE FAKING|TEST BALLOON|CHARM OFFENSIVE|SMEAR|WHATABOUT|DEFLECT|BLAME|GUILT TRIP|BLACKMAIL|ISOLATION TACTIC|INVALIDAT|FALSE APOLOG|PREMATURE FORGIVE|MASK SLIP|TRIVIALIZ|JEALOUSY INDUCTION|PUSH-PULL|WALKING ON EGGSHELLS|CRAZY MAKER|PUPPETMASTER|FAWN|CONTROL|EXPLOITATIVE|FINANCIAL|ABUSER|BOUNDARY|REACTIVE ABUSE|ENABLER|DEPENDENCY CREATION|INTERMITTENT REINFORCER|WEAPONIZ|VEILED THREAT|TOXIC POSITIVITY|PITY PLOY|MARTYR|VICTIM|SCAPEGOAT|SAVIOR"),
    ("phobias", r"PHOBE|PHOBIA|PHOBIC|PHOBIST|PHOBO"),
    ("disorders", r"DISORDER|PERSONALITY|NARCISS|BORDERLINE|HISTRIONIC|SCHIZ|AVOIDANT|DEPENDENT|PARANOI|ANTISOCIAL|PSYCHOTIC|DISSOCIAT|DEREALIZ|DEPERSONAL|ADHD|\bADD\b|ATTENTION-DEFICIT|OBSESSIV|COMPULSIV|PTSD|POSTTRAUMATIC|BIPOLAR|CYCLOTHYM|DEPRESS|DYSTHYM|INSOMNI|SOMNIPHOBE|NIGHTMARE|BULIMIA|ANOREXIA|BINGE|CONVERSION|SOMATIC|ILLNESS|HEALTH ANXIETY|DYSMORPH|HOARDING|TRICHOTILL|PYROMANIA|ALEXITHYM|OPPOSITIONAL|DEFIANCE|PATHOLOGICAL DEMAND|CATALEPT|HALLUCINAT|CAPGRAS|CONFABULAT|SELECTIVE MUTISM"),
    ("anxieties", r"ANXI|PANIC|WORRY|HYPERVIGIL|FREEZE|FLOOD|CATASTROPH|DOOM|RUMINAT|TERROR|DREAD"),
    ("mood", r"MANIA|MANIAC|MOOD|DESPAIR|GRIEF|BURNOUT|LONELINESS|NUMB|SHAME|GUILT|ENVY|JEALOUS"),
    ("virtues", r"KINDNESS|PATIEN|HUMIL|HUMBLE|TEMPERANCE|CHARIT|GENEROUS|COURAGE|GRATEFUL|OPTIMIST|RESILIENT|ADAPTABLE|CURIOUS|COMPASSION|HOPE|CONFIDENT|PEACE|SERENE|TRANQUIL|WISE|LISTENER|AUTHENTIC|LOVING|DEVOTED|DILIGEN|PLAYFUL|ENTHUSIAS|CAREFREE|EMPOWER|STEADFAST|LIGHTHEARTED|BLISSFUL|JUBILANT|DELIGHT|EUPHORIC|THRILL|RELIEVED|REFRESHED|HARMONIOUS|PRESENT|ETERNAL NOW|ORIGINAL|VISIONARY|INNER|SPIRITUAL|RELIGIOUS|FOUNDATIONAL|ENLIGHTEN|GRATEFUL|EMPATH|OPENMINDED|EXPRESSIVE"),
    ("fascinations", r"PHILE|PHILIA|PHILIAC|MANIAC|MANIA|OMANIA|OMANIAC|ANDRIA"),
]


def group_for(title):
    if not title:
        return ""
    for group, pattern in GROUP_RULES:
        if re.search(pattern, title):
            return group
    return "traits"


def main():
    folder = Path(sys.argv[1])
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    readings = read_titles(folder)

    cards = []
    for card in index:
        title = clean(readings.get(card["source"], ""))
        cards.append({"number": card["number"], "source": card["source"], "title": title, "group": group_for(title)})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(cards, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    counts = Counter(card["title"] for card in cards if card["title"])
    print(f"cards: {len(cards)}, with a title: {sum(counts.values())}, distinct titles: {len(counts)}")
    print(f"cards with no title: {sum(1 for c in cards if not c['title'])}")
    for title, count in sorted(counts.items(), key=lambda item: (-item[1], item[0])):
        print(f"{count:3d}  {title}")


if __name__ == "__main__":
    main()
