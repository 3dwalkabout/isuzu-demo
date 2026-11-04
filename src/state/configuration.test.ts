import assert from "node:assert/strict";
import { test } from "node:test";
import { ACCESSORIES } from "../config/accessories.ts";
import { DEFAULT_COLOUR_ID, PAINT_COLOURS } from "../config/colours.ts";
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
  let state = initialConfiguration();
  assert.deepEqual(hiddenNodes(state), ACCESSORIES.filter((a) => !a.defaultVisible).flatMap((a) => a.nodes));
  for (const accessory of ACCESSORIES) {
    state = configurationReducer(state, { type: "setAccessory", accessoryId: accessory.id, visible: false });
  }
  assert.deepEqual(hiddenNodes(state), ACCESSORIES.flatMap((a) => a.nodes));
  for (const accessory of ACCESSORIES) {
    state = configurationReducer(state, { type: "setAccessory", accessoryId: accessory.id, visible: true });
  }
  assert.deepEqual(hiddenNodes(state), []);
});
