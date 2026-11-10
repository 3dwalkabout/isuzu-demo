export const VIEWS = [
  { id: "front", label: "Front", azimuth: 0, elevation: 8 },
  { id: "back", label: "Back", azimuth: 180, elevation: 8 },
  { id: "side", label: "Side", azimuth: -90, elevation: 8 },
  { id: "top", label: "Top", azimuth: 0, elevation: 90 },
  { id: "driver", label: "Driver" },
] as const;

export type ViewId = (typeof VIEWS)[number]["id"];
