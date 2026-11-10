import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from "three";

type SurfaceMaps = { map?: Texture; normalMap?: Texture; roughnessMap?: Texture; metalnessMap?: Texture };
export interface StudioTextures {
  floor: SurfaceMaps;
  wall: SurfaceMaps;
  shutter: SurfaceMaps;
  paintedMetal: SurfaceMaps;
  dispose: () => void;
}

/** Locally hosted CC0 maps; see public/textures/garage/SOURCES.md. */
export async function loadStudioTextures(baseUrl: string, anisotropy: number): Promise<StudioTextures> {
  const loader = new TextureLoader();
  const textures = new Set<Texture>();
  const floor: SurfaceMaps = {}, wall: SurfaceMaps = {}, shutter: SurfaceMaps = {}, paintedMetal: SurfaceMaps = {};
  const tasks = ([
    [floor, "hangar_concrete_floor", false, 1],
    [wall, "concrete_wall_006", false, 1],
    [shutter, "painted_metal_shutter", true, 1],
    [paintedMetal, "blue_metal_plate", true, 0.8],
  ] as const).flatMap(([surface, asset, packed, repeat]) => ([
    ["map", "diff"], ["normalMap", "nor_gl"], ["roughnessMap", packed ? "arm" : "rough"],
  ] as const).map(async ([slot, suffix]) => {
    const texture = await loader.loadAsync(`${baseUrl}textures/garage/${asset}_${suffix}.webp`);
    if (slot === "map") texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    // Geometry UVs use two-metre units; the flat painted-steel scan is 2.5 m.
    texture.repeat.setScalar(repeat);
    if (asset === "blue_metal_plate") texture.offset.set(0.5, 0.15);
    texture.anisotropy = anisotropy;
    textures.add(texture);
    surface[slot] = texture;
    // glTF ARM packs roughness in green and exposed-metal coverage in blue.
    if (packed && slot === "roughnessMap") surface.metalnessMap = texture;
  }));
  // A missing optional surface map should leave a usable garage, not fail the car.
  const results = await Promise.allSettled(tasks);
  if (results.some(result => result.status === "rejected")) console.warn("Some garage textures could not load; using available maps.");
  return { floor, wall, shutter, paintedMetal, dispose: () => textures.forEach(texture => texture.dispose()) };
}
