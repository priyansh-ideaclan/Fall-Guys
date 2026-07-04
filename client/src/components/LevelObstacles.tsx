import React, { useRef, useState, useEffect, useMemo } from 'react';
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
  type?: 'pine' | 'oak' | 'palm' | 'candy';
  variant?: 'normal' | 'snow' | 'autumn' | 'candy-pink' | 'candy-yellow' | 'candy-blue' | 'candy-purple' | 'candy-green';
  scale?: number;
}

export const DecorativeTree: React.FC<DecorativeTreeProps> = ({ position, type = 'pine', variant = 'normal', scale = 1.0 }) => {
  let trunkColor = '#5c4033';
  
  let foliageColor = '#2e8b57'; // forest green
  if (variant === 'snow') foliageColor = '#eef3f7'; // snowy white
  if (variant === 'autumn') foliageColor = '#d2691e'; // autumn orange/gold

  // Candy pastel colors
  if (variant === 'candy-pink') foliageColor = '#ffb7b2';
  if (variant === 'candy-yellow') foliageColor = '#ffe57f';
  if (variant === 'candy-blue') foliageColor = '#90e0ef';
  if (variant === 'candy-purple') foliageColor = '#d8b4f8';
  if (variant === 'candy-green') foliageColor = '#a8e6cf';
  
  if (type === 'candy') {
    trunkColor = '#f5ebe0'; // pastel beige trunk
  }

  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* Tree Trunk */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={type === 'candy' ? [0.08, 0.14, 1.4, 8] : [0.15, 0.25, 1.6, 8]} />
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

      {type === 'candy' && (
        <group position={[0, 1.4, 0]}>
          {/* Main Bubble */}
          <mesh castShadow position={[0, 0.4, 0]}>
            <sphereGeometry args={[0.85, 12, 12]} />
            <meshStandardMaterial color={foliageColor} roughness={0.85} />
          </mesh>
          {/* Side bubbles */}
          <mesh castShadow position={[0.55, 0.2, 0.15]}>
            <sphereGeometry args={[0.6, 10, 10]} />
            <meshStandardMaterial color={foliageColor} roughness={0.85} />
          </mesh>
          <mesh castShadow position={[-0.55, 0.35, -0.15]}>
            <sphereGeometry args={[0.65, 10, 10]} />
            <meshStandardMaterial color={foliageColor} roughness={0.85} />
          </mesh>
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

  // Modulo styling for diverse colorful signs
  const colors = ['#ff007f', '#bd00ff', '#00e5ff', '#39ff14', '#ffd60a'];
  const baseColor = colors[number % colors.length];

  return (
    <group position={position}>
      {/* Thick Inflatable/Cartoon Post */}
      <mesh castShadow position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 2.0, 12]} />
        <meshStandardMaterial color="#ffe57f" roughness={0.4} metalness={0.1} />
      </mesh>
      
      {/* Soft rounded base column ring */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.16, 12]} />
        <meshStandardMaterial color="#f06292" roughness={0.5} />
      </mesh>

      {/* Floating Billboard Number */}
      <Billboard position={[0, 2.4, 0]}>
        {/* White Border Signboard backing */}
        <mesh castShadow position={[0, 0, -0.02]}>
          <boxGeometry args={[1.05, 0.75, 0.1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>

        {/* Inner Colored Signboard */}
        <mesh castShadow position={[0, 0, 0]}>
          <boxGeometry args={[0.95, 0.65, 0.11]} />
          <meshStandardMaterial color={baseColor} roughness={0.3} metalness={0.2} />
        </mesh>
        
        {/* Cute decorative balloon attachment */}
        <mesh position={[0.55, -0.25, -0.05]}>
          <sphereGeometry args={[0.16, 10, 10]} />
          <meshStandardMaterial color="#ff4081" roughness={0.2} />
        </mesh>
        <mesh position={[-0.55, -0.25, -0.05]}>
          <sphereGeometry args={[0.16, 10, 10]} />
          <meshStandardMaterial color="#00e5ff" roughness={0.2} />
        </mesh>

        {/* Large Floating Number */}
        <Text
          position={[0, 0.08, 0.07]}
          fontSize={0.36}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fontWeight={900}
        >
          {number}
        </Text>

        {/* Internal ID Label */}
        <Text
          position={[0, -0.18, 0.07]}
          fontSize={0.12}
          color="#ffffff"
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

// Windmill Obstacle (stands vertically, spins in X-Y plane)
interface WindmillProps {
  position: [number, number, number];
  speed: number;
  color?: string;
}

export const Windmill: React.FC<WindmillProps> = ({ position, speed, color = '#ffd60a' }) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);

  useFrame((state) => {
    const rb = rigidBodyRef.current;
    if (!rb) return;

    const time = state.clock.getElapsedTime();
    // Rotate around Z axis (X-Y plane)
    const angle = time * speed;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
    rb.setNextKinematicRotation(q);
  });

  return (
    <group position={position}>
      {/* Static vertical pillar support */}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[2.0, 0.22]} position={[0, -1.8, -0.6]} />
        {/* Support pillar centered behind the blades */}
        <mesh castShadow position={[0, -1.8, -0.6]}>
          <cylinderGeometry args={[0.2, 0.25, 4.0, 12]} />
          <meshStandardMaterial color="#4f5b66" roughness={0.5} metalness={0.8} />
        </mesh>
      </RigidBody>

      {/* Kinematic rotating Hub and Blades */}
      <RigidBody ref={rigidBodyRef} type="kinematicPosition" colliders={false} name="windmill-blade" friction={1.0} restitution={1.2}>
        {/* Hub */}
        <mesh castShadow position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.5, 16]} />
          <meshStandardMaterial color="#343d46" roughness={0.3} metalness={0.7} />
        </mesh>

        {/* 4 Blades (extending in cross shape in X-Y plane) */}
        {/* Blade 1 (UP) */}
        <group rotation={[0, 0, 0]} position={[0, 1.3, 0]}>
          <CuboidCollider args={[0.2, 1.1, 0.15]} />
          <mesh castShadow>
            <boxGeometry args={[0.4, 2.2, 0.3]} />
            <meshStandardMaterial color={color} roughness={0.2} metalness={0.2} />
          </mesh>
          {/* Visual detailing */}
          <mesh position={[0, 0, 0.16]}>
            <boxGeometry args={[0.3, 2.0, 0.02]} />
            <meshStandardMaterial color="#ff007f" roughness={0.2} />
          </mesh>
        </group>

        {/* Blade 2 (RIGHT) */}
        <group rotation={[0, 0, -Math.PI / 2]} position={[1.3, 0, 0]}>
          <CuboidCollider args={[0.2, 1.1, 0.15]} />
          <mesh castShadow>
            <boxGeometry args={[0.4, 2.2, 0.3]} />
            <meshStandardMaterial color={color} roughness={0.2} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.16]}>
            <boxGeometry args={[0.3, 2.0, 0.02]} />
            <meshStandardMaterial color="#ff007f" roughness={0.2} />
          </mesh>
        </group>

        {/* Blade 3 (DOWN) */}
        <group rotation={[0, 0, Math.PI]} position={[0, -1.3, 0]}>
          <CuboidCollider args={[0.2, 1.1, 0.15]} />
          <mesh castShadow>
            <boxGeometry args={[0.4, 2.2, 0.3]} />
            <meshStandardMaterial color={color} roughness={0.2} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.16]}>
            <boxGeometry args={[0.3, 2.0, 0.02]} />
            <meshStandardMaterial color="#ff007f" roughness={0.2} />
          </mesh>
        </group>

        {/* Blade 4 (LEFT) */}
        <group rotation={[0, 0, Math.PI / 2]} position={[-1.3, 0, 0]}>
          <CuboidCollider args={[0.2, 1.1, 0.15]} />
          <mesh castShadow>
            <boxGeometry args={[0.4, 2.2, 0.3]} />
            <meshStandardMaterial color={color} roughness={0.2} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.16]}>
            <boxGeometry args={[0.3, 2.0, 0.02]} />
            <meshStandardMaterial color="#ff007f" roughness={0.2} />
          </mesh>
        </group>
      </RigidBody>
    </group>
  );
};

