import { useCallback, useEffect, useRef, useState } from "react";
import { createViewer, type Viewer, type ViewerOptions } from "./createViewer";
import type { ViewId } from "../config/views";

type Selection = Pick<ViewerOptions, "model" | "paintColour" | "bedLiner" | "hiddenNodes" | "doors" | "reflections">;
type Status = "loading" | "ready" | "failed" | "unsupported" | "lost";

/** The only React boundary for the imperative Three.js viewer. */
export function useViewer({ model, paintColour, bedLiner, hiddenNodes, doors, reflections }: Selection) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const selectionRef = useRef({ model, paintColour, bedLiner, hiddenNodes, doors, reflections });
  const shownModel = useRef(model);
  const [status, setStatus] = useState<Status>("loading");
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [presenting, setPresentingState] = useState(false);
  const [captureError, setCaptureError] = useState(false);

  // Declared before the selection effect on purpose. A new model is set first, so the colour,
  // accessories and doors that arrive with it are kept for the new vehicle and never applied to
  // the one being replaced. The scene itself is not recreated.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || shownModel.current === model) return;
    shownModel.current = model;
    setStatus("loading");
    setProgress(0);
    viewer.setModel(model);
  }, [model]);

  useEffect(() => {
    selectionRef.current = { model, paintColour, bedLiner, hiddenNodes, doors, reflections };
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.setPaintColour(paintColour);
    viewer.setBedLiner(bedLiner);
    viewer.setHiddenNodes(hiddenNodes);
    viewer.setDoors(doors);
    viewer.setReflections(reflections);
  }, [model, paintColour, bedLiner, hiddenNodes, doors, reflections]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setStatus("loading");
    setProgress(0);
    setPresentingState(false);
    shownModel.current = selectionRef.current.model;

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
