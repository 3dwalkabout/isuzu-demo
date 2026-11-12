import assert from "node:assert/strict";
import { test } from "node:test";
import { VIEWS } from "./views.ts";

test("view ids are unique", () => {
  assert.equal(new Set(VIEWS.map(view => view.id)).size, VIEWS.length);
});

test("exterior views keep the camera above the ground and look from distinct directions", () => {
  const orbit = VIEWS.filter(view => "azimuth" in view);
  const seen = new Set<string>();
  for (const view of orbit) {
    assert.ok(view.elevation > 0 && view.elevation <= 90, view.id + " elevation");
    const key = ((view.azimuth % 360) + 360) % 360 + "/" + view.elevation;
    assert.ok(!seen.has(key), view.id + " duplicates another view");
    seen.add(key);
  }
});

test("three-quarter views sit between the front or rear and the side", () => {
  const azimuth = (id: string) => {
    const view = VIEWS.find(view => view.id === id);
    assert.ok(view && "azimuth" in view, id);
    return ((view.azimuth % 360) + 360) % 360;
  };
  assert.ok(azimuth("front-34") > 270 && azimuth("front-34") < 360);
  assert.ok(azimuth("rear-34") > 180 && azimuth("rear-34") < 270);
});
