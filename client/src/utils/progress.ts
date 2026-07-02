import * as THREE from 'three';

// Handcrafted navigation node lists for Levels 1-3, logic_2, and final_2
export const LEVEL_1_NODES: Array<[number, number, number]> = [
  [0, 0, 0], [0, 0, 7], [0, 0, 11], [0, 0, 14], [0, 0, 21.5],
  [0, 0, 25.5], [0, 0, 26.5], [0, 0, 34.5], [0, 0, 37.5], [0, 0, 46.0],
  [0, 0, 56.5]
];

export const LEVEL_2_NODES: Array<[number, number, number]> = [
  [0, 0, 0], [0, 0, 6], [-2, 0, 7], [0, 0, 12.5], [2, 0, 18], [0, 0, 27.5],
  [0, 0, 31.5], [0, 0, 37.5], [0, 0, 45.5], [0, 0, 58.5], [0, 0, 71.0],
  [0, 4.1, 80.0], [0, 4.1, 89.5]
];

export const LEVEL_3_NODES: Array<[number, number, number]> = [
  [0, 0, 0], [-1.6, 0.25, 10], [1.6, 0.25, 20], [0, 0, 15], [0, 0, 35.5],
  [0, 0, 47.5], [-1.2, 0, 55.5], [1.2, 0, 65.0], [0, 0, 72.5], [0, 0, 81.0],
  [-1.5, 0, 96.5], [1.5, 0, 96.5], [0, 0, 110.0]
];

export const LEVEL_GATE_MAZE: Array<[number, number, number]> = [
  [0, 0, 0], [-1.6, 0.5, 12], [0, 0.5, 24], [1.6, 0.5, 36], [0, 0.5, 46]
];

export const LEVEL_FINAL_CLIMB: Array<[number, number, number]> = [
  [0, 0, 0], [0, 1.2, 12], [-1.2, 0.8, 18], [1.2, 1.3, 24], [0, 4.8, 30], [0, 5.8, 38], [0, 8.8, 48]
];

export const LEVEL_PATHS: Record<string, Array<[number, number, number]>> = {
  'race_1': LEVEL_1_NODES,
  'race_2': LEVEL_2_NODES,
  'race_3': LEVEL_3_NODES,
  'logic_2': LEVEL_GATE_MAZE,
  'final_2': LEVEL_FINAL_CLIMB,
};

/**
 * Projects a 3D position onto the segment sequence to compute continuous progress.
 * segmentProgress value returned is between 0 and nodes.length - 1.
 */
export function getRacerProgressValue(
  levelId: string,
  pos: { x: number; y: number; z: number }
): number {
  const nodes = LEVEL_PATHS[levelId];
  if (!nodes || nodes.length < 2) {
    return pos.z; // fallback to z position
  }

  const position = new THREE.Vector3(pos.x, pos.y, pos.z);
  let minDistanceSq = Infinity;
  let bestSegmentIndex = 0;
  let bestSegmentProgress = 0;

  for (let i = 0; i < nodes.length - 1; i++) {
    const p1 = new THREE.Vector3(...nodes[i]);
    const p2 = new THREE.Vector3(...nodes[i + 1]);

    const segmentVec = p2.clone().sub(p1);
    const segmentLengthSq = segmentVec.lengthSq();
    if (segmentLengthSq === 0) continue;

    const playerVec = position.clone().sub(p1);
    let t = playerVec.dot(segmentVec) / segmentLengthSq;
    t = Math.max(0, Math.min(1, t)); // clamp progress inside the segment

    const projection = p1.clone().addScaledVector(segmentVec, t);
    const distanceSq = position.distanceToSquared(projection);

    if (distanceSq < minDistanceSq) {
      minDistanceSq = distanceSq;
      bestSegmentIndex = i;
      bestSegmentProgress = t;
    }
  }

  return bestSegmentIndex + bestSegmentProgress;
}
