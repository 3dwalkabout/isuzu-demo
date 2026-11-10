import { ACCESSORIES } from "../config/accessories.ts";
import { DEFAULT_COLOUR_ID, PAINT_COLOURS } from "../config/colours.ts";

export interface Configuration {
  colourId: string;
  /** Visibility of each accessory by id. */
  accessories: Record<string, boolean>;
}

export type ConfigurationAction =
  | { type: "selectColour"; colourId: string }
  | { type: "setAccessory"; accessoryId: string; visible: boolean };

export function initialConfiguration(): Configuration {
  return {
    colourId: DEFAULT_COLOUR_ID,
    accessories: Object.fromEntries(ACCESSORIES.map((a) => [a.id, a.defaultVisible])),
  };
}

/** Unknown ids are ignored so the state only ever holds configured options. */
export function configurationReducer(state: Configuration, action: ConfigurationAction): Configuration {
  switch (action.type) {
    case "selectColour":
      if (action.colourId === state.colourId || !PAINT_COLOURS.some((c) => c.id === action.colourId)) return state;
      return { ...state, colourId: action.colourId };
    case "setAccessory":
      if (!(action.accessoryId in state.accessories) || state.accessories[action.accessoryId] === action.visible) {
        return state;
      }
      return { ...state, accessories: { ...state.accessories, [action.accessoryId]: action.visible } };
  }
}

/** Names of every model node that must be hidden for this configuration. */
export function hiddenNodes(configuration: Configuration): string[] {
  return ACCESSORIES.filter((a) => a.behaviour !== "material" && !configuration.accessories[a.id]).flatMap((a) => a.nodes);
}
