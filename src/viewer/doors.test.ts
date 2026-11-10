import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { Box3, BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshPhysicalMaterial, Raycaster, Vector3, type TypedArray } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { createDoors } from "./doors.ts";
import { closedDoors, DOOR_IDS } from "../config/doors.ts";

test("the shipped quantised doors retain their closed shape and return after opening", async () => {
  await MeshoptDecoder.ready;
  const document = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({"meshopt.decoder":MeshoptDecoder}).read(fileURLToPath(new URL("../../public/models/dmax.glb", import.meta.url)));
  const model = new Group();
  for (const node of document.getRoot().listNodes()) {
    if (!["door", "door_handle", "windows_glass_side", "trim_plastic", "mirror01", "mirror_base", "interior01", "hull"].includes(node.getName())) continue;
    const group = new Group(); group.name = node.getName(); model.add(group);
    node.traverse(child => {
      for (const primitive of child.getMesh()?.listPrimitives() ?? []) {
        const geometry = new BufferGeometry();
        primitive.listSemantics().forEach(semantic => {
          const attribute = primitive.getAttribute(semantic)!;
          const key = {POSITION:"position", NORMAL:"normal", TEXCOORD_0:"uv"}[semantic];
          if (key) geometry.setAttribute(key, new BufferAttribute(attribute.getArray()! as TypedArray, attribute.getElementSize(), attribute.getNormalized()));
        });
        const indices = primitive.getIndices();
        if (indices) geometry.setIndex(new BufferAttribute(indices.getArray()! as TypedArray, 1));
        const mesh = new Mesh(geometry, new MeshPhysicalMaterial({side:DoubleSide}));
        mesh.matrixAutoUpdate = false;
        mesh.matrix.fromArray(child.getWorldMatrix());
        group.add(mesh);
      }
    });
  }
  model.updateWorldMatrix(true, true);
  const original = new Box3().setFromObject(model);
  const doors = createDoors(model);
  doors.update(0);
  const closed = new Box3().setFromObject(doors.root);
  assert.ok(original.min.distanceTo(closed.min) < 0.0001);
  assert.ok(original.max.distanceTo(closed.max) < 0.0001);
  for (const id of DOOR_IDS) {
    const group = doors.root.getObjectByName(id)!;
    assert.ok(group.children.length >= 3, `${id} is missing panel, handle or window`);
    assert.ok(group.getObjectByName(`${id}-interior01`), `${id} is missing its inner door card`);
    const edges = group.getObjectByName(`${id}-door-edges`) as Mesh;
    assert.ok(edges?.geometry.attributes.position.count > 0, `${id} has no edge caps`);
    assert.equal(edges.material, (group.getObjectByName(`${id}-door`) as Mesh).material, "edge caps must follow the shared body paint");
    group.traverse(object => {
      if ((object as Mesh).isMesh) assert.ok([...((object as Mesh).geometry.attributes.position.array)].every(Number.isFinite));
    });
  }
  const open = Object.fromEntries(DOOR_IDS.map(id => [id, true])) as ReturnType<typeof closedDoors>;
  doors.set(open, 0, false); doors.update(1000);
  const opened = new Box3().setFromObject(doors.root);
  assert.ok(opened.max.x > closed.max.x + 0.5);
  assert.ok(opened.min.x < closed.min.x - 0.5);
  const stationary = doors.root.children.filter(child => child.name.startsWith("stationary-"));
  const cabin = doors.root.getObjectByName("stationary-interior01") as Mesh;
  assert.ok(cabin.geometry.attributes.position.count > 1000, "the stationary cabin interior should still exist");
  for (const z of [0.45, 0.6, 0.8, -0.25, -0.45, -0.6]) {
    for (const side of [-1,1]) {
      const hits = new Raycaster(new Vector3(side * 2,0.95,z), new Vector3(-side,0,0)).intersectObjects(stationary);
      assert.ok(hits.every(hit => Math.abs(hit.point.x) < 0.701), `a stationary wall still obstructs a door opening at z=${z}`);
    }
  }
  doors.set(closedDoors(), 1000, false); doors.update(2000);
  const restored = new Box3().setFromObject(doors.root);
  assert.ok(closed.min.distanceTo(restored.min) < 0.0001);
  assert.ok(closed.max.distanceTo(restored.max) < 0.0001);
  doors.dispose();
});
