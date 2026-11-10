import { MathUtils } from "three";

/**
 * Every value that sets the look of the scene lives here, so lighting, backdrop and
 * grounding can be tuned without touching viewer logic.
 */
export const LOOK = {
  exposure: 1,
  /**
   * The HDR panorama supplies reflections, while the visible studio is real geometry.
   */
  environment: {
    file: "autoshop_01_1k.hdr",
    intensity: 1,
    rotationY: MathUtils.degToRad(0),
  },
  studio: {
    background: "#20242a",
    floor: "#f4f3f0",
    height: 7,
    ambient: { floor: 0.42, wall: 0.7, concrete: 0.7, roof: 0.35 },
  },
  /** Daylight through the skylight, plus two shadowed interior fixtures. */
  lights: {
    // Same daylight direction, with its origin beyond the complete enclosure.
    key: { type: "daylight", colour: "#fff7ec", intensity: 2.4, position: [-20, 50, 30] },
    rim: { type: "interior", colour: "#cfe3ff", intensity: 160, position: [-5, 6.5, -6] },
    fill: { type: "interior", colour: "#ffffff", intensity: 160, position: [6, 6.5, 4] },
  },
  keyShadow: {
    camera: { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 110 },
  },
} as const;
