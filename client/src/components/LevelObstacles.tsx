import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { Text, Billboard } from '@react-three/drei';
import { useGameStore } from '../store/useGameStore';
import { audioManager } from '../utils/audioManager';

// --- EXISTING BASIC OBSTACLES RE-EXPORTED / OPTIMIZED ---

// Kinematic Moving Platform
interface MovingPlatformProps {
  position: [number, number, number];
  size: [number, number, number];
  direction: 'x' | 'y' | 'z';
  range: number;
  speed: number;
  color?: string;
}

export const MovingPlatform: React.FC<MovingPlatformProps> = ({ position, size, direction, range, speed, color = '#bd00ff' }) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const startPos = useRef(new THREE.Vector3(...position));

  useFrame((state) => {
    const rb = rigidBodyRef.current;
    if (!rb) return;

    const time = state.clock.getElapsedTime();
    const offset = Math.sin(time * speed) * range;

    const currentPos = startPos.current.clone();
    if (direction === 'x') currentPos.x += offset;
    if (direction === 'y') currentPos.y += offset;
    if (direction === 'z') currentPos.z += offset;

    rb.setNextKinematicTranslation(currentPos);
  });

  return (
    <RigidBody ref={rigidBodyRef} type="kinematicPosition" colliders="cuboid" friction={1.0}>
      <mesh castShadow receiveShadow position={position}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
      </mesh>
    </RigidBody>
  );
};

// Rotating Sweeper Obstacle
interface RotatingSweeperProps {
  position: [number, number, number];
  radius: number;
  height: number;
  speed: number;
  color?: string;
  name?: string;
}

export const RotatingSweeper: React.FC<RotatingSweeperProps> = ({ position, radius, height, speed, color = '#ff007f', name = 'rotating-arm' }) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);

  useFrame((state) => {
    const rb = rigidBodyRef.current;
    if (!rb) return;

    const time = state.clock.getElapsedTime();
    const angle = time * speed;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    
    rb.setNextKinematicRotation(q);
  });

  return (
    <group position={position} name={name}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[height / 2, 0.2]} position={[0, height / 2, 0]} />
        <mesh castShadow position={[0, height / 2, 0]}>
          <cylinderGeometry args={[0.15, 0.2, height, 12]} />
          <meshStandardMaterial color="#444" roughness={0.5} />
        </mesh>
      </RigidBody>

      <RigidBody ref={rigidBodyRef} type="kinematicPosition" colliders="cuboid" friction={0.8} restitution={1.2}>
        <mesh castShadow position={[0, height - 0.15, 0]}>
          <boxGeometry args={[radius * 2, 0.25, 0.15]} />
          <meshStandardMaterial color={color} roughness={0.2} emissive={color} emissiveIntensity={0.2} />
        </mesh>
      </RigidBody>
    </group>
  );
};

// Jump Pad (Bounce Pad)
interface JumpPadProps {
  position: [number, number, number];
  boostForce?: number;
  color?: string;
}

