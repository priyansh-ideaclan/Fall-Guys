import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { audioManager } from '../utils/audioManager';

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
  'survival_1': [0, 4, 0],
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
    if (!playerMesh) return;

    const playerQualified = useGameStore.getState().playerQualified;

    // Keep camera targeted on player mesh throughout finish celebration
    let targetMesh = playerMesh;

    const playerPos = new THREE.Vector3();
    targetMesh.getWorldPosition(playerPos);

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
        // Fly backwards from finish line (Z = 145) to start line (Z = -5)
        const zPos = 145.0 * (1 - t) - 5.0 * t;
        const yPos = 8.5 * (1 - t) + 3.8 * t;
        
        let xPos = 0;
        if (zPos > 120) {
          xPos = 0;
        } else if (zPos > 106) {
          xPos = -3 * ((zPos - 106) / 14); // transition from -6 to 0
        } else if (zPos > 72) {
          xPos = -6; // Wind zone and balance beam
        } else if (zPos > 60) {
          xPos = -6 + (12 - (zPos - 60)) * 10/12; // transition
        } else if (zPos > 44) {
          xPos = 4; // Moving platforms
        } else if (zPos > 32) {
          xPos = -6 + ((zPos - 32) / 12) * 10; // transition from -6 to 4
        } else if (zPos > 15) {
          xPos = -6; // Hurdle 2 & sweepers
        } else {
          xPos = -6 * (zPos / 15); // transition from 0 to -6
        }

        flyCamPos.set(xPos, yPos + 3.5, zPos);
        flyLookAt.set(xPos, yPos, zPos + 10.0 * (1 - t) - 4.0 * t);
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
      const followTarget = computeFollowCamPos(playerPos, yaw.current, pitch.current);
      const followLook = playerPos.clone().add(new THREE.Vector3(0, 0.5, 0));

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

    const targetCamPos  = computeFollowCamPos(
      playerPos,
      yaw.current,
      pitch.current,
      (nitroEffectVal.current * 1.5) + (isPlayerSliding ? 2.5 : 0.0)
    );
    const targetLookAt  = playerPos.clone().add(new THREE.Vector3(0, 0.5, 0));

    // Floor clip prevention
    if (targetCamPos.y < playerPos.y + 0.4) {
      targetCamPos.y = playerPos.y + 0.4;
    }

    const tPos = Math.min(1.0, 7.0 * delta);
    const tLook = Math.min(1.0, 9.0 * delta);
    smoothCamPos.current.lerp(targetCamPos, tPos);
    smoothLookAt.current.lerp(targetLookAt, tLook);

    camera.position.copy(smoothCamPos.current);
    camera.lookAt(smoothLookAt.current);

    // Dynamic speed shake vibration during boost
    if (nitroEffectVal.current > 0.05) {
      const shake = nitroEffectVal.current * 0.035;
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      camera.position.z += (Math.random() - 0.5) * shake;
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
  extraDist: number = 0
): THREE.Vector3 {
  const dist = FOLLOW_DISTANCE + extraDist;
  const x = dist * Math.cos(pitch) * Math.sin(yaw);
  const y = FOLLOW_HEIGHT   + dist * Math.sin(-pitch);
  const z = dist * Math.cos(pitch) * Math.cos(yaw);
  return playerPos.clone().add(new THREE.Vector3(x, y, z));
}
