import * as THREE from 'three';
import type { Envelope, FurnitureModel, Part } from '@/domain';
import { EDGE_COLOUR, ENVELOPE_COLOUR, RAIL_COLOUR, roleColour } from './palette';

export interface PartObject {
  part: Part;
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  baseColour: THREE.Color;
}

export interface BuiltScene {
  group: THREE.Group;
  parts: Map<string, PartObject>;
  /** Clothes-rail tubes, keyed by section id. */
  rails: Map<string, THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>>;
  bounds: THREE.Box3;
  dispose: () => void;
}

/** One box mesh plus edge lines per part, in world millimetres (plan §5.4). */
export function buildScene(model: FurnitureModel | null, envelope: Envelope): BuiltScene {
  const group = new THREE.Group();
  const parts = new Map<string, PartObject>();
  const rails = new Map<string, THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>>();
  const disposables: { dispose: () => void }[] = [];

  if (model) {
    for (const rail of model.rails) {
      const geometry = new THREE.CylinderGeometry(rail.diameterMm / 2, rail.diameterMm / 2, rail.x1 - rail.x0, 24);
      const material = new THREE.MeshStandardMaterial({ color: RAIL_COLOUR, roughness: 0.35, metalness: 0.6 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set((rail.x0 + rail.x1) / 2, rail.y, rail.z);
      mesh.userData.sectionId = rail.sectionId;
      group.add(mesh);
      rails.set(rail.sectionId, mesh);
      disposables.push(geometry, material);
    }
    for (const part of model.parts) {
      const [x0, y0, z0] = part.box.min;
      const [x1, y1, z1] = part.box.max;
      const geometry = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      const baseColour = new THREE.Color(roleColour(part.role));
      const material = new THREE.MeshStandardMaterial({ color: baseColour.clone(), roughness: 0.85, metalness: 0 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      mesh.userData.partId = part.id;
      const edgeGeometry = new THREE.EdgesGeometry(geometry);
      const edgeMaterial = new THREE.LineBasicMaterial({ color: EDGE_COLOUR });
      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      edges.position.copy(mesh.position);
      group.add(mesh, edges);
      parts.set(part.id, { part, mesh, edges, baseColour });
      disposables.push(geometry, material, edgeGeometry, edgeMaterial);
    }
  } else {
    // Layout could not be resolved: draw only the envelope outline.
    const { widthMm: W, heightMm: H, depthMm: D } = envelope;
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D));
    const material = new THREE.LineDashedMaterial({ color: ENVELOPE_COLOUR, dashSize: 20, gapSize: 12 });
    const outline = new THREE.LineSegments(geometry, material);
    outline.computeLineDistances();
    outline.position.set(W / 2, H / 2, D / 2);
    group.add(outline);
    disposables.push(geometry, material);
  }

  const bounds = new THREE.Box3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(envelope.widthMm, envelope.heightMm, envelope.depthWithFrontsMm),
  );
  return {
    group,
    parts,
    rails,
    bounds,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
