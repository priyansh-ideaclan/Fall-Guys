import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { audioManager } from '../utils/audioManager';

// Predefined spline points for Level 1 camera flyover path (flying backwards from finish to start)
const LEVEL_1_CAM_POINTS = [
  new THREE.Vector3(0, 11, 130),
  new THREE.Vector3(6, 9, 102),
  new THREE.Vector3(-4, 13, 76),
  new THREE.Vector3(5, 12, 54),
  new THREE.Vector3(0, 4.5, -5.5)
];

const LEVEL_1_LOOK_POINTS = [
  new THREE.Vector3(0, 4, 115),
  new THREE.Vector3(-2, 4.5, 95),
  new THREE.Vector3(0, 8, 68),
  new THREE.Vector3(0, 6, 45),
  new THREE.Vector3(0, 0.8, 6.0)
];

const level1CamCurve = new THREE.CatmullRomCurve3(LEVEL_1_CAM_POINTS);
const level1LookCurve = new THREE.CatmullRomCurve3(LEVEL_1_LOOK_POINTS);

// ─── Constants ────────────────────────────────────────────────────────────────

/** Distance from player the follow-cam sits */
const FOLLOW_DISTANCE = 6.0;

/** How high above the player the follow-cam sits (metres) */
const FOLLOW_HEIGHT = 2.4;

/** How quickly the follow-cam position lerps to its target (per frame) */
const FOLLOW_POS_LERP = 0.10;

/** How quickly the look-at point lerps (per frame) */
const FOLLOW_LOOK_LERP = 0.12;

/** How quickly yaw auto-rotates to face the player's movement direction */
const YAW_AUTO_LERP = 0.05;

/** Mouse sensitivity */
const MOUSE_SENSITIVITY = 0.0022;

/** Pitch limits (radians) */
const PITCH_MIN = -Math.PI / 2.8; // ~64° — look up
const PITCH_MAX = Math.PI / 5;    // ~36° — look down

/** Duration (seconds) of the cinematic flyover intro */
const FLYOVER_DURATION = 8.0;

/** Duration (seconds) of the blend from flyover/menu to starting follow-cam position */
const INTRO_BLEND_DURATION = 1.5;

/** Starting spawn points fallback lookup (should match useGameStore.ts) */
const SPAWN_POINTS: Record<string, [number, number, number]> = {
  'race_1': [0, 4, 0],
  'race_2': [0, 4, 0],
  'race_3': [0, 4, 0],
  'survival_1': [0, 4, 5.5],
  'survival_2': [0, 4, 0],
  'logic_1': [0, 2.5, -5.8],
  'logic_2': [0, 4, 0],
  'hunt_1': [0, 4, 0],
  'final_1': [0, 10, 0],
  'final_2': [0, 4, 0],
};

// ─── Component ────────────────────────────────────────────────────────────────

