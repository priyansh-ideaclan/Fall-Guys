import React, { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { getThemeConfig } from '../../utils/themeManager';
import { JumpPad } from '../LevelObstacles';
import { audioManager } from '../../utils/audioManager';

// Dynamic Star Prop that can be collected
interface StarProps {
  position: [number, number, number];
  onCollect: () => void;
  color: string;
}

const FloatingStar: React.FC<StarProps> = ({ position, onCollect, color }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 3.5;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.getElapsedTime() * 5.0) * 0.15;
    }
  });

  const handleEnter = (event: any) => {
    const target = event.rigidBodyObject;
    if (target && (target.name === 'player' || target.name === 'bot')) {
      const racerId = target.name === 'player' ? 'player' : target.userData?.id || 'bot';
      // Trigger store score update
      useGameStore.getState().updateScore(racerId, 1);
      audioManager.playClick();
      onCollect();
    }
  };

  return (
    <group position={position} name="star">
      {/* Visual Star */}
      <mesh ref={meshRef} castShadow>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial color={color} roughness={0.1} metalness={0.9} emissive={color} emissiveIntensity={0.6} />
      </mesh>
      
      {/* Sensor */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, 0.5, 0.5]} sensor onIntersectionEnter={handleEnter} />
      </RigidBody>
    </group>
  );
};

export const Hunt1: React.FC = () => {
  const theme = useGameStore((state) => state.visualTheme);
  const config = getThemeConfig(theme);

  // Pool of possible star positions
  const STAR_POSITIONS: [number, number, number][] = [
    [-5, 0.6, -5],
    [5, 0.6, -5],
    [-5, 0.6, 5],
    [5, 0.6, 5],
    [0, 0.6, 0],
    [-3, 1.8, 0],
    [3, 1.8, 0],
    [0, 1.8, -3],
    [0, 1.8, 3],
    [-2, 3.2, -2], // High positions above bounce pads
    [2, 3.2, 2],
  ];

  // Active indices of stars currently spawned
  const [activeStarPos, setActiveStarPos] = useState<[number, number, number][]>([
    [-5, 0.6, -5],
    [5, 0.6, -5],
    [-5, 0.6, 5],
    [5, 0.6, 5],
    [0, 0.6, 0],
  ]);

  const handleStarCollected = (indexToReplace: number) => {
    setActiveStarPos((prev) => {
      const next = [...prev];
      // Pick a new position from the pool that isn't currently in next
      const unused = STAR_POSITIONS.filter(pos => !next.some(n => n[0] === pos[0] && n[2] === pos[2]));
      if (unused.length > 0) {
        next[indexToReplace] = unused[Math.floor(Math.random() * unused.length)];
      }
      return next;
    });
  };

  return (
    <group name="hunt_1">
      {/* 1. Main Arena Floor */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.6}>
        <mesh receiveShadow position={[0, -0.4, 0]}>
          <boxGeometry args={[14, 0.8, 14]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Ramps & Raised platforms */}
      <RigidBody type="fixed" colliders="cuboid">
        {/* Left platform */}
        <mesh receiveShadow castShadow position={[-3, 0.5, 0]}>
          <boxGeometry args={[2, 1.0, 3]} />
          <meshStandardMaterial color={config.obstacleColor1} roughness={0.6} />
        </mesh>
        {/* Right platform */}
        <mesh receiveShadow castShadow position={[3, 0.5, 0]}>
          <boxGeometry args={[2, 1.0, 3]} />
          <meshStandardMaterial color={config.obstacleColor1} roughness={0.6} />
        </mesh>
        {/* Top platform */}
        <mesh receiveShadow castShadow position={[0, 0.5, -3]}>
          <boxGeometry args={[3, 1.0, 2]} />
          <meshStandardMaterial color={config.accentColor} roughness={0.6} />
        </mesh>
        {/* Bottom platform */}
        <mesh receiveShadow castShadow position={[0, 0.5, 3]}>
          <boxGeometry args={[3, 1.0, 2]} />
          <meshStandardMaterial color={config.accentColor} roughness={0.6} />
        </mesh>
      </RigidBody>

      {/* Jump pads to reach high stars */}
      <JumpPad position={[-2, 0.05, -2]} boostForce={12.0} color={config.obstacleColor2} />
      <JumpPad position={[2, 0.05, 2]} boostForce={12.0} color={config.obstacleColor2} />

      {/* Render active stars */}
      {activeStarPos.map((pos, i) => (
        <FloatingStar
          key={i}
          position={pos}
          color="#ffd60a"
          onCollect={() => handleStarCollected(i)}
        />
      ))}
    </group>
  );
};
