export type MusicState = "idle" | "playing" | "paused" | "failed";

/** The parts of `HTMLAudioElement` the controller uses, so tests can stand in for it. */
export interface AudioLike {
  src: string;
  loop: boolean;
  volume: number;
  preload: string;
  play: () => Promise<void>;
  pause: () => void;
  addEventListener: (type: "error", listener: () => void) => void;
  removeEventListener: (type: "error", listener: () => void) => void;
}

export interface VisibilityLike {
  readonly hidden: boolean;
  addEventListener: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener: (type: "visibilitychange", listener: () => void) => void;
}

export interface BackgroundMusicOptions {
  volume: number;
  onChange: (state: MusicState) => void;
  createAudio?: () => AudioLike;
  visibility?: VisibilityLike;
}

export interface BackgroundMusic {
  readonly state: MusicState;
  /** Starts or pauses playback. Call it from a user gesture, browsers refuse audio otherwise. */
  toggle: () => void;
  dispose: () => void;
}

/**
 * Looping background music that never starts by itself. The audio element is created on the
 * first toggle, so nothing is downloaded until a visitor asks for sound. Playback pauses while
 * the page is hidden and resumes when it returns, and a file that fails to load ends in the
 * `failed` state instead of throwing.
 */
export function createBackgroundMusic(
  src: string,
  { volume, onChange, createAudio = () => new Audio(), visibility = document }: BackgroundMusicOptions,
): BackgroundMusic {
  let state: MusicState = "idle";
  let audio: AudioLike | null = null;
  let disposed = false;

  const setState = (next: MusicState) => {
    if (disposed || state === next) return;
    state = next;
    onChange(next);
  };

  const fail = () => setState("failed");

  const start = () => {
    const element = audio;
    if (!element) return;
    element.play().catch((error: unknown) => {
      // a refused or interrupted start is not a broken file, the visitor can try again
      const name = (error as { name?: string } | null)?.name;
      if (name === "NotAllowedError" || name === "AbortError") setState("paused");
      else fail();
    });
  };

  const onVisibility = () => {
    if (!audio || state !== "playing") return;
    if (visibility.hidden) audio.pause();
    else start();
  };
  visibility.addEventListener("visibilitychange", onVisibility);

  return {
    get state() {
      return state;
    },
    toggle() {
      if (disposed || state === "failed") return;
      if (state === "playing") {
        audio?.pause();
        setState("paused");
        return;
      }
      if (!audio) {
        audio = createAudio();
        audio.preload = "auto";
        audio.loop = true;
        audio.volume = volume;
        audio.addEventListener("error", fail);
        audio.src = src;
      }
      setState("playing");
      start();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      visibility.removeEventListener("visibilitychange", onVisibility);
      if (audio) {
        audio.removeEventListener("error", fail);
        audio.pause();
        audio.src = "";
      }
      audio = null;
    },
  };
}
