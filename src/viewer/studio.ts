import {
  BoxGeometry, Color, Fog, Group,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry,
  type BufferGeometry, type Material, type Scene, type Texture,
} from "three";
import { LOOK } from "./look.ts";
import type { StudioTextures } from "./studioTextures.ts";

/** Concrete tiles, columns and a skylight are physical geometry, so floor
 * perspective and structural lines stay consistent throughout the orbit. */
export function createStudio(scene: Scene, groundY: number) {
  scene.background = new Color(LOOK.studio.background);
  scene.fog = new Fog(LOOK.studio.background, 20, 44);
  const root = new Group();
  root.name = "garage";
  scene.add(root);
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const roofMaterials = new Map<Material, Material>();
  let roofCutaway = false;
  let surfaceTextures: StudioTextures | null = null;

  const concrete = new MeshStandardMaterial({ color: "#d1d5d8", roughness: 0.92, envMapIntensity: LOOK.studio.ambient.concrete });
  const red = new MeshStandardMaterial({ color: "#a62b32", roughness: 0.7, envMapIntensity: 0.65 });
  const blackMetal = new MeshStandardMaterial({ color: "#30343a", roughness: 0.7, envMapIntensity: 0.65 });
  const dark = new MeshStandardMaterial({ color: "#252a30", roughness: 0.9, envMapIntensity: LOOK.studio.ambient.roof });
  const wall = new MeshStandardMaterial({ color: "#b5bec7", roughness: 1, envMapIntensity: LOOK.studio.ambient.wall });
  const metal = new MeshStandardMaterial({ color: "#d4dae0", metalness: 0.2, roughness: 0.8, envMapIntensity: 0.7 });
  const frame = new MeshStandardMaterial({ color: "#67717b", metalness: 0.75, roughness: 0.38, envMapIntensity: 0.8 });
  const skylight = new MeshBasicMaterial({ color: "#dce5eb" });
  [concrete, red, blackMetal, dark, wall, metal, frame, skylight].forEach(material => materials.add(material));

  const box = (name: string, size: readonly number[], position: readonly number[], material: Material, castsShadow = true) => {
    const geometry = new BoxGeometry(size[0], size[1], size[2]);
    // Project each face in two-metre UV units so a long
    // wall, thin column and painted band have the same surface-detail scale.
    const positionAttribute = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const x = positionAttribute.getX(i), y = positionAttribute.getY(i), z = positionAttribute.getZ(i);
      uv.setXY(i, (Math.abs(normal.getX(i)) > 0.5 ? z : x) / 2, (Math.abs(normal.getY(i)) > 0.5 ? z : y) / 2);
    }
    geometries.add(geometry);
    let surface = material;
    if (name.startsWith("roof-") || name.startsWith("skylight") || name.startsWith("ceiling-")) {
      if (!roofMaterials.has(material)) {
        const copy = material.clone();
        roofMaterials.set(material, copy);
        materials.add(copy);
      }
      surface = roofMaterials.get(material)!;
    }
    const mesh = new Mesh(geometry, surface);
    mesh.name = name;
    mesh.position.set(position[0], groundY + position[1], position[2]);
    mesh.castShadow = castsShadow;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  const floorGeometry = new PlaneGeometry(160, 160);
  const floorUv = floorGeometry.attributes.uv;
  for (let i = 0; i < floorUv.count; i++) floorUv.setXY(i, floorUv.getX(i) * 80, floorUv.getY(i) * 80);
  const floorMaterial = new MeshStandardMaterial({
    color: LOOK.studio.floor, roughness: 0.95, metalness: 0, envMapIntensity: LOOK.studio.ambient.floor,
  });
  geometries.add(floorGeometry);
  materials.add(floorMaterial);
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.name = "garage-floor";
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = groundY;
  floor.receiveShadow = true;
  root.add(floor);

  const height = LOOK.studio.height;
  const doorCentres = [-6, 6];
  const doorWidth = 6;
  // Columns stay outside the normal camera orbit, framing the vehicle bay.
  for (const x of [-10.5, 10.5]) {
    for (const z of [-10.5, 10.5]) {
      const id = (x < 0 ? "left" : "right") + (z < 0 ? "-rear" : "-front");
      box(id + "-base", [0.7, 0.35, 0.7], [x, 0.175, z], blackMetal);
      box(id + "-band", [0.7, 2.15, 0.7], [x, 1.425, z], red);
      box(id + "-column", [0.7, height - 2.5, 0.7], [x, 2.5 + (height - 2.5) / 2, z], concrete);
    }
  }
  for (const side of [-1, 1]) {
    box("side-wall", [0.25, height, 40], [side * 20, height / 2, 0], wall);
    box("end-wall", [40, height, 0.25], [0, height / 2, side * 20], wall);
    box("side-wall-plinth", [0.12, 0.8, 40], [side * 19.8, 0.4, 0], blackMetal, false);
    if (side > 0) box("end-wall-plinth", [40, 0.8, 0.12], [0, 0.4, 19.8], blackMetal, false);
  }
  // End each skirting section at a doorway, rather than laying coplanar
  // material across the shutter. Door centres and widths define both meshes.
  let skirtingStart = -20;
  for (const x of doorCentres) {
    const openingStart = x - doorWidth / 2;
    box("rear-wall-plinth", [openingStart - skirtingStart, 0.8, 0.12], [(skirtingStart + openingStart) / 2, 0.4, -19.8], blackMetal, false);
    skirtingStart = x + doorWidth / 2;
    box("roller-door", [doorWidth, 4.2, 0.12], [x, 2.1, -19.8], metal, false);
    box("door-header", [6.2, 0.12, 0.2], [x, 4.3, -19.7], red, false);
    // The shutter scan supplies aligned horizontal rib normals. Tracks and
    // the bottom rail provide real edge depth without overlapping skirting.
    for (const side of [-1, 1]) box("shutter-guide", [0.14, 4.3, 0.22], [x + side * (doorWidth / 2 + 0.03), 2.15, -19.65], frame, false);
    box("shutter-bottom-rail", [doorWidth, 0.1, 0.18], [x, 0.06, -19.66], frame, false);
  }
  box("rear-wall-plinth", [20 - skirtingStart, 0.8, 0.12], [(skirtingStart + 20) / 2, 0.4, -19.8], blackMetal, false);

  // Solid roof sections surround a real opening for the directional light.
  box("roof-left", [12, 0.2, 40], [-14, height, 0], dark);
  box("roof-right", [18, 0.2, 40], [11, height, 0], dark);
  box("roof-rear", [10, 0.2, 20.5], [-3, height, -9.75], dark);
  box("roof-front", [10, 0.2, 11.5], [-3, height, 14.25], dark);
  box("skylight", [10, 0.04, 8], [-3, height + 0.25, 4.5], skylight, false);
  for (const x of [-8, -6, -4, -2, 0, 2]) {
    box("skylight-rail", [0.12, 0.18, 8], [x, height, 4.5], dark);
  }
  for (const z of [0.5, 2.5, 4.5, 6.5, 8.5]) {
    box("skylight-crossbar", [10, 0.18, 0.12], [-3, height, z], dark);
  }
  for (const z of [-10.5, 10.5]) {
    box("ceiling-beam", [22, 0.35, 0.3], [0, height - 0.25, z], concrete);
  }
  for (const x of [-9, 9]) {
    for (const z of [-8, 0, 8]) {
      box("ceiling-strip", [4, 0.05, 0.14], [x, height - 0.2, z], skylight, false);
    }
  }

  return {
    root,
    setEnvironment(environment: Texture) {
      // Bind explicitly so each surface's indoor ambient level is respected.
      // The scene fallback otherwise replaces it with environmentIntensity.
      materials.forEach(material => {
        if (material instanceof MeshStandardMaterial) {
          material.envMap = environment;
          material.needsUpdate = true;
        }
      });
    },
    setTextures(textures: StudioTextures) {
      surfaceTextures?.dispose();
      surfaceTextures = textures;
      Object.assign(floorMaterial, textures.floor);
      floorMaterial.normalScale.setScalar(0.28);
      Object.assign(wall, textures.wall);
      wall.normalScale.setScalar(0.45);
      Object.assign(concrete, textures.wall);
      concrete.normalScale.setScalar(0.35);
      Object.assign(metal, textures.shutter);
      metal.metalness = textures.shutter.metalnessMap ? 1 : 0.2;
      metal.normalScale.setScalar(0.75);
      // Paint is dielectric; the metalness map exposes steel only at worn areas.
      for (const material of [red, blackMetal]) {
        Object.assign(material, textures.paintedMetal);
        material.metalness = textures.paintedMetal.metalnessMap ? 1 : 0;
        material.normalScale.setScalar(0.3);
      }
      const roofConcrete = roofMaterials.get(concrete) as MeshStandardMaterial | undefined;
      if (roofConcrete) { Object.assign(roofConcrete, textures.wall); roofConcrete.normalScale.copy(concrete.normalScale); }
      materials.forEach(material => { material.needsUpdate = true; });
    },
    updateCamera(cameraY: number) {
      const threshold = groundY + height - (roofCutaway ? 0.6 : 0.35);
      const cutaway = cameraY > threshold;
      if (cutaway === roofCutaway) return;
      roofCutaway = cutaway;
      // Suppress only the visible/depth pass. Shadow materials are separate,
      // so the skylight still lights the bay consistently during inspection.
      for (const material of roofMaterials.values()) {
        material.colorWrite = !cutaway;
        material.depthWrite = !cutaway;
      }
    },
    dispose() {
      root.removeFromParent();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      surfaceTextures?.dispose();
    },
  };
}
