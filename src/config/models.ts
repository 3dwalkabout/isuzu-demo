export interface VehicleModel {
  id: string;
  label: string;
  /** Path under `public/` to the optimised glTF binary. */
  file: string;
}

/**
 * Vehicles the viewer can show. Each file must be a binary glTF under `public/`, which the
 * config test checks. The first entry is shown when the page loads.
 */
export const VEHICLE_MODELS: readonly [VehicleModel, ...VehicleModel[]] = [
  { id: "dmax", label: "Isuzu D-Max", file: "models/dmax.glb" },
];

export const DEFAULT_MODEL: VehicleModel = VEHICLE_MODELS[0];
