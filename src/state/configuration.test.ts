import assert from "node:assert/strict";
import { test } from "node:test";
import { ACCESSORIES } from "../config/accessories.ts";
import { DEFAULT_COLOUR_ID, PAINT_COLOURS } from "../config/colours.ts";
import { DEFAULT_MODEL } from "../config/models.ts";
import { configurationReducer, hiddenNodes, initialConfiguration } from "./configuration.ts";

test("the initial configuration follows the config defaults", () => {
  const state = initialConfiguration();
  assert.equal(state.colourId, DEFAULT_COLOUR_ID);
  for (const accessory of ACCESSORIES) {
    assert.equal(state.accessories[accessory.id], accessory.defaultVisible);
  }
});

test("selecting a colour changes only the colour", () => {
  const state = initialConfiguration();
  const other = PAINT_COLOURS.find((c) => c.id !== state.colourId);
  assert.ok(other);
  const next = configurationReducer(state, { type: "selectColour", colourId: other.id });
  assert.equal(next.colourId, other.id);
  assert.equal(next.accessories, state.accessories);
});

test("selecting the current or an unknown colour returns the same state", () => {
  const state = initialConfiguration();
  assert.equal(configurationReducer(state, { type: "selectColour", colourId: state.colourId }), state);
  assert.equal(configurationReducer(state, { type: "selectColour", colourId: "no-such-colour" }), state);
});

test("toggling an accessory changes only that accessory", () => {
  const state = initialConfiguration();
  const [first, ...rest] = ACCESSORIES;
  const next = configurationReducer(state, { type: "setAccessory", accessoryId: first.id, visible: !first.defaultVisible });
  assert.equal(next.accessories[first.id], !first.defaultVisible);
  for (const accessory of rest) assert.equal(next.accessories[accessory.id], state.accessories[accessory.id]);
  assert.equal(next.colourId, state.colourId);
});

test("setting an accessory to its current value or an unknown id returns the same state", () => {
  const state = initialConfiguration();
  const [first] = ACCESSORIES;
  const same = { type: "setAccessory", accessoryId: first.id, visible: state.accessories[first.id] } as const;
  assert.equal(configurationReducer(state, same), state);
  assert.equal(configurationReducer(state, { type: "setAccessory", accessoryId: "no-such-accessory", visible: false }), state);
});

test("hidden nodes cover the whole group of every hidden accessory and nothing else", () => {
  const nodesOf = (a: (typeof ACCESSORIES)[number]) => DEFAULT_MODEL.accessories[a.id];
  let state = initialConfiguration();
  assert.deepEqual(hiddenNodes(state, DEFAULT_MODEL), ACCESSORIES.filter((a) => a.behaviour !== "material" && !a.defaultVisible).flatMap(nodesOf));
  for (const accessory of ACCESSORIES) {
    state = configurationReducer(state, { type: "setAccessory", accessoryId: accessory.id, visible: false });
  }
  assert.deepEqual(hiddenNodes(state, DEFAULT_MODEL), ACCESSORIES.filter((a) => a.behaviour !== "material").flatMap(nodesOf));
  for (const accessory of ACCESSORIES) {
    state = configurationReducer(state, { type: "setAccessory", accessoryId: accessory.id, visible: true });
  }
  assert.deepEqual(hiddenNodes(state, DEFAULT_MODEL), []);
});

test("a model hides nodes only for the accessories it offers", () => {
  const partial = { ...DEFAULT_MODEL, accessories: { "mud-flaps": ["flap_a", "flap_b"] } };
  let state = initialConfiguration();
  state = configurationReducer(state, { type: "setAccessory", accessoryId: "roof-rails", visible: false });
  assert.deepEqual(hiddenNodes(state, partial), []);
  state = configurationReducer(state, { type: "setAccessory", accessoryId: "mud-flaps", visible: false });
  assert.deepEqual(hiddenNodes(state, partial), ["flap_a", "flap_b"]);
});

test("removing the bed liner keeps the tray geometry visible through colour and accessory changes", () => {
  let state = configurationReducer(initialConfiguration(), { type: "setAccessory", accessoryId: "bed-liner", visible: false });
  state = configurationReducer(state, { type: "selectColour", colourId: "mineral-white" });
  state = configurationReducer(state, { type: "setAccessory", accessoryId: "roof-rails", visible: false });
  assert.equal(state.accessories["bed-liner"], false);
  assert.deepEqual(hiddenNodes(state, DEFAULT_MODEL), ["rail_01"]);
});
