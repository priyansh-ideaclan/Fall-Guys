import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { getThemeConfig } from '../../utils/themeManager';

// --- SURVIVAL 1: SPINNING SWEEPER ARENA ---
export const Survival1: React.FC = () => {
  const timeElapsed = useGameStore((state) => state.timeElapsed);
  const theme = useGameStore((state) => state.visualTheme);
  const config = getThemeConfig(theme);
  const eliminateRacer = useGameStore((state) => state.eliminateRacer);
  const phase = useGameStore((state) => state.phase);

  const sweeperRbRef = useRef<RapierRigidBody>(null);
  const startRotation = useRef(0);

  useFrame((state, delta) => {
    const rb = sweeperRbRef.current;
    if (!rb) return;

    // Sweeper speeds up as round progress
    const baseSpeed = 2.0;
    const accel = (timeElapsed || 0) * 0.15;
    const currentSpeed = baseSpeed + accel;

    startRotation.current += currentSpeed * delta;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), startRotation.current);
    rb.setNextKinematicRotation(q);
  });

  // Kill zone sensor callback — eliminate whoever falls below the arena
  const handleKillZone = (event: any) => {
    if (phase !== 'PLAYING') return;
    const rb = event.rigidBodyObject;
    if (!rb) return;
    if (rb.name === 'player') {
      eliminateRacer('player');
    } else if (rb.name === 'bot') {
      const botId = rb.userData?.id;
      if (botId) eliminateRacer(botId);
    }
  };

  return (
    <group name="survival_1">
      <RigidBody type="fixed" colliders={false} friction={0.7}>
        <CylinderCollider args={[0.4, 8.0]} position={[0, -0.4, 0]} />
        <mesh receiveShadow position={[0, -0.4, 0]}>
          <cylinderGeometry args={[8, 8, 0.8, 24]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.6} />
        </mesh>
      </RigidBody>

      {/* Decorative center column */}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.0, 0.8]} position={[0, 0.5, 0]} />
        <mesh castShadow position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.6, 0.8, 1.0, 12]} />
          <meshStandardMaterial color="#333333" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Kinematic Spinning Sweeper Bar */}
      <RigidBody ref={sweeperRbRef} type="kinematicPosition" colliders={false} restitution={1.3} friction={0.5}>
        {/* Collision box for sweeping bar */}
        <CuboidCollider args={[7.2, 0.3, 0.15]} position={[0, 0.35, 0]} />
        {/* Double-sided sweeping arm mesh */}
        <mesh castShadow position={[0, 0.35, 0]}>
          <boxGeometry args={[14.4, 0.5, 0.3]} />
          <meshStandardMaterial color={config.obstacleColor1} roughness={0.2} emissive={config.obstacleColor1} emissiveIntensity={0.3} />
        </mesh>
      </RigidBody>

      {/* Outer barrier rings for visuals */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[8.5, 9.2, 24]} />
        <meshStandardMaterial color={config.accentColor} roughness={0.4} />
      </mesh>

      {/* KILL ZONE — wide sensor below the arena, eliminates anyone who falls */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[30, 0.5, 30]}
          position={[0, -3.5, 0]}
          sensor
          onIntersectionEnter={handleKillZone}
        />
      </RigidBody>
    </group>
  );
};


