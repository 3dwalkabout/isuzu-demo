import { useEffect, useRef, useState } from "react";
import { createViewer, type Viewer } from "@/viewer/createViewer";

type Status = "loading" | "ready" | "failed" | "unsupported" | "lost";

const MESSAGES: Record<Exclude<Status, "loading" | "ready">, string> = {
  failed: "The model could not be loaded.",
  unsupported: "This browser cannot show the 3D view. Try a current version of Chrome, Edge, Firefox or Safari.",
  lost: "The graphics connection was interrupted. It will resume on its own, or reload the page.",
};

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setStatus("loading");
    setProgress(0);
    let viewer: Viewer;
    try {
      viewer = createViewer(container, {
        cacheBust: attempt > 0 ? String(attempt) : undefined,
        onProgress: setProgress,
        onLoaded: () => setStatus("ready"),
        onError: () => setStatus("failed"),
        onContextLost: () => setStatus("lost"),
        onContextRestored: () => setStatus("ready"),
      });
    } catch {
      setStatus("unsupported");
      return;
    }
    viewerRef.current = viewer;
    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [attempt]);

  return (
    <main className="app">
      <div className="viewer" ref={containerRef} />
      {status === "loading" && (
        <p className="viewer-status" role="status">
          Loading model {Math.round(progress * 100)}%
        </p>
      )}
      {status === "ready" && (
        <button type="button" className="reset-view" onClick={() => viewerRef.current?.resetView()}>
          Reset view
        </button>
      )}
      {status !== "loading" && status !== "ready" && (
        <div className="viewer-status viewer-status--message" role="alert">
          <p>{MESSAGES[status]}</p>
          {status === "failed" && (
            <button type="button" className="retry" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          )}
        </div>
      )}
    </main>
  );
}
