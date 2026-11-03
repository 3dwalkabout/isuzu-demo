import { ACCESSORIES } from "@/config/accessories";
import { DEFAULT_COLOUR_ID } from "@/config/colours";

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

export function configurationReducer(state: Configuration, action: ConfigurationAction): Configuration {
  switch (action.type) {
    case "selectColour":
      return action.colourId === state.colourId ? state : { ...state, colourId: action.colourId };
    case "setAccessory":
      return state.accessories[action.accessoryId] === action.visible
        ? state
        : { ...state, accessories: { ...state.accessories, [action.accessoryId]: action.visible } };
  }
}
