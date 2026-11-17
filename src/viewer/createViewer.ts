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
import type { VehicleModel } from "../config/models";
import { disposeObject } from "./dispose";

const modelUrl = (model: VehicleModel) => `${import.meta.env.BASE_URL}${model.file}`;
const HDRI_URL = `${import.meta.env.BASE_URL}hdri/${LOOK.environment.file}`;
const withBust = (url: string, bust?: string) => (bust ? `${url}?r=${encodeURIComponent(bust)}` : url);
const MAX_PIXEL_RATIO = 2;

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
  /**
   * Shows another vehicle in the same scene. The current vehicle stays until the new one has
   * loaded, then is released, and a request superseded by a later one is discarded. Progress and
   * completion arrive through `onProgress` and `onLoaded`.
   */
  setModel: (model: VehicleModel) => void;
  setReflections: (enabled: boolean) => void;
  setPaintColour: (colour: string) => void;
  setBedLiner: (enabled: boolean) => void;
  setDoors: (state: DoorState) => void;
  /** Hides exactly these named nodes and shows every other node that was hidden before. */
  setHiddenNodes: (names: readonly string[]) => void;
  dispose: () => void;
}

export interface ViewerOptions {
  /** Vehicle shown first. */
  model: VehicleModel;
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

/** Everything that belongs to the vehicle on show, released together when it is swapped out. */
interface Vehicle {
  spec: VehicleModel;
  model: Object3D;
  materials: VehicleMaterials;
  doors: ReturnType<typeof createDoors> | null;
  accessories: ReturnType<typeof createAccessoryMotion>;
  studio: ReturnType<typeof createStudio>;
  /** Set once the garage textures have been applied, the vehicle counts as loaded after that. */
  texturesReady: boolean;
}

export function createViewer(
  container: HTMLElement,
  {
    model: initialModel,
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
  controls.minDistance = initialModel.camera.minDistance;
  controls.maxDistance = initialModel.camera.maxDistance;
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
      vehicle?.studio.updateCamera(camera.position.y);
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
  // loaded means the environment map, the requested vehicle and its garage textures are all in
  // place, announced once per request
  let announced = 0;
  const checkLoaded = () => {
    if (disposed || announced === loadToken) return;
    if (!environment || !vehicle || vehicle.spec !== spec || !vehicle.texturesReady) return;
    announced = loadToken;
    onLoaded?.();
  };
  let environment: Texture | null = null;
  const disposables: { dispose: () => void }[] = [];
  const startTarget = new Vector3();
  /** The vehicle on show, and the model the viewer is showing or about to show. */
  let vehicle: Vehicle | null = null;
  let spec = initialModel;
  let loadToken = 0;
  const cameraLimits = () => (vehicle?.spec ?? spec).camera;
  let doorState = initialDoors;
  let bedLiner = initialBedLiner;
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let paintColour = initialPaintColour;
  let hiddenNodes = initialHiddenNodes;

  updateMotion = (now) => {
    let active = vehicle?.materials.update(now) ?? false;
    active = reflections.update(now) || active;
    const doorsActive = vehicle?.doors?.update(now) ?? false;
    const accessoriesActive = vehicle?.accessories.update(now) ?? false;
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
    return Math.max(distance, cameraLimits().minDistance);
  };

  const flushOrbit = () => {
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = !reducedMotion();
  };

  const configureCamera = (driver: boolean) => {
    driverView = driver;
    controls.minDistance = driver ? 0.001 : cameraLimits().minDistance;
    controls.maxDistance = driver ? 0.001 : cameraLimits().maxDistance;
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
    // a model without a driver view ignores that request
    if (id === "driver" && !cameraLimits().driverEye) return;
    setPresenting(false);
    flushOrbit();
    configureCamera(id === "driver");
    activeView = id;
    userMoved = true;
    if (id === "driver") {
      // Calibrated eye position per model. A millimetre orbit radius
      // allows looking around without moving away from the driver's seat.
      const eye = new Vector3(...cameraLimits().driverEye!);
      moveCamera(eye.clone().add(new Vector3(0, 0, -0.001)), eye, immediate);
    } else {
      const view = VIEWS.find(view => view.id === id)!;
      if (!("azimuth" in view)) return;
      const azimuth = MathUtils.degToRad(view.azimuth), elevation = MathUtils.degToRad(view.elevation);
      const direction = new Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
      const distance = fitDistance(direction, inputCamera.fov) * (id === "top" ? 1.15 : 1);
      controls.maxDistance = Math.max(cameraLimits().maxDistance, distance);
      moveCamera(startTarget.clone().addScaledVector(direction, distance), startTarget, immediate);
    }
  };

  const resetView = (immediate = false) => {
    flushOrbit();
    configureCamera(false);
    activeView = null;
    const startAzimuth = MathUtils.degToRad(cameraLimits().startAzimuth);
    const startElevation = MathUtils.degToRad(cameraLimits().startElevation);
    const horizontal = Math.cos(startElevation);
    const direction = new Vector3(
      Math.sin(startAzimuth) * horizontal,
      Math.sin(startElevation),
      Math.cos(startAzimuth) * horizontal,
    );
    const distance = fitDistance(direction, inputCamera.fov);
    controls.maxDistance = Math.max(cameraLimits().maxDistance, distance);
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
      vehicle?.studio.setEnvironment(environment);
      disposables.push(target);
      requestRender();
      checkLoaded();
    },
    undefined,
    (error) => {
      if (!disposed) onError?.(error);
    },
  );

  /** Releases the vehicle on show and everything built for it. */
  const unloadVehicle = () => {
    if (!vehicle) return;
    const { model, materials, doors, accessories, studio } = vehicle;
    vehicle = null;
    doors?.dispose();
    accessories.dispose();
    materials.dispose();
    studio.dispose();
    model.removeFromParent();
    disposeObject(model);
    corners.length = 0;
  };

  const buildVehicle = (target: VehicleModel, model: Object3D) => {
    const materials = applyVehicleMaterials(model, paintColour, bedLiner, {
      paint: target.materials.paint,
      accent: target.materials.accent,
      linerNodes: target.accessories["bed-liner"] ?? [],
    });
    scene.add(model);

    const box = new Box3().setFromObject(model);
    const centre = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const accessories = createAccessoryMotion(model, target.accessories);
    scene.add(accessories.root);
    accessories.setHidden(hiddenNodes, performance.now(), true);
    const doors = target.doors ? createDoors(model) : null;
    if (doors) {
      scene.add(doors.root);
      doors.set(doorState, performance.now(), true);
    }
    for (const root of [model, accessories.root, ...(doors ? [doors.root] : [])]) root.traverse(object => {
      const mesh = object as Mesh;
      if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
    });
    const studio = createStudio(scene, box.min.y);
    if (environment) studio.setEnvironment(environment);
    reflections.attach(scene);
    const built: Vehicle = { spec: target, model, materials, doors, accessories, studio, texturesReady: false };
    vehicle = built;
    void loadStudioTextures(import.meta.env.BASE_URL, Math.min(8, renderer.capabilities.getMaxAnisotropy())).then(textures => {
      // the vehicle was swapped out or the viewer closed while the textures were loading
      if (disposed || vehicle !== built) { textures.dispose(); return; }
      studio.setTextures(textures);
      built.texturesReady = true;
      requestRender();
      checkLoaded();
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
  };

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  /**
   * Loads a vehicle and swaps it in. The vehicle on show stays until the new one has loaded. A
   * result that arrives after a later request, or after the viewer closed, is released unused.
   */
  const loadVehicle = (target: VehicleModel) => {
    const token = ++loadToken;
    loader.load(
      withBust(modelUrl(target), cacheBust),
      (gltf) => {
        if (disposed || token !== loadToken) {
          disposeObject(gltf.scene);
          return;
        }
        unloadVehicle();
        buildVehicle(target, gltf.scene);
      },
      (event) => {
        if (token === loadToken && event.lengthComputable) onProgress?.(event.loaded / event.total);
      },
      (error) => {
        if (!disposed && token === loadToken) onError?.(error);
      },
    );
  };
  loadVehicle(initialModel);

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
    setModel(next) {
      if (disposed || next === spec) return;
      spec = next;
      if (vehicle?.spec === next) {
        // switching back to the vehicle on show while another one was loading, drop that load
        loadToken += 1;
        checkLoaded();
        return;
      }
      loadVehicle(next);
    },
    setBedLiner(enabled) {
      bedLiner = enabled;
      vehicle?.materials.setBedLiner(enabled, reducedMotion());
      requestRender();
    },
    // Door and accessory names belong to one model, so while another model is loading they are
    // only remembered and applied when it is built.
    setDoors(state) {
      doorState = state;
      if (vehicle?.spec === spec) vehicle.doors?.set(state, performance.now(), reducedMotion());
      renderer.shadowMap.needsUpdate = true;
      requestRender();
    },
    setHiddenNodes(names) {
      if (names.length === hiddenNodes.length && names.every((name, i) => name === hiddenNodes[i])) return;
      hiddenNodes = names;
      if (vehicle?.spec === spec) vehicle.accessories.setHidden(names, performance.now(), reducedMotion());
      renderer.shadowMap.needsUpdate = true;
      requestRender();
    },
    setPaintColour(colour) {
      if (colour === paintColour) return;
      paintColour = colour;
      vehicle?.materials.setPaintColour(colour, reducedMotion());
      requestRender();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      unloadVehicle();
      controls.dispose();
      lighting.dispose();
      for (const item of disposables) item.dispose();
      environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
