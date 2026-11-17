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
  const materials = applyVehicleMaterials(root, "#91111a", true, { paint: "carpaint", accent: null, linerNodes: ["trunk"] });
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

test("paint and accent follow the material names given for the model", () => {
  const root = new Group();
  const body = new Mesh(new BoxGeometry(), new MeshPhysicalMaterial({ name: "body_paint" }));
  const grille = new Mesh(new BoxGeometry(), new MeshPhysicalMaterial({ name: "grille_paint" }));
  const other = new Mesh(new BoxGeometry(), new MeshPhysicalMaterial({ name: "carpaint" }));
  root.add(body, grille, other);
  const materials = applyVehicleMaterials(root, "#094bac", true, { paint: "body_paint", accent: "grille_paint", linerNodes: [] });
  materials.update(performance.now() + 1000);
  assert.equal((body.material as MeshPhysicalMaterial).color.getHexString(), "094bac");
  assert.notEqual(grille.material, body.material);
  assert.equal((grille.material as MeshPhysicalMaterial).color.getHexString(), "25282c");
  assert.equal(other.material.name, "carpaint", "a material the model does not name as paint is left alone");
  materials.dispose();
});
