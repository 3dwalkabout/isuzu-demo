import assert from "node:assert/strict";
import { test } from "node:test";
import { Box3, BoxGeometry, BufferAttribute, Group, Mesh, MeshPhysicalMaterial } from "three";
import { createAccessoryMotion } from "./accessoryMotion.ts";

test("paired accessories fit from opposite sides and reverse without jumping", () => {
  const model = new Group();
  model.scale.setScalar(0.001); model.position.set(-1,0,-1);
  for (const name of ["rail_01","rubber_02","rubber_01"]) {
    const group = new Group(); group.name = name; model.add(group);
    for (const x of [200,1800]) {
      const geometry = new BoxGeometry(100,100,100).translate(x,1500,1000);
      geometry.setAttribute("position", new BufferAttribute(new Uint16Array(geometry.attributes.position.array),3));
      group.add(new Mesh(geometry, new MeshPhysicalMaterial({color:"#111111"})));
    }
  }
  model.updateWorldMatrix(true,true);
  const original = new Box3().setFromObject(model);
  const accessories = createAccessoryMotion(model);
  const names = ["rail_01","rubber_02","rubber_01"];
  accessories.setHidden(names,0,true); accessories.update(0);
  assert.equal(accessories.root.children.length,6);
  assert.ok(accessories.root.children.every(part => !part.visible));
  accessories.setHidden([],0,false); accessories.update(425);
  const left = accessories.root.getObjectByName("side-steps-left")!;
  const right = accessories.root.getObjectByName("side-steps-right")!;
  assert.equal(left.position.x,0.325);
  assert.equal(right.position.x,-0.325);
  assert.equal(accessories.root.getObjectByName("roof-rails-left")!.position.y,0.35);
  assert.ok(accessories.root.children.every(part => part.visible));
  accessories.setHidden(names,425,false); accessories.update(425);
  assert.equal(left.position.x,0.325);
  accessories.update(1300);
  assert.ok(accessories.root.children.every(part => !part.visible));
  accessories.setHidden([],1400,true); accessories.update(1400);
  const fitted = new Box3().setFromObject(accessories.root);
  assert.ok(original.min.distanceTo(fitted.min) < 0.0001);
  assert.ok(original.max.distanceTo(fitted.max) < 0.0001);
  assert.ok(accessories.root.children.every(part => part.visible && part.position.length() === 0));
  for (const part of accessories.root.children as Mesh[]) {
    assert.equal((part.material as MeshPhysicalMaterial).opacity,1);
    assert.equal((part.material as MeshPhysicalMaterial).transparent,false);
  }
  accessories.dispose();
});
