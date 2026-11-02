import { useEffect, useRef, useState } from "react";
import { createViewer } from "@/viewer/createViewer";

type Status = "loading" | "ready" | "failed";

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const viewer = createViewer(container, {
      onProgress: setProgress,
      onLoaded: () => setStatus("ready"),
      onError: () => setStatus("failed"),
    });
    return viewer.dispose;
  }, []);

  return (
    <main className="app">
      <div className="viewer" ref={containerRef} />
      {status === "loading" && (
        <p className="viewer-status">
          Loading model {Math.round(progress * 100)}%
        </p>
      )}
      {status === "failed" && (
        <p className="viewer-status">The model could not be loaded.</p>
      )}
    </main>
  );
}
