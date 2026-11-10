import { BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3, type Material, type Object3D } from "three";
import { ACCESSORIES } from "../config/accessories.ts";
import { Transition } from "./motion.ts";
import { worldGeometry } from "./geometry.ts";

const FITTING_OFFSETS: Record<string, readonly [number, number, number]> = {
  "roof-rails": [0, 0.7, 0],
  "side-steps": [0.65, 0.12, 0],
  "mud-flaps": [0.45, 0.08, -0.2],
};

/** Split the paired parts so each side fits from outside the vehicle. */
function splitSides(mesh: Mesh) {
  const world = worldGeometry(mesh);
  const source = world.index ? world.toNonIndexed() : world;
  const entries = Object.entries(source.attributes);
  const outputs = [-1,1].map(side => {
    const arrays = entries.map(() => [] as number[]);
    const positions = source.attributes.position;
    for (let i = 0; i < positions.count; i += 3) {
      const centreX = (positions.getX(i) + positions.getX(i+1) + positions.getX(i+2)) / 3;
      if ((centreX >= 0 ? 1 : -1) !== side) continue;
      entries.forEach(([,a], attributeIndex) => {
        for (let j = 0; j < 3; j++) for (let k = 0; k < a.itemSize; k++) arrays[attributeIndex].push(a.getComponent(i+j,k));
      });
    }
    const geometry = new BufferGeometry();
    entries.forEach(([name,a],i) => geometry.setAttribute(name,new Float32BufferAttribute(arrays[i],a.itemSize)));
    geometry.normalizeNormals();
    if (geometry.attributes.position.count) { geometry.computeBoundingBox(); geometry.computeBoundingSphere(); }
    return {side,geometry};
  });
  if (source !== world) source.dispose();
  world.dispose();
  return outputs;
}

export function createAccessoryMotion(model: Object3D) {
  model.updateWorldMatrix(true,true);
  const root = new Group(); root.name = "animated-accessories";
  const items = ACCESSORIES.filter(accessory => accessory.behaviour !== "material").map(accessory => {
    const motion = new Transition(1, 850);
    const parts: {mesh: Mesh; offset: Vector3; materials: {material: Material; opacity: number; transparent: boolean; depthWrite: boolean}[]}[] = [];
    const seen = new Set<Mesh>();
    for (const name of accessory.nodes) model.getObjectByName(name)?.traverse(object => {
      const source = object as Mesh;
      if (!source.isMesh || seen.has(source)) return;
      seen.add(source);
      for (const {side,geometry} of splitSides(source)) {
        if (!geometry.attributes.position.count) { geometry.dispose(); continue; }
        const materials: typeof parts[number]["materials"] = [];
        const clone = (original: Material) => {
          const material = original.clone();
          materials.push({material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite});
          return material;
        };
        const mesh = new Mesh(geometry, Array.isArray(source.material) ? source.material.map(clone) : clone(source.material));
        mesh.name = `${accessory.id}-${side < 0 ? "right" : "left"}`;
        const [x,y,z] = FITTING_OFFSETS[accessory.id];
        parts.push({mesh, materials, offset:new Vector3(x * side,y,z)});
        root.add(mesh);
      }
      source.visible = false;
    });
    return {accessory,motion,parts};
  });
  return {
    root,
    setHidden(names: readonly string[], now: number, immediate: boolean) {
      for (const {accessory,motion} of items) motion.to(accessory.nodes.some(name => names.includes(name)) ? 0 : 1, now, immediate);
    },
    update(now: number) {
      let active = false;
      for (const {motion,parts} of items) {
        active = motion.update(now) || active;
        const opacityFactor = Math.min(1, motion.value * 4);
        for (const {mesh,offset,materials} of parts) {
          mesh.position.copy(offset).multiplyScalar(1 - motion.value);
          mesh.visible = motion.value > 0;
          for (const {material,opacity,transparent,depthWrite} of materials) {
            const blending = opacityFactor < 1;
            if (material.transparent !== (blending || transparent)) { material.transparent = blending || transparent; material.needsUpdate = true; }
            material.opacity = opacity * opacityFactor;
            material.depthWrite = blending ? false : depthWrite;
          }
        }
      }
      return active;
    },
    dispose() {
      for (const {parts} of items) for (const {mesh,materials} of parts) { mesh.geometry.dispose(); materials.forEach(({material}) => material.dispose()); }
      root.removeFromParent();
    },
  };
}
