import { MathUtils } from "three";

/**
 * Every value that sets the look of the scene lives here, so lighting, backdrop and
 * grounding can be tuned without touching viewer logic.
 */
export const LOOK = {
  exposure: 1,
  /**
   * Image based lighting, also projected onto a dome with a real floor so the room has
   * depth and the vehicle stands on it. Height is the eye height the image was shot at and
   * sets how large the room looks, radius is how far the floor reaches before the walls.
   */
  environment: {
    file: "autoshop_01_1k.hdr",
    intensity: 1,
    rotationY: MathUtils.degToRad(0),
    height: 6,
    radius: 40,
  },
  /** Directional lights that add crisp highlights on top of the environment. */
  lights: {
    key: { colour: "#ffffff", intensity: 1, position: [4, 6, 5] },
    rim: { colour: "#cfe3ff", intensity: 1.6, position: [-5, 3, -6] },
    fill: { colour: "#ffffff", intensity: 0.4, position: [-6, 2, 4] },
  },
  /** Wide soft shadow and a tighter, darker one right under the body. */
  shadows: {
    soft: {
      widthScale: 1.9,
      depthScale: 1.25,
      stops: [
        [0, "rgba(0,0,0,0.85)"],
        [0.45, "rgba(0,0,0,0.5)"],
        [1, "rgba(0,0,0,0)"],
      ] as [number, string][],
    },
    contact: {
      widthScale: 1.12,
      depthScale: 0.82,
      stops: [
        [0, "rgba(0,0,0,1)"],
        [0.6, "rgba(0,0,0,0.75)"],
        [1, "rgba(0,0,0,0)"],
      ] as [number, string][],
    },
  },
} as const;

/** Draw order for the transparent ground planes, both sit at almost the same height. */
export const RENDER_ORDER = { softShadow: 1, contactShadow: 2 } as const;
