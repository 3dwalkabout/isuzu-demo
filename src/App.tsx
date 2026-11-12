import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Check, Maximize, Minimize, RotateCcw, X } from "lucide-react";
import { Icon } from "@/components/Icon";
import { Toggle } from "@/components/Toggle";
import { CameraControls } from "@/components/CameraControls";
import { useFullscreen } from "@/components/useFullscreen";
import { useBackgroundMusic } from "@/components/useBackgroundMusic";
import { ACCESSORIES } from "@/config/accessories";
import { PAINT_COLOURS, getPaintColour } from "@/config/colours";
import { closedDoors, DOORS, DOOR_IDS, type DoorState } from "@/config/doors";
import { configurationReducer, hiddenNodes, initialConfiguration } from "@/state/configuration";
import { useViewer } from "@/viewer/useViewer";
import { VIEWS, type ViewId } from "@/config/views";
import paintIcon from "@/assets/icons/spray-gun.svg?raw";
import accessoriesIcon from "@/assets/icons/trim-panel.svg?raw";
import doorsIcon from "@/assets/icons/seat.svg?raw";
import wheelsIcon from "@/assets/icons/alloy-wheel.svg?raw";
import trimIcon from "@/assets/icons/material-swatch.svg?raw";
import editIcon from "@/assets/icons/edit.svg?raw";
import playIcon from "@/assets/icons/play.svg?raw";
import reflectionsIcon from "@/assets/icons/graph.svg?raw";
import cameraIcon from "@/assets/icons/camera.svg?raw";
import audioIcon from "@/assets/icons/audio.svg?raw";
import videoIcon from "@/assets/icons/video.svg?raw";

const PANELS = [
  { id: "paint", label: "Paint", icon: paintIcon },
  { id: "wheels", label: "Wheels", icon: wheelsIcon },
  { id: "accessories", label: "Accessories", icon: accessoriesIcon },
  { id: "trim", label: "Trim", icon: trimIcon },
  { id: "interior", label: "Interior", icon: doorsIcon },
] as const;

type Panel = (typeof PANELS)[number]["id"];

const MESSAGES = {
  failed: "Unable to load the vehicle.",
  unsupported: "3D is unavailable in this browser.",
  lost: "Reconnecting to the 3D view…",
};