export const JumpPad: React.FC<JumpPadProps> = ({ position, boostForce = 12.5, color = '#00e5ff' }) => {
  const [pulse, setPulse] = useState(false);
  const particles = useRef<Array<{ pos: THREE.Vector3; vel: THREE.Vector3; scale: number }>>([]);
  const pointsRef = useRef<THREE.Points>(null);

  const handleEnter = (event: any) => {
    const otherBody = event.rigidBody;
    const otherObject = event.rigidBodyObject;
    if (otherBody && otherObject && (otherObject.name === 'player' || otherObject.name === 'bot')) {
      const vel = otherBody.linvel();
      otherBody.setLinvel({ x: vel.x * 0.5, y: boostForce, z: Math.max(vel.z, 6.5) }, true);
      audioManager.playJump();
      
      setPulse(true);
      setTimeout(() => setPulse(false), 400);

      // Trigger particle burst
      particles.current = Array.from({ length: 15 }).map(() => ({
        pos: new THREE.Vector3(0, 0.1, 0),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 3.0,
          Math.random() * 4.0 + 3.0,
          (Math.random() - 0.5) * 3.0
        ),
        scale: Math.random() * 0.08 + 0.04
      }));
    }
  };

  useFrame((state) => {
    if (particles.current.length > 0 && pointsRef.current) {
      const geom = pointsRef.current.geometry;
      const positions = geom.attributes.position.array as Float32Array;
      
      particles.current.forEach((p, idx) => {
        p.vel.y -= 0.12; // gravity
        p.pos.add(p.vel.clone().multiplyScalar(0.04));
        
        positions[idx * 3] = p.pos.x;
        positions[idx * 3 + 1] = p.pos.y;
        positions[idx * 3 + 2] = p.pos.z;
      });
      geom.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      <mesh receiveShadow position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.65, 24]} />
        <meshStandardMaterial color={pulse ? '#ffffff' : '#ffd60a'} roughness={0.2} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.22, 0.55]} sensor onIntersectionEnter={handleEnter} position={[0, 0.22, 0]} />
        <mesh 
          castShadow 
          receiveShadow 
          position={[0, 0.04, 0]}
          scale={pulse ? [1.15, 1.3, 1.15] : [1.0, 1.0, 1.0]}
        >
          <cylinderGeometry args={[0.55, 0.55, 0.08, 12]} />
          <meshStandardMaterial 
            color={pulse ? '#ffffff' : color} 
            roughness={0.1} 
            emissive={pulse ? '#ffffff' : color} 
            emissiveIntensity={pulse ? 1.5 : 0.4} 
          />
        </mesh>
        
        <points ref={pointsRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={15}
              array={new Float32Array(15 * 3)}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial size={0.12} color={color} sizeAttenuation transparent opacity={0.8} />
        </points>
      </RigidBody>
    </group>
  );
};

// Checkpoint pad
interface CheckpointProps {
  position: [number, number, number];
  id: number;
}

export const Checkpoint: React.FC<CheckpointProps> = ({ position, id }) => {
  const passCheckpointAction = useGameStore((state) => state.passCheckpoint);
  const activeCheckpoint = useGameStore((state) => state.lastCheckpoint);
  
  const isActive = activeCheckpoint && 
    Math.abs(activeCheckpoint[0] - position[0]) < 0.1 && 
    Math.abs(activeCheckpoint[2] - position[2]) < 0.1;

  const handleEnter = (event: any) => {
    if (event.rigidBodyObject && event.rigidBodyObject.name === 'player') {
      passCheckpointAction([position[0], position[1] + 1.2, position[2]]);
      audioManager.playCheckpoint();
    }
  };

  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider 
          args={[1.25, 0.8, 1.25]} 
          sensor 
          onIntersectionEnter={handleEnter} 
          position={[0, 0.4, 0]} 
        />
      </RigidBody>
    </group>
  );
};


// --- NEW COMPONENT SPECIFIC OBSTACLES & SURFACES ---

// 1. Ice Platform (Reduced Friction)
export const IcePlatform: React.FC<{ position: [number, number, number]; size: [number, number, number]; color?: string }> = ({ position, size, color = '#7ce8ff' }) => {
  return (
    <RigidBody type="fixed" colliders="cuboid" friction={0.01} name="ice-floor">
      <mesh castShadow receiveShadow position={position} userData={{ surface: 'ice' }}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.01} metalness={0.5} />
      </mesh>
    </RigidBody>
  );
};

// 2. Mud Platform (Slowing Area)
export const MudPlatform: React.FC<{ position: [number, number, number]; size: [number, number, number]; color?: string }> = ({ position, size, color = '#422915' }) => {
  return (
    <RigidBody type="fixed" colliders="cuboid" friction={0.8} name="mud-floor">
      <mesh castShadow receiveShadow position={position} userData={{ surface: 'mud' }}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.0} />
      </mesh>
    </RigidBody>
  );
};

// 3. Speed Boost Pad
export const SpeedPad: React.FC<{ position: [number, number, number]; color?: string }> = ({ position, color = '#39ff14' }) => {
  const handleEnter = (event: any) => {
    const target = event.rigidBodyObject;
    if (target && (target.name === 'player' || target.name === 'bot')) {
      const currentVel = target.linvel();
      // Apply sharp boost forward in positive Z direction
      target.setLinvel({
        x: currentVel.x * 1.5,
        y: currentVel.y,
        z: Math.max(8.5, currentVel.z + 5.0)
      }, true);
      audioManager.playClick();
    }
  };

  return (
    <group position={position}>
      {/* Arrow graphics */}
      <mesh receiveShadow position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 1.2]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh receiveShadow position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 0.6, 3]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider 
          args={[0.6, 0.2, 0.6]} 
          sensor 
          onIntersectionEnter={handleEnter} 
          position={[0, 0.1, 0]}
        />
      </RigidBody>
    </group>
  );
};

