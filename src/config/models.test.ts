import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_MODEL, VEHICLE_MODELS } from "./models.ts";

test("model ids are unique and every model has a label", () => {
  const ids = VEHICLE_MODELS.map(model => model.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const model of VEHICLE_MODELS) assert.ok(model.label.trim().length > 0, `${model.id} has no label`);
});

test("the default model is the first entry", () => {
  assert.equal(DEFAULT_MODEL, VEHICLE_MODELS[0]);
});

test("every model file is a binary glTF under public/models", () => {
  for (const model of VEHICLE_MODELS) {
    assert.match(model.file, /^models\/[^/]+\.glb$/, `${model.id} must point at a .glb in models/`);
    const file = readFileSync(new URL(`../../public/${model.file}`, import.meta.url));
    assert.equal(file.readUInt32LE(0), 0x46546c67, `${model.file} is not a glb file`);
  }
});
