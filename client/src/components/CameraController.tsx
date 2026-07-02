import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';

export const CameraController: React.FC = () => {
  const { camera, gl } = useThree();
  const phase = useGameStore((state) => state.phase);

  // Camera angles in radians
  const yaw = useRef(0);   // Horizontal rotation
  const pitch = useRef(-0.3); // Vertical rotation (tilt down slightly)
  
  // Track pointer lock status
  const isLocked = useRef(false);

  // Sensitivity
  const sensitivity = 0.002;
  const minPitch = -Math.PI / 3; // Look up limit
  const maxPitch = Math.PI / 6;  // Look down limit
  
  // Camera zoom distance
  const currentDistance = useRef(4.0);
  const targetDistance = 4.0;

  useEffect(() => {
    if (phase !== 'PLAYING') {
      // Release cursor if menu is active
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock();
      }
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isLocked.current) return;

      yaw.current -= e.movementX * sensitivity;
      pitch.current -= e.movementY * sensitivity;

      // Restrict vertical rotation to avoid flipping upside down
      pitch.current = Math.max(minPitch, Math.min(maxPitch, pitch.current));
    };

    const handlePointerLockChange = () => {
      isLocked.current = document.pointerLockElement === gl.domElement;
    };

    const handleCanvasClick = () => {
      if (phase === 'PLAYING') {
        gl.domElement.requestPointerLock();
      }
    };

    gl.domElement.addEventListener('click', handleCanvasClick);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    return () => {
      gl.domElement.removeEventListener('click', handleCanvasClick);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [phase, gl.domElement]);

  useFrame((state) => {
    // Find the player object by name
    const playerMesh = state.scene.getObjectByName('player-visual');
    if (!playerMesh) return;

    const playerQualified = useGameStore.getState().playerQualified;
    let targetMesh = playerMesh;

    if (playerQualified) {
      const bots: THREE.Object3D[] = [];
      state.scene.traverse((child) => {
        if (child.name === 'bot-visual') {
          bots.push(child);
        }
      });
      if (bots.length > 0) {
        targetMesh = bots[0];
      }
    }

    // Get position of target mesh
    const targetPos = new THREE.Vector3();
    targetMesh.getWorldPosition(targetPos);

    // Camera target (look at target's head area)
    const targetLookAt = targetPos.clone().add(new THREE.Vector3(0, 0.6, 0));

    // Calculate camera offset using spherical coordinates
    const offset = new THREE.Vector3();
    const radius = currentDistance.current;

    // Math check:
    // x = r * cos(pitch) * sin(yaw)
    // y = r * sin(-pitch) // Negative because pitch goes up
    // z = r * cos(pitch) * cos(yaw)
    offset.x = radius * Math.cos(pitch.current) * Math.sin(yaw.current);
    offset.y = radius * Math.sin(-pitch.current);
    offset.z = radius * Math.cos(pitch.current) * Math.cos(yaw.current);

    // Smooth distance zoom adjustments (e.g. if we want camera collision later)
    currentDistance.current += (targetDistance - currentDistance.current) * 0.1;

    // Target position of the camera
    const targetCamPos = targetPos.clone().add(offset);

    // Simple camera height buffer so it doesn't clip below floor (e.g. if floor is at y=0, camera stays above y=0.3)
    if (targetCamPos.y < targetPos.y + 0.3) {
      targetCamPos.y = targetPos.y + 0.3;
    }

    // Smoothly lerp camera position
    camera.position.lerp(targetCamPos, 0.12);

    // Smoothly update what the camera looks at
    const currentLookTarget = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
    currentLookTarget.lerp(targetLookAt, 0.15);
    camera.lookAt(currentLookTarget);
  });

  return null;
};
