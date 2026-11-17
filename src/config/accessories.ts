export interface Accessory {
  id: string;
  label: string;
  behaviour?: "material";
  /** Whether the accessory is visible when the page first loads. */
  defaultVisible: boolean;
}

/**
 * Accessories a vehicle can offer. The model nodes that make up each accessory are listed per
 * model in `models.ts`, and a model offers only the accessories it lists. Defaults keep the
 * vehicle as supplied until a default is agreed.
 */
export const ACCESSORIES: readonly Accessory[] = [
  { id: "roof-rails", label: "Roof rails", defaultVisible: true },
  { id: "side-steps", label: "Side steps", defaultVisible: true },
  { id: "mud-flaps", label: "Mud flaps", defaultVisible: true },
  { id: "bed-liner", label: "Bed liner", behaviour: "material", defaultVisible: true },
];
