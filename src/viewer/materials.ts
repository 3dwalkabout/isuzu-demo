import { Color, Mesh, MeshPhysicalMaterial, type Material, type Object3D } from "three";

/**
 * Material tuning for the vehicle. The exported model carries no usable paint
 * (base colour missing, mirror finish) and tyres that read chalky, so these
 * materials replace or adjust them by name after load.
 */

/** Glass is either left as exported (transmission pass) or drawn as cheap alpha blending. */
export type GlassMode = "alpha" | "transmission";
export const GLASS_MODE: GlassMode = "alpha";

const PAINT = {
  material: "carpaint",
  metalness: 0.55,
  roughness: 0.32,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  envMapIntensity: 1,
} as const;

const ACCENT = {
  material: "carpaint_second",
  colour: "#25282c",
  metalness: 0.85,
  roughness: 0.35,
} as const;

const TYRE = { material: "tire", roughness: 0.85 } as const;

/** Opacity of each exported glass material when drawn as alpha blending. */
const GLASS_OPACITY: Record<string, number> = {
  windowglass: 0.32,
  clearglass: 0.28,
  redglass: 0.72,
};

/** Model material names this file relies on, a test checks that each exists in the shipped model. */
export const TUNED_MATERIAL_NAMES: readonly string[] = [
  PAINT.material,
  ACCENT.material,
  TYRE.material,
  ...Object.keys(GLASS_OPACITY),
];

export interface VehicleMaterials {
  setPaintColour: (colour: string) => void;
  dispose: () => void;
}

function eachMesh(root: Object3D, visit: (mesh: Mesh, material: Material) => void) {
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    visit(mesh, mesh.material);
  });
}

function toAlphaGlass(material: Material, opacity: number) {
  const glass = material as MeshPhysicalMaterial;
  glass.transmission = 0;
  glass.transparent = true;
  glass.opacity = opacity;
  glass.depthWrite = false;
  glass.envMapIntensity = 1.5;
  glass.needsUpdate = true;
}

/**
 * Applies paint, accent, tyre and glass materials to a loaded vehicle. Paint is one
 * shared material, so a colour change is a single assignment and leaves clearcoat,
 * roughness and everything else untouched.
 */
export function applyVehicleMaterials(root: Object3D, paintColour: string): VehicleMaterials {
  const paint = new MeshPhysicalMaterial({
    name: PAINT.material,
    color: new Color(paintColour),
    metalness: PAINT.metalness,
    roughness: PAINT.roughness,
    clearcoat: PAINT.clearcoat,
    clearcoatRoughness: PAINT.clearcoatRoughness,
    envMapIntensity: PAINT.envMapIntensity,
  });
  const accent = new MeshPhysicalMaterial({
    name: ACCENT.material,
    color: new Color(ACCENT.colour),
    metalness: ACCENT.metalness,
    roughness: ACCENT.roughness,
  });
  const replaced = new Set<Material>();

  eachMesh(root, (mesh, material) => {
    if (material.name === PAINT.material) {
      replaced.add(material);
      mesh.material = paint;
    } else if (material.name === ACCENT.material) {
      replaced.add(material);
      mesh.material = accent;
    } else if (material.name === TYRE.material) {
      (material as MeshPhysicalMaterial).roughness = TYRE.roughness;
    } else if (GLASS_MODE === "alpha" && material.name in GLASS_OPACITY) {
      toAlphaGlass(material, GLASS_OPACITY[material.name]);
    }
  });

  for (const material of replaced) material.dispose();

  return {
    setPaintColour: (colour) => paint.color.set(colour),
    dispose: () => {
      paint.dispose();
      accent.dispose();
    },
  };
}
