import { useEffect, useRef, useState } from "react";
import { createViewer, type Viewer } from "@/viewer/createViewer";

type Status = "loading" | "ready" | "failed";

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [progress, setProgress] = useState(0);

  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const viewer = createViewer(container, {
      onProgress: setProgress,
      onLoaded: () => setStatus("ready"),
      onError: () => setStatus("failed"),
    });
    viewerRef.current = viewer;
    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, []);

  return (
    <main className="app">
      <div className="viewer" ref={containerRef} />
      {status === "loading" && (
        <p className="viewer-status">
          Loading model {Math.round(progress * 100)}%
        </p>
      )}
      {status === "ready" && (
        <button
          type="button"
          className="reset-view"
          onClick={() => viewerRef.current?.resetView()}
        >
          Reset view
        </button>
      )}
      {status === "failed" && (
        <p className="viewer-status">The model could not be loaded.</p>
      )}
    </main>
  );
}
