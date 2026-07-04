import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider, RapierRigidBody } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { getThemeConfig } from '../../utils/themeManager';
import { Checkpoint } from '../LevelObstacles';

// --- LOGIC 1: MEMORY TILE SHOWDOWN ---
interface TileProps {
  position: [number, number, number];
  colorName: 'RED' | 'GREEN' | 'BLUE';
  hexColor: string;
  activeColor: string;
  isDropPhase: boolean;
}

const MemoryTile: React.FC<TileProps> = ({ position, colorName, hexColor, activeColor, isDropPhase }) => {
  const isMatch = colorName === activeColor;
  const shouldDrop = isDropPhase && !isMatch;
  const currentY = useRef(position[1]);

  useFrame((state, delta) => {
    const targetY = shouldDrop ? -12.0 : position[1];
    currentY.current = THREE.MathUtils.lerp(currentY.current, targetY, shouldDrop ? 0.25 : 0.12);
  });

  return (
    <group position={[position[0], currentY.current, position[2]]}>
      <RigidBody type="fixed" colliders="cuboid" friction={0.6}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[2.2, 0.6, 2.2]} />
          <meshStandardMaterial 
            color={hexColor} 
            roughness={0.4} 
            emissive={hexColor}
            emissiveIntensity={isMatch ? 0.15 : 0}
          />
        </mesh>
      </RigidBody>
    </group>
  );
};

export const Logic1: React.FC = () => {
  const theme = useGameStore((state) => state.visualTheme);
  const activeColorPattern = useGameStore((state) => state.activeColorPattern);
  const setActiveColorPattern = useGameStore((state) => state.setActiveColorPattern);
  const config = getThemeConfig(theme);

  const [countdown, setCountdown] = useState(4);
  const [isDropPhase, setIsDropPhase] = useState(false);

  // Colors mapping
  const colors = {
    RED: '#ff0055',
    GREEN: '#39ff14',
    BLUE: '#00e5ff'
  };

  // Run the memory loop
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    // 7 second round cycle: 4s memorize, 2s drop tiles, 1s restore
    const cycle = time % 7;

    if (cycle < 4) {
      // Memorize phase
      const secondsLeft = Math.ceil(4 - cycle);
      if (countdown !== secondsLeft) {
        setCountdown(secondsLeft);
      }
      if (isDropPhase) {
        setIsDropPhase(false);
      }
    } else if (cycle >= 4 && cycle < 6) {
      // Drop tiles phase
      if (countdown !== 0) {
        setCountdown(0);
      }
      if (!isDropPhase) {
        setIsDropPhase(true);
      }
    } else {
      // Restore phase
      if (isDropPhase) {
        setIsDropPhase(false);
      }
      // Pick next color pattern at the transition of the new cycle
      const nextColors: ('RED' | 'GREEN' | 'BLUE')[] = ['RED', 'GREEN', 'BLUE'];
      const chosen = nextColors[Math.floor((time / 7) % 3)];
      if (activeColorPattern !== chosen) {
        setActiveColorPattern(chosen);
      }
    }
  });

  // Grid layout config
  const tileLayout: Array<{ pos: [number, number, number]; color: 'RED' | 'GREEN' | 'BLUE' }> = [
    { pos: [-2.6, 0, -2.6], color: 'RED' },
    { pos: [0, 0, -2.6], color: 'GREEN' },
    { pos: [2.6, 0, -2.6], color: 'BLUE' },

    { pos: [-2.6, 0, 0], color: 'BLUE' },
    { pos: [0, 0, 0], color: 'RED' },
    { pos: [2.6, 0, 0], color: 'GREEN' },

    { pos: [-2.6, 0, 2.6], color: 'GREEN' },
    { pos: [0, 0, 2.6], color: 'BLUE' },
    { pos: [2.6, 0, 2.6], color: 'RED' },
  ];

  return (
    <group name="logic_1">
      {/* Starting Safety Deck */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.6}>
        <mesh receiveShadow position={[0, 0, -5.8]}>
          <boxGeometry args={[8, 0.6, 2.5]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Grid of memory tiles */}
      {tileLayout.map((tile, i) => (
        <MemoryTile
          key={i}
          position={tile.pos}
          colorName={tile.color}
          hexColor={colors[tile.color]}
          activeColor={activeColorPattern}
          isDropPhase={isDropPhase}
        />
      ))}

      {/* Holographic Text Billboard in center showing countdown & safe color */}
      <group position={[0, 3.5, 0]}>
        <mesh>
          <planeGeometry args={[4.2, 1.8]} />
          <meshBasicMaterial color="#000" transparent opacity={0.5} />
        </mesh>
        <Text
          position={[0, 0.4, 0.05]}
          fontSize={0.28}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineColor="#000"
          outlineWidth={0.01}
        >
          {countdown > 0 ? `MATCH COLOR IN: ${countdown}s` : 'TILES DROPPING!'}
        </Text>
        <Text
          position={[0, -0.3, 0.05]}
          fontSize={0.42}
          color={colors[activeColorPattern as keyof typeof colors] || '#fff'}
          anchorX="center"
          anchorY="middle"
          outlineColor="#000"
          outlineWidth={0.015}
          fontWeight={900}
        >
          {activeColorPattern}
        </Text>
      </group>
    </group>
  );
};



