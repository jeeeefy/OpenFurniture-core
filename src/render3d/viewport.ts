import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Envelope, FurnitureModel } from '@/domain';
import { BACKGROUND, EDGE_COLOUR, FRONT_ROLES, HOVER_TINT, SELECTED_EDGE_COLOUR, SELECTED_TINT } from './palette';
import { movedLessThan, pickPart } from './picking';
import { buildScene, type BuiltScene } from './sceneBuilder';

export type ViewPreset = 'iso' | 'front' | 'side' | 'top';

export interface ViewportCallbacks {
  onPick(partId: string | null): void;
  onHover(partId: string | null): void;
  onContextLost(): void;
}

export interface Viewport {
  setModel(model: FurnitureModel | null, envelope: Envelope): void;
  setSelection(partIds: readonly string[]): void;
  setOptions(options: { showFronts: boolean; showBack: boolean }): void;
  setView(view: ViewPreset): void;
  fit(): void;
  dispose(): void;
}

const VIEW_DIRECTIONS: Record<ViewPreset, THREE.Vector3> = {
  iso: new THREE.Vector3(0.8, 0.6, 1.4).normalize(),
  front: new THREE.Vector3(0, 0, 1),
  side: new THREE.Vector3(1, 0, 0),
  // A tiny z component keeps OrbitControls' up vector well defined.
  top: new THREE.Vector3(0, 1, 0.001).normalize(),
};

/** Render-on-demand three.js viewport (plan §5.4); camera state survives model updates. */
export function createViewport(canvas: HTMLCanvasElement, cb: ViewportCallbacks): Viewport {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(BACKGROUND);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(1500, 3000, 2500);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(35, 1, 10, 100_000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;

  let built: BuiltScene | null = null;
  let hasFitted = false;
  let selection = new Set<string>();
  let hovered: string | null = null;
  let options = { showFronts: true, showBack: true };
  let frame = 0;
  let disposed = false;
  let modelVersion = 0;

  const render = () => {
    frame = 0;
    if (disposed) return;
    renderer.render(scene, camera);
    const p = camera.position;
    canvas.dataset.camera = [p.x, p.y, p.z].map((v) => Math.round(v)).join(',');
    // Pixel-independent hook: which model the last frame shows (AC-050 commit → 3D timing).
    canvas.dataset.renderedModel = String(modelVersion);
  };
  const requestRender = () => {
    if (frame === 0 && !disposed) frame = requestAnimationFrame(render);
  };
  controls.addEventListener('change', requestRender);

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const fitDistance = (radius: number) => {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    return (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.05;
  };

  const placeCamera = (direction: THREE.Vector3) => {
    if (!built) return;
    const sphere = built.bounds.getBoundingSphere(new THREE.Sphere());
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(direction, fitDistance(sphere.radius));
    camera.near = Math.max(1, sphere.radius / 100);
    camera.far = sphere.radius * 100;
    camera.updateProjectionMatrix();
    controls.update();
    requestRender();
  };

  const applyAppearance = () => {
    if (!built) return;
    let hidden = 0;
    for (const [id, obj] of built.parts) {
      const role = obj.part.role;
      const visible = (options.showFronts || !FRONT_ROLES.has(role)) && (options.showBack || role !== 'back');
      if (!visible) hidden += 1;
      obj.mesh.visible = visible;
      obj.edges.visible = visible;
      const colour = obj.baseColour.clone();
      if (selection.has(id)) colour.lerp(new THREE.Color(SELECTED_TINT), 0.55);
      else if (hovered === id) colour.lerp(new THREE.Color(HOVER_TINT), 0.5);
      obj.mesh.material.color.copy(colour);
      obj.edges.material.color.set(selection.has(id) ? SELECTED_EDGE_COLOUR : EDGE_COLOUR);
    }
    canvas.dataset.partCount = String(built.parts.size);
    canvas.dataset.railCount = String(built.rails.size);
    canvas.dataset.hiddenParts = String(hidden);
    requestRender();
  };

  const meshes = () => (built ? [...built.parts.values()].map((p) => p.mesh) : []);

  let down: { x: number; y: number } | null = null;
  const onPointerDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    if (down && movedLessThan(down, { x: e.clientX, y: e.clientY })) {
      cb.onPick(pickPart(new THREE.Raycaster(), camera, canvas, e.clientX, e.clientY, meshes()));
    }
    down = null;
  };
  const raycaster = new THREE.Raycaster();
  const onPointerMove = (e: PointerEvent) => {
    if (e.buttons !== 0) return;
    const id = pickPart(raycaster, camera, canvas, e.clientX, e.clientY, meshes());
    if (id !== hovered) {
      hovered = id;
      applyAppearance();
      cb.onHover(id);
    }
  };
  const onPointerLeave = () => {
    if (hovered !== null) {
      hovered = null;
      applyAppearance();
      cb.onHover(null);
    }
  };
  const onContextLost = (e: Event) => {
    e.preventDefault();
    cb.onContextLost();
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('webglcontextlost', onContextLost);

  return {
    setModel(model, envelope) {
      modelVersion += 1;
      if (built) {
        scene.remove(built.group);
        built.dispose();
      }
      built = buildScene(model, envelope);
      scene.add(built.group);
      if (hovered !== null && !built.parts.has(hovered)) hovered = null;
      resize();
      if (!hasFitted) {
        hasFitted = true;
        placeCamera(VIEW_DIRECTIONS.iso);
      }
      applyAppearance();
    },
    setSelection(partIds) {
      selection = new Set(partIds);
      // Pixel-independent hook for E2E tests (spike SP-01).
      canvas.dataset.selectedParts = [...selection].sort().join(' ');
      applyAppearance();
    },
    setOptions(next) {
      options = { ...next };
      applyAppearance();
    },
    setView(view) {
      placeCamera(VIEW_DIRECTIONS[view]);
    },
    fit() {
      const direction = camera.position.clone().sub(controls.target).normalize();
      placeCamera(direction.lengthSq() > 0 ? direction : VIEW_DIRECTIONS.iso);
    },
    dispose() {
      disposed = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      observer.disconnect();
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      built?.dispose();
      renderer.dispose();
    },
  };
}
