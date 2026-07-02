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


// --- LOGIC 2: CORRECT GATE MAZE ---
interface GateProps {
  position: [number, number, number];
  isPassable: boolean;
  color: string;
}

const ChoiceGate: React.FC<GateProps> = ({ position, isPassable, color }) => {
  const [opened, setOpened] = useState(false);

  const handleTouch = (event: any) => {
    if (event.rigidBodyObject && (event.rigidBodyObject.name === 'player' || event.rigidBodyObject.name === 'bot')) {
      if (isPassable && !opened) {
        setOpened(true);
      }
    }
  };

  if (opened) return null;

  return (
    <RigidBody type="fixed" colliders={false} onCollisionEnter={handleTouch}>
      <CuboidCollider args={[0.9, 1.2, 0.1]} position={position} />
      <mesh castShadow position={position}>
        <boxGeometry args={[1.8, 2.4, 0.15]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </RigidBody>
  );
};

export const Logic2: React.FC = () => {
  const theme = useGameStore((state) => state.visualTheme);
  const triggerWinAction = useGameStore((state) => state.triggerWin);
  const config = getThemeConfig(theme);

  const handleFinish = (event: any) => {
    if (event.rigidBodyObject && event.rigidBodyObject.name === 'player') {
      triggerWinAction();
    }
  };

  return (
    <group name="logic_2">
      {/* 1. Start Deck */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.6}>
        <mesh receiveShadow position={[0, -0.4, 0]}>
          <boxGeometry args={[6, 0.8, 6]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* 2. Path Deck spanning the maze */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.6}>
        <mesh receiveShadow position={[0, -0.4, 25]}>
          <boxGeometry args={[5, 0.8, 44]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.6} />
        </mesh>
      </RigidBody>

      {/* Gate Row 1 (z = 12): Left is Correct */}
      <ChoiceGate position={[-1.6, 1.0, 12]} isPassable={true} color={config.accentColor} />
      <ChoiceGate position={[0, 1.0, 12]} isPassable={false} color={config.obstacleColor1} />
      <ChoiceGate position={[1.6, 1.0, 12]} isPassable={false} color={config.obstacleColor1} />
      
      {/* Gate Row 2 (z = 24): Middle is Correct */}
      <ChoiceGate position={[-1.6, 1.0, 24]} isPassable={false} color={config.obstacleColor2} />
      <ChoiceGate position={[0, 1.0, 24]} isPassable={true} color={config.accentColor} />
      <ChoiceGate position={[1.6, 1.0, 24]} isPassable={false} color={config.obstacleColor2} />

      {/* Gate Row 3 (z = 36): Right is Correct */}
      <ChoiceGate position={[-1.6, 1.0, 36]} isPassable={false} color={config.obstacleColor1} />
      <ChoiceGate position={[0, 1.0, 36]} isPassable={false} color={config.obstacleColor1} />
      <ChoiceGate position={[1.6, 1.0, 36]} isPassable={true} color={config.accentColor} />

      {/* Checkpoint helper inside maze */}
      <Checkpoint position={[0, 0, 20]} id={1} />

      {/* 3. Finish Deck (z = 46) */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[0, -0.4, 46]}>
          <boxGeometry args={[6, 0.8, 6]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.5} />
        </mesh>
        
        {/* Arch */}
        <mesh castShadow position={[-2.0, 1.3, 46]}>
          <cylinderGeometry args={[0.15, 0.15, 2.6, 12]} />
          <meshStandardMaterial color={config.obstacleColor2} />
        </mesh>
        <mesh castShadow position={[2.0, 1.3, 46]}>
          <cylinderGeometry args={[0.15, 0.15, 2.6, 12]} />
          <meshStandardMaterial color={config.obstacleColor2} />
        </mesh>
        <mesh castShadow position={[0, 2.6, 46]}>
          <boxGeometry args={[4.2, 0.25, 0.4]} />
          <meshStandardMaterial color={config.obstacleColor1} />
        </mesh>
      </RigidBody>

      {/* Finish trigger */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider 
          args={[2.2, 1.5, 0.15]} 
          sensor 
          onIntersectionEnter={handleFinish} 
          position={[0, 1.0, 46]} 
        />
      </RigidBody>
    </group>
  );
};
