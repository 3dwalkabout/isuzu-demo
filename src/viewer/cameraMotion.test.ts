import assert from "node:assert/strict";
import { test } from "node:test";
import { PerspectiveCamera, Spherical, Vector3 } from "three";
import { CameraMotion, cameraFieldOfView } from "./cameraMotion.ts";

test("portrait framing preserves horizontal field instead of pulling far away", () => {
  assert.ok(Math.abs(cameraFieldOfView(1.5) - 30) < 0.00001);
  const aspect = 390 / 844;
  const vertical = cameraFieldOfView(aspect) * Math.PI / 180;
  assert.ok(Math.abs(Math.tan(vertical / 2) * aspect - Math.tan(Math.PI / 12)) < 0.00001);
  assert.ok(cameraFieldOfView(0.1) <= 75);
});

test("reset follows the shortest orbit without cutting through the vehicle", () => {
  const camera = new PerspectiveCamera();
  camera.position.setFromSpherical(new Spherical(8,1.2,179 * Math.PI / 180));
  const input = camera.clone();
  const target = new Vector3();
  const motion = new CameraMotion(camera,input,target);
  const destination = new Vector3().setFromSpherical(new Spherical(10,1.3,-179 * Math.PI / 180));
  const start = camera.position.clone();
  // Pending input must not change the visible start of reset.
  input.position.set(20,10,0);
  motion.moveTo(destination,target,0);
  assert.ok(camera.position.distanceTo(start) < 0.00001);
  motion.update(400);
  assert.ok(camera.position.z < -8, "reset took the long arc");
  assert.ok(Math.abs(camera.position.length() - 9) < 0.00001);
  assert.equal(motion.update(800), false);
  assert.ok(camera.position.distanceTo(destination) < 0.00001);
});

test("a gesture can interrupt reset from the exact visible pose", () => {
  const camera = new PerspectiveCamera(); camera.position.set(0,2,8);
  const input = camera.clone();
  const target = new Vector3();
  const motion = new CameraMotion(camera,input,target);
  motion.moveTo(new Vector3(8,3,0),new Vector3(0,1,0),0);
  motion.update(300);
  const visible = camera.position.clone();
  motion.cancel();
  assert.equal(motion.isResetting,false);
  assert.ok(input.position.distanceTo(visible) < 0.00001);
  motion.update(316);
  assert.ok(camera.position.distanceTo(visible) < 0.00001);
});

test("zoom eases to the input distance and reduced motion applies it immediately", () => {
  const camera = new PerspectiveCamera(); camera.position.set(0,0,10);
  const input = camera.clone();
  const target = new Vector3();
  const motion = new CameraMotion(camera,input,target);
  motion.update(0);
  input.position.set(0,0,5);
  assert.equal(motion.update(16),true);
  assert.ok(camera.position.z > 5 && camera.position.z < 10);
  for (let now=32; now<=1200; now+=16) motion.update(now);
  assert.ok(Math.abs(camera.position.z-5) < 0.0001);
  input.position.set(0,0,9);
  assert.equal(motion.update(1216,true),false);
  assert.equal(camera.position.z,9);
  motion.moveTo(new Vector3(7,3,2),new Vector3(),1300,true);
  assert.equal(motion.isResetting,false);
  assert.ok(camera.position.distanceTo(new Vector3(7,3,2)) < 0.00001);
});

test("driver view eases its lens and seated pose, then restores an exterior view", () => {
  const camera = new PerspectiveCamera(30); camera.position.set(5, 2, 8);
  const input = camera.clone();
  const target = new Vector3();
  const motion = new CameraMotion(camera, input, target);
  const eye = new Vector3(-0.4, 1.43, 0.25);
  const position = eye.clone().add(new Vector3(0, 0, -0.001));
  motion.moveTo(position, eye, 0, false, 70);
  assert.equal(camera.fov, 30);
  motion.update(400);
  assert.ok(Math.abs(camera.fov - 50) < 0.00001);
  motion.update(800);
  assert.ok(camera.position.distanceTo(position) < 0.00001);
  assert.equal(camera.fov, 70);
  assert.ok(camera.getWorldDirection(new Vector3()).z > 0.99);
  motion.moveTo(new Vector3(5, 2, 8), new Vector3(), 900, true, 30);
  assert.equal(camera.fov, 30);
  assert.ok(camera.position.distanceTo(new Vector3(5, 2, 8)) < 0.00001);
});
