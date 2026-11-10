import { useCallback, useEffect, useRef, useState } from "react";
import { createViewer, type Viewer, type ViewerOptions } from "./createViewer";
import type { ViewId } from "../config/views";

type Selection = Pick<ViewerOptions, "paintColour" | "bedLiner" | "hiddenNodes" | "doors" | "reflections">;
type Status = "loading" | "ready" | "failed" | "unsupported" | "lost";

/** The only React boundary for the imperative Three.js viewer. */
export function useViewer({ paintColour, bedLiner, hiddenNodes, doors, reflections }: Selection) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const selectionRef = useRef({ paintColour, bedLiner, hiddenNodes, doors, reflections });
  const [status, setStatus] = useState<Status>("loading");
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [presenting, setPresentingState] = useState(false);
  const [captureError, setCaptureError] = useState(false);

  useEffect(() => {
    selectionRef.current = { paintColour, bedLiner, hiddenNodes, doors, reflections };
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.setPaintColour(paintColour);
    viewer.setBedLiner(bedLiner);
    viewer.setHiddenNodes(hiddenNodes);
    viewer.setDoors(doors);
    viewer.setReflections(reflections);
  }, [paintColour, bedLiner, hiddenNodes, doors, reflections]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setStatus("loading");
    setProgress(0);
    setPresentingState(false);

    try {
      const viewer = createViewer(container, {
        ...selectionRef.current,
        cacheBust: attempt > 0 ? String(attempt) : undefined,
        onProgress: setProgress,
        onLoaded: () => setStatus("ready"),
        onError: () => setStatus("failed"),
        onContextLost: () => setStatus("lost"),
        onContextRestored: () => setStatus("ready"),
        onPresentingChange: setPresentingState,
      });
      viewerRef.current = viewer;
      return () => {
        viewerRef.current = null;
        viewer.dispose();
      };
    } catch {
      setStatus("unsupported");
    }
  }, [attempt]);

  const retry = useCallback(() => setAttempt(current => current + 1), []);
  const resetView = useCallback(() => viewerRef.current?.resetView(), []);
  const setPresenting = useCallback((enabled: boolean) => viewerRef.current?.setPresenting(enabled), []);
  const savePhoto = useCallback(async () => {
    setCaptureError(false);
    try { await viewerRef.current?.savePhoto(); }
    catch { setCaptureError(true); }
  }, []);
  const setView = useCallback((view: ViewId) => viewerRef.current?.setView(view), []);

  return { containerRef, status, progress, retry, resetView, presenting, setPresenting,
    setView, savePhoto, captureError,
    dismissCaptureError: () => setCaptureError(false) };
}