export const CameraController: React.FC = () => {
  const { camera, gl } = useThree();
  const phase = useGameStore((state) => state.phase);
  const currentLevelId = useGameStore((state) => state.currentLevelId);
  const cinematicActive = useGameStore((state) => state.cinematicActive);
  const setCinematicActive = useGameStore((state) => state.setCinematicActive);

  // ── Mouse-controlled yaw / pitch ──────────────────────────────────────────
  const yaw   = useRef(Math.PI);   // Start facing +Z (race direction)
  const pitch = useRef(-0.28);     // Slight downward tilt

  // ── Pointer lock ──────────────────────────────────────────────────────────
  const isLocked = useRef(false);

  // ── Cinematic flyover & Blend states ──────────────────────────────────────
  const flyoverTimer   = useRef(0);
  const blendTimer     = useRef(0);
  const isBlending     = useRef(false);
  const prevPhase      = useRef<string>('');
  const prevCinActive  = useRef<boolean>(false);

  // Snapshots for smooth blending
  const blendFromPos    = useRef(new THREE.Vector3());
  const blendFromLookAt = useRef(new THREE.Vector3());

  // ── Persistent smoothed values for the follow-cam ─────────────────────────
  const smoothCamPos    = useRef(new THREE.Vector3(0, 6, -10));
  const smoothLookAt    = useRef(new THREE.Vector3(0, 1, 0));
  const smoothedTargetPos = useRef(new THREE.Vector3());
  const nitroEffectVal  = useRef(0);
  const slideEffectVal  = useRef(0);
  const isNitroActive   = useGameStore((state) => state.isNitroActive);
  const isPlayerSliding = useGameStore((state) => state.isPlayerSliding);

  // ─────────────────────────────────────────────────────────────────────────
  // Key bindings to skip the cinematic flyover
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase === 'ROUND_INTRO' && useGameStore.getState().cinematicActive) {
        if (e.code === 'Space' || e.code === 'Escape') {
          e.preventDefault();
          audioManager.playClick();
          setCinematicActive(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, setCinematicActive]);

  // ─────────────────────────────────────────────────────────────────────────
  // Pointer lock setup / teardown
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'PLAYING') {
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock();
      }
      isLocked.current = false;
      return;
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isLocked.current || isBlending.current) return;
      yaw.current   -= e.movementX * MOUSE_SENSITIVITY;
      pitch.current -= e.movementY * MOUSE_SENSITIVITY;
      pitch.current  = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch.current));
    };

    const onLockChange = () => {
      isLocked.current = document.pointerLockElement === gl.domElement;
    };

    const onCanvasClick = () => {
      if (phase === 'PLAYING' && !isBlending.current) {
        gl.domElement.requestPointerLock();
      }
    };

    gl.domElement.addEventListener('click', onCanvasClick);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);

    return () => {
      gl.domElement.removeEventListener('click', onCanvasClick);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }, [phase, gl.domElement]);

  // ─────────────────────────────────────────────────────────────────────────
  // Detect phase / cinematicActive transitions
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // If entering a new round intro, reset flyover timer
    if (phase === 'ROUND_INTRO' && prevPhase.current !== 'ROUND_INTRO') {
      flyoverTimer.current = 0;
      isBlending.current   = false;
      blendTimer.current   = 0;
      yaw.current          = Math.PI;
      pitch.current        = -0.28;
    }

    // When cinematic ends/is skipped, transition smoothly to follow camera
    if (phase === 'ROUND_INTRO' && !cinematicActive && prevCinActive.current) {
      // Snapshot current camera position and direction to start the lerp blend
      blendFromPos.current.copy(camera.position);

      const lookDir = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .multiplyScalar(6)
        .add(camera.position);
      blendFromLookAt.current.copy(lookDir);

      isBlending.current = true;
      blendTimer.current = 0;
    }

    prevPhase.current = phase;
    prevCinActive.current = cinematicActive;
  }, [phase, cinematicActive, camera]);

  // ─────────────────────────────────────────────────────────────────────────
  // Main per-frame camera logic
  // ─────────────────────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const playerMesh = state.scene.getObjectByName('player-visual');
    const { isPlayerEliminated, activeBots, isSpectating, spectatingBotId, spectateNext } = useGameStore.getState();

    let targetMesh: THREE.Object3D | null = null;

    // Spectator mode: follow the designated bot
    if (isSpectating && spectatingBotId) {
      const isRace = useGameStore.getState().currentLevelType === 'RACE';
      const winners = useGameStore.getState().winnersList;

      // Auto-switch if the current spectated bot no longer exists in active bots
      // or if it has already qualified in a race round
      const stillActive = activeBots.some((b) => b.id === spectatingBotId) &&
                          (!isRace || !winners.includes(spectatingBotId));

      if (!stillActive && activeBots.length > 0) {
        spectateNext();
      }

      const targetId = useGameStore.getState().spectatingBotId;
      if (targetId) {
        state.scene.traverse((child) => {
          if (!targetMesh && child.userData && child.userData.id === targetId) {
            targetMesh = child;
          }
        });
      }
    }

    // Fallback: if player is eliminated and not spectating a bot, find first active bot
    if (!targetMesh && isPlayerEliminated && activeBots.length > 0 && !isSpectating) {
      const spectateId = activeBots[0].id;
      state.scene.traverse((child) => {
        if (!targetMesh && child.userData && child.userData.id === spectateId) {
          targetMesh = child;
        }
      });
    }

    // Default: follow the player
    if (!targetMesh) {
      targetMesh = playerMesh || null;
    }

    if (!targetMesh) return;

    const playerPos = new THREE.Vector3();
    targetMesh.getWorldPosition(playerPos);

    // Initialize or smoothly lerp the smoothedTargetPos to filter out physics tick jitter
    if (smoothedTargetPos.current.lengthSq() === 0) {
      smoothedTargetPos.current.copy(playerPos);
    } else {
      smoothedTargetPos.current.lerp(playerPos, Math.min(1.0, 18.0 * delta));
    }

    // ───────────────────────────────────────────────────────────────────────
    // 1. MENU PHASE: Smooth animated looping previews
    // ───────────────────────────────────────────────────────────────────────
    if (phase === 'MENU') {
      const time = state.clock.getElapsedTime();
      const menuCamPos = new THREE.Vector3();
      const menuLookAt = new THREE.Vector3();

      if (currentLevelId === 'race_1') {
        // Showcase hurdles and rotating sweepers
        const angle = time * 0.15;
        menuCamPos.set(Math.sin(angle) * 5, 4.2, 8 + Math.cos(angle) * 3);
        menuLookAt.set(0, 0.8, 12);
      } else if (currentLevelId === 'survival_1') {
        // Orbit the rotating sweepers
        const angle = time * 0.22;
        menuCamPos.set(Math.sin(angle) * 11, 4.8, Math.cos(angle) * 11);
        menuLookAt.set(0, 0.5, 0);
      } else if (currentLevelId === 'logic_1') {
        // Looking down at the logic grid tiles
        const angle = time * 0.18;
        menuCamPos.set(Math.sin(angle) * 6, 5.0, -5.8 + Math.cos(angle) * 6);
        menuLookAt.set(0, 0, -5.8);

      } else {
        // Fallback normal orbit
        const angle = time * 0.15;
        menuCamPos.set(Math.sin(angle) * 6, 4.5, Math.cos(angle) * 6);
        menuLookAt.set(0, 1, 0);
      }

      // Lerp transition between different menu level selections
      camera.position.lerp(menuCamPos, 0.05);

      const currentLook = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .multiplyScalar(5)
        .add(camera.position);
      currentLook.lerp(menuLookAt, 0.05);
      camera.lookAt(currentLook);

      smoothCamPos.current.copy(camera.position);
      smoothLookAt.current.copy(menuLookAt);
      return;
    }

    // ───────────────────────────────────────────────────────────────────────
    // 2. ROUND INTRO FLYOVER: Drone fly-through paths
    // ───────────────────────────────────────────────────────────────────────
    if (phase === 'ROUND_INTRO' && cinematicActive) {
      flyoverTimer.current += delta;
      
      // Auto-end flyover
      if (flyoverTimer.current >= FLYOVER_DURATION) {
        setCinematicActive(false);
        return;
      }

      const t = flyoverTimer.current / FLYOVER_DURATION;
      const flyCamPos = new THREE.Vector3();
      const flyLookAt = new THREE.Vector3();

      if (currentLevelId === 'race_1') {
        // Evaluate the smooth Catmull-Rom curves using a cubic smoothstep easing factor
        const easedT = t * t * (3 - 2 * t);
        flyCamPos.copy(level1CamCurve.getPoint(easedT));
        flyLookAt.copy(level1LookCurve.getPoint(easedT));
      } else if (currentLevelId === 'survival_1') {
        // Full circular orbit panning down
        const angle = t * Math.PI * 1.5;
        flyCamPos.set(Math.sin(angle) * 12, 6.0 - t * 2.0, Math.cos(angle) * 12);
        flyLookAt.set(0, 0.5, 0);
      } else if (currentLevelId === 'logic_1') {
        // Panning over the memory grid
        const xPos = -6 * (1 - t) + 6 * t;
        flyCamPos.set(xPos, 5.2, -5.8 + Math.cos(t * Math.PI) * 2.5);
        flyLookAt.set(0, 0, -5.8);
      } else if (currentLevelId === 'survival_2') {
        // Smooth spiral flyover showcasing the three hex tiers
        const angle = t * Math.PI * 1.8;
        const radius = 16.0 - t * 4.0;
        flyCamPos.set(Math.sin(angle) * radius, 14.0 - t * 7.5, Math.cos(angle) * radius);
        flyLookAt.set(0, 3.0 - t * 2.0, 0);
      } else {
        // Fallback flyover
        flyCamPos.set(0, 6, -10 + t * 20);
        flyLookAt.set(0, 1, 0);
      }

      camera.position.copy(flyCamPos);
      camera.lookAt(flyLookAt);

      smoothCamPos.current.copy(camera.position);
      smoothLookAt.current.copy(flyLookAt);
      return;
    }

    // ───────────────────────────────────────────────────────────────────────
    // 3. COUNTDOWN / START BLEND: Smooth camera glide behind player
    // ───────────────────────────────────────────────────────────────────────
    if (isBlending.current) {
      blendTimer.current += delta;
      const t = Math.min(blendTimer.current / INTRO_BLEND_DURATION, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // smooth step

      // Starting/follow-cam target
      const followTarget = computeFollowCamPos(smoothedTargetPos.current, yaw.current, pitch.current);
      const followLook = smoothedTargetPos.current.clone().add(new THREE.Vector3(0, 0.5, 0));

      const blendedPos    = blendFromPos.current.clone().lerp(followTarget, ease);
      const blendedLookAt = blendFromLookAt.current.clone().lerp(followLook, ease);

      camera.position.copy(blendedPos);
      camera.lookAt(blendedLookAt);

      smoothCamPos.current.copy(blendedPos);
      smoothLookAt.current.copy(blendedLookAt);

      if (t >= 1) {
        isBlending.current = false;
      }
      return;
    }

    // ───────────────────────────────────────────────────────────────────────
    // 4. GAMEPLAY FOLLOW: Standard stable third-person follow
    // ───────────────────────────────────────────────────────────────────────

    // Camera rotation is decoupled from character facing direction, preventing auto-spinning on S.

    const targetEffect = (phase === 'PLAYING' && isNitroActive) ? 1.0 : 0.0;
    const targetSlideEffect = (phase === 'PLAYING' && isPlayerSliding) ? 1.0 : 0.0;
    nitroEffectVal.current = THREE.MathUtils.lerp(nitroEffectVal.current, targetEffect, delta * 8);
    slideEffectVal.current = THREE.MathUtils.lerp(slideEffectVal.current, targetSlideEffect, delta * 6);

    // Apply dynamic FOV zoom (wider field of view during Nitro and Slide)
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = 60 + nitroEffectVal.current * 14 + slideEffectVal.current * 10; // FOV goes from 60 up to 84
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }

    // Dynamic camera height, pitch, and distance parameters for Hex-A-Terrestrial
    let customFollowDistance = FOLLOW_DISTANCE;
    let pitchOffset = 0;
    let heightOffset = 0;

    if (currentLevelId === 'survival_2') {
      // If player drops below top tier, pull camera closer and tilt it steeper to look down through upper shafts
      if (smoothedTargetPos.current.y < 5.5) {
        const dropFactor = Math.max(0, Math.min(1.0, (5.5 - smoothedTargetPos.current.y) / 6.5));
        customFollowDistance = FOLLOW_DISTANCE - dropFactor * 1.6; // camera gets closer (down to 4.4m)
        pitchOffset = -dropFactor * 0.45; // pitch down steeper (by ~25 deg)
        heightOffset = dropFactor * 0.9; // raise look down vantage point
      }
    }

    const targetCamPos  = computeFollowCamPos(
      smoothedTargetPos.current,
      yaw.current,
      pitch.current + pitchOffset,
      (nitroEffectVal.current * 1.5) + (isPlayerSliding ? 2.5 : 0.0) + (customFollowDistance - FOLLOW_DISTANCE),
      FOLLOW_HEIGHT + heightOffset
    );
    const targetLookAt  = smoothedTargetPos.current.clone().add(new THREE.Vector3(0, 0.5, 0));

    // Floor clip prevention
    if (targetCamPos.y < smoothedTargetPos.current.y + 0.4) {
      targetCamPos.y = smoothedTargetPos.current.y + 0.4;
    }

    const tPos = Math.min(1.0, 7.0 * delta);
    const tLook = Math.min(1.0, 9.0 * delta);
    smoothCamPos.current.lerp(targetCamPos, tPos);
    smoothLookAt.current.lerp(targetLookAt, tLook);

    camera.position.copy(smoothCamPos.current);
    camera.lookAt(smoothLookAt.current);

    // Dynamic speed shake vibration during boost + impact screen shake
    const { cameraShake, tickCameraShake } = useGameStore.getState();
    if (cameraShake > 0) {
      tickCameraShake(delta);
    }

    const totalShake = (nitroEffectVal.current * 0.035) + (cameraShake * 0.42);
    if (totalShake > 0.005) {
      camera.position.x += (Math.random() - 0.5) * totalShake;
      camera.position.y += (Math.random() - 0.5) * totalShake;
      camera.position.z += (Math.random() - 0.5) * totalShake;
    }

    // Dynamic camera occlusion detection (fades out tiles between camera and player)
    if (currentLevelId === 'survival_2') {
      const levelGroup = state.scene.getObjectByName('level4_hex');
      const hexMeshes: THREE.Mesh[] = [];
      if (levelGroup) {
        levelGroup.traverse((child) => {
          if (child.name === 'hextile' && child instanceof THREE.Mesh) {
            hexMeshes.push(child);
          }
        });
      }

      const camToPlayer = new THREE.Vector3().subVectors(playerPos, camera.position);
      const distanceToPlayer = camToPlayer.length();
      const rayDirection = camToPlayer.clone().normalize();

      // Raycast from camera to player
      const raycaster = new THREE.Raycaster(camera.position, rayDirection, 0.1, distanceToPlayer);
      const intersects = raycaster.intersectObjects(hexMeshes);

      const intersectedUUIDs = new Set<string>();
      intersects.forEach((hit) => {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && obj.name !== 'hextile') {
          obj = obj.parent;
        }
        if (obj) {
          intersectedUUIDs.add(obj.uuid);
        }
      });

      // Update materials opacities smoothly
      hexMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          if (intersectedUUIDs.has(mesh.uuid)) {
            mat.transparent = true;
            mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.20, delta * 12.0);
          } else {
            if (mat.opacity < 1.0) {
              mat.opacity = THREE.MathUtils.lerp(mat.opacity, 1.0, delta * 6.0);
              if (mat.opacity > 0.98) {
                mat.opacity = 1.0;
                mat.transparent = false;
              }
            }
          }
        }
      });
    }
  });

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: compute follow-cam position from player pos + angles
// ─────────────────────────────────────────────────────────────────────────────
function computeFollowCamPos(
  playerPos: THREE.Vector3,
  yaw: number,
  pitch: number,
  extraDist: number = 0,
  customHeight: number = FOLLOW_HEIGHT
): THREE.Vector3 {
  const dist = FOLLOW_DISTANCE + extraDist;
  const x = dist * Math.cos(pitch) * Math.sin(yaw);
  const y = customHeight + dist * Math.sin(-pitch);
  const z = dist * Math.cos(pitch) * Math.cos(yaw);
  return playerPos.clone().add(new THREE.Vector3(x, y, z));
}