// 4. Conveyor Belt Platform (Pushes player forward/backward)
export const ConveyorBelt: React.FC<{ position: [number, number, number]; size: [number, number, number]; pushSpeed: number; color?: string }> = ({ position, size, pushSpeed, color = '#2c2c2c' }) => {
  return (
    <RigidBody type="fixed" colliders="cuboid" friction={0.6}>
      <mesh castShadow receiveShadow position={position} userData={{ surface: 'conveyor', pushSpeed }}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </RigidBody>
  );
};

// 5. Tilting Platform (Tilts based on weight balance)
export const TiltingDeck: React.FC<{ position: [number, number, number]; size: [number, number, number]; color?: string }> = ({ position, size, color = '#ff007f' }) => {
  const groupRef = useRef<THREE.Group>(null);
  const tiltZ = useRef(0);
  const tiltX = useRef(0);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    // Search scene for player or bots
    const player = state.scene.getObjectByName('player');
    const bots = state.scene.children.filter((child) => child.name === 'bot');

    let totalWeightZ = 0;
    let totalWeightX = 0;

    // Check player
    if (player) {
      const d = player.position.clone().sub(group.position);
      if (Math.abs(d.z) < size[2] / 2 && Math.abs(d.x) < size[0] / 2) {
        totalWeightZ -= d.x * 0.08;
        totalWeightX += d.z * 0.08;
      }
    }

    // Check bots
    bots.forEach((bot) => {
      const d = bot.position.clone().sub(group.position);
      if (Math.abs(d.z) < size[2] / 2 && Math.abs(d.x) < size[0] / 2) {
        totalWeightZ -= d.x * 0.04; // bots weigh slightly less for layout stability
        totalWeightX += d.z * 0.04;
      }
    });

    // Smoothly rotate the visual mesh towards weights
    tiltZ.current = THREE.MathUtils.lerp(tiltZ.current, totalWeightZ, 0.08);
    tiltX.current = THREE.MathUtils.lerp(tiltX.current, totalWeightX, 0.08);

    group.rotation.z = tiltZ.current;
    group.rotation.x = tiltX.current;
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Central static support axle */}
      <mesh position={[0, -size[1] / 2 - 0.2, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.5, 12]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* The tilting platform platform */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.8}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} roughness={0.4} />
        </mesh>
      </RigidBody>
    </group>
  );
};

// 6. Collapsing Platform (Hex-a-Gone styled block that disappears and respawns)
export const CollapsingTile: React.FC<{ position: [number, number, number]; size: [number, number, number]; color?: string }> = ({ position, size, color = '#bd00ff' }) => {
  const [tileState, setTileState] = useState<'active' | 'warn' | 'gone'>('active');

  useEffect(() => {
    if (tileState === 'warn') {
      const timer = setTimeout(() => {
        setTileState('gone');
      }, 750); // Warning delay

      return () => clearTimeout(timer);
    } else if (tileState === 'gone') {
      const timer = setTimeout(() => {
        setTileState('active'); // Respawns after 3.5 seconds
      }, 3500);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [tileState]);

  const handleEnter = () => {
    if (tileState === 'active') {
      setTileState('warn');
      audioManager.playLand();
    }
  };

  if (tileState === 'gone') return null;

  const isWarn = tileState === 'warn';
  const displayColor = isWarn ? '#ffd60a' : color;

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial 
          color={displayColor} 
          roughness={0.3} 
          emissive={isWarn ? '#ffd60a' : '#000000'}
          emissiveIntensity={isWarn ? 0.7 : 0}
        />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
        <CuboidCollider 
          args={[size[0] / 2 - 0.05, 0.2, size[2] / 2 - 0.05]} 
          sensor 
          onIntersectionEnter={handleEnter} 
          position={[0, size[1] / 2 + 0.1, 0]}
        />
      </RigidBody>
    </group>
  );
};

// 7. Rolling Log Obstacle (Sweeps players sideways)
export const RollingLog: React.FC<{ position: [number, number, number]; length: number; radius: number; rotSpeed: number; color?: string }> = ({ position, length, radius, rotSpeed, color = '#ff6700' }) => {
  const rbRef = useRef<RapierRigidBody>(null);

  useFrame((state) => {
    const rb = rbRef.current;
    if (!rb) return;

    const time = state.clock.getElapsedTime();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), time * rotSpeed);
    rb.setNextKinematicRotation(q);
  });

  return (
    <group position={position}>
      {/* Supporting side pegs */}
      <mesh position={[-length / 2 - 0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.3]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh position={[length / 2 + 0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.3]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      <RigidBody ref={rbRef} type="kinematicPosition" colliders={false}>
        <CylinderCollider args={[length / 2, radius]} rotation={[0, 0, Math.PI / 2]} />
        <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius, radius, length, 16]} />
          <meshStandardMaterial color={color} roughness={0.4} />
        </mesh>
      </RigidBody>
    </group>
  );
};

