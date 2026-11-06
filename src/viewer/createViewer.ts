import {
  ACESFilmicToneMapping,
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
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
import { GroundedSkybox } from "three/addons/objects/GroundedSkybox.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { LOOK, RENDER_ORDER } from "./look";
import { applyVehicleMaterials, type VehicleMaterials } from "./materials";

const MODEL_URL = `${import.meta.env.BASE_URL}models/dmax.glb`;
const HDRI_URL = `${import.meta.env.BASE_URL}hdri/${LOOK.environment.file}`;
const withBust = (url: string, bust?: string) => (bust ? `${url}?r=${encodeURIComponent(bust)}` : url);
const MAX_PIXEL_RATIO = 2;

const FOV = 30;
const START_AZIMUTH = MathUtils.degToRad(38);
const START_ELEVATION = MathUtils.degToRad(11);
const MIN_DISTANCE = 4.5;
const MAX_DISTANCE = 14;
const MAX_POLAR_ANGLE = MathUtils.degToRad(87);
/** Share of the window the vehicle may fill along its limiting axis. */
const FRAMING_FILL = 1.1;
/** Metres the orbit target sits below the usual centre, so the vehicle clears the panel at the bottom. */
const FRAMING_LIFT = 0.2;

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

function radialTexture(stops: readonly (readonly [number, string])[]): CanvasTexture {
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

function groundPlane(texture: CanvasTexture, width: number, depth: number, y: number, renderOrder: number) {
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
  mesh.renderOrder = renderOrder;
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
  renderer.toneMappingExposure = LOOK.exposure;
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.environmentIntensity = LOOK.environment.intensity;
  scene.environmentRotation.y = LOOK.environment.rotationY;
  for (const { colour, intensity, position } of Object.values(LOOK.lights)) {
    const light = new DirectionalLight(new Color(colour), intensity);
    light.position.fromArray(position);
    scene.add(light);
  }
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
  controls.addEventListener("start", () => {
    userMoved = true;
  });

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

  const corners: Vector3[] = [];
  let userMoved = false;

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (corners.length && !userMoved) resetView();
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
  let backgroundImage: Texture | null = null;
  const disposables: { dispose: () => void }[] = [];
  const startTarget = new Vector3();
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

  // Distance from the target, along the start direction, at which all eight corners of the
  // vehicle bounds fit inside both fields of view.
  const fitDistance = (direction: Vector3) => {
    const right = new Vector3(0, 1, 0).cross(direction).normalize();
    const up = new Vector3().crossVectors(direction, right);
    const tanV = Math.tan(MathUtils.degToRad(FOV) / 2) * FRAMING_FILL;
    const tanH = tanV * camera.aspect;
    let distance = 0;
    for (const corner of corners) {
      const offset = corner.clone().sub(startTarget);
      const depth = offset.dot(direction);
      distance = Math.max(distance, depth + Math.abs(offset.dot(right)) / tanH, depth + Math.abs(offset.dot(up)) / tanV);
    }
    return MathUtils.clamp(distance, MIN_DISTANCE, MAX_DISTANCE * 0.8);
  };

  const resetView = () => {
    const horizontal = Math.cos(START_ELEVATION);
    const direction = new Vector3(
      Math.sin(START_AZIMUTH) * horizontal,
      Math.sin(START_ELEVATION),
      Math.cos(START_AZIMUTH) * horizontal,
    );
    camera.position.copy(startTarget).addScaledVector(direction, fitDistance(direction));
    controls.target.copy(startTarget);
    controls.update();
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
      // the full image stays alive on the dome, the filtered copy lights the vehicle
      backgroundImage = texture;
      const dome = new GroundedSkybox(texture, LOOK.environment.height, LOOK.environment.radius);
      dome.position.y = LOOK.environment.height;
      dome.rotation.y = LOOK.environment.rotationY;
      scene.add(dome);
      disposables.push(dome.geometry, dome.material);
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

      // the two shadows are transparent planes at almost the same height, so draw order is explicit
      const softTexture = radialTexture(LOOK.shadows.soft.stops);
      const contactTexture = radialTexture(LOOK.shadows.contact.stops);
      disposables.push(softTexture, contactTexture);
      const soft = groundPlane(
        softTexture,
        size.x * LOOK.shadows.soft.widthScale,
        size.z * LOOK.shadows.soft.depthScale,
        0.004,
        RENDER_ORDER.softShadow,
      );
      const contact = groundPlane(
        contactTexture,
        size.x * LOOK.shadows.contact.widthScale,
        size.z * LOOK.shadows.contact.depthScale,
        0.006,
        RENDER_ORDER.contactShadow,
      );
      for (const shadow of [soft, contact]) {
        shadow.position.x = centre.x;
        shadow.position.z = centre.z;
      }
      scene.add(soft, contact);
      for (const plane of [soft, contact]) disposables.push(plane.geometry, plane.material);

      startTarget.set(centre.x, box.min.y + size.y * 0.42 - FRAMING_LIFT, centre.z);
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x, y, z));
        }
      }
      camera.near = 0.2;
      camera.far = LOOK.environment.radius * 3;
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
      backgroundImage?.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
