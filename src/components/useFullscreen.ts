import { useCallback, useEffect, useState, type RefObject } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const doc = () => document as FullscreenDocument;
const isSupported = () => Boolean(doc().fullscreenEnabled || doc().webkitFullscreenEnabled);
const currentElement = () => doc().fullscreenElement ?? doc().webkitFullscreenElement ?? null;

/**
 * Fullscreen state for one element. `supported` is false where the API is missing,
 * for example on iPhone, so the caller can hide the control and keep the normal layout.
 */
export function useFullscreen(target: RefObject<HTMLElement | null>) {
  const [supported] = useState(isSupported);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(currentElement() !== null && currentElement() === target.current);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [target]);

  const toggle = useCallback(async () => {
    const element = target.current as FullscreenElement | null;
    if (!element) return;
    try {
      if (currentElement()) await (doc().exitFullscreen?.() ?? doc().webkitExitFullscreen?.());
      else await (element.requestFullscreen?.() ?? element.webkitRequestFullscreen?.());
    } catch {
      // a refused request leaves the normal layout in place
    }
  }, [target]);

  return { supported, active, toggle };
}
