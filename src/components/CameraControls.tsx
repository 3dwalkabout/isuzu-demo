import { Pointer } from "lucide-react";

function MouseGesture({ zoom = false }: { zoom?: boolean }) {
  return <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5.5" y="2" width="13" height="20" rx="6.5" />
    {zoom ? <path className="gesture-accent" d="M12 5v5m-2-3 2-2 2 2m-4 1 2 2 2-2" /> : <>
      <path d="M5.5 10h13M12 2v8" />
      <path className="gesture-accent" d="M8 7V6a2 2 0 0 1 2-2v3" strokeWidth="2.4" />
    </>}
  </svg>;
}

function PinchGesture() {
  return <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 20V10a1.5 1.5 0 0 1 3 0v5m7 5V10a1.5 1.5 0 0 0-3 0v5" />
    <path className="gesture-accent" d="M9 5H2m3-3L2 5l3 3m10-3h7m-3-3 3 3-3 3" />
  </svg>;
}

export function CameraControls() {
  return <aside className="camera-controls surface" aria-label="Camera controls">
    <div className="camera-controls-mouse">
      <span className="camera-gesture" aria-label="Drag the left mouse button to move around the vehicle"><MouseGesture /><span>Drag</span></span>
      <span className="camera-gesture" aria-label="Scroll the mouse wheel to zoom"><MouseGesture zoom /><span>Scroll</span></span>
    </div>
    <div className="camera-controls-touch">
      <span className="camera-gesture" aria-label="Drag one finger to move around the vehicle"><Pointer size={23} strokeWidth={1.4} aria-hidden="true" /><span>Drag</span></span>
      <span className="camera-gesture" aria-label="Pinch two fingers to zoom"><PinchGesture /><span>Pinch</span></span>
    </div>
  </aside>;
}