export function App() {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [reflections, setReflections] = useState(true);
  const [viewListOpen, setViewListOpen] = useState(false);
  const [selectedView, setSelectedView] = useState<ViewId>("front");
  const viewListButton = useRef<HTMLButtonElement | null>(null);
  const viewChoice = useRef<HTMLButtonElement | null>(null);
  const [doors, setDoors] = useState(closedDoors);
  const [configuration, dispatch] = useReducer(configurationReducer, undefined, initialConfiguration);
  const lastSelector = useRef<HTMLButtonElement | null>(null);
  const appRef = useRef<HTMLElement | null>(null);
  const fullscreen = useFullscreen(appRef);
  const music = useBackgroundMusic();
  const soundLabel = !music.available
    ? "Sound — audio unavailable"
    : music.failed
      ? "Sound — audio failed to load, press to retry"
      : music.playing ? "Sound on" : "Sound off";
  const colour = getPaintColour(configuration.colourId);
  const hidden = useMemo(() => hiddenNodes(configuration), [configuration.accessories]);
  const viewer = useViewer({
    paintColour: colour.hex,
    bedLiner: configuration.accessories["bed-liner"],
    hiddenNodes: hidden,
    doors,
    reflections,
  });
  const ready = viewer.status === "ready";
  const activePanel = PANELS.find(item => item.id === panel);

  useEffect(() => {
    if (viewListOpen) viewChoice.current?.focus();
  }, [viewListOpen]);

  const closePanel = useCallback(() => {
    setPanel(null);
    lastSelector.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (viewListOpen) { setViewListOpen(false); viewListButton.current?.focus(); }
        else if (panel) closePanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePanel, panel, viewListOpen]);

  const setAllDoors = (open: boolean) => {
    setDoors(Object.fromEntries(DOOR_IDS.map(id => [id, open])) as DoorState);
  };

  return (
    <main className="app" ref={appRef}>
      <div className="viewer" ref={viewer.containerRef} />
      <h1 className="vehicle-name">ISUZU D-MAX</h1>
      {ready && <CameraControls />}

      {viewer.status === "loading" && (
        <div className="viewer-status" role="status">
          <div className="loading">
            <span>Loading…</span>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: Math.round(viewer.progress * 100) + "%" }} />
            </div>
          </div>
        </div>
      )}

      {ready && activePanel && (
        <section
          id={"panel-" + activePanel.id}
          className={"panel surface" + (panel === "paint" ? " panel--paint" : "")}
          aria-label={activePanel.label}
        >
          <header className="panel-heading">
            <h2>{panel === "paint" ? colour.name : activePanel.label}</h2>
            <button
              type="button"
              className="utility-button"
              aria-label="Close panel"
              onClick={closePanel}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          {panel === "paint" && (
            <div className="swatches">
              {PAINT_COLOURS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className="swatch"
                  aria-label={option.name}
                  aria-pressed={option.id === configuration.colourId}
                  data-tooltip={option.name}
                  onClick={() => dispatch({ type: "selectColour", colourId: option.id })}
                >
                  <span className="swatch-colour" style={{ backgroundColor: option.hex }}>
                    {option.id === configuration.colourId && (
                      <Check size={16} className="swatch-check" aria-hidden="true" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}

          {panel === "accessories" && (
            <div className="toggle-grid">
              {ACCESSORIES.filter(accessory => accessory.behaviour !== "material").map(accessory => (
                <Toggle
                  key={accessory.id}
                  label={accessory.label}
                  checked={configuration.accessories[accessory.id]}
                  onChange={visible => dispatch({
                    type: "setAccessory",
                    accessoryId: accessory.id,
                    visible,
                  })}
                />
              ))}
            </div>
          )}

          {panel === "trim" && (
            <Toggle label="Bed liner" checked={configuration.accessories["bed-liner"]}
              onChange={visible => dispatch({ type: "setAccessory", accessoryId: "bed-liner", visible })} />
          )}

          {panel === "interior" && (
            <>
              <div className="toggle-grid">
                {DOORS.map(door => (
                  <Toggle
                    key={door.id}
                    label={door.label}
                    ariaLabel={door.label + " door"}
                    checked={doors[door.id]}
                    onChange={open => setDoors(current => ({ ...current, [door.id]: open }))}
                  />
                ))}
              </div>
              <div className="door-actions">
                <button type="button" onClick={() => setAllDoors(true)}>Open all</button>
                <button type="button" onClick={() => setAllDoors(false)}>Close all</button>
              </div>
            </>
          )}
        </section>
      )}

      {viewer.status !== "loading" && viewer.status !== "ready" && (
        <div className="viewer-status viewer-status--error" role="alert">
          <p>{MESSAGES[viewer.status]}</p>
          {(viewer.status === "failed" || viewer.status === "lost") && (
            <button type="button" className="retry" onClick={viewer.retry}>
              <RotateCcw size={16} aria-hidden="true" />
              Retry
            </button>
          )}
        </div>
      )}

      {viewer.captureError && (
        <div className="capture-error surface" role="alert">
          <span>Unable to save capture. Try again.</span>
          <button type="button" className="utility-button" aria-label="Dismiss capture error" onClick={viewer.dismissCaptureError}><X size={16} /></button>
        </div>
      )}

      {music.failed && (
        <div className="capture-error surface" role="status">
          <span>Background music could not be loaded. Press Sound to try again.</span>
        </div>
      )}

      <nav className="toolbar surface" aria-label="Configurator">
        <div className="toolbar-modes toolbar-group" role="group" aria-label="Mode">
          <button type="button" className="toolbar-action" aria-label="Configure" data-tooltip="Configure" disabled={!ready}
            aria-pressed={!viewer.presenting} onClick={() => viewer.setPresenting(false)}><Icon svg={editIcon} /></button>
          <button type="button" className="toolbar-action" aria-label="Present" data-tooltip="Present" disabled={!ready}
            aria-pressed={viewer.presenting} onClick={() => { setPanel(null); setViewListOpen(false); viewer.setPresenting(!viewer.presenting); }}><Icon svg={playIcon} /></button>
        </div>
        <div className="toolbar-selectors toolbar-group" role="group" aria-label="Configuration">
        {PANELS.map(item => (
          <button
            key={item.id}
            type="button"
            className="selector"
            disabled={!ready || item.id === "wheels"}
            data-tooltip={item.id === "wheels" ? "Wheels — alternative wheel models unavailable" : item.label}
            aria-label={item.id === "wheels" ? "Wheels — alternative wheel models unavailable" : item.label}
            aria-pressed={panel === item.id}
            aria-expanded={panel === item.id}
            aria-controls={ready && panel === item.id ? "panel-" + item.id : undefined}
            onClick={event => {
              setViewListOpen(false);
              lastSelector.current = event.currentTarget;
              viewer.setPresenting(false);
              setPanel(current => current === item.id ? null : item.id);
            }}
          >
            <Icon svg={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
        </div>
        <div className="toolbar-actions toolbar-group" role="group" aria-label="View and capture">
        <button
          type="button"
          className="toolbar-action"
          aria-label="Reflections"
          data-tooltip="Reflections"
          aria-pressed={reflections}
          disabled={!ready}
          onClick={() => setReflections(current => !current)}
        >
          <Icon svg={reflectionsIcon} />
        </button>
        <button type="button" className="toolbar-action" aria-label="Save photo" data-tooltip="Save photo" disabled={!ready} onClick={viewer.savePhoto}><Icon svg={cameraIcon} /></button>
        <button type="button" className="toolbar-action" aria-label={soundLabel} data-tooltip={soundLabel}
          aria-pressed={music.available && !music.failed ? music.playing : undefined}
          disabled={!music.available} onClick={music.toggle}><Icon svg={audioIcon} /></button>
        <button ref={viewListButton} type="button" className="toolbar-action view-list-toggle" aria-label="Camera views" data-tooltip="View"
          aria-expanded={viewListOpen} aria-controls={viewListOpen ? "camera-views" : undefined} disabled={!ready}
          onClick={() => { setPanel(null); setViewListOpen(open => !open); }}>
          <Icon svg={videoIcon} />
        </button>
        {fullscreen.supported && (
          <button type="button" className="toolbar-action" aria-label={fullscreen.active ? "Exit fullscreen" : "Enter fullscreen"}
            data-tooltip={fullscreen.active ? "Exit fullscreen" : "Fullscreen"} aria-pressed={fullscreen.active}
            onClick={fullscreen.toggle}>
            {fullscreen.active
              ? <Minimize size={20} strokeWidth={1.4} aria-hidden="true" />
              : <Maximize size={20} strokeWidth={1.4} aria-hidden="true" />}
          </button>
        )}
        <button type="button" className="toolbar-action reset-camera" aria-label="Reset camera" data-tooltip="Reset camera"
          disabled={!ready} onClick={viewer.resetView}><RotateCcw size={20} strokeWidth={1.4} aria-hidden="true" /></button>
        </div>
        {viewListOpen && <div id="camera-views" className="view-list surface" role="group" aria-label="Camera views">
          {VIEWS.map(view => <button key={view.id} ref={view.id === selectedView ? viewChoice : undefined} type="button"
            aria-pressed={view.id === selectedView} onClick={() => {
              setSelectedView(view.id); viewer.setView(view.id); setViewListOpen(false); viewListButton.current?.focus();
            }}>
            <span>{view.label}</span>{selectedView === view.id && <Check size={14} aria-hidden="true" />}
          </button>)}
        </div>}
      </nav>
    </main>
  );
}
