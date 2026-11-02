// Motion for each 3D view. These are pure functions with no DOM or Three.js, so the
// tests can run them in Node.
//
// Each function takes a time in seconds and an intensity from 0 (still) to 1 (full),
// and returns a pose. scene.js applies the pose to the figure and its effects.
//
// Safety: nothing here flashes. Opacity changes take seconds, not fractions of a second,
// and no motion repeats faster than about twice a second. test/motion.test.mjs checks this.

export const STYLES = ["heavy", "jitter", "pulse", "loop", "swing", "scatter", "flashback", "spotlight", "glass", "night"];

const TAU = Math.PI * 2;

function smooth(x) {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

// A repeatable pseudo-random number in [0, 1), from an integer seed.
export function hash(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// Where attention point i is heading in movement cycle n (used by "scatter").
function attentionTarget(i, n) {
  return [
    (hash(i * 17 + n * 3 + 1) * 2 - 1) * 1.8,
    1.4 + (hash(i * 31 + n * 7 + 5) * 2 - 1) * 0.9,
    (hash(i * 5 + n * 13 + 9) * 2 - 1) * 1.3,
  ];
}

function blankPose() {
  return {
    lean: 0, sway: 0, bob: 0, breath: 0,
    headTilt: 0, headYaw: 0,
    armAngle: 0, armSwing: 0, legStep: 0,
    jitter: [0, 0, 0],
    tint: 0,         // 0 = the figure's own colour, 1 = the accent colour
    ring: null,      // { radius, opacity }: a flat ring on the floor
    thoughts: null,  // { radius, spin, height }: small spheres circling the head
    fragments: null, // opacity of each memory fragment, 0 to 0.5
    watchers: 0,     // opacity of the discs that face the figure, 0 to 1
    veil: 0,         // opacity of the glass in front of the figure, 0 to 1
    attention: null, // positions of attention points: [[x, y, z], ...]
  };
}

const motions = {
  // Slow and heavy: a forward lean, a slow sway, and the head drops.
  heavy(t, k) {
    const p = blankPose();
    p.lean = (0.16 + 0.03 * Math.sin(0.35 * t)) * k;
    p.sway = 0.02 * Math.sin(0.22 * t) * k;
    p.bob = -0.05 * k;
    p.breath = 0.015 * Math.sin(0.6 * t) * k;
    p.armAngle = 0.12 * k;
    p.armSwing = 0.04 * Math.sin(0.5 * t) * k;
    p.headTilt = 0.25 * k;
    return p;
  },

  // Small tremors that never stop.
  jitter(t, k) {
    const p = blankPose();
    p.jitter = [
      0.012 * k * Math.sin(7.3 * t) + 0.006 * k * Math.sin(13.1 * t + 1),
      0.006 * k * Math.sin(8.7 * t + 2),
      0.01 * k * Math.sin(6.1 * t + 3),
    ];
    p.breath = 0.02 * Math.sin(3.2 * t) * k;
    p.armAngle = (0.1 + 0.05 * Math.sin(2.1 * t)) * k;
    p.armSwing = 0.05 * Math.sin(3.7 * t) * k;
    p.headTilt = 0.05 * Math.sin(5.3 * t) * k;
    return p;
  },

  // A surge that builds, peaks and fades over a six-second cycle.
  pulse(t, k) {
    const p = blankPose();
    const u = (t % 6) / 6;
    const level = u < 0.35 ? smooth(u / 0.35) : u < 0.5 ? 1 : 1 - smooth((u - 0.5) / 0.5);
    p.ring = { radius: 1.1 + 1.3 * level * k, opacity: 0.06 + 0.3 * level * k };
    p.breath = 0.03 * level * k;
    p.lean = -0.04 * level * k;
    p.headTilt = -0.06 * level * k;
    p.armSwing = 0.08 * Math.sin(5 * t) * k;
    return p;
  },

  // A thought that keeps circling the head, with a repeated gesture.
  loop(t, k) {
    const p = blankPose();
    p.armAngle = (0.5 + 0.35 * Math.sin(1.4 * t)) * k;
    p.headTilt = 0.15 * Math.sin(0.7 * t) * k;
    p.thoughts = { radius: 0.85, spin: 0.7 * t, height: 2.3 };
    return p;
  },

  // Mood rises and falls over a sixteen-second cycle. The colour warms as the mood rises.
  swing(t, k) {
    const p = blankPose();
    const m = Math.sin((TAU * t) / 16);
    p.lean = 0.14 * (0.5 - 0.5 * m) * k;
    p.bob = 0.12 * m * k;
    p.armAngle = -0.3 * m * k;
    p.armSwing = 0.1 * Math.sin((TAU * t) / 4) * k;
    p.tint = (m + 1) / 2;
    return p;
  },

  // Attention jumps between points, and the head turns to look around.
  scatter(t, k) {
    const p = blankPose();
    p.attention = [0, 1, 2, 3, 4, 5].map((i) => {
      const x = t / 2 + i * 0.7;
      const n = Math.floor(x);
      const f = smooth(x - n);
      const a = attentionTarget(i, n);
      const b = attentionTarget(i, n + 1);
      return [0, 1, 2].map((j) => a[j] + (b[j] - a[j]) * f);
    });
    p.headYaw = 0.5 * Math.sin(0.9 * t) * k;
    p.armSwing = 0.08 * Math.sin(2.5 * t) * k;
    p.bob = 0.02 * Math.sin(1.7 * t) * k;
    return p;
  },

  // Memories surface and fade in slow waves. Nothing snaps on.
  flashback(t, k) {
    const p = blankPose();
    p.fragments = [0, 1, 2, 3, 4].map((i) => {
      const period = 9 + 2 * hash(i + 1);
      const offset = hash(i + 7) * period;
      const wave = Math.max(0, Math.sin((TAU * (t + offset)) / period));
      return 0.5 * k * wave * wave;
    });
    p.lean = 0.1 * k;
    p.armAngle = (0.3 + 0.1 * Math.sin(0.3 * t)) * k;
    p.headTilt = -0.1 * k;
    return p;
  },

  // Eyes seem to be everywhere. Discs around the room slowly brighten and dim while the figure folds in.
  spotlight(t, k) {
    const p = blankPose();
    p.lean = 0.12 * k;
    p.headTilt = 0.35 * k;
    p.armAngle = 0.8 * k;
    p.sway = 0.01 * Math.sin(0.4 * t) * k;
    p.watchers = 0.35 + 0.25 * Math.sin((TAU * t) / 10) * k;
    return p;
  },

  // A pane of glass sits between the viewer and the figure. Movement is slow and loose.
  glass(t, k) {
    const p = blankPose();
    p.veil = 0.22 + 0.05 * Math.sin(0.2 * t) * k;
    p.sway = 0.05 * Math.sin(0.15 * t) * k;
    p.lean = 0.02 * k;
    p.headTilt = 0.05 * Math.sin(0.3 * t) * k;
    p.armAngle = 0.1 * k;
    return p;
  },

  // A restless night: the body tosses and turns, and a dim ring hangs in the room.
  night(t, k) {
    const p = blankPose();
    p.sway = (0.15 * Math.sin(0.5 * t) + 0.05 * Math.sin(1.7 * t)) * k;
    p.lean = (0.1 + 0.05 * Math.sin(0.9 * t)) * k;
    p.headTilt = 0.2 * Math.sin(0.6 * t) * k;
    p.armAngle = (0.25 + 0.2 * Math.sin(0.8 * t + 1)) * k;
    p.legStep = 0.2 * Math.sin(0.7 * t) * k;
    p.ring = { radius: 2.0, opacity: 0.12 + 0.05 * Math.sin(0.2 * t) * k };
    return p;
  },
};

export function poseFor(style, t, intensity = 1) {
  const motion = motions[style];
  if (!motion) throw new Error(`Unknown motion style: ${style}`);
  return motion(t, Math.min(1, Math.max(0, intensity)));
}