// ─── PatternWindmill & HorizontalWindBlower ───────────────────────────────────

interface PatternWindmillProps {
  position: [number, number, number];
  color?: string;
  speedScale?: number;
}

export const PatternWindmill: React.FC<PatternWindmillProps> = ({ position, color = '#ffd60a', speedScale = 1.0 }) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const angleRef = useRef(0);

  useFrame((state, delta) => {
    const rb = rigidBodyRef.current;
    if (!rb) return;

    const elapsed = state.clock.getElapsedTime() * speedScale;
    const t = elapsed % 8.5; // 8.5 second repeating cycle
    
    // Pattern speeds:
    // 0s - 2s: slow (1.0 rad/s)
    // 2s - 3s: accelerate (1.0 -> 6.0 rad/s)
    // 3s - 5.5s: fast (6.0 rad/s)
    // 5.5s - 7.5s: decelerate (6.0 -> 0.0 rad/s)
    // 7.5s - 8.5s: pause (0.0 rad/s)
    let speed = 0;
    if (t < 2.0) {
      speed = 1.0;
    } else if (t < 3.0) {
      const frac = t - 2.0;
      speed = 1.0 + frac * 5.0; // linearly interpolate from 1.0 to 6.0
    } else if (t < 5.5) {
      speed = 6.0;
    } else if (t < 7.5) {
      const frac = (t - 5.5) / 2.0;
      speed = 6.0 * (1.0 - frac); // linearly decelerate from 6.0 to 0.0
    } else {
      speed = 0.0;
    }

    angleRef.current += speed * delta;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angleRef.current);
    rb.setNextKinematicRotation(q);
  });

  return (
    <group position={position}>
      {/* Thick Inflatable Vertical Pillar Support */}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[2.0, 0.35]} position={[0, -1.5, -0.6]} />
        <mesh castShadow position={[0, -1.5, -0.6]}>
          <cylinderGeometry args={[0.3, 0.35, 3.2, 16]} />
          <meshStandardMaterial color="#ff007f" roughness={0.3} metalness={0.2} /> {/* Pink pillar */}
        </mesh>
        
        {/* Soft rounded base column ring */}
        <mesh position={[0, -3.0, -0.6]}>
          <cylinderGeometry args={[0.6, 0.7, 0.3, 16]} />
          <meshStandardMaterial color="#f06292" roughness={0.5} />
        </mesh>
      </RigidBody>

      {/* Kinematic rotating Hub and Blades */}
      <RigidBody ref={rigidBodyRef} type="kinematicPosition" colliders={false} name="windmill-blade" friction={1.0} restitution={1.2}>
        {/* Large Central Hub */}
        <mesh castShadow position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.6, 0.6, 0.65, 20]} />
          <meshStandardMaterial color="#bd00ff" roughness={0.2} metalness={0.5} /> {/* Purple hub */}
        </mesh>

        {/* 4 Large Rounded Blades (extending in cross shape) */}
        {/* Blade 1 (UP) */}
        <group rotation={[0, 0, 0]} position={[0, 1.3, 0]}>
          <CuboidCollider args={[0.25, 1.1, 0.15]} />
          <mesh castShadow>
            <boxGeometry args={[0.5, 2.2, 0.3]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
          </mesh>
          {/* Rounded tip detail */}
          <mesh position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.25, 12, 12]} />
            <meshStandardMaterial color="#00e5ff" roughness={0.3} />
          </mesh>
        </group>

        {/* Blade 2 (RIGHT) */}
        <group rotation={[0, 0, -Math.PI / 2]} position={[1.3, 0, 0]}>
          <CuboidCollider args={[0.25, 1.1, 0.15]} />
          <mesh castShadow>
            <boxGeometry args={[0.5, 2.2, 0.3]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.25, 12, 12]} />
            <meshStandardMaterial color="#00e5ff" roughness={0.3} />
          </mesh>
        </group>

        {/* Blade 3 (DOWN) */}
        <group rotation={[0, 0, Math.PI]} position={[0, -1.3, 0]}>
          <CuboidCollider args={[0.25, 1.1, 0.15]} />
          <mesh castShadow>
            <boxGeometry args={[0.5, 2.2, 0.3]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.25, 12, 12]} />
            <meshStandardMaterial color="#00e5ff" roughness={0.3} />
          </mesh>
        </group>

        {/* Blade 4 (LEFT) */}
        <group rotation={[0, 0, Math.PI / 2]} position={[-1.3, 0, 0]}>
          <CuboidCollider args={[0.25, 1.1, 0.15]} />
          <mesh castShadow>
            <boxGeometry args={[0.5, 2.2, 0.3]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.25, 12, 12]} />
            <meshStandardMaterial color="#00e5ff" roughness={0.3} />
          </mesh>
        </group>
      </RigidBody>
    </group>
  );
};

