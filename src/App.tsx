import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { ACCESSORIES } from "@/config/accessories";
import { PAINT_COLOURS, getPaintColour } from "@/config/colours";
import { configurationReducer, hiddenNodes, initialConfiguration } from "@/state/configuration";
import { createViewer, type Viewer } from "@/viewer/createViewer";
import resetViewIcon from "@/assets/icons/reset-view.svg?raw";
import sprayGunIcon from "@/assets/icons/spray-gun.svg?raw";
import trimPanelIcon from "@/assets/icons/trim-panel.svg?raw";

type Panel = "paint" | "accessories";
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
  const [panel, setPanel] = useState<Panel | null>("paint");
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

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const ready = status === "ready";
  const toggle = (name: Panel) => setPanel((current) => (current === name ? null : name));

  return (
    <main className="app">
      <div className="stage">
        <div className="viewer" ref={containerRef} />
        {status === "loading" && (
          <p className="viewer-status" role="status">
            Loading model {Math.round(progress * 100)}%
          </p>
        )}
        {ready && panel === "paint" && (
          <section id="panel-paint" className="panel" aria-label="Body colour">
            <div className="swatches">
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
            </div>
            <p className="panel-caption">{colour.name}</p>
          </section>
        )}
        {ready && panel === "accessories" && (
          <section id="panel-accessories" className="panel" aria-label="Accessories">
            <div className="accessory-list">
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
            </div>
          </section>
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
      </div>
      <nav className="toolbar" aria-label="Configurator">
        <div className="toolbar-group">
          <button
            type="button"
            className="icon-control"
            disabled={!ready}
            aria-pressed={panel === "paint"}
            aria-controls="panel-paint"
            onClick={() => toggle("paint")}
          >
            <Icon svg={sprayGunIcon} />
            <span className="icon-label">Paint</span>
          </button>
          <button
            type="button"
            className="icon-control"
            disabled={!ready}
            aria-pressed={panel === "accessories"}
            aria-controls="panel-accessories"
            onClick={() => toggle("accessories")}
          >
            <Icon svg={trimPanelIcon} />
            <span className="icon-label">Accessories</span>
          </button>
        </div>
        <div className="toolbar-group">
          <button type="button" className="icon-control" disabled={!ready} onClick={() => viewerRef.current?.resetView()}>
            <Icon svg={resetViewIcon} />
            <span className="icon-label">Reset view</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
