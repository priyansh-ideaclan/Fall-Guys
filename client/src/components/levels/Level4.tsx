import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { RigidBody, CylinderCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { getThemeConfig } from '../../utils/themeManager';
import { audioManager } from '../../utils/audioManager';

// ─── Pastel Background Component ───────────────────────────────────────────
const PastelBackground: React.FC = () => {
  const { scene } = useThree();
  const cloudsRef = useRef<THREE.Group>(null);

  useEffect(() => {
    // Set pink background sky and matching fog
    const originalBg = scene.background;
    const originalFog = scene.fog;

    scene.background = new THREE.Color('#ffb7b2'); // Warm pastel pink sky
    scene.fog = new THREE.FogExp2('#ffb7b2', 0.012); // atmospheric haze

    return () => {
      scene.background = originalBg;
      scene.fog = originalFog;
    };
  }, [scene]);

  // Slowly drift clouds
  useFrame((state) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = state.clock.getElapsedTime() * 0.012;
    }
  });

  // Shader material for green hills with contour lines
  const hillShader = useMemo(() => {
    return {
      uniforms: {
        hillColor: { value: new THREE.Color('#cceebb') }, // Pastel green
        lineColor: { value: new THREE.Color('#aaddaa') }, // Slightly darker green line
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 hillColor;
        uniform vec3 lineColor;
        void main() {
          // Draw contour lines based on height coordinate Y
          float scale = 0.85; 
          float thickness = 0.06;
          float linePattern = step(1.0 - thickness, fract(vPos.y * scale));
          vec3 color = mix(hillColor, lineColor, linePattern);
          gl_FragColor = vec4(color, 1.0);
        }
      `
    };
  }, []);

  return (
    <group name="pastel_bg">
      {/* Ambient and directional lights */}
      <ambientLight color="#ffebf0" intensity={1.1} />
      <directionalLight position={[15, 25, 15]} color="#fff0f5" intensity={1.4} castShadow />

      {/* ── 1. Far Snow-Capped Mountains ── */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * Math.PI * 2) / 8 + 0.35;
        const radius = 68 + Math.random() * 8;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const height = 18 + Math.random() * 6;
        const baseWidth = 15 + Math.random() * 5;
        
        return (
          <group key={`mountain_${i}`} position={[x, height / 2 - 5, z]}>
            {/* Mountain Base */}
            <mesh castShadow receiveShadow>
              <coneGeometry args={[baseWidth, height, 5]} />
              <meshStandardMaterial color="#b2d8d8" roughness={0.9} flatShading />
            </mesh>
            {/* Snowy Peak */}
            <mesh position={[0, height / 4, 0]}>
              <coneGeometry args={[baseWidth / 2, height / 2, 5]} />
              <meshStandardMaterial color="#ffffff" roughness={0.8} flatShading />
            </mesh>
          </group>
        );
      })}

      {/* ── 2. Rolling Green Hills with Contour Lines ── */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * Math.PI * 2) / 12;
        const radius = 42 + Math.random() * 6;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const scaleX = 24 + Math.random() * 6;
        const scaleY = 8 + Math.random() * 3;
        const scaleZ = 24 + Math.random() * 6;

        return (
          <group key={`hill_${i}`} position={[x, -3.5, z]}>
            <mesh scale={[scaleX, scaleY, scaleZ]}>
              <sphereGeometry args={[1, 32, 16]} />
              <shaderMaterial attach="material" args={[hillShader]} />
            </mesh>

            {/* Scattered cartoon trees on this hill */}
            {Array.from({ length: 3 }).map((_, tIdx) => {
              const tAngle = Math.random() * Math.PI * 2;
              const tRadius = Math.random() * 0.65;
              const tx = Math.sin(tAngle) * tRadius * scaleX;
              const tz = Math.cos(tAngle) * tRadius * scaleZ;
              const ty = Math.cos((tRadius * Math.PI) / 2) * scaleY - 0.2;
              
              const treeHeight = 1.3 + Math.random() * 0.7;
              const foliageColor = ['#ffd3b6', '#a8e6cf', '#ffaaa5', '#dcedc1'][tIdx % 4];

              return (
                <group key={`tree_${tIdx}`} position={[tx, ty, tz]}>
                  {/* Trunk */}
                  <mesh position={[0, treeHeight / 2, 0]}>
                    <cylinderGeometry args={[0.08, 0.12, treeHeight, 8]} />
                    <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
                  </mesh>
                  {/* Foliage */}
                  <mesh position={[0, treeHeight + 0.3, 0]}>
                    <sphereGeometry args={[0.55, 8, 8]} />
                    <meshStandardMaterial color={foliageColor} roughness={0.6} flatShading />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}

      {/* ── 3. Gently Drifting Fluffy Clouds ── */}
      <group ref={cloudsRef}>
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i * Math.PI * 2) / 8;
          const radius = 38 + Math.random() * 8;
          const x = Math.sin(angle) * radius;
          const z = Math.cos(angle) * radius;
          const y = 15 + Math.random() * 5;

          return (
            <group key={`cloud_${i}`} position={[x, y, z]} scale={[1.6, 1.3, 1.6]}>
              {/* Central fluff */}
              <mesh>
                <sphereGeometry args={[1.3, 16, 16]} />
                <meshStandardMaterial color="#ffffff" roughness={0.9} transparent opacity={0.9} />
              </mesh>
              {/* Left fluff */}
              <mesh position={[-1.1, -0.2, 0]} scale={[0.8, 0.8, 0.8]}>
                <sphereGeometry args={[1.3, 12, 12]} />
                <meshStandardMaterial color="#ffffff" roughness={0.9} transparent opacity={0.9} />
              </mesh>
              {/* Right fluff */}
              <mesh position={[1.1, -0.2, 0]} scale={[0.8, 0.8, 0.8]}>
                <sphereGeometry args={[1.3, 12, 12]} />
                <meshStandardMaterial color="#ffffff" roughness={0.9} transparent opacity={0.9} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
};

// ─── Individual Hex Tile Component ──────────────────────────────────────────
interface HexTileProps {
  id: string;
  position: [number, number, number];
  color: string;
}

const HexTile: React.FC<HexTileProps> = ({ id, position, color }) => {
  const [status, setStatus] = useState<'active' | 'warning' | 'falling' | 'regenerating' | 'rising'>('active');
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
        // Play melodic piano note based on tile position coordinates to create spatial pitch variation
        const pitchSeed = Math.round(Math.abs(position[0] * 17 + position[2] * 11));
        audioManager.playHexPianoNote(pitchSeed);
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
      }, delay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, position]);

  // Delayed regeneration timer (waits ~10.0 seconds before starting rising animation)
  useEffect(() => {
    if (status === 'regenerating') {
      const delay = 8500 + Math.random() * 1500; // 8.5s - 10s
      const timer = setTimeout(() => {
        setStatus('rising');
      }, delay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status]);

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
        setStatus('regenerating');
      }
    } else if (status === 'regenerating') {
      // Keep collider positioned far below map
      if (rigidBodyRef.current) {
        rigidBodyRef.current.setNextKinematicTranslation(
          new THREE.Vector3(position[0], -15.0, position[2])
        );
      }
    } else if (status === 'rising') {
      // Smooth rise up at 3.2m/s
      currentY.current += delta * 3.2;

      // Decelerate visual spin back to upright
      rotX.current = THREE.MathUtils.lerp(rotX.current, 0, delta * 5.0);
      rotY.current = THREE.MathUtils.lerp(rotY.current, 0, delta * 5.0);

      if (rigidBodyRef.current) {
        rigidBodyRef.current.setNextKinematicTranslation(
          new THREE.Vector3(position[0], currentY.current, position[2])
        );
      }

      if (currentY.current >= position[1]) {
        // Reset properties to original state
        currentY.current = position[1];
        fallSpeed.current = 0;
        rotX.current = 0;
        rotY.current = 0;
        hasBeenSteppedOn.current = false;
        setStatus('active');
      }
    } else {
      // Ensure it stays at its fixed initial position when active
      if (rigidBodyRef.current) {
        rigidBodyRef.current.setNextKinematicTranslation(
          new THREE.Vector3(position[0], position[1], position[2])
        );
      }
    }
  });

  const isWarning = status === 'warning';
  const isFalling = status === 'falling';
  const isRegenerating = status === 'regenerating';
  const isRising = status === 'rising';
  
  // Color tiles red on step warning, and a beautiful glowing cyan while rising/regenerating
  const displayColor = isWarning ? '#ff3b30' : isRising ? '#00ffc4' : color;

  return (
    <group name="hextile_container">
      <RigidBody
        ref={rigidBodyRef}
        type="kinematicPosition"
        colliders={false}
        position={position}
        name="hextile_body"
      >
        {/* Visual Hex Cylinder Mesh */}
        {!isRegenerating && (
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
              emissive={isWarning ? '#ff3b30' : isRising ? '#00ffc4' : isFalling ? '#550000' : color}
              emissiveIntensity={isWarning ? pulseIntensity.current : isRising ? 1.0 : isFalling ? 0.4 : 0.08}
            />
          </mesh>
        )}

        {/* Main physical surface cylinder collider */}
        {!isRegenerating && (
          <CylinderCollider args={[0.11, 0.58]} />
        )}

        {/* Top waddle contact sensor (only active when status is fully reset to active) */}
        {status === 'active' && (
          <CylinderCollider 
            args={[0.15, 0.55]} 
            sensor 
            onIntersectionEnter={handleEnter} 
            position={[0, 0.16, 0]} 
          />
        )}
      </RigidBody>
    </group>
  );
};

// ─── Level 4 Main Component ──────────────────────────────────────────────────
export const Level4: React.FC = () => {
  const theme = useGameStore((state) => state.visualTheme);
  const config = getThemeConfig(theme);
  const eliminateRacer = useGameStore((state) => state.eliminateRacer);
  const phase = useGameStore((state) => state.phase);
  const levelSeed = useGameStore((state) => state.levelSeed);



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
    <group name="level4_hex" key={levelSeed}>

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

      {/* ── 4. Pastel Background (Mountains, Hills, Trees, Clouds) ── */}
      <PastelBackground />
    </group>
  );
};
