import {
  ACESFilmicToneMapping,
  Box3,
  CanvasTexture,
  Color,
  DoubleSide,
  EquirectangularReflectionMapping,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { applyVehicleMaterials, type VehicleMaterials } from "./materials";

const MODEL_URL = `${import.meta.env.BASE_URL}models/dmax.glb`;
const HDRI_URL = `${import.meta.env.BASE_URL}hdri/studio.hdr`;
const withBust = (url: string, bust?: string) => (bust ? `${url}?r=${encodeURIComponent(bust)}` : url);
const MAX_PIXEL_RATIO = 2;
const BACKGROUND = "#16181b";

const FOV = 30;
const START_AZIMUTH = MathUtils.degToRad(38);
const START_ELEVATION = MathUtils.degToRad(11);
const MIN_DISTANCE = 4.5;
const MAX_DISTANCE = 14;
const MAX_POLAR_ANGLE = MathUtils.degToRad(87);

export interface Viewer {
  resetView: () => void;
  setPaintColour: (colour: string) => void;
  /** Hides exactly these named nodes and shows every other node that was hidden before. */
  setHiddenNodes: (names: readonly string[]) => void;
  dispose: () => void;
}

export interface ViewerOptions {
  /** Body colour used when the model first appears. */
  paintColour: string;
  /** Names of nodes that start hidden. */
  hiddenNodes: readonly string[];
  /** Appended to asset URLs so a retry bypasses a cached failed response. */
  cacheBust?: string;
  onProgress?: (fraction: number) => void;
  onLoaded?: () => void;
  onError?: (error: unknown) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

const TEXTURE_SLOTS = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"] as const;

/** Releases the geometries, materials and textures under an object. */
function disposeObject(root: Object3D) {
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

function radialTexture(stops: [number, string][]): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [offset, colour] of stops) gradient.addColorStop(offset, colour);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function groundPlane(texture: CanvasTexture, width: number, depth: number, y: number) {
  const mesh = new Mesh(
    new PlaneGeometry(width, depth),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

export function createViewer(
  container: HTMLElement,
  {
    paintColour: initialPaintColour,
    hiddenNodes: initialHiddenNodes,
    cacheBust,
    onProgress,
    onLoaded,
    onError,
    onContextLost,
    onContextRestored,
  }: ViewerOptions,
): Viewer {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(BACKGROUND);
  const pmrem = new PMREMGenerator(renderer);

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.minDistance = MIN_DISTANCE;
  controls.maxDistance = MAX_DISTANCE;
  controls.maxPolarAngle = MAX_POLAR_ANGLE;

  let frame = 0;
  const requestRender = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      renderer.render(scene, camera);
    });
  };
  controls.addEventListener("change", requestRender);

  const canvas = renderer.domElement;
  const handleContextLost = (event: Event) => {
    // keep the context restorable and stop drawing until it returns
    event.preventDefault();
    cancelAnimationFrame(frame);
    frame = 0;
    onContextLost?.();
  };
  const handleContextRestored = () => {
    onContextRestored?.();
    requestRender();
  };
  canvas.addEventListener("webglcontextlost", handleContextLost);
  canvas.addEventListener("webglcontextrestored", handleContextRestored);

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  let disposed = false;
  let model: Object3D | null = null;
  let pending = 2;
  const assetLoaded = () => {
    pending -= 1;
    if (pending === 0 && !disposed) onLoaded?.();
  };
  let environment: Texture | null = null;
  const disposables: { dispose: () => void }[] = [];
  const startTarget = new Vector3();
  let fitWidth = 5.6;
  let vehicleMaterials: VehicleMaterials | null = null;
  let paintColour = initialPaintColour;
  let hiddenNodes = initialHiddenNodes;
  const nodesByName = new Map<string, Object3D[]>();

  // a name can match a wrapper group and its mesh, both are toggled together
  const applyHiddenNodes = (previous: readonly string[]) => {
    for (const name of previous) {
      for (const node of nodesByName.get(name) ?? []) node.visible = true;
    }
    for (const name of hiddenNodes) {
      for (const node of nodesByName.get(name) ?? []) node.visible = false;
    }
  };

  // Distance at which the vehicle length fits the horizontal field of view.
  const fitDistance = () => {
    const halfHorizontal = Math.atan(Math.tan(MathUtils.degToRad(FOV) / 2) * camera.aspect);
    const distance = fitWidth / 2 / Math.tan(halfHorizontal);
    return MathUtils.clamp(distance, MIN_DISTANCE * 1.4, MAX_DISTANCE * 0.8);
  };

  const resetView = () => {
    const distance = fitDistance();
    const horizontal = Math.cos(START_ELEVATION) * distance;
    camera.position.set(
      startTarget.x + Math.sin(START_AZIMUTH) * horizontal,
      startTarget.y + Math.sin(START_ELEVATION) * distance,
      startTarget.z + Math.cos(START_AZIMUTH) * horizontal,
    );
    controls.target.copy(startTarget);
    controls.update();
    requestRender();
  };

  new HDRLoader().load(
    withBust(HDRI_URL, cacheBust),
    (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.mapping = EquirectangularReflectionMapping;
      const target = pmrem.fromEquirectangular(texture);
      texture.dispose();
      environment = target.texture;
      scene.environment = environment;
      disposables.push(target);
      requestRender();
      assetLoaded();
    },
    undefined,
    (error) => {
      if (!disposed) onError?.(error);
    },
  );

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    withBust(MODEL_URL, cacheBust),
    (gltf) => {
      if (disposed) return;
      model = gltf.scene;
      vehicleMaterials = applyVehicleMaterials(gltf.scene, paintColour);
      gltf.scene.traverse((node) => {
        const group = nodesByName.get(node.name);
        if (group) group.push(node);
        else nodesByName.set(node.name, [node]);
      });
      applyHiddenNodes([]);
      scene.add(gltf.scene);

      const box = new Box3().setFromObject(gltf.scene);
      const centre = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());

      // Floor falls off into the background, the contact shadow sits on top of it.
      const floorTexture = radialTexture([
        [0, "rgba(58,62,68,1)"],
        [0.55, "rgba(32,35,39,0.6)"],
        [1, "rgba(22,24,27,0)"],
      ]);
      const shadowTexture = radialTexture([
        [0, "rgba(0,0,0,0.85)"],
        [0.45, "rgba(0,0,0,0.5)"],
        [1, "rgba(0,0,0,0)"],
      ]);
      disposables.push(floorTexture, shadowTexture);
      const floor = groundPlane(floorTexture, 26, 26, 0);
      const shadow = groundPlane(shadowTexture, size.x * 1.9, size.z * 1.25, 0.004);
      shadow.position.x = centre.x;
      shadow.position.z = centre.z;
      scene.add(floor, shadow);
      disposables.push(floor.geometry, floor.material, shadow.geometry, shadow.material);

      startTarget.set(centre.x, box.min.y + size.y * 0.42, centre.z);
      fitWidth = Math.hypot(size.x, size.z) * 0.95;
      camera.near = 0.2;
      camera.far = 80;
      camera.updateProjectionMatrix();
      resetView();

      requestRender();
      assetLoaded();
    },
    (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    },
    (error) => {
      if (!disposed) onError?.(error);
    },
  );

  return {
    resetView,
    setHiddenNodes(names) {
      if (names.length === hiddenNodes.length && names.every((name, i) => name === hiddenNodes[i])) return;
      const previous = hiddenNodes;
      hiddenNodes = names;
      applyHiddenNodes(previous);
      requestRender();
    },
    setPaintColour(colour) {
      if (colour === paintColour) return;
      paintColour = colour;
      vehicleMaterials?.setPaintColour(colour);
      requestRender();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      if (model) disposeObject(model);
      controls.dispose();
      for (const item of disposables) item.dispose();
      vehicleMaterials?.dispose();
      environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
