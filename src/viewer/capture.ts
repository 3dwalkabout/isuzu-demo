/** Browser downloads contain the rendered scene, without the configurator controls. */
export function saveCapture(blob: Blob, extension: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `isuzu-dmax-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
  link.click();
  // Give the browser time to start consuming the download before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
