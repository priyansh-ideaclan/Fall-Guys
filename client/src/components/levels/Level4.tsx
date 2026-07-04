import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CylinderCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { getThemeConfig } from '../../utils/themeManager';
import { audioManager } from '../../utils/audioManager';

// ─── Individual Hex Tile Component ──────────────────────────────────────────
interface HexTileProps {
  id: string;
  position: [number, number, number];
  color: string;
}

const HexTile: React.FC<HexTileProps> = ({ id, position, color }) => {
  const [status, setStatus] = useState<'active' | 'warning' | 'falling' | 'gone'>('active');
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const currentY = useRef(position[1]);
  const fallSpeed = useRef(0);
  const rotX = useRef(0);
  const rotY = useRef(0);
  
  const hasBeenSteppedOn = useRef(false);
  const pulseIntensity = useRef(1.5);

  // Trigger disappear warning on player/bot contact
  const handleEnter = (event: any) => {
    const rb = event.rigidBodyObject;
    if (rb && (rb.name === 'player' || rb.name === 'bot')) {
      hasBeenSteppedOn.current = true;
      if (useGameStore.getState().phase === 'PLAYING' && status === 'active') {
        setStatus('warning');
      }
    }
  };

  // Warning duration timer (randomized slightly between 0.8s and 1.2s per user spec)
  useEffect(() => {
    if (status === 'warning') {
      const delay = 800 + Math.random() * 400;
      const timer = setTimeout(() => {
        setStatus('falling');
        useGameStore.getState().triggerSplash([position[0], -4.0, position[2]], '#00ffc4');
        audioManager.playCollision(); // Play short impact sound
      }, delay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, position]);

  useFrame((state, delta) => {
    // If stepped on during countdown/intro, trigger warning once phase becomes PLAYING
    if (hasBeenSteppedOn.current && status === 'active') {
      if (useGameStore.getState().phase === 'PLAYING') {
        setStatus('warning');
      }
    }

    if (status === 'warning') {
      // Pulse emissive crack intensity
      pulseIntensity.current = 1.3 + Math.sin(state.clock.getElapsedTime() * 16.0) * 0.75;
    }

    if (status === 'falling') {
      fallSpeed.current += delta * 15.0; // Accelerating fall
      currentY.current -= fallSpeed.current * delta;

      // Spin visual slightly during fall
      rotX.current += delta * 2.2;
      rotY.current += delta * 1.5;

      if (rigidBodyRef.current) {
        rigidBodyRef.current.setNextKinematicTranslation(
          new THREE.Vector3(position[0], currentY.current, position[2])
        );
      }

      if (currentY.current < -6.0) {
        setStatus('gone');
      }
    }
  });

  if (status === 'gone') return null;

  const isWarning = status === 'warning';
  const isFalling = status === 'falling';
  const displayColor = isWarning ? '#ff3b30' : color; // Glow red on step

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      colliders={false}
      position={position}
      name="hextile_body"
    >
      {/* Visual Hex Cylinder Mesh */}
      <mesh 
        castShadow 
        receiveShadow
        rotation={[rotX.current, Math.PI / 6 + rotY.current, 0]}
        name="hextile"
        userData={{ id, state: status, yPos: currentY.current }}
      >
        <cylinderGeometry args={[0.58, 0.58, 0.22, 6]} />
        <meshStandardMaterial 
          color={displayColor} 
          roughness={0.25} 
          metalness={0.2}
          emissive={isWarning ? '#ff3b30' : isFalling ? '#550000' : color}
          emissiveIntensity={isWarning ? pulseIntensity.current : isFalling ? 0.4 : 0.08}
        />
      </mesh>

      {/* Main physical surface cylinder collider */}
      <CylinderCollider args={[0.11, 0.58]} />

      {/* Top waddle contact sensor */}
      {!isFalling && (
        <CylinderCollider 
          args={[0.15, 0.55]} 
          sensor 
          onIntersectionEnter={handleEnter} 
          position={[0, 0.16, 0]} 
        />
      )}
    </RigidBody>
  );
};

// ─── Level 4 Main Component ──────────────────────────────────────────────────
export const Level4: React.FC = () => {
  const theme = useGameStore((state) => state.visualTheme);
  const config = getThemeConfig(theme);
  const eliminateRacer = useGameStore((state) => state.eliminateRacer);
  const phase = useGameStore((state) => state.phase);

  // Generate 3 tiers of hexagonal tiles
  const tiersData = useMemo(() => {
    const size = 0.60; // Spaced tile hex size (R=0.58, spacing 0.60 gives a perfect small 3.5cm gap)
    const generateHexes = (yVal: number, radius: number) => {
      const list: Array<{ id: string; pos: [number, number, number] }> = [];
      for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
          const x = size * (1.5 * q);
          const z = size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r);
          list.push({
            id: `hex_${yVal.toFixed(0)}_${q}_${r}`,
            pos: [x, yVal, z]
          });
        }
      }
      return list;
    };

    return [
      { y: 7.0, hexes: generateHexes(7.0, 5) },  // Top Tier (radius 5 - 61 tiles)
      { y: 3.0, hexes: generateHexes(3.0, 6) },  // Middle Tier (radius 6 - 91 tiles)
      { y: -1.0, hexes: generateHexes(-1.0, 7) }  // Bottom Tier (radius 7 - 127 tiles)
    ];
  }, []);

  const handleKillZone = (event: any) => {
    if (phase !== 'PLAYING') return;
    const rb = event.rigidBodyObject;
    if (rb) {
      if (rb.name === 'player') {
        eliminateRacer('player');
      } else if (rb.name === 'bot') {
        const botId = rb.userData?.id;
        if (botId) eliminateRacer(botId);
      }
    }
  };

  return (
    <group name="level4_hex">

      {/* ── 1. Tiers of Hex Tiles ── */}
      {tiersData.map((tier, tIdx) => {
        const colorPalette = [config.groundColor, config.obstacleColor1, config.accentColor];
        const tierColor = colorPalette[tIdx % colorPalette.length];
        return (
          <group key={tier.y} name={`tier_${tIdx}`}>
            {tier.hexes.map((h) => (
              <HexTile 
                key={h.id} 
                id={h.id} 
                position={h.pos} 
                color={tierColor} 
              />
            ))}
          </group>
        );
      })}

      {/* ── 2. Space Scenery & Outer Boundaries ── */}
      {/* Neon glowing ring at slime level */}
      <mesh position={[0, -4.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[16.5, 17.5, 32]} />
        <meshStandardMaterial 
          color={config.accentColor} 
          emissive={config.accentColor} 
          emissiveIntensity={1.2} 
        />
      </mesh>

      {/* Giant holographic display posts */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i * Math.PI) / 3;
        const radius = 18.5;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, angle + Math.PI, 0]}>
            <mesh castShadow position={[0, 0, 0]}>
              <cylinderGeometry args={[0.24, 0.32, 14.0, 8]} />
              <meshStandardMaterial color="#222" roughness={0.8} />
            </mesh>
            {/* Emissive capsule beacons on top */}
            <mesh position={[0, 7.2, 0]}>
              <capsuleGeometry args={[0.2, 0.4, 8, 16]} />
              <meshStandardMaterial 
                color={config.obstacleColor1} 
                emissive={config.obstacleColor1} 
                emissiveIntensity={1.5} 
              />
            </mesh>
          </group>
        );
      })}

      {/* ── 3. Slime Kill Zone plane below the arena ── */}
      <RigidBody type="fixed" colliders={false}>
        <mesh receiveShadow position={[0, -4.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[150, 150]} />
          <meshStandardMaterial 
            color={config.accentColor} 
            emissive={config.accentColor} 
            emissiveIntensity={0.65} 
            roughness={0.15}
          />
        </mesh>
        {/* Slime contact trigger sensor */}
        <CylinderCollider 
          args={[0.5, 60.0]} 
          position={[0, -4.0, 0]} 
          sensor 
          onIntersectionEnter={handleKillZone} 
        />
      </RigidBody>
    </group>
  );
};
