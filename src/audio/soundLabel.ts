export interface SoundControlState {
  available: boolean;
  failed: boolean;
  playing: boolean;
}

/** Accessible name and tooltip for the Sound control, one wording per state. */
export function soundLabel({ available, failed, playing }: SoundControlState): string {
  if (!available) return "Sound — audio unavailable";
  if (failed) return "Sound — audio failed to load, press to retry";
  return playing ? "Sound on" : "Sound off";
}
