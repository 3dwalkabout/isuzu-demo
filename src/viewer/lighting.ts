import { Color, DirectionalLight, SpotLight, type Scene } from "three";
import { LOOK } from "./look.ts";

/** The daylight shadow camera must contain the whole enclosure, not just the car. */
export function createStudioLighting(scene: Scene) {
  const lights = Object.entries(LOOK.lights).map(([name, { type, colour, intensity, position }]) => {
    const light = type === "daylight"
      ? new DirectionalLight(new Color(colour), intensity)
      : new SpotLight(new Color(colour), intensity, 40, Math.PI / 3, 0.9, 2);
    light.name = "studio-" + name;
    light.position.fromArray(position);
    light.castShadow = true;
    light.shadow.normalBias = 0.02;
    if (light instanceof DirectionalLight) {
      light.shadow.mapSize.set(2048, 2048);
      Object.assign(light.shadow.camera, LOOK.keyShadow.camera);
      light.shadow.camera.updateProjectionMatrix();
      light.shadow.bias = -0.0001;
    } else {
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.camera.near = 0.2;
      light.shadow.bias = -0.0001;
      light.shadow.radius = 2;
    }
    scene.add(light, light.target);
    return light;
  });
  return {
    lights,
    dispose() {
      lights.forEach(light => {
        if (light.castShadow) light.shadow.dispose();
        light.removeFromParent();
        light.target.removeFromParent();
      });
    },
  };
}
