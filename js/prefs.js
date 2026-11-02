// Remembers one setting, calm mode, on this device only. Nothing is sent anywhere.
const KEY = "mind-atlas:prefs";

function defaults() {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return { calm: Boolean(reduced) };
}

export function loadPrefs() {
  try {
    return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return defaults();
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ calm: Boolean(prefs.calm) }));
  } catch {
    // Private browsing can block storage. The setting then lasts for this visit only.
  }
}
