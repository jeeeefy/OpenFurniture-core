/** True if the browser can create a WebGL2 context (plan §5.4). */
export function isWebGL2Available(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
