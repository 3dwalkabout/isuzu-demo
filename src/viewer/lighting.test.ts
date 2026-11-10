import assert from "node:assert/strict";
import { test } from "node:test";
import { Box3, DirectionalLight, Mesh, Raycaster, Scene, SpotLight, Vector3 } from "three";
import { createStudioLighting } from "./lighting.ts";
import { createStudio } from "./studio.ts";

test("daylight shadow coverage contains every roof, wall and column corner", () => {
  const scene = new Scene();
  const studio = createStudio(scene, 0);
  const lighting = createStudioLighting(scene);
  try {
    scene.updateMatrixWorld(true);
    const key = lighting.lights.find(light => light.name === "studio-key") as DirectionalLight;
    key.shadow.updateMatrices(key);
    for (const mesh of studio.root.children.filter(object => object.castShadow)) {
      const bounds = new Box3().setFromObject(mesh);
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const clip = new Vector3(x, y, z).project(key.shadow.camera);
        assert.ok(Math.max(Math.abs(clip.x), Math.abs(clip.y), Math.abs(clip.z)) <= 1, `${mesh.name} escapes the daylight shadow camera and leaks light`);
      }
    }
    // Only the actual skylight may admit direct daylight into the room.
    const direction = key.position.clone().normalize();
    const casters = studio.root.children.filter(object => (object as Mesh).castShadow);
    for (let x = -18; x <= 18; x += 3) for (let z = -18; z <= 18; z += 3) {
      const origin = new Vector3(x, 0.01, z);
      const roofPoint = origin.clone().addScaledVector(direction, (7 - origin.y) / direction.y);
      if (roofPoint.x >= -8 && roofPoint.x <= 2 && roofPoint.z >= 0.5 && roofPoint.z <= 8.5) continue;
      assert.ok(new Raycaster(origin, direction, 0, 110).intersectObjects(casters).length > 0, `solid enclosure admits daylight at ${x}, ${z}`);
    }
  } finally {
    lighting.dispose();
    studio.dispose();
  }
});

test("interior fixtures sit beneath the roof and shadow the entire vehicle bay", () => {
  const scene = new Scene();
  const lighting = createStudioLighting(scene);
  scene.updateMatrixWorld(true);
  try {
    const fixtures = lighting.lights.filter(light => light instanceof SpotLight);
    assert.equal(fixtures.length, 2);
    for (const light of fixtures) {
      assert.ok(light.position.y > 0 && light.position.y < 7, "interior light is outside the enclosure");
      assert.equal(light.castShadow, true, "unshadowed fill light makes the car float");
      light.shadow.updateMatrices(light);
      for (const x of [-1.2, 1.2]) for (const y of [0, 2]) for (const z of [-2.7, 2.7]) {
        const clip = new Vector3(x, y, z).project(light.shadow.camera);
        assert.ok(Math.max(Math.abs(clip.x), Math.abs(clip.y), Math.abs(clip.z)) <= 1, "interior shadow clips the car");
      }
    }
  } finally { lighting.dispose(); }
});