interface HorizontalWindBlowerProps {
  position: [number, number, number];
  size: [number, number, number];
  baseForce: number;
  direction: 'left' | 'right';
  color?: string;
}

export const HorizontalWindBlower: React.FC<HorizontalWindBlowerProps> = ({
  position,
  size,
  baseForce,
  direction,
  color = '#00e5ff'
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const fanBladeRef = useRef<THREE.Mesh>(null);
  const audioThrottleRef = useRef(0);

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    const t = elapsed % 7.0; // 7.0s cycle
    
    // Wind cycle:
    // 0.0s - 2.0s: wind OFF (factor = 0)
    // 2.0s - 3.0s: ramp UP (factor: 0 -> 1)
    // 3.0s - 6.0s: FULL power (factor = 1)
    // 6.0s - 7.0s: ramp DOWN (factor: 1 -> 0)
    let factor = 0;
    if (t < 2.0) {
      factor = 0;
    } else if (t < 3.0) {
      factor = t - 2.0;
    } else if (t < 6.0) {
      factor = 1.0;
    } else {
      factor = 7.0 - t;
    }

    // Determine current wind force vector along X axis
    const sign = direction === 'left' ? -1 : 1;
    const forceX = baseForce * factor * sign;
    
    // Update group userData.force dynamically so players/bots detect the correct time-varying force!
    if (groupRef.current) {
      groupRef.current.userData.force = [forceX, 0, 0];
    }

    // Rotate fan blades based on current wind factor
    if (fanBladeRef.current) {
      fanBladeRef.current.rotation.y += delta * (0.5 + factor * 22.0); // fast spin when active
    }

    // Sound effect: play whoosh sound at regular intervals when wind is active
    if (factor > 0.05) {
      audioThrottleRef.current += delta;
      if (audioThrottleRef.current > 0.14) {
        audioThrottleRef.current = 0;
        audioManager.playWindWhoosh(factor); // dynamic volume and frequency based on ramp
      }
    } else {
      audioThrottleRef.current = 0;
    }

    // Animate wind particles inside the group
    const particles = groupRef.current?.children.filter((child) => child.name === 'wind-streak');
    if (particles) {
      particles.forEach((p, idx) => {
        // Shift particle position along X axis based on wind direction
        p.position.x += delta * 15.0 * sign * (0.4 + factor * 1.2);
        
        // Wrap around if it goes outside bounds
        const halfWidth = size[0] / 2;
        if (sign > 0 && p.position.x > halfWidth) {
          p.position.x = -halfWidth;
        } else if (sign < 0 && p.position.x < -halfWidth) {
          p.position.x = halfWidth;
        }
        
        // scale visual opacity based on wind factor
        const mesh = p as THREE.Mesh;
        if (mesh.material) {
          (mesh.material as THREE.MeshBasicMaterial).opacity = factor * 0.16 * (0.3 + 0.7 * Math.sin(state.clock.getElapsedTime() * 4 + idx));
        }
      });
    }
  });

  // Generate 8 wind particle coordinates deterministically inside the zone volume
  const particleConfigs = useMemo<Array<{ pos: [number, number, number] }>>(() => {
    const arr: Array<{ pos: [number, number, number] }> = [];
    for (let i = 0; i < 8; i++) {
      const rx = (Math.random() - 0.5) * size[0];
      const ry = (Math.random() - 0.5) * size[1] + 0.5;
      const rz = (Math.random() - 0.5) * size[2];
      arr.push({ pos: [rx, ry, rz] });
    }
    return arr;
  }, [size]);

  // Position of the fan body
  const fanX = direction === 'left' ? size[0] / 2 + 0.35 : -size[0] / 2 - 0.35;
  const fanRot = direction === 'left' ? Math.PI / 2 : -Math.PI / 2;

  return (
    <group ref={groupRef} position={position} name="wind-zone" userData={{ size, force: [0, 0, 0] }}>
      {/* 1. Large Stylized Fan Blower body */}
      <group position={[fanX, 0.5, 0]} rotation={[0, 0, fanRot]}>
        {/* Base cylinder housing */}
        <mesh castShadow>
          <cylinderGeometry args={[0.75, 0.85, 0.6, 12]} />
          <meshStandardMaterial color="#455a64" roughness={0.4} metalness={0.7} />
        </mesh>
        
        {/* Blower exhaust guard rim */}
        <mesh position={[0, 0.31, 0]}>
          <cylinderGeometry args={[0.82, 0.82, 0.12, 12]} />
          <meshStandardMaterial color="#37474f" roughness={0.2} />
        </mesh>
        
        {/* Colorful visual cap accent */}
        <mesh position={[0, -0.31, 0]}>
          <cylinderGeometry args={[0.65, 0.7, 0.1, 12]} />
          <meshStandardMaterial color={color} roughness={0.3} />
        </mesh>

        {/* Rotating Blades */}
        <mesh ref={fanBladeRef} position={[0, 0.2, 0]}>
          <boxGeometry args={[1.3, 0.1, 0.15]} />
          <meshStandardMaterial color="#ffffff" roughness={0.1} />
        </mesh>
      </group>

      {/* 2. Visual Wind streaks */}
      {particleConfigs.map((cfg: { pos: [number, number, number] }, idx: number) => (
        <mesh key={idx} name="wind-streak" position={cfg.pos}>
          <boxGeometry args={[0.8, 0.04, 0.04]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.0} />
        </mesh>
      ))}

      {/* 3. Transparent wind tunnel visual indicator bounds */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={size} />
        <meshBasicMaterial color={color} transparent opacity={0.03} wireframe />
      </mesh>
    </group>
  );
};

