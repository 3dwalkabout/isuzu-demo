import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ACCESSORIES } from "./accessories.ts";
import { DEFAULT_COLOUR_ID, PAINT_COLOURS } from "./colours.ts";
import {
  DEFAULT_MODEL,
  VEHICLE_MODELS,
  colourForModel,
  getModel,
  modelAccessories,
  modelColours,
  type VehicleModel,
} from "./models.ts";

interface GltfJson {
  nodes: { name?: string }[];
  materials: { name?: string }[];
}

/** Reads the JSON chunk of a shipped binary glTF. */
function readGlb(model: VehicleModel): GltfJson {
  const file = readFileSync(new URL(`../../public/${model.file}`, import.meta.url));
  assert.equal(file.readUInt32LE(0), 0x46546c67, `${model.file} is not a glb file`);
  const length = file.readUInt32LE(12);
  assert.equal(file.readUInt32LE(16), 0x4e4f534a, `${model.file}: first chunk is not JSON`);
  return JSON.parse(file.subarray(20, 20 + length).toString("utf8"));
}

test("model ids are unique and every model has a label", () => {
  const ids = VEHICLE_MODELS.map(model => model.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const model of VEHICLE_MODELS) assert.ok(model.label.trim().length > 0, `${model.id} has no label`);
});

test("the default model is the first entry and lookup rejects an unknown id", () => {
  assert.equal(DEFAULT_MODEL, VEHICLE_MODELS[0]);
  assert.equal(getModel(DEFAULT_MODEL.id), DEFAULT_MODEL);
  assert.throws(() => getModel("no-such-model"));
});

test("every model file is a binary glTF under public/models", () => {
  for (const model of VEHICLE_MODELS) {
    assert.match(model.file, /^models\/[^/]+\.glb$/, `${model.id} must point at a .glb in models/`);
    readGlb(model);
  }
});

test("every model resolves its paint materials, accessory nodes and door parts in its own file", () => {
  for (const model of VEHICLE_MODELS) {
    const glb = readGlb(model);
    const nodes = new Set(glb.nodes.map(node => node.name));
    const materials = new Set(glb.materials.map(material => material.name));
    assert.ok(materials.has(model.materials.paint), `${model.id}: paint material "${model.materials.paint}" is not in the file`);
    if (model.materials.accent) {
      assert.ok(materials.has(model.materials.accent), `${model.id}: accent material "${model.materials.accent}" is not in the file`);
    }
    for (const [accessory, names] of Object.entries(model.accessories)) {
      assert.ok(names.length > 0, `${model.id}: ${accessory} has no nodes`);
      for (const name of names) assert.ok(nodes.has(name), `${model.id}: ${accessory} node "${name}" is not in the file`);
    }
    if (model.doors) assert.ok(nodes.has("door"), `${model.id}: door support needs a "door" node`);
  }
});

test("a model lists only known accessories and no node belongs to two of them", () => {
  const known = new Set(ACCESSORIES.map(accessory => accessory.id));
  for (const model of VEHICLE_MODELS) {
    const owner = new Map<string, string>();
    for (const [accessory, names] of Object.entries(model.accessories)) {
      assert.ok(known.has(accessory), `${model.id}: unknown accessory "${accessory}"`);
      for (const name of names) {
        assert.equal(owner.get(name), undefined, `${model.id}: "${name}" is in ${owner.get(name)} and ${accessory}`);
        owner.set(name, accessory);
      }
    }
  }
});

test("a model offers only palette colours and its camera limits make sense", () => {
  const palette = new Set(PAINT_COLOURS.map(colour => colour.id));
  for (const model of VEHICLE_MODELS) {
    for (const id of model.colours ?? []) assert.ok(palette.has(id), `${model.id}: unknown colour "${id}"`);
    if (model.colours) assert.ok(model.colours.length > 0, `${model.id} offers no colours`);
    const { minDistance, maxDistance, startElevation, driverEye } = model.camera;
    assert.ok(minDistance > 0 && minDistance < maxDistance, `${model.id}: orbit distance limits`);
    assert.ok(startElevation > 0 && startElevation < 90, `${model.id}: start elevation`);
    if (driverEye) assert.equal(driverEye.length, 3);
  }
});

test("a model offers its listed accessories and colours in shared order", () => {
  const sample: VehicleModel = { ...DEFAULT_MODEL, accessories: { "mud-flaps": ["a"], "roof-rails": ["b"] }, colours: ["basalt-black-mica", "mineral-white"] };
  assert.deepEqual(modelAccessories(sample).map(accessory => accessory.id), ["roof-rails", "mud-flaps"]);
  assert.deepEqual(modelColours(sample).map(colour => colour.id), ["mineral-white", "basalt-black-mica"]);
  assert.equal(modelColours(DEFAULT_MODEL), PAINT_COLOURS);
});

test("the selected colour is kept when the model offers it and falls back to the model default otherwise", () => {
  const limited: VehicleModel = { ...DEFAULT_MODEL, colours: ["basalt-black-mica", "mineral-white"] };
  assert.equal(colourForModel(limited, "mineral-white"), "mineral-white");
  assert.equal(colourForModel(limited, "neptune-blue-mica"), "mineral-white");
  const withDefault: VehicleModel = { ...DEFAULT_MODEL, colours: ["mineral-white", DEFAULT_COLOUR_ID] };
  assert.equal(colourForModel(withDefault, "neptune-blue-mica"), DEFAULT_COLOUR_ID);
  assert.equal(colourForModel(DEFAULT_MODEL, "neptune-blue-mica"), "neptune-blue-mica");
});
