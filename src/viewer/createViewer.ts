import {
  Box3,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const MODEL_URL = `${import.meta.env.BASE_URL}models/dmax.glb`;
const MAX_PIXEL_RATIO = 2;

export interface Viewer {
  dispose: () => void;
}

export interface ViewerOptions {
  onProgress?: (fraction: number) => void;
  onLoaded?: () => void;
  onError?: (error: unknown) => void;
}

export function createViewer(
  container: HTMLElement,
  { onProgress, onLoaded, onError }: ViewerOptions = {},
): Viewer {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;

  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;

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
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    MODEL_URL,
    (gltf) => {
      if (disposed) return;
      scene.add(gltf.scene);

      const box = new Box3().setFromObject(gltf.scene);
      const centre = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      const distance = Math.max(size.x, size.y, size.z) * 1.6;
      controls.target.copy(centre);
      camera.position.set(
        centre.x + distance * 0.75,
        centre.y + size.y * 0.35,
        centre.z + distance * 0.7,
      );
      camera.near = distance / 100;
      camera.far = distance * 10;
      camera.updateProjectionMatrix();
      controls.update();

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
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