// Cartoon Drifting Cloud
interface DriftingCloudProps {
  position: [number, number, number];
  scale?: number;
  speed?: number;
}

export const DriftingCloud: React.FC<DriftingCloudProps> = ({ position, scale = 1.0, speed = 0.6 }) => {
  const groupRef = useRef<THREE.Group>(null);
  const startPos = useRef(new THREE.Vector3(...position));

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    // Drift along Z
    groupRef.current.position.z += delta * speed;
    
    // Wrap around once Z goes past 160 (restarts at -30)
    if (groupRef.current.position.z > 165.0) {
      groupRef.current.position.z = -30.0;
    }
  });

  return (
    <group ref={groupRef} position={startPos.current} scale={[scale, scale, scale]}>
      {/* Puffy clouds meshes */}
      <mesh castShadow>
        <sphereGeometry args={[2.0, 10, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} emissive="#ffffff" emissiveIntensity={0.03} />
      </mesh>
      <mesh position={[1.5, -0.2, 0.3]} castShadow>
        <sphereGeometry args={[1.3, 8, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh position={[-1.4, -0.1, -0.2]} castShadow>
        <sphereGeometry args={[1.4, 8, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh position={[0.2, 0.4, 1.2]} castShadow>
        <sphereGeometry args={[1.0, 8, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
    </group>
  );
};

// Rolling candy landscape hill with topographic contours
interface CandyHillProps {
  position: [number, number, number];
  radius: number;
  color?: string;
}

export const CandyHill: React.FC<CandyHillProps> = ({ position, radius, color = '#8ae960' }) => {
  return (
    <group position={position}>
      {/* Main Hill sphere */}
      <mesh receiveShadow castShadow>
        <sphereGeometry args={[radius, 20, 20]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>

      {/* Styled Topographic Contour Lines - White rings wrapping the hill */}
      <mesh position={[0, radius * 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 0.7, 0.05, 8, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
      </mesh>
      <mesh position={[0, radius * 0.65, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 0.45, 0.04, 8, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
      </mesh>
    </group>
  );
};

// Snow-capped pink mountains
interface CandyMountainProps {
  position: [number, number, number];
  radius: number;
  height: number;
}

export const CandyMountain: React.FC<CandyMountainProps> = ({ position, radius, height }) => {
  return (
    <group position={position}>
      {/* Pink mountain base */}
      <mesh castShadow receiveShadow>
        <coneGeometry args={[radius, height, 5, 1]} />
        <meshStandardMaterial color="#ffb7b2" roughness={0.9} />
      </mesh>

      {/* Snow cap */}
      <mesh position={[0, height * 0.325, 0]}>
        <coneGeometry args={[radius * 0.35, height * 0.35, 5, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </mesh>
    </group>
  );
};
