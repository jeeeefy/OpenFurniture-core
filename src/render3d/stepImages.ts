import * as THREE from 'three';
import type { AssemblyStep, FurnitureModel } from '@/domain';
import { BACKGROUND, STEP_ASSEMBLED, STEP_NEW } from './palette';
import { buildScene } from './sceneBuilder';
import { isWebGL2Available } from './webgl';

export const STEP_IMAGE_SIZE = { widthPx: 1000, heightPx: 750 } as const;

const CAMERA_DIRECTIONS: Record<AssemblyStep['camera'], THREE.Vector3> = {
  'iso-front': new THREE.Vector3(0.8, 0.6, 1.4).normalize(),
  'iso-back': new THREE.Vector3(-0.8, 0.6, -1.4).normalize(),
  front: new THREE.Vector3(0, 0, 1),
};

const RAIL_PHASES = new Set<AssemblyStep['phase']>(['P0', 'P8', 'P9', 'P10', 'P11', 'P12']);

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * One offscreen renderer for all steps (plan §5.4): new parts amber, assembled parts light grey.
 * Returns an empty map without WebGL2; the caller then shows the placeholder.
 */
export async function renderStepImages(
  model: FurnitureModel,
  steps: readonly AssemblyStep[],
  o: { widthPx: number; heightPx: number } = STEP_IMAGE_SIZE,
): Promise<Map<number, string>> {
  const images = new Map<number, string>();
  if (steps.length === 0 || !isWebGL2Available()) return images;

  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(o.widthPx, o.heightPx, false);
  renderer.setClearColor(BACKGROUND);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(1500, 3000, 2500);
  scene.add(sun);
  const built = buildScene(model, model.envelope);
  scene.add(built.group);

  const camera = new THREE.PerspectiveCamera(35, o.widthPx / o.heightPx, 10, 100_000);
  const sphere = built.bounds.getBoundingSphere(new THREE.Sphere());
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = (sphere.radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.05;
  camera.near = Math.max(1, sphere.radius / 100);
  camera.far = sphere.radius * 100;
  camera.updateProjectionMatrix();

  try {
    for (const step of steps) {
      const visible = new Set(step.visiblePartIds);
      const highlight = new Set(step.highlightPartIds);
      for (const [id, obj] of built.parts) {
        obj.mesh.visible = visible.has(id);
        obj.edges.visible = visible.has(id);
        obj.mesh.material.color.set(highlight.has(id) ? STEP_NEW : STEP_ASSEMBLED);
      }
      // Rails are fitted in P8 (interior) and shown on the finished piece in P0.
      for (const mesh of built.rails.values()) {
        mesh.visible = RAIL_PHASES.has(step.phase);
        mesh.material.color.set(step.phase === 'P8' ? STEP_NEW : STEP_ASSEMBLED);
      }
      camera.position.copy(sphere.center).addScaledVector(CAMERA_DIRECTIONS[step.camera], distance);
      camera.lookAt(sphere.center);
      renderer.render(scene, camera);
      images.set(step.index, canvas.toDataURL('image/png'));
      // Keeps the page responsive between steps.
      await nextTask();
    }
  } finally {
    built.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
  return images;
}
