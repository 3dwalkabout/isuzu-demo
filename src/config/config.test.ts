import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ACCESSORIES } from "./accessories.ts";
import { DEFAULT_MODEL } from "./models.ts";
import { TUNED_MATERIAL_NAMES } from "../viewer/materials.ts";
import { DEFAULT_COLOUR_ID, PAINT_COLOURS, getPaintColour } from "./colours.ts";

interface GltfJson {
  nodes: { name?: string }[];
  materials: { name?: string }[];
}

/** Reads the JSON chunk of the shipped binary glTF. */
function readModelJson(): GltfJson {
  const file = readFileSync(new URL(`../../public/${DEFAULT_MODEL.file}`, import.meta.url));
  assert.equal(file.readUInt32LE(0), 0x46546c67, "not a glb file");
  const length = file.readUInt32LE(12);
  assert.equal(file.readUInt32LE(16), 0x4e4f534a, "first chunk is not JSON");
  return JSON.parse(file.subarray(20, 20 + length).toString("utf8"));
}

const model = readModelJson();
const materialNames = new Set(model.materials.map((m) => m.name));

test("colour ids are unique and the default exists", () => {
  const ids = PAINT_COLOURS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes(DEFAULT_COLOUR_ID));
});

test("every colour has a name and a six digit hex value", () => {
  for (const colour of PAINT_COLOURS) {
    assert.ok(colour.name.trim().length > 0, `${colour.id} has no name`);
    assert.match(colour.hex, /^#[0-9a-f]{6}$/i, `${colour.id} has an invalid hex value`);
  }
});

test("every material tuned in code exists in the shipped model", () => {
  for (const name of TUNED_MATERIAL_NAMES) {
    assert.ok(materialNames.has(name), `material "${name}" is not in the model`);
  }
});

test("colour lookup returns the colour and rejects an unknown id", () => {
  assert.equal(getPaintColour(DEFAULT_COLOUR_ID).id, DEFAULT_COLOUR_ID);
  assert.throws(() => getPaintColour("no-such-colour"));
});

test("accessory ids are unique and each has a label", () => {
  const ids = ACCESSORIES.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const accessory of ACCESSORIES) {
    assert.ok(accessory.label.trim().length > 0, `${accessory.id} has no label`);
  }
});
