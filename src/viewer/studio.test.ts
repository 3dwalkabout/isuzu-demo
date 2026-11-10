import assert from "node:assert/strict";
import { test } from "node:test";
import { Box3, Mesh, MeshStandardMaterial, Raycaster, Scene, Texture, Vector3, type Material } from "three";
import { createStudio } from "./studio.ts";

test("garage floor and columns meet the supplied ground height without blocking the orbit", () => {
  const scene = new Scene();
  const groundY = 1.25;
  const studio = createStudio(scene, groundY);
  const floor = studio.root.getObjectByName("garage-floor") as Mesh;
  const environment = new Texture();
  studio.setEnvironment(environment);
  assert.equal((floor.material as MeshStandardMaterial).envMap, environment, "scene fallback must not override the floor's restrained indoor ambient level");
  const floorBounds = new Box3().setFromObject(floor);
  assert.ok(Math.abs(floorBounds.min.y - groundY) < 0.00001);
  assert.equal(floor.receiveShadow, true);
  for (const child of studio.root.children.filter(child => child.name.endsWith("-base"))) {
    const bounds = new Box3().setFromObject(child);
    assert.ok(Math.abs(bounds.min.y - groundY) < 0.00001, "column base floats above the floor");
  }
  studio.root.updateMatrixWorld(true);
  const target = new Vector3(0,groundY + 1,0);
  for (let i = 0; i < 32; i++) {
    const angle = i * Math.PI / 16;
    const origin = new Vector3(Math.sin(angle)*14,groundY + 2.5,Math.cos(angle)*14);
    const direction = target.clone().sub(origin);
    const hits = new Raycaster(origin,direction.clone().normalize(),0,direction.length()).intersectObject(studio.root,true);
    assert.equal(hits.length,0,"a structural element blocks the vehicle in the normal orbit");
  }
  const light = new Vector3(-4,groundY + 10,6);
  const direction = new Vector3(0,groundY,0).sub(light);
  const casters = studio.root.children.filter(object => (object as Mesh).castShadow);
  const hits = new Raycaster(light,direction.clone().normalize(),0,direction.length()).intersectObjects(casters);
  assert.equal(hits.length,0,"the skylight blocks the key light from reaching the vehicle bay");
  studio.dispose();
  environment.dispose();
  assert.equal(studio.root.parent,null);
});

test("wall skirting stops at roller-door openings", () => {
  const studio = createStudio(new Scene(), 0);
  try {
    const doors = studio.root.children.filter(mesh => mesh.name === "roller-door");
    const skirting = studio.root.children.filter(mesh => mesh.name.includes("plinth"));
    for (const door of doors) {
      const doorBounds = new Box3().setFromObject(door);
      for (const strip of skirting) {
        const overlap = doorBounds.clone().intersect(new Box3().setFromObject(strip));
        if (overlap.isEmpty()) continue;
        const size = overlap.getSize(new Vector3());
        assert.ok(Math.min(size.x, size.y, size.z) < 0.00001, "wall skirting overlaps a roller door and causes coplanar faces");
      }
    }
  } finally {
    studio.dispose();
  }
});

test("overhead inspection cuts away the roof while retaining its shadow geometry", () => {
  const studio = createStudio(new Scene(), 0);
  try {
    studio.root.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(0,14,0), new Vector3(0,-1,0), 0, 12);
    const visibleMeshes = () => studio.root.children.filter(object => ((object as Mesh).material as Material).colorWrite);
    assert.ok(ray.intersectObjects(visibleMeshes()).length > 0, "the initial roof should be present");
    const roof = studio.root.getObjectByName("roof-rear") as Mesh;
    studio.updateCamera(14);
    assert.equal(ray.intersectObjects(visibleMeshes()).length, 0, "roof still blocks the top-down view");
    assert.equal(roof.visible, true);
    assert.equal(roof.castShadow, true);
    assert.equal(((studio.root.getObjectByName("garage-floor") as Mesh).material as Material).colorWrite, true);
    studio.updateCamera(6.5);
    assert.equal((roof.material as Material).colorWrite, false, "cutaway should not flicker at the ceiling boundary");
    studio.updateCamera(6);
    assert.equal((roof.material as Material).colorWrite, true);
    assert.equal((roof.material as Material).depthWrite, true);
  } finally {
    studio.dispose();
  }
});

test("surface scans keep their two-metre scale on the floor and every wall face and are released with the studio", () => {
  const studio = createStudio(new Scene(), 0);
  const maps = Array.from({ length: 12 }, () => new Texture());
  let disposals = 0;
  maps.forEach(texture => texture.addEventListener("dispose", () => disposals++));
  studio.setTextures({
    floor: { map: maps[0], normalMap: maps[1], roughnessMap: maps[2] },
    wall: { map: maps[3], normalMap: maps[4], roughnessMap: maps[5] },
    shutter: { map: maps[6], normalMap: maps[7], roughnessMap: maps[8], metalnessMap: maps[8] },
    paintedMetal: { map: maps[9], normalMap: maps[10], roughnessMap: maps[11], metalnessMap: maps[11] },
    dispose: () => maps.forEach(texture => texture.dispose()),
  });
  const floor = studio.root.getObjectByName("garage-floor") as Mesh;
  assert.equal((floor.material as MeshStandardMaterial).normalMap, maps[1]);
  assert.equal((floor.material as MeshStandardMaterial).roughnessMap, maps[2]);
  const floorU = Array.from({ length: 4 }, (_, i) => floor.geometry.attributes.uv.getX(i));
  assert.equal(Math.max(...floorU) - Math.min(...floorU), 80);
  for (const mesh of studio.root.children as Mesh[]) {
    if (mesh === floor) continue;
    const { position, normal, uv } = mesh.geometry.attributes;
    for (let i = 0; i < uv.count; i++) {
      const uMetres = Math.abs(normal.getX(i)) > 0.5 ? position.getZ(i) : position.getX(i);
      const vMetres = Math.abs(normal.getY(i)) > 0.5 ? position.getZ(i) : position.getY(i);
      assert.ok(Math.abs(uv.getX(i) * 2 - uMetres) < 0.00001, `${mesh.name} stretches the scan horizontally`);
      assert.ok(Math.abs(uv.getY(i) * 2 - vMetres) < 0.00001, `${mesh.name} stretches the scan vertically`);
    }
  }
  const wall = studio.root.getObjectByName("side-wall") as Mesh;
  assert.equal((wall.material as MeshStandardMaterial).map, maps[3]);
  const shutter = studio.root.getObjectByName("roller-door") as Mesh;
  const band = studio.root.getObjectByName("left-rear-band") as Mesh;
  const base = studio.root.getObjectByName("left-rear-base") as Mesh;
  assert.equal((shutter.material as MeshStandardMaterial).normalMap, maps[7]);
  assert.equal((shutter.material as MeshStandardMaterial).metalnessMap, maps[8]);
  for (const mesh of [band, base]) {
    assert.equal((mesh.material as MeshStandardMaterial).normalMap, maps[10]);
    assert.equal((mesh.material as MeshStandardMaterial).roughnessMap, maps[11]);
    assert.equal((mesh.material as MeshStandardMaterial).metalnessMap, maps[11]);
  }
  for (const strip of studio.root.children.filter(mesh => mesh.name.includes("plinth"))) {
    assert.equal((strip as Mesh).material, base.material, "room skirting must share the painted black steel finish");
  }
  assert.notEqual(base.material, (studio.root.getObjectByName("roof-rear") as Mesh).material, "pillar paint must not alter the dark roof");
  studio.dispose();
  assert.equal(disposals, 12);
});
