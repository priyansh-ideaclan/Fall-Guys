import React, { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { getThemeConfig } from '../../utils/themeManager';
import { RotatingSweeper, PendulumHammer, SpeedPad } from '../LevelObstacles';
import { audioManager } from '../../utils/audioManager';

// --- HEX PIECE FOR HONEYCOMB COLLAPSE ---
interface HexProps {
  position: [number, number, number];
  color: string;
}

const FinalHex: React.FC<HexProps> = ({ position, color }) => {
  const [state, setState] = useState<'active' | 'warn' | 'gone'>('active');

  useEffect(() => {
    if (state === 'warn') {
      const timer = setTimeout(() => setState('gone'), 700);
      return () => clearTimeout(timer);
    } else if (state === 'gone') {
      const timer = setTimeout(() => setState('active'), 6000); // Respawns after 6s
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state]);

  const handleEnter = () => {
    if (state === 'active') {
      setState('warn');
      audioManager.playLand();
    }
  };

  if (state === 'gone') return null;

  const isWarn = state === 'warn';
  const displayColor = isWarn ? '#ffd60a' : color;

  return (
    <group position={position} userData={{ active: state === 'active', yPos: position[1] }}>
      <mesh castShadow receiveShadow rotation={[0, Math.PI / 6, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.2, 6]} />
        <meshStandardMaterial 
          color={displayColor} 
          roughness={0.3} 
          emissive={isWarn ? '#ffd60a' : '#000000'}
          emissiveIntensity={isWarn ? 0.7 : 0}
        />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.1, 0.55]} rotation={[0, Math.PI / 6, 0]} />
        <CylinderCollider args={[0.2, 0.53]} sensor onIntersectionEnter={handleEnter} position={[0, 0.1, 0]} />
      </RigidBody>
    </group>
  );
};

// --- FINAL 1: HONEYCOMB COLLAPSE ---
export const Final1: React.FC = () => {
  const theme = useGameStore((state) => state.visualTheme);
  const config = getThemeConfig(theme);

  // Generate grid positions for 3 layers of Hexes
  // Top layer (Smallest): y = 9.0
  const topLayer: [number, number, number][] = [
    [0, 9.0, 0],
    [-1.0, 9.0, -0.6], [1.0, 9.0, -0.6],
    [-1.0, 9.0, 0.6], [1.0, 9.0, 0.6],
    [0, 9.0, -1.2], [0, 9.0, 1.2],
  ];

  // Middle layer (Medium): y = 5.5
  const middleLayer: [number, number, number][] = [];
  for (let x = -2.5; x <= 2.5; x += 1.25) {
    for (let z = -2.5; z <= 2.5; z += 1.25) {
      if (Math.abs(x) + Math.abs(z) <= 3.8) {
        middleLayer.push([x, 5.5, z]);
      }
    }
  }

  // Bottom layer (Largest): y = 2.0
  const bottomLayer: [number, number, number][] = [];
  for (let x = -4.5; x <= 4.5; x += 1.25) {
    for (let z = -4.5; z <= 4.5; z += 1.25) {
      if (Math.abs(x) + Math.abs(z) <= 6.2) {
        bottomLayer.push([x, 2.0, z]);
      }
    }
  }

  return (
    <group name="final_1">
      {/* Safe Starting center platform */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.6}>
        <mesh receiveShadow position={[0, 9.8, 0]}>
          <boxGeometry args={[1.5, 0.6, 1.5]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Top Layer */}
      {topLayer.map((pos, i) => (
        <FinalHex key={`top_${i}`} position={pos} color={config.obstacleColor1} />
      ))}

      {/* Middle Layer */}
      {middleLayer.map((pos, i) => (
        <FinalHex key={`mid_${i}`} position={pos} color={config.accentColor} />
      ))}

      {/* Bottom Layer */}
      {bottomLayer.map((pos, i) => (
        <FinalHex key={`bot_${i}`} position={pos} color={config.obstacleColor2} />
      ))}
    </group>
  );
};


// --- FINAL 2: CROWN PEAK CLIMB ---
export const Final2: React.FC = () => {
  const theme = useGameStore((state) => state.visualTheme);
  const qualifyRacer = useGameStore((state) => state.qualifyRacer);
  const config = getThemeConfig(theme);

  const crownRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (crownRef.current) {
      crownRef.current.rotation.y = state.clock.getElapsedTime() * 2.0;
      crownRef.current.position.y = 8.8 + Math.sin(state.clock.getElapsedTime() * 4.0) * 0.15;
    }
  });

  const handleCrownGrab = (event: any) => {
    if (event.rigidBodyObject) {
      const racerId = event.rigidBodyObject.name === 'player' ? 'player' : event.rigidBodyObject.userData?.id || 'bot';
      qualifyRacer(racerId);
    }
  };

  return (
    <group name="final_2">
      {/* 1. Spawn starting platform */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.6}>
        <mesh receiveShadow position={[0, -0.4, 0]}>
          <boxGeometry args={[6, 0.8, 6]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* 2. Massive inclined ramp up to the peak */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.6}>
        {/* Inclined deck mesh */}
        <mesh 
          receiveShadow 
          position={[0, 3.8, 25]} 
          rotation={[Math.atan2(8.2, 44), 0, 0]}
        >
          <boxGeometry args={[4.5, 0.8, 44.8]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.6} />
        </mesh>
      </RigidBody>

      {/* Obstacles along the incline sprint */}
      <RotatingSweeper position={[0, 1.2, 12]} radius={2.0} height={0.6} speed={3.0} color={config.obstacleColor1} />
      <SpeedPad position={[-1.2, 0.8, 18]} />
      <SpeedPad position={[1.2, 1.3, 24]} />
      <PendulumHammer position={[0, 4.8, 30]} length={2.5} speed={4.0} color={config.obstacleColor2} />
      <RotatingSweeper position={[0, 5.8, 38]} radius={2.0} height={0.6} speed={-3.2} color={config.accentColor} />

      {/* 3. The Peak Landing Platform */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[0, 7.8, 48]} castShadow>
          <boxGeometry args={[5, 0.8, 5]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.5} />
        </mesh>

        {/* Pillars supporting the crown */}
        <mesh castShadow position={[-1.8, 9.2, 48]}>
          <cylinderGeometry args={[0.1, 0.1, 2.0, 12]} />
          <meshStandardMaterial color={config.obstacleColor2} />
        </mesh>
        <mesh castShadow position={[1.8, 9.2, 48]}>
          <cylinderGeometry args={[0.1, 0.1, 2.0, 12]} />
          <meshStandardMaterial color={config.obstacleColor2} />
        </mesh>
      </RigidBody>

      {/* Dynamic Golden Crown to grab */}
      <mesh ref={crownRef} position={[0, 8.8, 48]} castShadow>
        <torusGeometry args={[0.5, 0.18, 8, 16]} />
        <meshStandardMaterial color="#ffd60a" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Crown Grab Sensor */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider 
          args={[0.8, 0.8, 0.8]} 
          sensor 
          onIntersectionEnter={handleCrownGrab} 
          position={[0, 8.8, 48]} 
        />
      </RigidBody>
    </group>
  );
};
