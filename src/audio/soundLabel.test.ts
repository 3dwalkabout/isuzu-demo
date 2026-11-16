import assert from "node:assert/strict";
import { test } from "node:test";
import { soundLabel } from "./soundLabel.ts";

test("an unconfigured track reads as unavailable whatever else is set", () => {
  assert.equal(soundLabel({ available: false, failed: true, playing: true }), "Sound — audio unavailable");
});

test("a failed load tells the visitor to retry", () => {
  assert.match(soundLabel({ available: true, failed: true, playing: false }), /retry/);
});

test("a working track reads as on or off", () => {
  assert.equal(soundLabel({ available: true, failed: false, playing: true }), "Sound on");
  assert.equal(soundLabel({ available: true, failed: false, playing: false }), "Sound off");
});
