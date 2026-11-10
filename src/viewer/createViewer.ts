import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  EquirectangularReflectionMapping,
  MathUtils,
  Mesh,
  PerspectiveCamera,
  PMREMGenerator,
  PCFShadowMap,
  Scene,
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
import { LOOK } from "./look";
import { createStudioLighting } from "./lighting";
import { createReflections } from "./reflections";
import { applyVehicleMaterials, type VehicleMaterials } from "./materials";
import { createDoors } from "./doors";
import type { DoorState } from "../config/doors";
import { createAccessoryMotion } from "./accessoryMotion";
import { CameraMotion, cameraFieldOfView } from "./cameraMotion";
import { createStudio } from "./studio";
import { loadStudioTextures } from "./studioTextures";
import { saveCapture } from "./capture";
import { VIEWS, type ViewId } from "../config/views";

const MODEL_URL = `${import.meta.env.BASE_URL}models/dmax.glb`;
const HDRI_URL = `${import.meta.env.BASE_URL}hdri/${LOOK.environment.file}`;
const withBust = (url: string, bust?: string) => (bust ? `${url}?r=${encodeURIComponent(bust)}` : url);
const MAX_PIXEL_RATIO = 2;

const START_AZIMUTH = MathUtils.degToRad(38);
const START_ELEVATION = MathUtils.degToRad(11);
const MIN_DISTANCE = 4.5;
const MAX_DISTANCE = 14;
const MAX_POLAR_ANGLE = MathUtils.degToRad(87);
/** Share of the window the vehicle may fill along its limiting axis. */
const FRAMING_FILL = 0.95;
/** Metres the orbit target sits below the usual centre, so the vehicle clears the panel at the bottom. */
const FRAMING_LIFT = 0.2;

export interface Viewer {
  resetView: () => void;
  setPresenting: (enabled: boolean) => void;
  savePhoto: () => Promise<void>;
  setView: (view: ViewId) => void;
  setReflections: (enabled: boolean) => void;
  setPaintColour: (colour: string) => void;
  setBedLiner: (enabled: boolean) => void;
  setDoors: (state: DoorState) => void;
  /** Hides exactly these named nodes and shows every other node that was hidden before. */
  setHiddenNodes: (names: readonly string[]) => void;
  dispose: () => void;
}

