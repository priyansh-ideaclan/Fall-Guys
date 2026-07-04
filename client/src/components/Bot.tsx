import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, useRapier, RapierRigidBody } from '@react-three/rapier';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { getRacerProgressValue } from '../utils/progress';

export interface BotProps {
  id: string;
  name: string;
  color: string;
  accessory: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  spawnPos: [number, number, number];
}

// Handcrafted navigation node lists for Levels 1-5 & mini-games
const LEVEL_1_LEFT_PATH: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, 5],
  [0, 0, 10],
  [-7.5, 0, 15.0],   // Left lane entry
  [-7.5, 0, 26.5],   // Left grass walkway
  [-7.5, 0.5, 33.0],  // Left mud area
  [0, 1.0, 40.6],    // Merge Checkpoint 2
  [0, 1.05, 47.0],   // Jump Pad
  [0, 7.5, 54.0],    // Landing deck Storey 1
  [-3.5, 7.9, 61.0], // Ice platform left Storey 2
  [-6.5, 8.7, 65.5], // Arena left edge (clear of center Hammer 1 arc)
  [-6.5, 8.7, 69.5], // Arena left edge (between Hammer 2 and Hammer 4)
  [-6.5, 8.7, 73.5], // Arena left exit (clear of Hammer 5 & 6)
  [0, 8.7, 76.5],   // Checkpoint 3
  [-5.0, 8.5, 76.0], // Left water slide entry
  [-5.0, 5.0, 83.0], // Left water slide mid
  [0, 4.1, 88.0],    // Slide landing deck
  [0, 5.2, 94.0],    // Walkway
  [0, 4.5, 100.0],   // Checkpoint 4
  [-3.0, 4.5, 105.0], // Left lane flat road
  [-3.0, 5.2, 109.0], // Left side gate
  [0, 1.1, 120.0],   // Speed slide
  [0, -1.8, 128.0],  // Final rotating sweeper
  [0, -2.4, 135.0]   // Finish Archway
];

const LEVEL_1_MIDDLE_PATH: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, 5],
  [0, 0, 10],
  [0, 0, 15],
  [-1.5, 0.1, 24.5], // Tilting deck
  [1.5, 0.1, 28.2],  // Platform A
  [-1.2, 0.35, 31.8], // Platform B
  [1.2, 0.6, 35.4],  // Platform C
  [-1.2, 0.85, 39.0], // Platform D
  [0, 1.0, 40.6],    // Checkpoint 2
  [0, 1.05, 47.0],   // Jump Pad
  [0, 7.5, 54.0],    // Landing deck Storey 1
  [0, 7.5, 54.0],    // Stay in center
  [-4.0, 8.3, 61.0], // Windmill crossing – hug left (avoid right windmills)
  [6.5, 8.7, 65.5],  // Arena right edge entry (dodge Hammer 1 center)
  [-6.5, 8.7, 69.5], // Arena left side mid (between Hammer 3 and Hammer 4)
  [6.5, 8.7, 73.5],  // Arena right exit (dodge Hammer 5)
  [0, 8.7, 76.5],   // Checkpoint 3
  [0.0, 8.5, 76.0],  // Middle slide entry
  [0.0, 5.0, 83.0],  // Middle slide mid
  [0, 4.1, 88.0],    // Slide landing deck
  [0, 5.2, 94.0],    // Walkway
  [0, 4.5, 100.0],   // Checkpoint 4
  [0.0, 4.5, 105.0], // Middle lane road
  [0.0, 5.2, 109.0], // Middle moving gate
  [0, 1.1, 120.0],   // Speed slide
  [0, -1.8, 128.0],  // Final rotating sweeper
  [0, -2.4, 135.0]   // Finish Archway
];

const LEVEL_1_RIGHT_PATH: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, 5],
  [0, 0, 10],
  [7.5, 0, 15.0],    // Right lane entry
  [7.5, 0.1, 22.5],  // Right moving platform
  [7.5, 0.4, 28.0],  // Speed pad right
  [7.5, 0.1, 34.0],  // Hammer platform
  [0, 1.0, 40.6],    // Checkpoint 2
  [0, 1.05, 47.0],   // Jump Pad
  [0, 7.5, 54.0],    // Landing deck Storey 1
  [4.5, 8.3, 61.0],  // Windmill bridge right Storey 2 – thread between windmills
  [6.5, 8.7, 65.5],  // Arena right edge entry (dodge Hammer 1)
  [6.5, 8.7, 69.5],  // Arena right mid (between Hammer 3 and Hammer 4)
  [-6.5, 8.7, 73.5], // Arena left exit (dodge Hammer 6)
  [0, 8.7, 76.5],   // Checkpoint 3
  [5.0, 8.5, 76.0],  // Right slide entry
  [5.0, 5.0, 83.0],  // Right slide mid
  [0, 4.1, 88.0],    // Slide landing deck
  [0, 5.2, 94.0],    // Walkway
  [0, 4.5, 100.0],   // Checkpoint 4
  [3.0, 4.5, 105.0], // Right shortcut entry
  [3.0, 4.1, 112.5], // Right balance beam
  [0, 1.1, 120.0],   // Speed slide
  [0, -1.8, 128.0],  // Final rotating sweeper
  [0, -2.4, 135.0]   // Finish Archway
];

const LEVEL_1_NODES = LEVEL_1_MIDDLE_PATH;

const LEVEL_2_NODES: Array<[number, number, number]> = [
  [0, 0, 0], [0, 0, 6], [-2, 0, 7], [0, 0, 12.5], [2, 0, 18], [0, 0, 27.5],
  [0, 0, 31.5], [0, 0, 37.5], [0, 0, 45.5], [0, 0, 58.5], [0, 0, 71.0],
  [0, 4.1, 80.0], [0, 4.1, 89.5]
];

const LEVEL_3_NODES: Array<[number, number, number]> = [
  [0, 0, 0], [-1.6, 0.25, 10], [1.6, 0.25, 20], [0, 0, 15], [0, 0, 35.5],
  [0, 0, 47.5], [-1.2, 0, 55.5], [1.2, 0, 65.0], [0, 0, 72.5], [0, 0, 81.0],
  [-1.5, 0, 96.5], [1.5, 0, 96.5], [0, 0, 110.0]
];

const LEVEL_GATE_MAZE: Array<[number, number, number]> = [
  [0, 0, 0], [-1.6, 0.5, 12], [0, 0.5, 24], [1.6, 0.5, 36], [0, 0.5, 46]
];

