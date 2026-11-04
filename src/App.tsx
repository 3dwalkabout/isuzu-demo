import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ACCESSORIES } from "@/config/accessories";
import { PAINT_COLOURS, getPaintColour } from "@/config/colours";
import { configurationReducer, hiddenNodes, initialConfiguration } from "@/state/configuration";
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
  const [configuration, dispatch] = useReducer(configurationReducer, undefined, initialConfiguration);
  const colour = getPaintColour(configuration.colourId);
  const hidden = useMemo(() => hiddenNodes(configuration), [configuration.accessories]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setStatus("loading");
    setProgress(0);
    let viewer: Viewer;
    try {
      viewer = createViewer(container, {
        paintColour: colour.hex,
        hiddenNodes: hidden,
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
    // a retry recreates the viewer from the configuration of that render, later changes go through the effects below
  }, [attempt]);

  useEffect(() => {
    viewerRef.current?.setPaintColour(colour.hex);
  }, [colour.hex]);

  useEffect(() => {
    viewerRef.current?.setHiddenNodes(hidden);
  }, [hidden]);

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
      {status === "ready" && (
        <div className="swatches" role="group" aria-label="Body colour">
          {PAINT_COLOURS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="swatch"
              style={{ backgroundColor: option.hex }}
              aria-label={option.name}
              aria-pressed={option.id === configuration.colourId}
              title={option.name}
              onClick={() => dispatch({ type: "selectColour", colourId: option.id })}
            />
          ))}
          <p className="swatch-name">{colour.name}</p>
        </div>
      )}
      {status === "ready" && (
        <fieldset className="accessories">
          <legend>Accessories</legend>
          {ACCESSORIES.map((accessory) => (
            <label key={accessory.id}>
              <input
                type="checkbox"
                checked={configuration.accessories[accessory.id]}
                onChange={(event) =>
                  dispatch({ type: "setAccessory", accessoryId: accessory.id, visible: event.target.checked })
                }
              />
              {accessory.label}
            </label>
          ))}
        </fieldset>
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
