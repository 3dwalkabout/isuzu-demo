export interface PaintColour {
  id: string;
  name: string;
  /** Base colour of the paint. Finish, clearcoat and surface detail come from the paint material. */
  hex: string;
}
/**
 * Names verified against the Australian D-MAX X-TERRAIN customiser, 2026-11-09:
 * https://www.isuzuute.com.au/d-max/customise
 * Hex values are display approximations, not manufacturer paint codes.
 */
export const PAINT_COLOURS: readonly PaintColour[] = [
  { id: "mineral-white", name: "Mineral White", hex: "#fffffe" },
  { id: "moonstone-white-pearl", name: "Moonstone White Pearl", hex: "#dcdbd7" },
  { id: "mercury-silver-metallic", name: "Mercury Silver Metallic", hex: "#9f9f9f" },
  { id: "wolfram-grey-metallic", name: "Wolfram Grey Metallic", hex: "#79787e" },
  { id: "obsidian-grey-mica", name: "Obsidian Grey Mica", hex: "#555d62" },
  { id: "basalt-black-mica", name: "Basalt Black Mica", hex: "#202020" },
  { id: "neptune-blue-mica", name: "Neptune Blue Mica", hex: "#094bac" },
  { id: "magnetic-red-mica", name: "Magnetic Red Mica", hex: "#91111a" },
  { id: "sunstone-orange-mica", name: "Sunstone Orange Mica", hex: "#b72b1e" },
];
export const DEFAULT_COLOUR_ID = "magnetic-red-mica";
/** Looks up a colour by id, an unknown id is a programming error. */
export function getPaintColour(id: string): PaintColour {
  const colour = PAINT_COLOURS.find((c) => c.id === id);
  if (!colour) throw new Error(`unknown paint colour ${id}`);
  return colour;
}