// 8. Wind / Fan Zone (Pushes player horizontally)
export const WindFanZone: React.FC<{ position: [number, number, number]; size: [number, number, number]; force: [number, number, number] }> = ({ position, size, force }) => {
  return (
    <group position={position} name="wind-zone" userData={{ size, force }}>
      {/* The visual Fan blower */}
      <mesh position={[-size[0] / 2 - 0.25, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.6, 0.8, 0.5, 8]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* Transparent wind tunnel visual indicator */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={size} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.06} wireframe />
      </mesh>
    </group>
  );
};

// 9. Hanging Pendulum Hammer (Swings back and forth)
export const PendulumHammer: React.FC<{ position: [number, number, number]; length: number; speed: number; maxAngle?: number; color?: string }> = ({ position, length, speed, maxAngle = Math.PI / 3, color = '#ff007f' }) => {
  const rbRef = useRef<RapierRigidBody>(null);

  useFrame((state) => {
    const rb = rbRef.current;
    if (!rb) return;

    const time = state.clock.getElapsedTime();
    // Oscillate pendulum swing rotation around Z axis
    const angle = Math.sin(time * speed) * maxAngle;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
    
    rb.setNextKinematicRotation(q);
  });

  // Top axle sits at position + length. We offset group position to pivot point
  // and child coordinates down from the pivot.
  return (
    <group position={[position[0], position[1] + length, position[2]]}>
      {/* Supporting top axle mounting at pivot point */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.5, 0.2, 0.5]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      <RigidBody ref={rbRef} type="kinematicPosition" colliders={false} name="rotating-arm">
        {/* Rod collider - hanging down from pivot */}
        <CuboidCollider args={[0.08, length / 2, 0.08]} position={[0, -length / 2, 0]} />
        {/* Hammer head weight collider - at the bottom */}
        <CuboidCollider args={[0.55, 0.4, 0.55]} position={[0, -length + 0.3, 0]} />

        {/* Visual rod */}
        <mesh position={[0, -length / 2, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, length, 8]} />
          <meshStandardMaterial color="#777" roughness={0.4} />
        </mesh>
        
        {/* Visual hammer head */}
        <mesh position={[0, -length + 0.3, 0]} castShadow>
          <boxGeometry args={[1.0, 0.7, 1.0]} />
          <meshStandardMaterial color={color} roughness={0.2} emissive={color} emissiveIntensity={0.15} />
        </mesh>
      </RigidBody>
    </group>
  );
};


// --- NEXT-GENERATION PREMIUM OBSTACLES & SCENERY ---

// 1. Power Jump Pad (Futuristic High Launch Pad with Glowing FX)
interface PowerJumpPadProps {
  position: [number, number, number];
  boostForce?: number;
  color?: string;
}

