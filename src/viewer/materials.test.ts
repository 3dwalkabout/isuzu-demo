import assert from "node:assert/strict";
import { test } from "node:test";
import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial } from "three";
import { applyVehicleMaterials } from "./materials.ts";

test("the unlined tray follows body paint without changing black trim or hiding geometry", () => {
  const root = new Group();
  const black = new MeshPhysicalMaterial({name: "black", color: "#111111"});
  const trunk = new Group(); trunk.name = "trunk";
  const tray = new Mesh(new BoxGeometry(), black);
  const trim = new Mesh(new BoxGeometry(), black);
  const body = new Mesh(new BoxGeometry(), new MeshPhysicalMaterial({name: "carpaint"}));
  trunk.add(tray); root.add(trunk, trim, body);
  const materials = applyVehicleMaterials(root, "#91111a");
  materials.setBedLiner(false, true);
  materials.update(performance.now() + 1000);
  assert.equal(tray.visible, true);
  assert.equal(trunk.visible, true);
  assert.equal((tray.material as MeshPhysicalMaterial).color.getHexString(), "91111a");
  materials.setPaintColour("#094bac", true);
  materials.update(performance.now() + 1000);
  assert.equal((tray.material as MeshPhysicalMaterial).color.getHexString(), "094bac");
  assert.equal(black.color.getHexString(), "111111");
  materials.setBedLiner(true, true);
  materials.update(performance.now() + 1000);
  assert.equal((tray.material as MeshPhysicalMaterial).color.getHexString(), "101214");
  assert.equal((body.material as MeshPhysicalMaterial).color.getHexString(), "094bac");
  materials.dispose();
});
