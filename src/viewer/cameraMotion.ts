import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from "three";
import { Transition } from "./motion.ts";

/** Keep a useful horizontal field in portrait instead of moving the camera
 * across the room to fit the vehicle through a telephoto-sized opening. */
export function cameraFieldOfView(aspect: number) {
  return Math.min(75, MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(30) / 2) / Math.min(1, aspect))));
}

/** OrbitControls drives the input camera. The rendered camera eases zoom and
 * resets around the target, preserving distance instead of cutting through it. */
export class CameraMotion {
  private progress = new Transition(1, 800);
  private from = new Spherical();
  private to = new Spherical();
  private fromTarget = new Vector3();
  private toTarget = new Vector3();
  private renderedTarget = new Vector3();
  private offset = new Vector3();
  private spherical = new Spherical();
  private lastTime: number | null = null;
  private fromFov = 30;
  private toFov = 30;
  isResetting = false;

  private camera: PerspectiveCamera;
  private input: PerspectiveCamera;
  private target: Vector3;

  constructor(camera: PerspectiveCamera, input: PerspectiveCamera, target: Vector3) {
    this.camera = camera;
    this.input = input;
    this.target = target;
    this.renderedTarget.copy(target);
  }

  moveTo(position: Vector3, target: Vector3, now: number, immediate = false, fov = this.camera.fov) {
    if (this.isResetting) this.update(now, immediate);
    this.fromTarget.copy(this.renderedTarget);
    this.fromFov = this.camera.fov;
    this.toFov = fov;
    this.input.fov = fov;
    this.input.updateProjectionMatrix();
    this.toTarget.copy(target);
    this.from.setFromVector3(this.offset.copy(this.camera.position).sub(this.fromTarget));
    this.to.setFromVector3(this.offset.copy(position).sub(target));
    const turn = MathUtils.euclideanModulo(this.to.theta - this.from.theta + Math.PI, Math.PI * 2) - Math.PI;
    this.to.theta = this.from.theta + turn;
    this.input.position.copy(position);
    this.target.copy(target);
    this.input.lookAt(target);
    this.progress.to(0, now, true);
    this.progress.to(1, now, immediate);
    this.isResetting = true;
    this.update(now, immediate);
  }

  /** A gesture takes over from the exact visible camera pose. */
  cancel() {
    if (!this.isResetting) return;
    this.isResetting = false;
    this.input.position.copy(this.camera.position);
    this.input.fov = this.camera.fov;
    this.input.updateProjectionMatrix();
    this.target.copy(this.renderedTarget);
    this.input.lookAt(this.target);
  }

  update(now: number, immediate = false) {
    const delta = this.lastTime === null ? 1 / 60 : Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    let active = false;

    if (this.isResetting) {
      if (immediate) this.progress.to(1, now, true);
      active = this.progress.update(now);
      const t = this.progress.value;
      this.camera.fov = MathUtils.lerp(this.fromFov, this.toFov, t);
      this.camera.updateProjectionMatrix();
      this.spherical.set(
        MathUtils.lerp(this.from.radius, this.to.radius, t),
        MathUtils.lerp(this.from.phi, this.to.phi, t),
        MathUtils.lerp(this.from.theta, this.to.theta, t),
      );
      this.renderedTarget.lerpVectors(this.fromTarget, this.toTarget, t);
      this.isResetting = active;
    } else {
      this.spherical.setFromVector3(this.offset.copy(this.input.position).sub(this.target));
      const desiredRadius = this.spherical.radius;
      const currentRadius = this.camera.position.distanceTo(this.renderedTarget);
      const radius = immediate || currentRadius === 0 ? desiredRadius : MathUtils.damp(currentRadius, desiredRadius, 18, delta);
      active = Math.abs(radius - desiredRadius) > 0.0001;
      this.spherical.radius = active ? radius : desiredRadius;
      this.renderedTarget.copy(this.target);
    }

    this.camera.position.setFromSpherical(this.spherical).add(this.renderedTarget);
    this.camera.lookAt(this.renderedTarget);
    return active;
  }
}
