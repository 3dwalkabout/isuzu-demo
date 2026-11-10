export const DOORS = [
  { id: "front-left", label: "Front left" },
  { id: "front-right", label: "Front right" },
  { id: "rear-left", label: "Rear left" },
  { id: "rear-right", label: "Rear right" },
] as const;

export type DoorId = (typeof DOORS)[number]["id"];
export type DoorState = Record<DoorId, boolean>;
export const DOOR_IDS = DOORS.map(door => door.id);

export function closedDoors(): DoorState {
  return Object.fromEntries(DOOR_IDS.map(id => [id, false])) as DoorState;
}
