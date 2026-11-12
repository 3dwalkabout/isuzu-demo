import { useCallback, useEffect, useRef, useState } from "react";
import { createBackgroundMusic, type BackgroundMusic, type MusicState } from "@/audio/backgroundMusic";
import { BACKGROUND_TRACK, MUSIC_VOLUME } from "@/config/audio";

/**
 * Sound state for the Sound control. `available` is false while no track is configured, so the
 * caller keeps the control disabled. Nothing is requested until `toggle` is called, and toggling
 * while `failed` retries the load.
 */
export function useBackgroundMusic() {
  const [state, setState] = useState<MusicState>("idle");
  const music = useRef<BackgroundMusic | null>(null);
  const available = BACKGROUND_TRACK !== null;

  useEffect(() => {
    if (!BACKGROUND_TRACK) return;
    const controller = createBackgroundMusic(import.meta.env.BASE_URL + BACKGROUND_TRACK.file, {
      volume: MUSIC_VOLUME,
      onChange: setState,
    });
    music.current = controller;
    return () => {
      music.current = null;
      controller.dispose();
    };
  }, []);

  const toggle = useCallback(() => music.current?.toggle(), []);

  return { available, playing: state === "playing", failed: state === "failed", toggle };
}
