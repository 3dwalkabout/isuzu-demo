export interface BackgroundTrack {
  /** Path under `public/`, for example `audio/ambient.mp3`. Loops while playing. */
  file: string;
}

/**
 * The background track. Leave as `null` until a track with a confirmed licence is added
 * under `public/audio/` with its source recorded next to it. While `null`, the Sound
 * control stays disabled and no audio is requested.
 */
export const BACKGROUND_TRACK: BackgroundTrack | null = null;

/** Playback level, deliberately low so the music never covers the demo. */
export const MUSIC_VOLUME = 0.35;
