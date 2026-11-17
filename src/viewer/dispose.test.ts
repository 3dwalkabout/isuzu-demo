import assert from "node:assert/strict";
import { test } from "node:test";
import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, Texture } from "three";
import { disposeObject } from "./dispose.ts";

function counted<T extends { dispose: () => void }>(resource: T) {
  const counter = { calls: 0 };
  const dispose = resource.dispose.bind(resource);
  resource.dispose = () => { counter.calls += 1; dispose(); };
  return counter;
}

test("disposing a vehicle releases every geometry, material and texture under it exactly once", () => {
  const root = new Group();
  const inner = new Group();
  const geometries = [new BoxGeometry(), new BoxGeometry()];
  const normalMap = new Texture();
  const materials = [new MeshPhysicalMaterial({ normalMap }), new MeshPhysicalMaterial()];
  inner.add(new Mesh(geometries[0], materials[0]));
  root.add(inner, new Mesh(geometries[1], materials[1]));

  const counts = [...geometries, ...materials, normalMap].map(counted);
  disposeObject(root);
  assert.deepEqual(counts.map(count => count.calls), [1, 1, 1, 1, 1]);
});

test("a material shared by several meshes is released for each mesh without error", () => {
  const root = new Group();
  const shared = new MeshPhysicalMaterial();
  root.add(new Mesh(new BoxGeometry(), shared), new Mesh(new BoxGeometry(), shared));
  assert.doesNotThrow(() => disposeObject(root));
});

test("an object without meshes is a no-op", () => {
  assert.doesNotThrow(() => disposeObject(new Group()));
});
