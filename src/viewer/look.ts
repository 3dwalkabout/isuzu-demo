import { MathUtils } from "three";

/**
 * Every value that sets the look of the scene lives here, so lighting, backdrop and
 * grounding can be tuned without touching viewer logic.
 */
export const LOOK = {
  exposure: 1,
  /** Image based lighting, rotated about the vertical axis so highlights land on the panels. */
  environment: {
    intensity: 1,
    rotationY: MathUtils.degToRad(90),
  },
  /** Directional lights that add crisp highlights on top of the environment. */
  lights: {
    key: { colour: "#ffffff", intensity: 1, position: [4, 6, 5] },
    rim: { colour: "#cfe3ff", intensity: 1.6, position: [-5, 3, -6] },
    fill: { colour: "#ffffff", intensity: 0.4, position: [-6, 2, 4] },
  },
  /** Screen filling gradient, lighter in the centre. */
  backdrop: {
    stops: [
      [0, "#3a3f46"],
      [0.6, "#1d2025"],
      [1, "#0f1114"],
    ] as [number, string][],
  },
  /** Pool of light on the floor, fades into the backdrop. */
  floor: {
    size: 26,
    stops: [
      [0, "rgba(70,75,82,1)"],
      [0.55, "rgba(36,39,44,0.6)"],
      [1, "rgba(22,24,27,0)"],
    ] as [number, string][],
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

/** Draw order for the transparent ground planes, all sit at almost the same height. */
export const RENDER_ORDER = { floor: 1, softShadow: 2, contactShadow: 3 } as const;
