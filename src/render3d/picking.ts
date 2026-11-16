import * as THREE from 'three';

export const CLICK_TOLERANCE_PX = 4;

/** Part id of the nearest visible mesh under the pointer, or null. */
export function pickPart(
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  meshes: readonly THREE.Object3D[],
): string | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(meshes.filter((m) => m.visible), false)[0];
  const partId: unknown = hit?.object.userData.partId;
  return typeof partId === 'string' ? partId : null;
}

export function movedLessThan(a: { x: number; y: number }, b: { x: number; y: number }, tolerance = CLICK_TOLERANCE_PX) {
  return Math.hypot(a.x - b.x, a.y - b.y) < tolerance;
}
