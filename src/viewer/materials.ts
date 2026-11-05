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

/** The exported tyre normal map is a flat sidewall print, not surface detail, and lights the rubber grey. */
const TYRE = { material: "tire", roughness: 0.9 } as const;

/** Black plastic trim exports at roughness 0.3, which mirrors the studio as a grey sheen on lamp frames and bumpers. */
const TRIM = { material: "black", roughness: 0.6, envMapIntensity: 0.3 } as const;

/** Opacity of each exported glass material when drawn as alpha blending. */
const GLASS_OPACITY: Record<string, number> = {
  windowglass: 0.7,
  clearglass: 0.12,
  redglass: 0.72,
};

/** Reflection strength per glass material, lamp covers stay low so they do not wash out. */
const GLASS_REFLECTION: Record<string, number> = {
  windowglass: 0.25,
  clearglass: 0.6,
  redglass: 0.6,
};

/** Window glass is tinted dark so the bright interior does not show through, and kept slightly rough so the studio does not mirror on it. */
const WINDOW_TINT = { material: "windowglass", colour: "#1b2225", roughness: 0.25 } as const;

/** Model material names this file relies on, a test checks that each exists in the shipped model. */
export const TUNED_MATERIAL_NAMES: readonly string[] = [
  PAINT.material,
  ACCENT.material,
  TYRE.material,
  TRIM.material,
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
  if (material.name === WINDOW_TINT.material) glass.roughness = WINDOW_TINT.roughness;
  glass.envMapIntensity = GLASS_REFLECTION[material.name] ?? 1;
  if (material.name === WINDOW_TINT.material) glass.color.set(WINDOW_TINT.colour);
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
      const tyre = material as MeshPhysicalMaterial;
      tyre.roughness = TYRE.roughness;
      tyre.normalMap?.dispose();
      tyre.normalMap = null;
      tyre.needsUpdate = true;
    } else if (material.name === TRIM.material) {
      const trim = material as MeshPhysicalMaterial;
      trim.roughness = TRIM.roughness;
      trim.envMapIntensity = TRIM.envMapIntensity;
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