export interface ViewerOptions {
  /** Body colour used when the model first appears. */
  paintColour: string;
  bedLiner: boolean;
  doors: DoorState;
  reflections: boolean;
  /** Names of nodes that start hidden. */
  hiddenNodes: readonly string[];
  /** Appended to asset URLs so a retry bypasses a cached failed response. */
  cacheBust?: string;
  onProgress?: (fraction: number) => void;
  onLoaded?: () => void;
  onError?: (error: unknown) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onPresentingChange?: (enabled: boolean) => void;
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

export function createViewer(
  container: HTMLElement,
  {
    paintColour: initialPaintColour,
    bedLiner: initialBedLiner,
    doors: initialDoors,
    reflections: initialReflections,
    hiddenNodes: initialHiddenNodes,
    cacheBust,
    onProgress,
    onLoaded,
    onError,
    onContextLost,
    onContextRestored,
    onPresentingChange,
  }: ViewerOptions,
): Viewer {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = LOOK.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.environmentIntensity = LOOK.environment.intensity;
  scene.environmentRotation.y = LOOK.environment.rotationY;
  scene.background = new Color(LOOK.studio.background);
  const lighting = createStudioLighting(scene);
  const reflections = createReflections(initialReflections);
  const pmrem = new PMREMGenerator(renderer);

  const camera = new PerspectiveCamera(cameraFieldOfView(1), 1, 0.2, 100);
  const inputCamera = camera.clone();
  const controls = new OrbitControls(inputCamera, renderer.domElement);
  const cameraMotion = new CameraMotion(camera, inputCamera, controls.target);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.55;
  controls.minDistance = MIN_DISTANCE;
  controls.maxDistance = MAX_DISTANCE;
  controls.maxPolarAngle = MAX_POLAR_ANGLE;
  controls.autoRotateSpeed = 0.5;

  let frame = 0;
  let lastFrame = 0;
  let presenting = false;
  let driverView = false;
  let activeView: ViewId | null = null;
  const setPresenting = (enabled: boolean) => {
    if (enabled && driverView) resetView();
    presenting = enabled;
    controls.autoRotate = enabled && !reducedMotion() && !cameraMotion.isResetting;
    onPresentingChange?.(enabled);
    requestRender();
  };
  let updateMotion = (_now: number): boolean => false;
  const requestRender = () => {
    if (frame) return;
    frame = requestAnimationFrame((now) => {
      frame = 0;
      const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 1 / 60;
      lastFrame = now;
      controls.enableDamping = !reducedMotion();
      controls.autoRotate = presenting && !reducedMotion() && !cameraMotion.isResetting;
      const orbitActive = cameraMotion.isResetting ? false : controls.update(delta);
      const cameraActive = cameraMotion.update(now, reducedMotion());
      studio?.updateCamera(camera.position.y);
      const objectActive = updateMotion(now);
      const active = objectActive || orbitActive || cameraActive || controls.autoRotate;
      renderer.render(scene, camera);
      if (active) requestRender();
    });
  };
  controls.addEventListener("change", requestRender);
  controls.addEventListener("start", () => {
    setPresenting(false);
    if (cameraMotion.isResetting) {
      // Flush residual orbit inertia before handing control back to the user.
      controls.enableDamping = false;
      controls.update();
      cameraMotion.cancel();
      controls.update();
      controls.enableDamping = !reducedMotion();
    }
    activeView = null;
    userMoved = true;
    requestRender();
  });

  const canvas = renderer.domElement;
  const handleContextLost = (event: Event) => {
    // keep the context restorable and stop drawing until it returns
    event.preventDefault();
    presenting = false;
    onPresentingChange?.(false);
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

  const corners: Vector3[] = [];
  let userMoved = false;

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.fov = driverView ? 70 : cameraFieldOfView(camera.aspect);
    camera.updateProjectionMatrix();
    inputCamera.aspect = camera.aspect;
    inputCamera.fov = camera.fov;
    inputCamera.updateProjectionMatrix();
    if (corners.length && activeView) setView(activeView, true);
    else if (corners.length && !userMoved) resetView(true);
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  let disposed = false;
  let model: Object3D | null = null;
  let pending = 3;
  const assetLoaded = () => {
    pending -= 1;
    if (pending === 0 && !disposed) onLoaded?.();
  };
  let environment: Texture | null = null;
  const disposables: { dispose: () => void }[] = [];
  const startTarget = new Vector3();
  let vehicleMaterials: VehicleMaterials | null = null;
  let animatedDoors: ReturnType<typeof createDoors> | null = null;
  let animatedAccessories: ReturnType<typeof createAccessoryMotion> | null = null;
  let studio: ReturnType<typeof createStudio> | null = null;
  let doorState = initialDoors;
  let bedLiner = initialBedLiner;
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let paintColour = initialPaintColour;
  let hiddenNodes = initialHiddenNodes;

  updateMotion = (now) => {
    let active = vehicleMaterials?.update(now) ?? false;
    active = reflections.update(now) || active;
    const doorsActive = animatedDoors?.update(now) ?? false;
    const accessoriesActive = animatedAccessories?.update(now) ?? false;
    if (doorsActive || accessoriesActive) renderer.shadowMap.needsUpdate = true;
    return active || doorsActive || accessoriesActive;
  };

  // Distance from the target, along the start direction, at which all eight corners of the
  // vehicle bounds fit inside both fields of view.
  const fitDistance = (direction: Vector3, fov = camera.fov) => {
    const right = new Vector3(0, 1, 0).cross(direction).normalize();
    const up = new Vector3().crossVectors(direction, right);
    const tanV = Math.tan(MathUtils.degToRad(fov) / 2) * FRAMING_FILL;
    const tanH = tanV * camera.aspect;
    let distance = 0;
    for (const corner of corners) {
      const offset = corner.clone().sub(startTarget);
      const depth = offset.dot(direction);
      distance = Math.max(distance, depth + Math.abs(offset.dot(right)) / tanH, depth + Math.abs(offset.dot(up)) / tanV);
    }
    return Math.max(distance, MIN_DISTANCE);
  };

  const flushOrbit = () => {
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = !reducedMotion();
  };

  const configureCamera = (driver: boolean) => {
    driverView = driver;
    controls.minDistance = driver ? 0.001 : MIN_DISTANCE;
    controls.maxDistance = driver ? 0.001 : MAX_DISTANCE;
    controls.minPolarAngle = driver ? 0.05 : 0;
    controls.maxPolarAngle = driver ? Math.PI - 0.05 : MAX_POLAR_ANGLE;
    controls.enableZoom = !driver;
    controls.rotateSpeed = driver ? -0.35 : 0.55;
    camera.near = driver ? 0.025 : 0.2;
    camera.updateProjectionMatrix();
    inputCamera.near = camera.near;
    inputCamera.fov = driver ? 70 : cameraFieldOfView(camera.aspect);
    inputCamera.updateProjectionMatrix();
  };

  const moveCamera = (position: Vector3, target: Vector3, immediate: boolean) => {
    cameraMotion.moveTo(position, target, performance.now(), immediate || reducedMotion(), inputCamera.fov);
    requestRender();
  };

  const setView = (id: ViewId, immediate = false) => {
    setPresenting(false);
    flushOrbit();
    configureCamera(id === "driver");
    activeView = id;
    userMoved = true;
    if (id === "driver") {
      // Calibrated right-hand-drive eye position. A millimetre orbit radius
      // allows looking around without moving away from the driver's seat.
      const eye = new Vector3(-0.4, 1.43, 0.25);
      moveCamera(eye.clone().add(new Vector3(0, 0, -0.001)), eye, immediate);
    } else {
      const view = VIEWS.find(view => view.id === id)!;
      if (!("azimuth" in view)) return;
      const azimuth = MathUtils.degToRad(view.azimuth), elevation = MathUtils.degToRad(view.elevation);
      const direction = new Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
      const distance = fitDistance(direction, inputCamera.fov) * (id === "top" ? 1.15 : 1);
      controls.maxDistance = Math.max(MAX_DISTANCE, distance);
      moveCamera(startTarget.clone().addScaledVector(direction, distance), startTarget, immediate);
    }
  };

  const resetView = (immediate = false) => {
    flushOrbit();
    configureCamera(false);
    activeView = null;
    const horizontal = Math.cos(START_ELEVATION);
    const direction = new Vector3(
      Math.sin(START_AZIMUTH) * horizontal,
      Math.sin(START_ELEVATION),
      Math.cos(START_AZIMUTH) * horizontal,
    );
    const distance = fitDistance(direction, inputCamera.fov);
    controls.maxDistance = Math.max(MAX_DISTANCE, distance);
    const position = startTarget.clone().addScaledVector(direction, distance);
    moveCamera(position, startTarget, immediate);
    userMoved = false;
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
      studio?.setEnvironment(environment);
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
      vehicleMaterials = applyVehicleMaterials(gltf.scene, paintColour, bedLiner);
      scene.add(gltf.scene);

      const box = new Box3().setFromObject(gltf.scene);
      const centre = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      animatedAccessories = createAccessoryMotion(gltf.scene);
      scene.add(animatedAccessories.root);
      animatedAccessories.setHidden(hiddenNodes, performance.now(), true);
      animatedDoors = createDoors(gltf.scene);
      scene.add(animatedDoors.root);
      animatedDoors.set(doorState, performance.now(), true);
      for (const root of [model, animatedDoors.root, animatedAccessories.root]) root.traverse(object => {
        const mesh = object as Mesh;
        if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
      });
      studio = createStudio(scene, box.min.y);
      if (environment) studio.setEnvironment(environment);
      reflections.attach(scene);
      disposables.push(studio);
      void loadStudioTextures(import.meta.env.BASE_URL, Math.min(8, renderer.capabilities.getMaxAnisotropy())).then(textures => {
        if (disposed) { textures.dispose(); return; }
        studio?.setTextures(textures);
        requestRender();
        assetLoaded();
      });
      renderer.shadowMap.needsUpdate = true;

      startTarget.set(centre.x, box.min.y + size.y * 0.42 - FRAMING_LIFT, centre.z);
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x, y, z));
        }
      }
      resetView(true);

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
    resetView: () => { setPresenting(false); resetView(); },
    setPresenting,
    async savePhoto() {
      renderer.render(scene, camera);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Photo unavailable");
      saveCapture(blob, "png");
    },
    setView,
    setReflections(enabled) {
      reflections.set(enabled, performance.now(), reducedMotion());
      requestRender();
    },
    setBedLiner(enabled) {
      bedLiner = enabled;
      vehicleMaterials?.setBedLiner(enabled, reducedMotion());
      requestRender();
    },
    setDoors(state) {
      doorState = state;
      animatedDoors?.set(state, performance.now(), reducedMotion());
      renderer.shadowMap.needsUpdate = true;
      requestRender();
    },
    setHiddenNodes(names) {
      if (names.length === hiddenNodes.length && names.every((name, i) => name === hiddenNodes[i])) return;
      hiddenNodes = names;
      animatedAccessories?.setHidden(names, performance.now(), reducedMotion());
      renderer.shadowMap.needsUpdate = true;
      requestRender();
    },
    setPaintColour(colour) {
      if (colour === paintColour) return;
      paintColour = colour;
      vehicleMaterials?.setPaintColour(colour, reducedMotion());
      requestRender();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      if (model) disposeObject(model);
      animatedDoors?.dispose();
      animatedAccessories?.dispose();
      controls.dispose();
      lighting.dispose();
      for (const item of disposables) item.dispose();
      vehicleMaterials?.dispose();
      environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
