export interface Accessory {
  id: string;
  label: string;
  /**
   * Names of the model nodes that make up the accessory. All of them are shown or
   * hidden together. Lookup is by name and may return a group, not only a mesh.
   */
  nodes: readonly string[];
  /** Whether the accessory is visible when the page first loads. */
  defaultVisible: boolean;
}

/**
 * Accessories that exist as separable parts of the supplied model. Each entry
 * must resolve to node names in the shipped model, which the config test checks.
 * Defaults keep the vehicle as supplied until a default is agreed.
 */
export const ACCESSORIES: readonly Accessory[] = [
  { id: "roof-rails", label: "Roof rails", nodes: ["rail_01"], defaultVisible: true },
  { id: "side-steps", label: "Side steps", nodes: ["rubber_02"], defaultVisible: true },
  { id: "mud-flaps", label: "Mud flaps", nodes: ["rubber_01"], defaultVisible: true },
  { id: "bed-liner", label: "Bed liner", nodes: ["trunk"], defaultVisible: true },
];
