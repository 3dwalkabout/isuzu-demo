import type { Material, Mesh, Object3D, Texture } from "three";

const TEXTURE_SLOTS = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"] as const;

/** Releases the geometries, materials and textures under an object. */
export function disposeObject(root: Object3D) {
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      for (const slot of TEXTURE_SLOTS) {
        (material as unknown as Record<string, Texture | null | undefined>)[slot]?.dispose();
      }
      material.dispose();
    }
  });
}