const LEVEL_FINAL_CLIMB: Array<[number, number, number]> = [
  [0, 0, 0], [0, 1.2, 12], [-1.2, 0.8, 18], [1.2, 1.3, 24], [0, 4.8, 30], [0, 5.8, 38], [0, 8.8, 48]
];

const LEVEL_PATHS: Record<string, Array<[number, number, number]>> = {
  'race_1': LEVEL_1_NODES,
  'race_2': LEVEL_2_NODES,
  'race_3': LEVEL_3_NODES,
  'logic_2': LEVEL_GATE_MAZE,
  'final_2': LEVEL_FINAL_CLIMB,
};

export const Bot: React.FC<BotProps> = ({ id, name, color, accessory, difficulty, spawnPos }) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const visualGroupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const trailMeshRef = useRef<THREE.Mesh>(null);

  const { rapier, world } = useRapier();
  const phase = useGameStore((state) => state.phase);
  const currentLevelId = useGameStore((state) => state.currentLevelId);
  const currentLevelType = useGameStore((state) => state.currentLevelType);
  const activeColorPattern = useGameStore((state) => state.activeColorPattern);
  const qualifyBot = useGameStore((state) => state.qualifyRacer);
  const eliminateBot = useGameStore((state) => state.eliminateRacer);
  const updateRacerProgress = useGameStore((state) => state.updateRacerProgress);
  const scores = useGameStore((state) => state.scores);

  // Ref for camera-distance opacity of name label
  const nameLabelRef = useRef<any>(null);

  // States
  const [isQualified, setIsQualified] = useState(false);
  const [isEliminated, setIsEliminated] = useState(false);
  
  const currentNodeIndex = useRef(0);
  const targetOffset = useRef(new THREE.Vector3(0, 0, 0));
  const botLastCheckpoint = useRef<[number, number, number]>(spawnPos);
  
  // Stuck detection variables
  const lastPosRef = useRef(new THREE.Vector3());
  const stuckTimeRef = useRef(0);

  const isGroundedRef = useRef(false);
  const jumpCooldown = useRef(0);
  const jumpCountRef = useRef(0);
  const landingSquish = useRef(0);
  const wasGrounded = useRef(true);
  
  // Knockback states
  const knockbackTimerRef = useRef(0);
  const knockbackVelRef = useRef(new THREE.Vector3());

  // Bot Nitro Boost states
  const isNitroActive = useRef(false);
  const nitroCooldown = useRef(0);
  const nitroDuration = useRef(0);
  const wasNitroActiveRef = useRef(false);
  
  // Base running speeds
  const botSpeed = useRef(difficulty === 'EASY' ? 3.5 : difficulty === 'MEDIUM' ? 4.2 : 4.9);
  const botPath = useRef<[number, number, number][]>(LEVEL_1_MIDDLE_PATH);
  const windmillMistakeFlag = useRef<boolean | null>(null);

  useEffect(() => {
    if (phase === 'PLAYING' || phase === 'ROUND_INTRO') {
      setIsQualified(false);
      setIsEliminated(false);
      currentNodeIndex.current = 0;
      botLastCheckpoint.current = spawnPos;
      jumpCooldown.current = 0;
      stuckTimeRef.current = 0;
      knockbackTimerRef.current = 0;
      lastPosRef.current.set(spawnPos[0], spawnPos[1], spawnPos[2]);
      
      isNitroActive.current = false;
      nitroCooldown.current = 0;
      nitroDuration.current = 0;
      wasNitroActiveRef.current = false;

      // Assign bot branching path choices based on ID
      const botIndex = parseInt(id.replace(/\D/g, '')) || 0;
      const pathChoice = botIndex % 3;
      if (pathChoice === 0) {
        botPath.current = LEVEL_1_LEFT_PATH;
      } else if (pathChoice === 1) {
        botPath.current = LEVEL_1_MIDDLE_PATH;
      } else {
        botPath.current = LEVEL_1_RIGHT_PATH;
      }
      
      const widthSpread = difficulty === 'EASY' ? 1.4 : difficulty === 'MEDIUM' ? 0.7 : 0.2;
      targetOffset.current.set(
        (Math.random() - 0.5) * widthSpread,
        0,
        (Math.random() - 0.5) * widthSpread
      );

      if (rigidBodyRef.current) {
        rigidBodyRef.current.setTranslation(new THREE.Vector3(...spawnPos), true);
        rigidBodyRef.current.setLinvel(new THREE.Vector3(0, 0, 0), true);
        rigidBodyRef.current.setAngvel(new THREE.Vector3(0, 0, 0), true);
      }
    }
  }, [phase, spawnPos, difficulty]);

  useFrame((state, delta) => {
    // Tick local bot nitro timers
    if (nitroCooldown.current > 0) {
      nitroCooldown.current -= delta;
      if (nitroCooldown.current < 0) nitroCooldown.current = 0;
    }
    if (isNitroActive.current) {
      nitroDuration.current -= delta;
      if (nitroDuration.current <= 0) {
        isNitroActive.current = false;
        nitroDuration.current = 0;
      }
    }

    if (phase !== 'PLAYING' || isQualified || isEliminated) {
      if (phase === 'ROUND_INTRO' && rigidBodyRef.current) {
        const rb = rigidBodyRef.current;
        rb.setLinvel({ x: 0, y: Math.min(rb.linvel().y, 0), z: 0 }, true);
        rb.setAngvel(new THREE.Vector3(0, 0, 0), true);
      }
      if (visualGroupRef.current && isQualified) {
        const time = state.clock.getElapsedTime();
        visualGroupRef.current.position.y = -0.12 + Math.abs(Math.sin(time * 12)) * 0.25;
        leftArmRef.current?.rotation.set(Math.sin(time * 10) * 0.5 - 1.2, 0, 0.4);
        rightArmRef.current?.rotation.set(Math.sin(time * 10) * 0.5 - 1.2, 0, -0.4);
      }
      return;
    }

    const rb = rigidBodyRef.current;
    if (!rb) return;

    const pos = rb.translation();

    // AI Strategic Nitro trigger logic
    if (nitroCooldown.current === 0 && !isNitroActive.current && phase === 'PLAYING') {
      const botHash = id.charCodeAt(id.length - 1) % 3;
      const personality = botHash === 0 ? 'AGGRESSIVE' : botHash === 1 ? 'BALANCED' : 'CAUTIOUS';

      const isNearHammers = (pos.z > 3 && pos.z < 7) || (pos.z > 88 && pos.z < 96);
      const isNearSweepers = (pos.z > 123 && pos.z < 132) || (pos.z > 85 && pos.z < 90);
      const isComplexPlatforming = (pos.z > 23 && pos.z < 44) || (pos.z > 58 && pos.z < 81);
      const isNarrowBeam = (pos.z > 110 && pos.z < 115 && Math.abs(pos.x) < 1.0);
      const isStraightSection = (pos.z > 2 && pos.z < 18) || (pos.z > 102 && pos.z < 122);
      
      const avoidNitro = isNearHammers || isNearSweepers || isComplexPlatforming || isNarrowBeam;
      
      if (!avoidNitro) {
        let triggerChance = 0;
        if (personality === 'AGGRESSIVE') {
          triggerChance = isStraightSection ? 0.005 : 0.002;
        } else if (personality === 'BALANCED') {
          triggerChance = isStraightSection ? 0.0025 : 0.0006;
        } else {
          // CAUTIOUS
          triggerChance = isStraightSection ? 0.0012 : 0;
        }
        
        if (Math.random() < triggerChance) {
          isNitroActive.current = true;
          nitroDuration.current = 1.0;
          nitroCooldown.current = 5.0;
        }
      }
    }

    // Trigger forward boost impulse on activation for bot
    const justActivatedNitro = isNitroActive.current && !wasNitroActiveRef.current;
    wasNitroActiveRef.current = isNitroActive.current;

    if (justActivatedNitro && visualGroupRef.current) {
      const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(visualGroupRef.current.quaternion);
      lookDir.y = 0;
      lookDir.normalize();
      
      const currentVel = rb.linvel();
      rb.setLinvel({
        x: currentVel.x + lookDir.x * 5.2, // Strong forward dash push
        y: currentVel.y,
        z: currentVel.z + lookDir.z * 5.2
      }, true);
    }

    // Decrement knockback timer and apply knockback velocity if active
    if (knockbackTimerRef.current > 0) {
      knockbackTimerRef.current -= delta;
      const currentVel = rb.linvel();
      rb.setLinvel({
        x: knockbackVelRef.current.x,
        y: currentVel.y,
        z: knockbackVelRef.current.z
      }, true);
      
      if (visualGroupRef.current) {
        visualGroupRef.current.rotation.y += delta * 15; // spin when hit!
      }
      return;
    }

    const progressValue = getRacerProgressValue(currentLevelId, pos);

    // Report live leaderboard progress
    updateRacerProgress({
      id,
      name,
      progressValue,
      yPos: pos.y,
      score: scores[id] || 0,
      finished: isQualified,
    });

    // Update name label scale and opacity based on camera distance to avoid clutter
    if (nameLabelRef.current) {
      const camPos = state.camera.position;
      const dist = Math.sqrt(
        (camPos.x - pos.x) ** 2 + (camPos.y - pos.y) ** 2 + (camPos.z - pos.z) ** 2
      );
      const targetScale = dist > 25 ? 0 : Math.max(0.35, 1.0 - (dist - 6) / 20);
      nameLabelRef.current.scale.set(targetScale, targetScale, targetScale);
      nameLabelRef.current.fillOpacity = dist > 25 ? 0 : Math.max(0.35, 1.0 - (dist - 6) / 20);
    }

    if (currentLevelId === 'race_1') {
      if (pos.z > 20 && botLastCheckpoint.current[2] < 20) botLastCheckpoint.current = [0, 1.2, 20];
      if (pos.z > 43.5 && botLastCheckpoint.current[2] < 43.5) botLastCheckpoint.current = [0, 2.2, 43.5];
      if (pos.z > 80 && botLastCheckpoint.current[2] < 80) botLastCheckpoint.current = [0, 14.7, 80];
      if (pos.z > 110 && botLastCheckpoint.current[2] < 110) botLastCheckpoint.current = [0, 5.7, 110];
    } else if (currentLevelId === 'race_2') {
      if (pos.z > 43 && botLastCheckpoint.current[2] < 43) botLastCheckpoint.current = [0, 1.2, 45.5];
      if (pos.z > 78 && botLastCheckpoint.current[2] < 78) botLastCheckpoint.current = [0, 5.2, 80];
    } else if (currentLevelId === 'race_3') {
      if (pos.z > 45 && botLastCheckpoint.current[2] < 45) botLastCheckpoint.current = [0, 1.2, 47.5];
    } else if (currentLevelId === 'logic_2') {
      if (pos.z > 18 && botLastCheckpoint.current[2] < 18) botLastCheckpoint.current = [0, 1.2, 20];
    } else if (currentLevelId === 'final_2') {
      if (pos.z > 42 && botLastCheckpoint.current[2] < 42) botLastCheckpoint.current = [0, 8.5, 48];
    }

    // 1. Raycast ground check (Velocity Locked & Offset Origin)
    const rayOrigin = new THREE.Vector3(pos.x, pos.y - 0.51, pos.z);
    const rayDir = { x: 0, y: -1, z: 0 };
    const maxToi = 0.08; // 8cm range below the capsule
    const ray = new rapier.Ray(rayOrigin, rayDir);
    const hit = world.castRay(ray, maxToi, true);
    
    const currentVelocity = rb.linvel();
    const isMovingUp = currentVelocity.y > 0.05;
    isGroundedRef.current = hit !== null && !isMovingUp;

    if (jumpCooldown.current > 0) {
      jumpCooldown.current -= delta;
    }

    // Reset jump counts on ground contact, or apply airborne penalty
    if (isGroundedRef.current) {
      jumpCountRef.current = 0;
    } else if (jumpCountRef.current === 0) {
      jumpCountRef.current = 1; // fell off a ledge, only 1 jump remaining
    }

    // 2. Teleport check or instant elimination if fell below boundaries
    const killBoundaryY = (currentLevelId === 'final_1' || currentLevelId === 'logic_1' || currentLevelId === 'survival_2') ? 0.0 : -8.0;
    if (pos.y < killBoundaryY) {
      useGameStore.getState().triggerSplash([pos.x, -8.2, pos.z], '#ff007f');
      if (currentLevelType === 'SURVIVAL' || currentLevelType === 'LOGIC' || currentLevelId === 'final_1') {
        // Eliminated!
        setIsEliminated(true);
        eliminateBot(id);
      } else {
        rb.setTranslation(new THREE.Vector3(...botLastCheckpoint.current), true);
        rb.setLinvel(new THREE.Vector3(0, 0, 0), true);
        rb.setAngvel(new THREE.Vector3(0, 0, 0), true);
        stuckTimeRef.current = 0;

        // Trigger recovery nitro
        if (nitroCooldown.current === 0 && !isNitroActive.current) {
          isNitroActive.current = true;
          nitroDuration.current = 1.0;
          nitroCooldown.current = 5.0;
        }
      }
      return;
    }

    // 3. Three.js Raycaster for surface properties (ice, mud, conveyors)
    let currentSurface = 'normal';
    let conveyorSpeed = 0;
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(pos.x, pos.y, pos.z),
      new THREE.Vector3(0, -1, 0)
    );
    const intersects = raycaster.intersectObjects(state.scene.children, true);
    if (intersects.length > 0 && intersects[0].distance < 0.65) {
      const hitObj = intersects[0].object;
      if (hitObj.userData && hitObj.userData.surface) {
        currentSurface = hitObj.userData.surface;
        if (currentSurface === 'conveyor') {
          conveyorSpeed = hitObj.userData.pushSpeed || 0;
        }
      } else if (hitObj.parent && hitObj.parent.userData && hitObj.parent.userData.surface) {
        currentSurface = hitObj.parent.userData.surface;
        if (currentSurface === 'conveyor') {
          conveyorSpeed = hitObj.parent.userData.pushSpeed || 0;
        }
      }
    }

    // 4. Steer logic configurations
    let activeSpeed = botSpeed.current;
    let accelerationRatio = isGroundedRef.current ? 0.15 : 0.06;
    let jumpImpulse = 6.2;

    const isSliding = currentSurface === 'slide' || currentSurface === 'speed-ramp';

    if (isNitroActive.current) {
      activeSpeed *= 1.48; // 48% speed boost
      accelerationRatio = Math.min(1.0, accelerationRatio * 1.8);
    }

    if (isSliding) {
      activeSpeed = 9.2; // Slide momentum
      accelerationRatio = 0.045; // lower control
    }

    if (currentSurface === 'ice') {
      accelerationRatio = 0.035;
      activeSpeed *= 1.1;
    } else if (currentSurface === 'mud') {
      activeSpeed *= 0.45;
      jumpImpulse = 3.2;
    } else if (currentSurface === 'speed-ramp') {
      accelerationRatio = 0.06;
      activeSpeed *= 1.8;
    }

    // Natural hesitation slowdown before gap jumps for Easy/Medium bots
    const isNearGap = (currentLevelId === 'race_2' && pos.z > 7.5 && pos.z < 9.5) || (currentLevelId === 'race_2' && pos.z > 22.5 && pos.z < 24.5);
    if (isNearGap && (difficulty === 'EASY' || difficulty === 'MEDIUM') && Math.random() < 0.25) {
      activeSpeed *= 0.65;
    }

    // Custom pattern windmill at Landmark 11 (Z = 22.0) and bridge windmills (Z = 68.0) timing checks
    const isNearLandmark11Windmill = currentLevelId === 'race_1' && pos.x < -4.0 && pos.z > 19.5 && pos.z < 24.5;
    const isNearBridgeWindmill = currentLevelId === 'race_1' && pos.x > 0.5 && pos.z > 64.0 && pos.z < 69.5;

    if (isNearLandmark11Windmill) {
      if (windmillMistakeFlag.current === null) {
        const threshold = difficulty === 'EASY' ? 0.35 : difficulty === 'MEDIUM' ? 0.12 : 0.02;
        windmillMistakeFlag.current = Math.random() < threshold;
      }

      if (windmillMistakeFlag.current === false) {
        const elapsed = state.clock.getElapsedTime();
        const t = elapsed % 8.5; // 8.5 second repeating cycle
        // Wait during fast rotation phase (3s to 5.5s)
        if (t >= 2.5 && t <= 5.8) {
          activeSpeed = 0; // pause and wait
        }
      }
    } else if (isNearBridgeWindmill) {
      if (windmillMistakeFlag.current === null) {
        const threshold = difficulty === 'EASY' ? 0.35 : difficulty === 'MEDIUM' ? 0.12 : 0.02;
        windmillMistakeFlag.current = Math.random() < threshold;
      }

      if (windmillMistakeFlag.current === false) {
        const time = state.clock.getElapsedTime();
        const bladeSweepAngle = Math.abs(Math.sin(time * 1.8 * 2.0));
        if (bladeSweepAngle > 0.65) {
          activeSpeed = 0; // pause and wait
        }
      }
    } else {
      windmillMistakeFlag.current = null;
    }

    // 4a. Wind zone cycle evasion check (Bots wait before crossing if wind is high)
    let isHeadingIntoStrongWind = false;
    const botIndex = parseInt(id.replace(/\D/g, '')) || 0;
    const windZonesList: THREE.Object3D[] = [];
    state.scene.traverse((child) => {
      if (child.name === 'wind-zone') {
        windZonesList.push(child);
      }
    });
    windZonesList.forEach((zone) => {
      const zonePos = new THREE.Vector3();
      zone.getWorldPosition(zonePos);
      const zoneSize = zone.userData.size;
      if (zoneSize) {
        const dx = pos.x - zonePos.x;
        const dy = pos.y - zonePos.y;
        const dz = pos.z - zonePos.z;
        // Bot is approaching or inside this wind zone
        if (
          Math.abs(dx) < zoneSize[0] / 2 + 1.5 && // extended lookahead buffer
          Math.abs(dy - 0.5) < zoneSize[1] / 2 &&
          Math.abs(dz) < zoneSize[2] / 2
        ) {
          const elapsed = state.clock.getElapsedTime();
          const t = elapsed % 7.5; // 7.5s cycle (2.5s per phase: Weak, Medium, Strong)
          // Strong wind is in the last phase of the cycle (5.0s to 7.5s)
          const isWindStrong = t >= 4.5 && t <= 7.3;
          if (isWindStrong) {
            // Decide if the bot commits a mistake based on bot index pattern
            const hasMistake = botIndex % 5 === 0;
            const shouldEvade = !hasMistake;
            if (shouldEvade) {
              isHeadingIntoStrongWind = true;
            }
          }
        }
      }
    });

    if (isHeadingIntoStrongWind) {
      activeSpeed = 0;
    }

    // 4b. Wind Zone detection
    let windForceX = 0;
    let windForceZ = 0;
    const windZones: THREE.Object3D[] = [];
    state.scene.traverse((child) => {
      if (child.name === 'wind-zone') {
        windZones.push(child);
      }
    });
    windZones.forEach((zone) => {
      const zonePos = new THREE.Vector3();
      zone.getWorldPosition(zonePos);
      const zoneSize = zone.userData.size;
      const zoneForce = zone.userData.force;
      if (zoneSize && zoneForce) {
        const dx = pos.x - zonePos.x;
        const dy = pos.y - zonePos.y;
        const dz = pos.z - zonePos.z;
        if (
          Math.abs(dx) < zoneSize[0] / 2 &&
          Math.abs(dy - 0.5) < zoneSize[1] / 2 &&
          Math.abs(dz) < zoneSize[2] / 2
        ) {
          windForceX += zoneForce[0] * 0.12;
          windForceZ += zoneForce[2] * 0.12;
        }
      }
    });

    // AI Multi-mode Steering logic
    let steerDir = new THREE.Vector3(0, 0, 0);
    let shouldJump = false;

    if (currentLevelType === 'RACE' || currentLevelId === 'logic_2' || currentLevelId === 'final_2') {
      // Path steering for races and courses
      let pathNodes = LEVEL_PATHS[currentLevelId] || LEVEL_1_MIDDLE_PATH;
      if (currentLevelId === 'race_1') {
        pathNodes = botPath.current;
      }
      const targetNode = pathNodes[currentNodeIndex.current];

      if (targetNode) {
        const targetPos = new THREE.Vector3(...targetNode).add(targetOffset.current);
        
        // Dynamically split bots to left/right large Jump Pads at Z = 47.0
        if (Math.abs(targetNode[2] - 47.0) < 0.1) {
          targetPos.x = botIndex % 2 === 0 ? -2.2 : 2.2;
        }
        
        // Dynamically adjust Route Choice on node 16 (which is index 16)
        if (currentLevelId === 'race_1' && currentNodeIndex.current === 999) {
          if (difficulty === 'HARD') {
            targetPos.x = -6.0; // Narrow beam shortcut
          } else if (difficulty === 'EASY') {
            targetPos.x = 4.0;  // Wide safe path
          } else {
            // Medium bots decide based on bot ID
            const botIdx = parseInt(id.replace('bot_', '')) || 0;
            targetPos.x = botIdx % 2 === 0 ? -6.0 : 4.0;
          }
        }

        const dist = new THREE.Vector3(pos.x, pos.y, pos.z).distanceTo(targetPos);

        if (dist < 1.3 && currentNodeIndex.current < pathNodes.length - 1) {
          currentNodeIndex.current++;
          const widthSpread = difficulty === 'EASY' ? 1.4 : difficulty === 'MEDIUM' ? 0.7 : 0.2;
          targetOffset.current.set(
            (Math.random() - 0.5) * widthSpread,
            0,
            (Math.random() - 0.5) * widthSpread
          );
        }

        steerDir.subVectors(targetPos, new THREE.Vector3(pos.x, pos.y, pos.z));
        steerDir.y = 0;
        steerDir.normalize();

        // Qualify finish check
        if (currentNodeIndex.current === pathNodes.length - 1 && dist < 1.4) {
          setIsQualified(true);
          qualifyBot(id);
          rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
          return;
        }
      }
    } else if (currentLevelId === 'survival_1') {
      // Spinning sweeper: run in a slow circle around center
      const botIdx = parseInt(id.replace('bot_', '')) || 0;
      const time = state.clock.getElapsedTime();
      const radius = 3.5 + (botIdx % 3) * 0.8;
      const angle = time * 0.35 + (botIdx * Math.PI / 4.5);
      const targetPos = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

      steerDir.subVectors(targetPos, new THREE.Vector3(pos.x, pos.y, pos.z));
      steerDir.y = 0;
      steerDir.normalize();
    } else if (currentLevelId === 'survival_2') {
      // Lava platform climb
      const botIdx = parseInt(id.replace('bot_', '')) || 0;
      const cycle = state.clock.getElapsedTime() % 8;
      const isLavaThreat = cycle > 2.0;

      if (isLavaThreat) {
        // Run to designated safe pillar
        const pillars: [number, number, number][] = [
          [-5, 1.8, -5],
          [5, 1.8, -5],
          [-5, 1.8, 5],
          [5, 1.8, 5],
        ];
        const targetPillar = pillars[botIdx % 4];
        const targetPos = new THREE.Vector3(...targetPillar);

        steerDir.subVectors(targetPos, new THREE.Vector3(pos.x, pos.y, pos.z));
        steerDir.y = 0;
        steerDir.normalize();

        // Jump if near the pillar base to climb it
        const flatDist = new THREE.Vector2(pos.x - targetPillar[0], pos.z - targetPillar[2]).length();
        if (flatDist < 2.0 && pos.y < 1.4 && isGroundedRef.current && jumpCooldown.current <= 0) {
          shouldJump = true;
        }
      } else {
        // Chill near center starting deck
        const targetPos = new THREE.Vector3(0, 1.2, 0);
        steerDir.subVectors(targetPos, new THREE.Vector3(pos.x, pos.y, pos.z));
        steerDir.y = 0;
        steerDir.normalize();
      }
    } else if (currentLevelId === 'logic_1') {
      // Memory color blocks
      const botIdx = parseInt(id.replace('bot_', '')) || 0;
      const cycle = state.clock.getElapsedTime() % 7;
      const isDangerNear = cycle > 2.5;

      const colorsPos = {
        RED: [
          [-2.6, 0, -2.6],
          [0, 0, 0],
          [2.6, 0, 2.6]
        ],
        GREEN: [
          [0, 0, -2.6],
          [-2.6, 0, 2.6],
          [2.6, 0, 0]
        ],
        BLUE: [
          [2.6, 0, -2.6],
          [-2.6, 0, 0],
          [0, 0, 2.6]
        ]
      };

      const cycleCount = Math.floor(state.clock.getElapsedTime() / 7);
      const randomSeed = Math.sin(botIdx * 45 + cycleCount) * 10;
      const isConfused = (difficulty === 'EASY' && (randomSeed % 1) < 0.28) || (difficulty === 'MEDIUM' && (randomSeed % 1) < 0.12);

      let targetColor = activeColorPattern;
      if (isConfused && isDangerNear) {
        // Run to a wrong color tile!
        targetColor = activeColorPattern === 'RED' ? 'BLUE' : 'RED';
      }

      const activeColorTiles = colorsPos[targetColor as keyof typeof colorsPos] || colorsPos.RED;
      const targetTile = activeColorTiles[botIdx % activeColorTiles.length];
      const targetPos = new THREE.Vector3(...targetTile);

      steerDir.subVectors(targetPos, new THREE.Vector3(pos.x, pos.y, pos.z));
      steerDir.y = 0;
      steerDir.normalize();
    } else if (currentLevelId === 'hunt_1') {
      // Star Hunt: find closest active star in 3D scene
      const stars = state.scene.children.filter((child) => child.name === 'star');
      let closestStar: THREE.Object3D | null = null;
      let minDist = 9999;

      stars.forEach((star) => {
        const starPos = new THREE.Vector3();
        star.getWorldPosition(starPos);
        const dist = new THREE.Vector3(pos.x, pos.y, pos.z).distanceTo(starPos);
        if (dist < minDist) {
          minDist = dist;
          closestStar = star;
        }
      });

      if (closestStar) {
        const targetPos = new THREE.Vector3();
        (closestStar as THREE.Object3D).getWorldPosition(targetPos);
        steerDir.subVectors(targetPos, new THREE.Vector3(pos.x, pos.y, pos.z));
        steerDir.y = 0;
        steerDir.normalize();

        const flatDist = new THREE.Vector2(pos.x - targetPos.x, pos.z - targetPos.z).length();
        if (flatDist < 1.0 && targetPos.y > pos.y + 1.2 && isGroundedRef.current && jumpCooldown.current <= 0) {
          shouldJump = true;
        }
      } else {
        const targetPos = new THREE.Vector3(0, 0, 0);
        steerDir.subVectors(targetPos, new THREE.Vector3(pos.x, pos.y, pos.z));
        steerDir.y = 0;
        steerDir.normalize();
      }
    } else if (currentLevelId === 'final_1') {
      // Honeycomb hex collapse
      let closestHex: THREE.Object3D | null = null;
      let minDist = 9999;

      state.scene.traverse((child) => {
        if (child.userData && child.userData.active === true) {
          const hexPos = new THREE.Vector3();
          child.getWorldPosition(hexPos);
          if (hexPos.y <= pos.y + 0.3 && hexPos.y >= pos.y - 4.0) {
            const dist = new THREE.Vector3(pos.x, pos.y, pos.z).distanceTo(hexPos);
            if (dist < minDist) {
              minDist = dist;
              closestHex = child;
            }
          }
        }
      });

      if (closestHex) {
        const targetPos = new THREE.Vector3();
        (closestHex as THREE.Object3D).getWorldPosition(targetPos);
        steerDir.subVectors(targetPos, new THREE.Vector3(pos.x, pos.y, pos.z));
        steerDir.y = 0;
        steerDir.normalize();

        const flatDist = new THREE.Vector2(pos.x - targetPos.x, pos.z - targetPos.z).length();
        if (flatDist > 0.8 && flatDist < 2.5 && isGroundedRef.current && jumpCooldown.current <= 0) {
          shouldJump = true;
        }
      }
    }

    // Add waddle steering drift
    if (steerDir.lengthSq() > 0.01) {
      const botIdx = parseInt(id.replace('bot_', '')) || 0;
      const clockTime = state.clock.getElapsedTime();
      const waddleSpeed = 5.0 + (botIdx % 3) * 1.2;
      const waddleAmp = 0.12 + (botIdx % 2) * 0.06;
      
      const lateralDir = new THREE.Vector3(-steerDir.z, 0, steerDir.x);
      steerDir.addScaledVector(lateralDir, Math.sin(clockTime * waddleSpeed) * waddleAmp);
      steerDir.normalize();
    }

    // 5. Jump decision logic

    // A. Forward-Downward Raycast sensor for Gap/Void detection
    const forwardOffset = steerDir.clone().multiplyScalar(0.5);
    const forwardRayOrigin = new THREE.Vector3(pos.x + forwardOffset.x, pos.y - 0.51, pos.z + forwardOffset.z);
    const forwardRay = new rapier.Ray(forwardRayOrigin, { x: 0, y: -1, z: 0 });
    const forwardHit = world.castRay(forwardRay, 0.5, true);
    
    if (forwardHit === null && isGroundedRef.current && jumpCooldown.current <= 0) {
      shouldJump = true;
    }

    // B. Obstacle sweeper jumping with timing checks (dodging approaching arms)
    const sweepers = state.scene.children.filter((child) => child.name === 'rotating-arm');
    sweepers.forEach((sweeper) => {
      const sweeperPos = new THREE.Vector3();
      sweeper.getWorldPosition(sweeperPos);
      const dist = new THREE.Vector3(pos.x, pos.y, pos.z).distanceTo(sweeperPos);
      
      if (dist < 3.2 && jumpCooldown.current <= 0) {
        const botAngle = Math.atan2(pos.x - sweeperPos.x, pos.z - sweeperPos.z);
        const sweepRot = sweeper.rotation.y;
        let angleDiff = Math.abs(sweepRot - botAngle);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        angleDiff = Math.abs(angleDiff);

        if (angleDiff < 0.8 && Math.random() < (difficulty === 'EASY' ? 0.5 : difficulty === 'MEDIUM' ? 0.8 : 0.98)) {
          shouldJump = true;
        }
      }
    });

    // C. Mid-air recovery jumping (double jump if falling)
    const currentVelY = rb.linvel().y;
    if (!isGroundedRef.current && currentVelY < -0.2 && jumpCountRef.current === 1 && jumpCooldown.current <= 0) {
      if (Math.random() < (difficulty === 'EASY' ? 0.2 : difficulty === 'MEDIUM' ? 0.6 : 0.9)) {
        shouldJump = true;
      }
    }

    // D. Stuck check / Barrier hopping
    const displacement = new THREE.Vector2(pos.x - lastPosRef.current.x, pos.z - lastPosRef.current.z).length();
    if (displacement < 0.02 && steerDir.lengthSq() > 0.01) {
      stuckTimeRef.current += delta;
      if (stuckTimeRef.current > 0.35 && isGroundedRef.current && jumpCooldown.current <= 0) {
        shouldJump = true;
        stuckTimeRef.current = 0;
      }
    } else {
      stuckTimeRef.current = 0;
    }
    lastPosRef.current.set(pos.x, pos.y, pos.z);

    // E. Level-Specific Jump Triggers (e.g. Launch pads)
    if (currentLevelId === 'race_1') {
      // Hurdle at [0, 0.25, 8.5]
      if (pos.z > 6.8 && pos.z < 9.0 && jumpCooldown.current <= 0) {
        shouldJump = true;
      }
      // Vertical climb Storey 1 -> Storey 2
      if (pos.z > 63.5 && pos.z < 66.0 && jumpCooldown.current <= 0) {
        shouldJump = true;
      }
      // Vertical climb Storey 2 -> Storey 3
      if (pos.z > 71.5 && pos.z < 74.0 && jumpCooldown.current <= 0) {
        shouldJump = true;
      }
      // Vertical climb Storey 3 -> Storey 4
      if (pos.z > 77.5 && pos.z < 80.0 && jumpCooldown.current <= 0) {
        shouldJump = true;
      }
    } else if (currentLevelId === 'race_2') {
      if (pos.z > 69.5 && pos.z < 72.5 && Math.abs(pos.x) < 1.0 && jumpCooldown.current <= 0) {
        shouldJump = true;
      }
    } else if (currentLevelId === 'final_2') {
      if (pos.z > 16.5 && pos.z < 19.5 && jumpCooldown.current <= 0) {
        shouldJump = true;
      }
      if (pos.z > 22.5 && pos.z < 25.5 && jumpCooldown.current <= 0) {
        shouldJump = true;
      }
    }

    // Apply linear velocities
    const vel = rb.linvel();
    let moveTargetX = steerDir.x * activeSpeed;
    let moveTargetZ = steerDir.z * activeSpeed;
    let moveTargetY = vel.y;

    // Apply slight upward lift when bot is caught by strong wind
    if (Math.abs(windForceX) > 2.8) {
      moveTargetY += delta * 6.5;
    }

    if (shouldJump && jumpCooldown.current <= 0 && jumpCountRef.current < 2) {
      moveTargetY = jumpImpulse;
      jumpCooldown.current = 0.5;
      jumpCountRef.current++;
    }

    const nextVelX = THREE.MathUtils.lerp(vel.x, moveTargetX + windForceX, accelerationRatio);
    const nextVelZ = THREE.MathUtils.lerp(vel.z, moveTargetZ + windForceZ + conveyorSpeed, accelerationRatio);

    // Apply snappy downward gravity when falling
    if (moveTargetY < 0) {
      moveTargetY -= delta * 14.0;
      moveTargetY = Math.max(moveTargetY, -20.0);
    }

    rb.setLinvel({ x: nextVelX, y: moveTargetY, z: nextVelZ }, true);

    // Update trail mesh visibility and color dynamically
    if (trailMeshRef.current) {
      const showTrail = isNitroActive.current || isSliding;
      trailMeshRef.current.visible = showTrail;
      if (showTrail) {
        let colorStr = "#ff007f"; // pink nitro
        if (!isNitroActive.current) {
          if (pos.x < -2.0) {
            colorStr = "#0066ff"; // water slide (blue)
          } else if (pos.x > 2.0) {
            colorStr = "#ffffff"; // ice slide (white)
          } else {
            colorStr = "#ffd60a"; // rainbow slide (gold)
          }
        }
        (trailMeshRef.current.material as THREE.MeshBasicMaterial).color.set(colorStr);
      }
    }

    // Rotate bot visual mesh
    if (steerDir.lengthSq() > 0.01 && visualGroupRef.current) {
      const targetRot = Math.atan2(steerDir.x, steerDir.z);
      let diff = targetRot - visualGroupRef.current.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      visualGroupRef.current.rotation.y += diff * Math.min(1.0, 10.0 * delta);
    }

    // Track landing squish
    const justLanded = isGroundedRef.current && !wasGrounded.current;
    wasGrounded.current = isGroundedRef.current;
    if (justLanded) {
      landingSquish.current = 0.35;
    }
    landingSquish.current = THREE.MathUtils.lerp(landingSquish.current, 0, delta * 12.0);

    // Leg/arm swing waddles
    const speed = new THREE.Vector3(vel.x, 0, vel.z).length();
    const visual = visualGroupRef.current;
    const lLeg = leftLegRef.current;
    const rLeg = rightLegRef.current;
    const lArm = leftArmRef.current;
    const rArm = rightArmRef.current;

    if (visual && lLeg && rLeg && lArm && rArm) {
      const squishXZ = 1.0 + landingSquish.current * 0.4;
      const squishY = 1.0 - landingSquish.current * 0.75;
      visual.scale.set(0.6 * squishXZ, 0.6 * squishY, 0.6 * squishXZ);
      visual.rotation.x = 0;
      visual.rotation.z = 0;
      lLeg.rotation.set(0, 0, 0);
      rLeg.rotation.set(0, 0, 0);
      lArm.rotation.set(0, 0, 0.15);
      rArm.rotation.set(0, 0, -0.15);
      visual.position.y = -0.12;

      if (Math.abs(windForceX) > 0.4) {
        const absWindX = Math.abs(windForceX);
        const clockTime = state.clock.getElapsedTime();
        
        // 1. Lean into the wind to fight it
        visual.rotation.z = -windForceX * 0.055;
        
        // 2. Wobble side-to-side losing balance
        const wobble = Math.sin(clockTime * 18.0) * 0.08 * (absWindX / 3.0);
        visual.rotation.x = wobble;
        
        // 3. Feet slide across platform: slide wobble offset
        visual.position.x = Math.cos(clockTime * 22.0) * 0.04 * (absWindX / 2.0);
        
        // 4. Arms & legs flailing frantically
        const flailTime = clockTime * 28.0;
        lArm.rotation.set(-Math.PI / 4, 0.4, -Math.PI / 2.5 + Math.sin(flailTime) * 0.65);
        rArm.rotation.set(-Math.PI / 4, -0.4, Math.PI / 2.5 + Math.cos(flailTime) * 0.65);
        lLeg.rotation.x = Math.sin(flailTime) * 0.4;
        rLeg.rotation.x = Math.cos(flailTime) * 0.4;

        if (!isGroundedRef.current && absWindX > 2.0) {
          // Mid-air tumble: spin visual group continuously
          const spinSpeed = clockTime * 4.2;
          visual.rotation.z = spinSpeed * Math.sign(windForceX);
          visual.rotation.x = spinSpeed * 0.55;
        }
      } else if (isSliding) {
        // Slide pose: lean forward, arms out, feet back
        visual.rotation.x = Math.PI / 4.5;
        lLeg.rotation.x = 0.4;
        rLeg.rotation.x = 0.4;
        lArm.rotation.set(-0.4, 0, 0.5);
        rArm.rotation.set(-0.4, 0, -0.5);
        visual.position.y = -0.2;
      } else if (!isGroundedRef.current) {
        visual.scale.set(0.54, 0.69, 0.54);
        const flail = 22;
        lLeg.rotation.x = Math.sin(state.clock.getElapsedTime() * flail) * 0.5;
        rLeg.rotation.x = Math.cos(state.clock.getElapsedTime() * flail) * 0.5;
        lArm.rotation.z = -Math.PI/3 + Math.sin(state.clock.getElapsedTime() * flail) * 0.4;
        rArm.rotation.z = Math.PI/3 + Math.cos(state.clock.getElapsedTime() * flail) * 0.4;
      } else if (speed > 0.1) {
        const walkRunBlend = Math.min(1.0, speed / 4.8);
        const waddleFreq = 5.0 + walkRunBlend * 10.0;
        const legSwing = Math.sin(state.clock.getElapsedTime() * waddleFreq) * 0.55 * walkRunBlend;
        const armSwing = Math.sin(state.clock.getElapsedTime() * waddleFreq) * 0.6 * walkRunBlend;

        lLeg.rotation.x = legSwing;
        rLeg.rotation.x = -legSwing;
        lArm.rotation.x = -armSwing;
        rArm.rotation.x = armSwing;
        
        visual.position.y = -0.12 + Math.abs(Math.sin(state.clock.getElapsedTime() * waddleFreq)) * 0.12 * walkRunBlend;
        visual.rotation.z = Math.sin(state.clock.getElapsedTime() * waddleFreq) * 0.08 * walkRunBlend;
      } else {
        const breathing = 2.5;
        visual.position.y = -0.12 + Math.sin(state.clock.getElapsedTime() * breathing) * 0.03;
        lArm.rotation.z = -Math.sin(state.clock.getElapsedTime() * breathing) * 0.05 - 0.15;
        rArm.rotation.z = Math.sin(state.clock.getElapsedTime() * breathing) * 0.05 + 0.15;
      }
    }
  });

  if (isEliminated) return null;

  return (
    <RigidBody
      ref={rigidBodyRef}
      colliders={false}
      enabledRotations={[false, false, false]}
      name="bot"
      position={spawnPos}
      linearDamping={0.5}
      friction={0.6}
      restitution={0.1}
      userData={{ id }}
      onCollisionEnter={(event) => {
        const other = event.other.rigidBodyObject;
        if (other && (other.name === 'rotating-arm' || other.name === 'windmill-blade')) {
          const botPos = rigidBodyRef.current!.translation();
          const otherPos = other.position;
          const dir = new THREE.Vector3(botPos.x - otherPos.x, 0.2, botPos.z - otherPos.z).normalize();
          
          knockbackVelRef.current.copy(dir).multiplyScalar(8.5);
          knockbackTimerRef.current = 0.45;
          useGameStore.getState().triggerSplash([botPos.x, botPos.y, botPos.z], '#00e5ff'); // Blue splash!
        }
      }}
    >
      <CapsuleCollider args={[0.25, 0.24]} />

      <group ref={visualGroupRef} name="bot-visual" scale={[0.6, 0.6, 0.6]}>
        <mesh castShadow receiveShadow>
          <capsuleGeometry args={[0.4, 0.7, 10, 20]} />
          <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
        </mesh>

        {isNitroActive.current && (
          <group>
            {/* Glowing aura halo */}
            <mesh position={[0, 0.1, 0]}>
              <sphereGeometry args={[0.55, 12, 12]} />
              <meshBasicMaterial color="#ff007f" transparent opacity={0.2} wireframe />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
              <sphereGeometry args={[0.58, 10, 10]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.06} />
            </mesh>
          </group>
        )}

        <group position={[0, 0.28, 0.3]} scale={[1, 0.75, 1]}>
          <mesh>
            <sphereGeometry args={[0.22, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#fff" roughness={0.1} />
          </mesh>
          <mesh position={[-0.08, 0.05, 0.2]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color="#000" />
          </mesh>
          <mesh position={[0.08, 0.05, 0.2]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color="#000" />
          </mesh>
        </group>

        <group ref={leftArmRef} position={[-0.45, 0.1, 0]}>
          <mesh castShadow><capsuleGeometry args={[0.08, 0.2, 8, 8]} /><meshStandardMaterial color={color} /></mesh>
        </group>
        <group ref={rightArmRef} position={[0.45, 0.1, 0]}>
          <mesh castShadow><capsuleGeometry args={[0.08, 0.2, 8, 8]} /><meshStandardMaterial color={color} /></mesh>
        </group>
        <group ref={leftLegRef} position={[-0.2, -0.65, 0]}>
          <mesh castShadow><capsuleGeometry args={[0.1, 0.15, 8, 8]} /><meshStandardMaterial color={color} /></mesh>
        </group>
        <group ref={rightLegRef} position={[0.2, -0.65, 0]}>
          <mesh castShadow><capsuleGeometry args={[0.1, 0.15, 8, 8]} /><meshStandardMaterial color={color} /></mesh>
        </group>

        {accessory === 'crown' && (
          <group position={[0, 0.72, 0]}>
            <mesh castShadow><cylinderGeometry args={[0.22, 0.2, 0.15, 12]} /><meshStandardMaterial color="#ffd700" metalness={0.8} /></mesh>
            <mesh castShadow position={[0, 0.1, 0]}><coneGeometry args={[0.22, 0.12, 12, 1, true]} /><meshStandardMaterial color="#ffd700" metalness={0.8} /></mesh>
          </group>
        )}
        {accessory === 'party' && (
          <mesh position={[0, 0.8, 0.05]} rotation={[-0.2, 0, 0]} castShadow>
            <coneGeometry args={[0.16, 0.35, 12]} />
            <meshStandardMaterial color="#00ffff" roughness={0.4} />
          </mesh>
        )}
        {accessory === 'glasses' && (
          <group position={[0, 0.3, 0.49]}>
            <mesh><boxGeometry args={[0.36, 0.06, 0.04]} /><meshStandardMaterial color="#000" /></mesh>
            <mesh position={[-0.08, -0.02, 0.01]}><boxGeometry args={[0.12, 0.08, 0.02]} /><meshStandardMaterial color="#ff007f" transparent opacity={0.8} /></mesh>
            <mesh position={[0.08, -0.02, 0.01]}><boxGeometry args={[0.12, 0.08, 0.02]} /><meshStandardMaterial color="#ff007f" transparent opacity={0.8} /></mesh>
          </group>
        )}

      </group>

      <mesh ref={trailMeshRef} position={[0, -0.4, -0.3]} visible={false}>
        <boxGeometry args={[0.4, 0.05, 0.6]} />
        <meshBasicMaterial transparent opacity={0.65} />
      </mesh>

      {/* Billboard name label above bot head */}
      <Billboard position={[0, 0.9, 0]}>
        <Text
          ref={nameLabelRef}
          fontSize={0.20}
          color={color}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.008}
          outlineColor="#000000"
          renderOrder={999}
          depthOffset={-1}
        >
          {name}
        </Text>
      </Billboard>
    </RigidBody>
  );
};
