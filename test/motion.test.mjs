import { test } from "node:test";
import assert from "node:assert/strict";
import { STYLES, poseFor, hash } from "../js/motion.js";

const LIMITS = { lean: 0.5, sway: 0.3, bob: 0.3, breath: 0.1, headTilt: 0.6, headYaw: 1, armAngle: 1.5, armSwing: 0.5, legStep: 0.5 };

test("hash is repeatable and stays in [0, 1)", () => {
  for (let i = 0; i < 500; i += 1) {
    const v = hash(i);
    assert.ok(v >= 0 && v < 1, `hash(${i}) = ${v}`);
    assert.equal(v, hash(i));
  }
});

test("every style gives finite values within limits for a minute", () => {
  for (const style of STYLES) {
    for (const intensity of [0.45, 1]) {
      for (let t = 0; t <= 60; t += 1 / 30) {
        const p = poseFor(style, t, intensity);
        for (const [key, limit] of Object.entries(LIMITS)) {
          assert.ok(Number.isFinite(p[key]) && Math.abs(p[key]) <= limit, `${style}.${key} at t=${t.toFixed(2)} is ${p[key]}`);
        }
        for (const v of p.jitter) assert.ok(Number.isFinite(v) && Math.abs(v) <= 0.05, `${style} jitter`);
        assert.ok(p.tint >= 0 && p.tint <= 1, `${style} tint`);
        assert.ok(p.watchers >= 0 && p.watchers <= 1, `${style} watchers`);
        assert.ok(p.veil >= 0 && p.veil <= 1, `${style} veil`);
        if (p.ring) assert.ok(p.ring.radius <= 3 && p.ring.opacity >= 0 && p.ring.opacity <= 1, `${style} ring`);
        if (p.fragments) for (const v of p.fragments) assert.ok(v >= 0 && v <= 0.5, `${style} fragment ${v}`);
        if (p.attention) {
          for (const [x, y, z] of p.attention) {
            assert.ok(Math.abs(x) <= 3 && y >= 0 && y <= 4 && Math.abs(z) <= 3, `${style} attention point`);
          }
        }
      }
    }
  }
});

function opacities(p) {
  const values = [p.watchers, p.veil];
  if (p.ring) values.push(p.ring.opacity);
  if (p.fragments) values.push(...p.fragments);
  return values;
}

test("no opacity changes fast enough to read as flashing", () => {
  // Flashing means several large changes a second. Here nothing may change by more than 0.5 per second.
  const dt = 1 / 60;
  for (const style of STYLES) {
    let previous = opacities(poseFor(style, 0, 1));
    for (let t = dt; t <= 60; t += dt) {
      const current = opacities(poseFor(style, t, 1));
      current.forEach((value, i) => {
        const rate = Math.abs(value - previous[i]) / dt;
        assert.ok(rate <= 0.5, `${style} changes by ${rate.toFixed(2)} per second at t=${t.toFixed(2)}`);
      });
      previous = current;
    }
  }
});
