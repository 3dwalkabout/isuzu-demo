import { ACCESSORIES, type Accessory } from "./accessories.ts";
import { DEFAULT_COLOUR_ID, PAINT_COLOURS, type PaintColour } from "./colours.ts";

export interface VehicleModel {
  id: string;
  label: string;
  /** Path under `public/` to the optimised glTF binary. */
  file: string;
  /** Names of the model materials that carry the body paint and the fixed accent colour. */
  materials: { paint: string; accent: string | null };
  /**
   * Node names that make up each accessory the model offers, by accessory id. All nodes of an
   * accessory are shown or hidden together. A model offers only the accessories listed here.
   */
  accessories: Readonly<Record<string, readonly string[]>>;
  /** Whether the model has the separable door parts the door animation needs. */
  doors: boolean;
  /** Paint colour ids the model offers, or `null` for the whole palette. */
  colours: readonly string[] | null;
  camera: {
    /** Degrees around the vehicle and above the ground for the opening view and reset. */
    startAzimuth: number;
    startElevation: number;
    /** Orbit distance limits in metres. */
    minDistance: number;
    maxDistance: number;
    /** Eye position for the driver view, or `null` when the model has no driver view. */
    driverEye: readonly [number, number, number] | null;
  };
}

/**
 * Vehicles the viewer can show. Each file must be a binary glTF under `public/`, and each entry
 * is checked against its own file by the config test. The first entry is shown when the page loads.
 */
export const VEHICLE_MODELS: readonly [VehicleModel, ...VehicleModel[]] = [
  {
    id: "dmax",
    label: "Isuzu D-Max",
    file: "models/dmax.glb",
    materials: { paint: "carpaint", accent: "carpaint_second" },
    accessories: {
      "roof-rails": ["rail_01"],
      "side-steps": ["rubber_02"],
      "mud-flaps": ["rubber_01"],
      "bed-liner": ["trunk"],
    },
    doors: true,
    colours: null,
    camera: { startAzimuth: 38, startElevation: 11, minDistance: 4.5, maxDistance: 14, driverEye: [-0.4, 1.43, 0.25] },
  },
];

export const DEFAULT_MODEL: VehicleModel = VEHICLE_MODELS[0];

/** Looks up a model by id, an unknown id is a programming error. */
export function getModel(id: string): VehicleModel {
  const model = VEHICLE_MODELS.find(candidate => candidate.id === id);
  if (!model) throw new Error(`unknown vehicle model ${id}`);
  return model;
}

/** The accessories this model offers, in the order of the shared accessory list. */
export function modelAccessories(model: VehicleModel): Accessory[] {
  return ACCESSORIES.filter(accessory => accessory.id in model.accessories);
}

/** The paint colours this model offers. */
export function modelColours(model: VehicleModel): readonly PaintColour[] {
  const allowed = model.colours;
  return allowed ? PAINT_COLOURS.filter(colour => allowed.includes(colour.id)) : PAINT_COLOURS;
}

/** Keeps the selected colour when the model offers it, otherwise the model's default colour. */
export function colourForModel(model: VehicleModel, colourId: string): string {
  const colours = modelColours(model);
  if (colours.some(colour => colour.id === colourId)) return colourId;
  return colours.some(colour => colour.id === DEFAULT_COLOUR_ID) ? DEFAULT_COLOUR_ID : colours[0].id;
}
