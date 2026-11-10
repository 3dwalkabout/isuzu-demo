import assert from "node:assert/strict";
import { test } from "node:test";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createDoorEdges } from "./doorEdges.ts";

test("edge caps bridge the skin thickness without filling window openings or overlapping the adjacent seam", () => {
  // A panel with a rectangular window. Duplicated triangle vertices match the
  // exported skin; shared internal edges must be welded before making caps.
  const points: number[] = [];
  const quad = (y0: number, z0: number, y1: number, z1: number) => {
    for (const [y, z] of [[y0,z0],[y1,z0],[y1,z1],[y0,z0],[y1,z1],[y0,z1]]) points.push(1,y,z);
  };
  quad(0,0,0.5,1); quad(0.5,0,1.5,0.2); quad(0.5,0.8,1.5,1); quad(1.5,0,1.7,1);
  const skin = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(points,3));
  const caps = createDoorEdges(skin, 1, 0.5, 0, true);
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new Mesh(caps, material); mesh.updateMatrixWorld();
  assert.equal(new Raycaster(new Vector3(2,1,0.5),new Vector3(-1,0,0)).intersectObject(mesh).length,0,"caps block the window");
  assert.ok(new Raycaster(new Vector3(0.85,0.25,-0.5),new Vector3(0,0,1),0,0.6).intersectObject(mesh).length > 0,"latch edge remains hollow");
  const position = caps.attributes.position;
  let thinFrame = false, thickPanel = false;
  for (let i=0;i<position.count;i++) {
    assert.ok(position.getX(i) >= 0.71999 && position.getX(i) <= 1);
    assert.ok(position.getZ(i) >= 0, "front cap protrudes into the adjacent rear door");
    if (position.getY(i)>0.6 && Math.abs(position.getX(i)-0.965)<0.00001) thinFrame = true;
    if (position.getY(i)<0.4 && Math.abs(position.getX(i)-0.72)<0.00001) thickPanel = true;
  }
  assert.ok(thinFrame && thickPanel,"window frame and lower panel need different thicknesses");
  skin.dispose(); caps.dispose(); material.dispose();
});
