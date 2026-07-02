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
    </group>
  );
};

// --- SURVIVAL 2: RISING LAVA FLOODS ---
export const Survival2: React.FC = () => {
  const theme = useGameStore((state) => state.visualTheme);
  const config = getThemeConfig(theme);

  const lavaMeshRef = useRef<THREE.Mesh>(null);
  const [lavaWarning, setLavaWarning] = useState(false);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    // 8-second cycle: warning for 3s, high for 3s, low for 2s
    const cycle = time % 8;
    const isWarning = cycle > 2 && cycle <= 5;
    const isHigh = cycle > 5 || cycle <= 0.8;

    if (isWarning !== lavaWarning) {
      setLavaWarning(isWarning);
    }

    if (lavaMeshRef.current) {
      let targetY = -2.5; // low height
      if (isHigh) {
        targetY = 0.5; // high height
      } else if (isWarning) {
        // slightly rise and bubble as warning
        targetY = -1.2 + Math.sin(time * 25) * 0.1;
      }
      // Lerp transition
      lavaMeshRef.current.position.y = THREE.MathUtils.lerp(lavaMeshRef.current.position.y, targetY, 0.08);
    }
  });

  return (
    <group name="survival_2">
      {/* Center spawn deck (high, safe at start) */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.6}>
        <mesh receiveShadow position={[0, 1.2, 0]}>
          <boxGeometry args={[4, 0.6, 4]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.6} />
        </mesh>
      </RigidBody>

      {/* 4 Safe Pillars of varying heights */}
      {/* Top Left */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.8}>
        <mesh receiveShadow position={[-5, 1.8, -5]} castShadow>
          <boxGeometry args={[2.5, 4.0, 2.5]} />
          <meshStandardMaterial color={config.obstacleColor1} roughness={0.4} />
        </mesh>
      </RigidBody>
      {/* Top Right */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.8}>
        <mesh receiveShadow position={[5, 1.5, -5]} castShadow>
          <boxGeometry args={[2.5, 3.4, 2.5]} />
          <meshStandardMaterial color={config.accentColor} roughness={0.4} />
        </mesh>
      </RigidBody>
      {/* Bottom Left */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.8}>
        <mesh receiveShadow position={[-5, 1.5, 5]} castShadow>
          <boxGeometry args={[2.5, 3.4, 2.5]} />
          <meshStandardMaterial color={config.accentColor} roughness={0.4} />
        </mesh>
      </RigidBody>
      {/* Bottom Right */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.8}>
        <mesh receiveShadow position={[5, 1.8, 5]} castShadow>
          <boxGeometry args={[2.5, 4.0, 2.5]} />
          <meshStandardMaterial color={config.obstacleColor1} roughness={0.4} />
        </mesh>
      </RigidBody>

      {/* Lower ground (flooded by lava) */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.6}>
        <mesh receiveShadow position={[0, -0.6, 0]}>
          <boxGeometry args={[16, 0.8, 16]} />
          <meshStandardMaterial color="#2d2d2d" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* Lava Plain Indicator (Visual + logic check handled by Bot / Player coordinates) */}
      <mesh ref={lavaMeshRef} position={[0, -2.5, 0]}>
        <boxGeometry args={[24, 0.5, 24]} />
        <meshStandardMaterial 
          color={lavaWarning ? '#ff5500' : '#ff1100'} 
          emissive={lavaWarning ? '#ff3300' : '#ff0000'}
          emissiveIntensity={lavaWarning ? 0.8 : 1.5}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
};
