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
  type Texture,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { applyVehicleMaterials, type VehicleMaterials } from "./materials";

const MODEL_URL = `${import.meta.env.BASE_URL}models/dmax.glb`;
const HDRI_URL = `${import.meta.env.BASE_URL}hdri/studio.hdr`;
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
  dispose: () => void;
}

export interface ViewerOptions {
  onProgress?: (fraction: number) => void;
  onLoaded?: () => void;
  onError?: (error: unknown) => void;
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
  { onProgress, onLoaded, onError }: ViewerOptions = {},
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
  let environment: Texture | null = null;
  const disposables: { dispose: () => void }[] = [];
  const startTarget = new Vector3();
  let fitWidth = 5.6;
  let vehicleMaterials: VehicleMaterials | null = null;
  let paintColour: string | undefined;

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

  new HDRLoader().load(HDRI_URL, (texture) => {
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
  });

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    MODEL_URL,
    (gltf) => {
      if (disposed) return;
      vehicleMaterials = applyVehicleMaterials(gltf.scene, paintColour);
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

      onLoaded?.();
      requestRender();
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
    setPaintColour(colour) {
      paintColour = colour;
      vehicleMaterials?.setPaintColour(colour);
      requestRender();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
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