export const PowerJumpPad: React.FC<PowerJumpPadProps> = ({ position, boostForce = 22.0, color = '#39ff14' }) => {
  const [pulse, setPulse] = useState(false);
  const particles = useRef<Array<{ pos: THREE.Vector3; vel: THREE.Vector3; scale: number }>>([]);
  const pointsRef = useRef<THREE.Points>(null);

  const handleEnter = (event: any) => {
    const otherBody = event.rigidBody;
    const otherObject = event.rigidBodyObject;
    if (otherBody && otherObject && (otherObject.name === 'player' || otherObject.name === 'bot')) {
      const vel = otherBody.linvel();
      otherBody.setLinvel({ x: vel.x * 0.5, y: boostForce, z: Math.max(vel.z * 1.2, 7.5) }, true);
      audioManager.playJump();
      
      setPulse(true);
      setTimeout(() => setPulse(false), 400);

      // Particle burst
      particles.current = Array.from({ length: 25 }).map(() => ({
        pos: new THREE.Vector3(0, 0.1, 0),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 4.0,
          Math.random() * 6.0 + 4.0,
          (Math.random() - 0.5) * 4.0
        ),
        scale: Math.random() * 0.12 + 0.05
      }));
    }
  };

  useFrame((state) => {
    if (particles.current.length > 0 && pointsRef.current) {
      const geom = pointsRef.current.geometry;
      const positions = geom.attributes.position.array as Float32Array;
      
      particles.current.forEach((p, idx) => {
        p.vel.y -= 0.15; // gravity
        p.pos.add(p.vel.clone().multiplyScalar(0.04));
        
        positions[idx * 3] = p.pos.x;
        positions[idx * 3 + 1] = p.pos.y;
        positions[idx * 3 + 2] = p.pos.z;
      });
      geom.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      {/* Outer energy rings */}
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.7, 0.08, 8, 24]} />
        <meshBasicMaterial color={pulse ? '#ffffff' : color} />
      </mesh>
      
      {/* Dynamic glowing energy column */}
      <mesh position={[0, 1.0, 0]} scale={pulse ? [1.25, 1.0, 1.25] : [1.0, 1.0, 1.0]}>
        <cylinderGeometry args={[0.55, 0.55, 2.0, 16, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={pulse ? 0.35 : 0.12} side={THREE.DoubleSide} />
      </mesh>
      
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.25, 0.6]} sensor onIntersectionEnter={handleEnter} position={[0, 0.25, 0]} />
        
        {/* Base mesh */}
        <mesh 
          castShadow 
          receiveShadow 
          position={[0, 0.05, 0]}
          scale={pulse ? [1.1, 1.2, 1.1] : [1.0, 1.0, 1.0]}
        >
          <cylinderGeometry args={[0.65, 0.65, 0.1, 16]} />
          <meshStandardMaterial color={pulse ? '#555' : '#222'} roughness={0.4} />
        </mesh>
        
        {/* Core launch button */}
        <mesh position={[0, 0.08, 0]} scale={pulse ? [1.1, 1.3, 1.1] : [1.0, 1.0, 1.0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.06, 16]} />
          <meshStandardMaterial 
            color={pulse ? '#ffffff' : color} 
            emissive={pulse ? '#ffffff' : color} 
            emissiveIntensity={pulse ? 2.0 : 0.5} 
          />
        </mesh>

        {/* Particles */}
        <points ref={pointsRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={25}
              array={new Float32Array(25 * 3)}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial size={0.15} color={color} sizeAttenuation transparent opacity={0.8} />
        </points>
      </RigidBody>
    </group>
  );
};


// 2. Decorative Tree (Supports multiple styles: pine, oak, palm, snow, autumn)
interface DecorativeTreeProps {
  position: [number, number, number];
  type?: 'pine' | 'oak' | 'palm';
  variant?: 'normal' | 'snow' | 'autumn';
  scale?: number;
}

