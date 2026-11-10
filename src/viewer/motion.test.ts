import assert from "node:assert/strict";
import { test } from "node:test";
import { Transition } from "./motion.ts";

test("an interrupted animation reverses from its current value without jumping", () => {
  const motion = new Transition(0, 400);
  motion.to(1, 0);
  assert.equal(motion.update(200), true);
  assert.equal(motion.value, 0.5);
  motion.to(0, 200);
  assert.equal(motion.value, 0.5);
  motion.update(400);
  assert.equal(motion.value, 0.25);
  assert.equal(motion.update(600), false);
  assert.equal(motion.value, 0);
});
test("reduced motion applies the final state immediately", () => {
  const motion = new Transition(0);
  motion.to(1, 0, true);
  assert.equal(motion.value, 1);
  assert.equal(motion.update(0), false);
});