export const DecorativeTree: React.FC<DecorativeTreeProps> = ({ position, type = 'pine', variant = 'normal', scale = 1.0 }) => {
  const trunkColor = '#5c4033';
  
  let foliageColor = '#2e8b57'; // forest green
  if (variant === 'snow') foliageColor = '#eef3f7'; // snowy white
  if (variant === 'autumn') foliageColor = '#d2691e'; // autumn orange/gold

  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* Tree Trunk */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.25, 1.6, 8]} />
        <meshStandardMaterial color={trunkColor} roughness={0.9} />
      </mesh>

      {/* Foliage */}
      {type === 'pine' && (
        <>
          <mesh position={[0, 1.8, 0]} castShadow>
            <coneGeometry args={[0.8, 1.2, 8]} />
            <meshStandardMaterial color={foliageColor} roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.4, 0]} castShadow>
            <coneGeometry args={[0.6, 1.0, 8]} />
            <meshStandardMaterial color={foliageColor} roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.9, 0]} castShadow>
            <coneGeometry args={[0.4, 0.8, 8]} />
            <meshStandardMaterial color={foliageColor} roughness={0.8} />
          </mesh>
        </>
      )}

      {type === 'oak' && (
        <mesh position={[0, 2.0, 0]} castShadow>
          <sphereGeometry args={[0.8, 8, 8]} />
          <meshStandardMaterial color={foliageColor} roughness={0.85} />
        </mesh>
      )}

      {type === 'palm' && (
        <group position={[0, 1.6, 0]}>
          {[...Array(5)].map((_, i) => (
            <mesh 
              key={i} 
              position={[0, 0, 0]} 
              rotation={[0.3, (i * Math.PI * 2) / 5, 0]} 
              castShadow
            >
              <boxGeometry args={[0.15, 0.05, 1.1]} />
              <meshStandardMaterial color="#2e8b57" roughness={0.7} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
};


// 3. Decorative Cloud (Low-poly floating puffy clouds)
interface DecorativeCloudProps {
  position: [number, number, number];
  scale?: number;
}

export const DecorativeCloud: React.FC<DecorativeCloudProps> = ({ position, scale = 1.0 }) => {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh castShadow>
        <sphereGeometry args={[1.5, 8, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} emissive="#fff" emissiveIntensity={0.05} />
      </mesh>
      <mesh position={[1.2, -0.2, 0.2]} castShadow>
        <sphereGeometry args={[1.0, 8, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh position={[-1.1, -0.1, -0.2]} castShadow>
        <sphereGeometry args={[1.1, 8, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh position={[0.2, 0.3, 1.0]} castShadow>
        <sphereGeometry args={[0.8, 8, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
    </group>
  );
};


// 4. Waving Flag
interface WavingFlagProps {
  position: [number, number, number];
  color?: string;
  height?: number;
}

export const WavingFlag: React.FC<WavingFlagProps> = ({ position, color = '#ff007f', height = 3.5 }) => {
  const flagRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (flagRef.current) {
      const time = state.clock.getElapsedTime();
      // Wave motion rotation
      flagRef.current.rotation.y = Math.sin(time * 3.5) * 0.18;
      flagRef.current.position.y = height - 0.5 + Math.sin(time * 2.0) * 0.02;
    }
  });

  return (
    <group position={position}>
      {/* Flagpole */}
      <mesh castShadow position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.07, height, 8]} />
        <meshStandardMaterial color="#dcdcdc" roughness={0.2} metalness={0.8} />
      </mesh>
      
      {/* Flagpole cap */}
      <mesh position={[0, height, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.1} metalness={0.9} />
      </mesh>

      {/* Flag Banner */}
      <mesh ref={flagRef} position={[0.5, height - 0.5, 0]} castShadow>
        <boxGeometry args={[1.0, 0.6, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  );
};


// 5. Decorative Ruins (Ancient stone columns/archways for Desert Zone)
interface DecorativeRuinsProps {
  position: [number, number, number];
  type?: 'pillar' | 'broken-pillar' | 'arch';
  scale?: number;
}

export const DecorativeRuins: React.FC<DecorativeRuinsProps> = ({ position, type = 'pillar', scale = 1.0 }) => {
  const ruinsColor = '#d2b48c'; // sandstone tan

  return (
    <group position={position} scale={[scale, scale, scale]}>
      {type === 'pillar' && (
        <mesh castShadow position={[0, 2.0, 0]}>
          <cylinderGeometry args={[0.4, 0.45, 4.0, 8]} />
          <meshStandardMaterial color={ruinsColor} roughness={0.8} />
        </mesh>
      )}

      {type === 'broken-pillar' && (
        <group>
          <mesh castShadow position={[0, 1.0, 0]}>
            <cylinderGeometry args={[0.4, 0.45, 2.0, 8]} />
            <meshStandardMaterial color={ruinsColor} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0.3, 0.2, 0.8]} rotation={[1.1, 0.4, -0.2]}>
            <cylinderGeometry args={[0.38, 0.38, 1.5, 8]} />
            <meshStandardMaterial color={ruinsColor} roughness={0.8} />
          </mesh>
        </group>
      )}

      {type === 'arch' && (
        <group>
          {/* Left Column */}
          <mesh castShadow position={[-1.5, 2.0, 0]}>
            <cylinderGeometry args={[0.35, 0.4, 4.0, 8]} />
            <meshStandardMaterial color={ruinsColor} roughness={0.8} />
          </mesh>
          {/* Right Column */}
          <mesh castShadow position={[1.5, 2.0, 0]}>
            <cylinderGeometry args={[0.35, 0.4, 4.0, 8]} />
            <meshStandardMaterial color={ruinsColor} roughness={0.8} />
          </mesh>
          {/* Top Beam */}
          <mesh castShadow position={[0, 4.2, 0]}>
            <boxGeometry args={[3.8, 0.5, 0.8]} />
            <meshStandardMaterial color={ruinsColor} roughness={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
};


// 6. Confetti Cannon (Checkpoints Celebrations)
export const ConfettiCannon: React.FC<{ position: [number, number, number]; active?: boolean }> = ({ position, active = false }) => {
  const particles = useRef<Array<{ pos: THREE.Vector3; vel: THREE.Vector3; color: string; scale: number }>>([]);
  const pointsRef = useRef<THREE.Points>(null);

  // Initialize confetti particles
  useEffect(() => {
    if (active) {
      const colors = ['#ffd60a', '#00e5ff', '#ff007f', '#bd00ff', '#39ff14'];
      particles.current = Array.from({ length: 40 }).map(() => ({
        pos: new THREE.Vector3(position[0], position[1] + 0.4, position[2]),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 4.0,
          Math.random() * 5.0 + 3.0,
          (Math.random() - 0.5) * 4.0
        ),
        color: colors[Math.floor(Math.random() * colors.length)],
        scale: Math.random() * 0.15 + 0.05
      }));
      audioManager.playCheckpoint();
    }
  }, [active]);

  useFrame(() => {
    if (active && particles.current.length > 0 && pointsRef.current) {
      const geom = pointsRef.current.geometry;
      const positions = geom.attributes.position.array as Float32Array;
      
      particles.current.forEach((p, idx) => {
        // Apply gravity
        p.vel.y -= 0.1;
        p.pos.add(p.vel.clone().multiplyScalar(0.05));
        
        positions[idx * 3] = p.pos.x;
        positions[idx * 3 + 1] = p.pos.y;
        positions[idx * 3 + 2] = p.pos.z;
      });
      geom.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* The launcher base structure */}
      <mesh position={position} castShadow>
        <cylinderGeometry args={[0.2, 0.3, 0.5, 8]} />
        <meshStandardMaterial color="#444" roughness={0.4} />
      </mesh>
      
      {/* Celebration particles */}
      {active && (
        <points ref={pointsRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={particles.current.length}
              array={new Float32Array(particles.current.length * 3)}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial size={0.15} color="#ffd60a" sizeAttenuation />
        </points>
      )}
    </group>
  );
};


// 7. Visual animated slime / water / lava Plane for Kill Zones
interface KillZonePlaneProps {
  position: [number, number, number];
  size: [number, number];
  type: 'slime' | 'water' | 'lava';
}

export const KillZonePlane: React.FC<KillZonePlaneProps> = ({ position, size, type }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const bubblesRef = useRef<THREE.Points>(null);
  const bubbles = useRef<Array<{ pos: THREE.Vector3; speed: number; phase: number }>>([]);
  
  useEffect(() => {
    // Generate random bubbles floating on the slime/water surface
    bubbles.current = Array.from({ length: 60 }).map(() => ({
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * size[0],
        0.1,
        (Math.random() - 0.5) * size[1]
      ),
      speed: Math.random() * 0.2 + 0.1,
      phase: Math.random() * Math.PI * 2
    }));
  }, [size]);

  let planeColor = '#00e5ff'; // water cyan
  let emissiveVal = '#000000';
  let intensity = 0;

  if (type === 'slime') {
    planeColor = '#ff007f'; // neon hot pink slime
    emissiveVal = '#ff007f';
    intensity = 0.5;
  } else if (type === 'lava') {
    planeColor = '#ff3300'; // lava red
    emissiveVal = '#ff3300';
    intensity = 0.8;
  }

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (meshRef.current) {
      // Wave ripple simulation
      meshRef.current.position.y = position[1] + Math.sin(time * 1.5) * 0.12;
    }

    if (bubblesRef.current && bubbles.current.length > 0) {
      const geom = bubblesRef.current.geometry;
      const positions = geom.attributes.position.array as Float32Array;

      bubbles.current.forEach((b, idx) => {
        // Animate bubble floating slightly up/down and sideways
        positions[idx * 3] = position[0] + b.pos.x + Math.sin(time + b.phase) * 0.2;
        positions[idx * 3 + 1] = position[1] + 0.1 + Math.abs(Math.sin(time * b.speed + b.phase)) * 0.4;
        positions[idx * 3 + 2] = position[2] + b.pos.z;
      });
      geom.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Main slime mesh */}
      <mesh 
        ref={meshRef} 
        position={position} 
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={size} />
        <meshStandardMaterial 
          color={planeColor} 
          roughness={0.2} 
          metalness={0.1}
          transparent
          opacity={0.88}
          emissive={emissiveVal}
          emissiveIntensity={intensity}
        />
      </mesh>

      {/* Floating foam/bubbles particles on surface */}
      <points ref={bubblesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={60}
            array={new Float32Array(60 * 3)}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial 
          size={0.24} 
          color={type === 'slime' ? '#ffd60a' : '#ffffff'} 
          sizeAttenuation 
          transparent 
          opacity={0.65} 
        />
      </points>
    </group>
  );
};


// 8. Numbered Debug Landmark / reference point for debug testing
interface DebugLandmarkProps {
  position: [number, number, number];
  number: number;
  label: string;
}

export const DebugLandmark: React.FC<DebugLandmarkProps> = ({ position, number, label }) => {
  const showDebugCheckpoints = useGameStore((state) => state.showDebugCheckpoints);

  if (!showDebugCheckpoints) return null;

  return (
    <group position={position}>
      {/* Wooden/Stone post */}
      <mesh castShadow position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.08, 0.09, 2.4, 8]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.8} /> {/* brown post */}
      </mesh>
      
      {/* Small base rock support */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.22, 0.25, 0.1, 8]} />
        <meshStandardMaterial color="#7f8c8d" roughness={0.9} />
      </mesh>

      {/* Floating Billboard Number */}
      <Billboard position={[0, 2.8, 0]}>
        {/* Signboard Backing */}
        <mesh castShadow>
          <planeGeometry args={[0.85, 0.6]} />
          <meshBasicMaterial color="#bd00ff" toneMapped={false} /> {/* neon purple */}
        </mesh>
        
        {/* High contrast border */}
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[0.91, 0.66]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>

        <Text
          position={[0, 0.08, 0.02]}
          fontSize={0.34}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fontWeight={900}
        >
          {number}
        </Text>

        <Text
          position={[0, -0.18, 0.02]}
          fontSize={0.11}
          color="#ffd60a"
          anchorX="center"
          anchorY="middle"
          fontWeight={800}
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
};


// 9. Slime Splash effect component for dynamic fall feedback
export const SlimeSplash: React.FC<{ position: [number, number, number]; color?: string }> = ({ position, color = '#ff007f' }) => {
  const particles = useRef<Array<{ pos: THREE.Vector3; vel: THREE.Vector3; scale: number }>>([]);
  const pointsRef = useRef<THREE.Points>(null);

  useEffect(() => {
    particles.current = Array.from({ length: 25 }).map(() => ({
      pos: new THREE.Vector3(0, 0, 0),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 3.5,
        Math.random() * 4.5 + 2.5,
        (Math.random() - 0.5) * 3.5
      ),
      scale: Math.random() * 0.15 + 0.08
    }));
  }, []);

  useFrame(() => {
    if (particles.current.length > 0 && pointsRef.current) {
      const geom = pointsRef.current.geometry;
      const positions = geom.attributes.position.array as Float32Array;

      particles.current.forEach((p, idx) => {
        p.vel.y -= 0.12; // gravity
        p.pos.add(p.vel.clone().multiplyScalar(0.04));
        
        positions[idx * 3] = p.pos.x;
        positions[idx * 3 + 1] = p.pos.y;
        positions[idx * 3 + 2] = p.pos.z;
      });
      geom.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={25}
            array={new Float32Array(25 * 3)}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.2} color={color} sizeAttenuation transparent opacity={0.8} />
      </points>
    </group>
  );
};
