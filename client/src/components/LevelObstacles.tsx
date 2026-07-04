import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { Text, Billboard, Html } from '@react-three/drei';
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
  const cooldownRef = useRef<Record<string, number>>({});

  useFrame((state) => {
    const rb = rigidBodyRef.current;
    if (!rb) return;

    const time = state.clock.getElapsedTime();
    const angle = time * speed;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    
    rb.setNextKinematicRotation(q);
  });

  const handleHit = (event: any) => {
    const otherBody: RapierRigidBody | undefined = event.rigidBody;
    const otherObj = event.rigidBodyObject;
    if (!otherBody || !otherObj) return;
    if (otherObj.name !== 'player' && otherObj.name !== 'bot') return;

    // Throttle: max one knockback per body per 0.6s
    const id = otherObj.uuid || otherObj.name;
    const now = performance.now() / 1000;
    if (cooldownRef.current[id] && now - cooldownRef.current[id] < 0.6) return;
    cooldownRef.current[id] = now;

    // Compute radial knockback direction from pivot to target
    const pivotWorld = new THREE.Vector3(...position);
    const targetPos = otherBody.translation();
    const radialDir = new THREE.Vector3(
      targetPos.x - pivotWorld.x,
      0,
      targetPos.z - pivotWorld.z
    ).normalize();

    // Tangential direction (perpendicular, matching rotation direction)
    const sign = speed >= 0 ? 1 : -1;
    const tangentialDir = new THREE.Vector3(
      -radialDir.z * sign,
      0,
      radialDir.x * sign
    );

    // Strong combined knockback: 70% sweep + 30% push outward
    const KNOCK = 16.5;
    const UP_BOOST = 6.2;
    const kx = (tangentialDir.x * 0.7 + radialDir.x * 0.3) * KNOCK;
    const kz = (tangentialDir.z * 0.7 + radialDir.z * 0.3) * KNOCK;

    otherBody.setLinvel({ x: kx, y: UP_BOOST, z: kz }, true);
    audioManager.playJump?.();
  };

  return (
    <group position={position} name={name}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[height / 2, 0.2]} position={[0, height / 2, 0]} />
        <mesh castShadow position={[0, height / 2, 0]}>
          <cylinderGeometry args={[0.15, 0.2, height, 12]} />
          <meshStandardMaterial color="#444" roughness={0.5} />
        </mesh>
      </RigidBody>

      <RigidBody
        ref={rigidBodyRef}
        type="kinematicPosition"
        colliders="cuboid"
        name={name}
        onCollisionEnter={handleHit}
        friction={0.8}
        restitution={1.2}
        userData={{ speed }}
      >
        <mesh castShadow position={[0, height - 0.15, 0]}>
          <boxGeometry args={[radius * 2, 0.25, 0.15]} />
          <meshStandardMaterial color={color} roughness={0.2} emissive={color} emissiveIntensity={0.2} />
        </mesh>
      </RigidBody>
    </group>
  );
};

interface JumpPadProps {
  position: [number, number, number];
  boostForce?: number;
  color?: string;
  scale?: number;
  boostZ?: number;
}

export const JumpPad: React.FC<JumpPadProps> = ({ position, boostForce = 12.5, color = '#00e5ff', scale = 1.0, boostZ }) => {
  const [pulse, setPulse] = useState(false);
  const particles = useRef<Array<{ pos: THREE.Vector3; vel: THREE.Vector3; scale: number }>>([]);
  const pointsRef = useRef<THREE.Points>(null);

  const handleEnter = (event: any) => {
    const otherBody = event.rigidBody;
    const otherObject = event.rigidBodyObject;
    if (otherBody && otherObject && (otherObject.name === 'player' || otherObject.name === 'bot')) {
      const vel = otherBody.linvel();
      const zSpeed = boostZ !== undefined ? boostZ : (Math.max(0, vel.z) * 0.2 + 1.2);
      otherBody.setLinvel({ x: vel.x * 0.5, y: boostForce, z: zSpeed }, true);
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

  // Manually compute dimensions to avoid scaling the RigidBody parent group
  const baseRadius = 0.85 * scale;
  const padHeight = 0.08 * scale;
  const ringRadiusInner = 0.8 * scale;
  const ringRadiusOuter = 1.05 * scale;
  
  // CylinderCollider args: [halfHeight, radius]
  // We make the trigger a tall vertical column and add a 10% radius buffer to catch all edge touches and jump-ins
  const colliderHalfHeight = 1.2 * scale;
  const colliderRadius = baseRadius * 1.1;
  const colliderY = 1.2 * scale;

  return (
    <group position={position}>
      <mesh receiveShadow position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ringRadiusInner, ringRadiusOuter, 24]} />
        <meshStandardMaterial color={pulse ? '#ffffff' : '#ffd60a'} roughness={0.2} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[colliderHalfHeight, colliderRadius]} sensor onIntersectionEnter={handleEnter} position={[0, colliderY, 0]} />
        <mesh 
          castShadow 
          receiveShadow 
          position={[0, padHeight / 2, 0]}
          scale={pulse ? [1.15, 1.3, 1.15] : [1.0, 1.0, 1.0]}
        >
          <cylinderGeometry args={[baseRadius, baseRadius, padHeight, 12]} />
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

// ─── Seesaw ───────────────────────────────────────────────────────────────────
// Physics-accurate seesaw: plank is a kinematic RigidBody that tilts around a
// fixed central pivot based on the sum of all characters' weight × offset.
// The 'axis' prop controls which horizontal axis tilts:
//   'x' → plank tilts left/right  (rotation around world X — front-back weight)
//   'z' → plank tilts forward/backward  (rotation around world Z — side-side weight)

interface SeesawProps {
  position: [number, number, number];
  length?: number;   // full plank length (along the non-pivot horizontal axis)
  width?: number;    // plank width (perpendicular)
  thickness?: number;
  axis?: 'x' | 'z'; // pivot axis direction
  color?: string;
  pivotColor?: string;
}

export const Seesaw: React.FC<SeesawProps> = ({
  position,
  length = 6.0,
  width = 3.0,
  thickness = 0.28,
  axis = 'z',
  color = '#ffd60a',
  pivotColor = '#555555',
}) => {
  const rbRef = useRef<RapierRigidBody>(null);
  // Visual group ref for the pivot-relative display
  const visualRef = useRef<THREE.Group>(null);

  // Physics state
  const angleRef = useRef(0);         // current tilt angle (radians)
  const angVelRef = useRef(0);        // angular velocity (rad/s)

  const STIFFNESS = 2.4;    // how strongly weight drives rotation
  const DAMPING   = 0.88;   // angular velocity damping per frame (0-1)
  const MAX_ANGLE = Math.PI / 5.2;  // ~34°

  // Plank half-extents for the collider
  // axis='z': plank is long in Z → pivot tilts around Z, long axis = Z
  // axis='x': plank is long in X → pivot tilts around X, long axis = X
  const halfLong  = length / 2;
  const halfWide  = width / 2;
  const halfThick = thickness / 2;

  // Collider args: [halfX, halfY, halfZ]
  const colliderArgs: [number, number, number] = axis === 'z'
    ? [halfWide, halfThick, halfLong]
    : [halfLong, halfThick, halfWide];

  useFrame((state, delta) => {
    const rb = rbRef.current;
    if (!rb) return;

    // ── 1. Compute net torque from weight (signed offset on the pivot axis) ──
    let netTorque = 0;

    const scan = (obj: THREE.Object3D) => {
      const d = obj.position.clone().sub(new THREE.Vector3(...position));
      const onPlank = Math.abs(d.x) < halfWide + 0.5 && Math.abs(d.z) < halfLong + 0.5;
      if (!onPlank) return;
      // For axis='z', weight imbalance comes from X offset (right vs left)
      // For axis='x', weight imbalance comes from Z offset (front vs back)
      const offset = axis === 'z' ? d.x : d.z;
      netTorque += offset;
    };

    const player = state.scene.getObjectByName('player');
    if (player) scan(player);
    state.scene.children
      .filter(c => c.name === 'bot')
      .forEach(scan);

    // ── 2. Integrate angular velocity ──
    const targetAngVel = netTorque * STIFFNESS * delta;
    angVelRef.current = angVelRef.current * DAMPING + targetAngVel;
    angleRef.current = THREE.MathUtils.clamp(
      angleRef.current + angVelRef.current,
      -MAX_ANGLE,
      MAX_ANGLE,
    );

    // Snap back toward 0 when nobody is on it
    if (Math.abs(netTorque) < 0.05) {
      angleRef.current = THREE.MathUtils.lerp(angleRef.current, 0, 0.018);
      angVelRef.current *= 0.92;
    }

    // ── 3. Update kinematic RigidBody position + rotation ──
    const angle = angleRef.current;
    const quat = new THREE.Quaternion();
    if (axis === 'z') {
      quat.setFromEuler(new THREE.Euler(0, 0, angle));
    } else {
      quat.setFromEuler(new THREE.Euler(angle, 0, 0));
    }

    rb.setNextKinematicTranslation({
      x: position[0],
      y: position[1],
      z: position[2],
    });
    rb.setNextKinematicRotation(quat);
  });

  return (
    <group>
      {/* ── Pivot fulcrum (triangular wedge shape: two boxes) ── */}
      {/* Base block */}
      <mesh castShadow position={[position[0], position[1] - thickness - 0.22, position[2]]}>
        <boxGeometry args={[0.7, 0.44, 0.7]} />
        <meshStandardMaterial color={pivotColor} roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Narrow top wedge */}
      <mesh castShadow position={[position[0], position[1] - thickness * 0.5, position[2]]}>
        <cylinderGeometry args={[0.12, 0.32, 0.44, 8]} />
        <meshStandardMaterial color={pivotColor} roughness={0.4} metalness={0.4} />
      </mesh>

      {/* ── Seesaw plank — kinematic RigidBody ── */}
      <RigidBody
        ref={rbRef}
        type="kinematicPosition"
        colliders={false}
        position={position}
        friction={0.85}
        restitution={0.05}
      >
        <CuboidCollider args={colliderArgs} />
        <mesh castShadow receiveShadow>
          {axis === 'z'
            ? <boxGeometry args={[width, thickness, length]} />
            : <boxGeometry args={[length, thickness, width]} />
          }
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.12} />
        </mesh>

        {/* ── End markers — coloured caps to show which end is which ── */}
        {axis === 'z' ? (
          <>
            <mesh position={[0, thickness * 0.5, -halfLong + 0.18]} castShadow>
              <boxGeometry args={[width - 0.1, 0.1, 0.36]} />
              <meshStandardMaterial color="#ff007f" roughness={0.2} emissive="#ff007f" emissiveIntensity={0.35} />
            </mesh>
            <mesh position={[0, thickness * 0.5, halfLong - 0.18]} castShadow>
              <boxGeometry args={[width - 0.1, 0.1, 0.36]} />
              <meshStandardMaterial color="#00e5ff" roughness={0.2} emissive="#00e5ff" emissiveIntensity={0.35} />
            </mesh>
          </>
        ) : (
          <>
            <mesh position={[-halfLong + 0.18, thickness * 0.5, 0]} castShadow>
              <boxGeometry args={[0.36, 0.1, width - 0.1]} />
              <meshStandardMaterial color="#ff007f" roughness={0.2} emissive="#ff007f" emissiveIntensity={0.35} />
            </mesh>
            <mesh position={[halfLong - 0.18, thickness * 0.5, 0]} castShadow>
              <boxGeometry args={[0.36, 0.1, width - 0.1]} />
              <meshStandardMaterial color="#00e5ff" roughness={0.2} emissive="#00e5ff" emissiveIntensity={0.35} />
            </mesh>
          </>
        )}
      </RigidBody>
    </group>
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
// ─── BumpyPillar ──────────────────────────────────────────────────────────────
// Rotating cylinder with protruding bumps (spheres) around its circumference.
// Physics: kinematicPosition RigidBody → bumps act as real collision surfaces.
// Knockback: tangential (sweep direction) + radial (outward) + vertical pop.

interface BumpyPillarProps {
  position: [number, number, number];
  speed?: number;       // rad/s — positive = CCW, negative = CW
  color?: string;       // pillar body color
  bumpColor?: string;   // bump sphere color (defaults to a contrasting accent)
  radius?: number;      // pillar body radius
  height?: number;      // total pillar height
  bumpCount?: number;   // bumps per ring
  rings?: number;       // how many bump rings (1 or 2)
}

export const BumpyPillar: React.FC<BumpyPillarProps> = ({
  position,
  speed = 1.5,
  color = '#ff007f',
  bumpColor,
  radius = 0.38,
  height = 2.0,
  bumpCount = 5,
  rings = 2,
}) => {
  const rbRef = useRef<RapierRigidBody>(null);
  const angleRef = useRef(0);
  const cooldownRef = useRef<Record<string, number>>({});

  const BUMP_RADIUS = 0.26;
  const BUMP_DIST   = radius + BUMP_RADIUS + 0.04; // centre of bump from axis
  const KNOCK       = 16.0;
  const UP_BOOST    = 5.5;
  const COOLDOWN    = 0.55;

  // Angles for each bump around the circle
  const bumpAngles = useMemo(
    () => Array.from({ length: bumpCount }, (_, i) => (i / bumpCount) * Math.PI * 2),
    [bumpCount],
  );

  // Ring Y-offsets relative to pillar centre (negative = lower, positive = upper)
  const ringOffsets = rings >= 2 ? [-0.38, 0.38] : [0];

  // ── Rotate pillar each frame ──
  useFrame((_state, delta) => {
    const rb = rbRef.current;
    if (!rb) return;
    angleRef.current += speed * delta;
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      angleRef.current,
    );
    rb.setNextKinematicTranslation({ x: position[0], y: position[1], z: position[2] });
    rb.setNextKinematicRotation(q);
  });

  // ── Knockback on bump contact ──
  const handleHit = (event: any) => {
    const otherBody: RapierRigidBody | undefined = event.rigidBody;
    const otherObj = event.rigidBodyObject;
    if (!otherBody || !otherObj) return;
    if (otherObj.name !== 'player' && otherObj.name !== 'bot') return;

    const id = otherObj.uuid ?? otherObj.name;
    const now = performance.now() / 1000;
    if (cooldownRef.current[id] && now - cooldownRef.current[id] < COOLDOWN) return;
    cooldownRef.current[id] = now;

    // Direction from pillar axis to target (radial)
    const pivot = new THREE.Vector3(...position);
    const t = otherBody.translation();
    const radialDir = new THREE.Vector3(t.x - pivot.x, 0, t.z - pivot.z).normalize();

    // Tangential: perpendicular to radial, in the sweep direction of the spin
    const sign = speed >= 0 ? 1 : -1;
    const tangDir = new THREE.Vector3(-radialDir.z * sign, 0, radialDir.x * sign);

    // 65% tangential sweep + 35% radial push
    const kx = (tangDir.x * 0.65 + radialDir.x * 0.35) * KNOCK;
    const kz = (tangDir.z * 0.65 + radialDir.z * 0.35) * KNOCK;
    otherBody.setLinvel({ x: kx, y: UP_BOOST, z: kz }, true);
    audioManager.playJump?.();
  };

  const resolvedBumpColor = bumpColor ?? (color === '#ff007f' ? '#ffd60a' : '#ff007f');

  return (
    <group>
      {/* ── Decorative base ring (fixed, no physics needed) ── */}
      <mesh position={[position[0], position[1] - height / 2 - 0.05, position[2]]} receiveShadow>
        <cylinderGeometry args={[radius * 2.0, radius * 2.2, 0.14, 20]} />
        <meshStandardMaterial color="#222" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[position[0], position[1] - height / 2 + 0.02, position[2]]}>
        <cylinderGeometry args={[radius * 1.5, radius * 1.55, 0.08, 20]} />
        <meshStandardMaterial color={color} roughness={0.15} metalness={0.5}
          emissive={color} emissiveIntensity={0.4} />
      </mesh>

      {/* ── Kinematic rotating body: pillar + bump colliders + visuals ── */}
      <RigidBody
        ref={rbRef}
        type="kinematicPosition"
        colliders={false}
        position={position}
        onCollisionEnter={handleHit}
      >
        {/* Main cylinder collider */}
        <CylinderCollider args={[height / 2, radius]} />

        {/* Bump colliders — one CuboidCollider per bump per ring */}
        {ringOffsets.map((yOff, ri) =>
          bumpAngles.map((angle, bi) => (
            <CuboidCollider
              key={`col-${ri}-${bi}`}
              args={[BUMP_RADIUS, BUMP_RADIUS, BUMP_RADIUS]}
              position={[
                Math.cos(angle) * BUMP_DIST,
                yOff,
                Math.sin(angle) * BUMP_DIST,
              ]}
            />
          )),
        )}

        {/* ── Pillar body visual ── */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[radius * 0.95, radius, height, 20]} />
          <meshStandardMaterial
            color={color}
            roughness={0.18}
            metalness={0.28}
            emissive={color}
            emissiveIntensity={0.12}
          />
        </mesh>

        {/* Spiral stripe painted on pillar surface (decorative ring meshes) */}
        {[0.38, 0.0, -0.38].map((yy, i) => (
          <mesh key={i} position={[0, yy, 0]}>
            <torusGeometry args={[radius + 0.01, 0.04, 8, 24]} />
            <meshStandardMaterial color={resolvedBumpColor} roughness={0.1} metalness={0.5}
              emissive={resolvedBumpColor} emissiveIntensity={0.3} />
          </mesh>
        ))}

        {/* Top cap sphere */}
        <mesh position={[0, height / 2 + 0.02, 0]} castShadow>
          <sphereGeometry args={[radius * 1.1, 16, 16]} />
          <meshStandardMaterial color={resolvedBumpColor} roughness={0.1} metalness={0.5}
            emissive={resolvedBumpColor} emissiveIntensity={0.4} />
        </mesh>

        {/* ── Bump spheres (visuals) — two rings ── */}
        {ringOffsets.map((yOff, ri) =>
          bumpAngles.map((angle, bi) => (
            <mesh
              key={`vis-${ri}-${bi}`}
              position={[
                Math.cos(angle) * BUMP_DIST,
                yOff,
                Math.sin(angle) * BUMP_DIST,
              ]}
              castShadow
            >
              <sphereGeometry args={[BUMP_RADIUS, 14, 14]} />
              <meshStandardMaterial
                color={resolvedBumpColor}
                roughness={0.12}
                metalness={0.45}
                emissive={resolvedBumpColor}
                emissiveIntensity={0.25}
              />
            </mesh>
          )),
        )}
      </RigidBody>
    </group>
  );
};

// ─── SpinningHammer ──────────────────────────────────────────────────────────

interface SpinningHammerProps {
  position: [number, number, number];
  speed: number;             // base rad/s, positive = CCW, negative = CW
  armLength?: number;        // half-arm length, default 2.4
  color?: string;            // hammer head color
  armColor?: string;         // arm bar color
  variable?: boolean;        // if true, speed oscillates slow→fast→slow
  mountingHeight?: number;   // height of rotating arm
}

export const SpinningHammer: React.FC<SpinningHammerProps> = ({
  position,
  speed,
  armLength = 2.4,
  color = '#ff2d6f',
  armColor = '#ffe033',
  variable = false,
  mountingHeight = 1.2,
}) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const angleRef = useRef(0);
  const cooldownRef = useRef<Record<string, number>>({});
  const armHalf = armLength;

  useFrame((_state, delta) => {
    const rb = rigidBodyRef.current;
    if (!rb) return;

    // Variable speed: oscillates between 0.4× and 2.5× base using a sine wave
    let effectiveSpeed = speed;
    if (variable) {
      const t = _state.clock.getElapsedTime();
      const factor = 0.5 + 1.5 * (0.5 + 0.5 * Math.sin(t * 0.7));
      effectiveSpeed = speed * factor;
    }
    angleRef.current += effectiveSpeed * delta;
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      angleRef.current
    );
    rb.setNextKinematicRotation(q);
  });

  // Called by Rapier when the rotating arm contacts a dynamic body
  const handleHit = (event: any) => {
    const otherBody: RapierRigidBody | undefined = event.rigidBody;
    const otherObj = event.rigidBodyObject;
    if (!otherBody || !otherObj) return;
    if (otherObj.name !== 'player' && otherObj.name !== 'bot') return;

    // Throttle: max one knockback per body per 0.6s
    const id = otherObj.uuid || otherObj.name;
    const now = performance.now() / 1000;
    if (cooldownRef.current[id] && now - cooldownRef.current[id] < 0.6) return;
    cooldownRef.current[id] = now;

    // Compute radial knockback direction from pivot to target
    const pivotWorld = new THREE.Vector3(...position);
    const targetPos = otherBody.translation();
    const radialDir = new THREE.Vector3(
      targetPos.x - pivotWorld.x,
      0,
      targetPos.z - pivotWorld.z
    ).normalize();

    // Tangential direction (perpendicular, matching hammer rotation direction)
    const sign = speed >= 0 ? 1 : -1;
    const tangentialDir = new THREE.Vector3(
      -radialDir.z * sign,
      0,
      radialDir.x * sign
    );

    // Combined knockback: 70% tangential (sweep direction) + 30% radial (outward)
    const KNOCK = 18.0;
    const UP_BOOST = 7.0;
    const kx = (tangentialDir.x * 0.7 + radialDir.x * 0.3) * KNOCK;
    const kz = (tangentialDir.z * 0.7 + radialDir.z * 0.3) * KNOCK;

    otherBody.setLinvel({ x: kx, y: UP_BOOST, z: kz }, true);
    audioManager.playJump?.();
  };

  return (
    <group position={position}>
      {/* Fixed base pillar */}
      <RigidBody type="fixed" colliders={false}>
        {/* Base disc ring – large glossy accent */}
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <cylinderGeometry args={[1.0, 1.08, 0.1, 28]} />
          <meshStandardMaterial color="#bd00ff" roughness={0.2} metalness={0.5} />
        </mesh>
        {/* Inner gold ring */}
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.7, 0.72, 0.08, 28]} />
          <meshStandardMaterial color="#ffd60a" roughness={0.15} metalness={0.6}
            emissive="#ffd60a" emissiveIntensity={0.4} />
        </mesh>
        {/* Pillar shaft */}
        <CylinderCollider args={[mountingHeight / 2, 0.32]} position={[0, mountingHeight / 2, 0]} />
        <mesh castShadow position={[0, mountingHeight / 2, 0]}>
          <cylinderGeometry args={[0.28, 0.32, mountingHeight, 18]} />
          <meshStandardMaterial color="#ff007f" roughness={0.2} metalness={0.35} />
        </mesh>
        {/* Pillar top cap sphere */}
        <mesh position={[0, mountingHeight + 0.06, 0]} castShadow>
          <sphereGeometry args={[0.32, 18, 18]} />
          <meshStandardMaterial color="#ff5fab" roughness={0.1} metalness={0.55} />
        </mesh>
      </RigidBody>

      {/* Kinematic rotating arm + hammer heads — explicit knockback via onCollisionEnter */}
      <RigidBody
        ref={rigidBodyRef}
        type="kinematicPosition"
        colliders={false}
        name="spinning-hammer"
        onCollisionEnter={handleHit}
      >
        {/* Arm bar collider + mesh */}
        <CuboidCollider args={[armHalf, 0.16, 0.16]} position={[0, mountingHeight, 0]} />
        <mesh castShadow position={[0, mountingHeight, 0]}>
          <boxGeometry args={[armHalf * 2, 0.32, 0.32]} />
          <meshStandardMaterial color={armColor} roughness={0.18} metalness={0.35} />
        </mesh>
        {/* Arm highlight gloss stripe */}
        <mesh position={[0, mountingHeight + 0.06, 0]}>
          <boxGeometry args={[armHalf * 2, 0.06, 0.36]} />
          <meshStandardMaterial color="#ffffff" roughness={0.1} opacity={0.45} transparent />
        </mesh>

        {/* ── Hammer Head A (positive X end) ── */}
        <group position={[armHalf, mountingHeight, 0]}>
          <CuboidCollider args={[0.42, 0.42, 0.6]} />
          {/* Main body */}
          <mesh castShadow>
            <boxGeometry args={[0.84, 0.84, 1.2]} />
            <meshStandardMaterial color={color} roughness={0.12} metalness={0.25} />
          </mesh>
          {/* Glossy face plate */}
          <mesh position={[0, 0, 0.65]}>
            <cylinderGeometry args={[0.36, 0.36, 0.07, 22]} />
            <meshStandardMaterial color="#ffffff" roughness={0.04} metalness={0.7} />
          </mesh>
          {/* Rounded tip sphere */}
          <mesh position={[0, 0, 0.72]}>
            <sphereGeometry args={[0.38, 18, 18]} />
            <meshStandardMaterial color="#ffccdd" roughness={0.08} metalness={0.45} />
          </mesh>
          {/* Side stripe accent */}
          <mesh position={[0, 0.44, 0]}>
            <boxGeometry args={[0.88, 0.07, 1.24]} />
            <meshStandardMaterial color="#ffd60a" roughness={0.18} />
          </mesh>
        </group>

        {/* ── Hammer Head B (negative X end, mirrored) ── */}
        <group position={[-armHalf, mountingHeight, 0]}>
          <CuboidCollider args={[0.42, 0.42, 0.6]} />
          <mesh castShadow>
            <boxGeometry args={[0.84, 0.84, 1.2]} />
            <meshStandardMaterial color={color} roughness={0.12} metalness={0.25} />
          </mesh>
          <mesh position={[0, 0, -0.65]}>
            <cylinderGeometry args={[0.36, 0.36, 0.07, 22]} />
            <meshStandardMaterial color="#ffffff" roughness={0.04} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0, -0.72]}>
            <sphereGeometry args={[0.38, 18, 18]} />
            <meshStandardMaterial color="#ffccdd" roughness={0.08} metalness={0.45} />
          </mesh>
          <mesh position={[0, 0.44, 0]}>
            <boxGeometry args={[0.88, 0.07, 1.24]} />
            <meshStandardMaterial color="#ffd60a" roughness={0.18} />
          </mesh>
        </group>
      </RigidBody>
    </group>
  );
};


// ─── CurvedSlide ──────────────────────────────────────────────────────────────
// Procedurally generates a low-friction slide made of segments.
// Supports sideOffset to create customizable curves, and automatically
// renders side-guard walls to keep players and bots in the lane.

interface CurvedSlideProps {
  startX: number;
  endX: number;
  startY: number;
  endY: number;
  startZ: number;
  endZ: number;
  width: number;
  color: string;
  sideOffset?: number; // horizontal s-curve offset
  segmentsCount?: number;
  roughness?: number;
  metalness?: number;
  opacity?: number;
}

export const CurvedSlide: React.FC<CurvedSlideProps> = ({
  startX,
  endX,
  startY,
  endY,
  startZ,
  endZ,
  width,
  color,
  sideOffset = 0,
  segmentsCount = 8,
  roughness = 0.1,
  metalness = 0.3,
  opacity = 0.9,
}) => {
  // Generate segment properties
  const segments = useMemo(() => {
    const arr = [];
    const getPoint = (t: number) => {
      const x = startX + (endX - startX) * t + sideOffset * Math.sin(t * Math.PI);
      const y = startY + (endY - startY) * t;
      const z = startZ + (endZ - startZ) * t;
      return new THREE.Vector3(x, y, z);
    };

    for (let i = 0; i < segmentsCount; i++) {
      const t0 = i / segmentsCount;
      const t1 = (i + 1) / segmentsCount;
      const p0 = getPoint(t0);
      const p1 = getPoint(t1);

      const center = p0.clone().add(p1).multiplyScalar(0.5);
      const dir = p1.clone().sub(p0);
      const length = dir.length();

      const pitch = Math.atan2(-dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
      const yaw = Math.atan2(dir.x, dir.z);

      arr.push({
        position: [center.x, center.y, center.z] as [number, number, number],
        rotation: [pitch, yaw, 0] as [number, number, number],
        length,
      });
    }
    return arr;
  }, [startX, endX, startY, endY, startZ, endZ, sideOffset, segmentsCount]);

  const isTransparent = opacity < 1.0;

  return (
    <group>
      {segments.map((seg, idx) => (
        <RigidBody
          key={idx}
          type="fixed"
          colliders="cuboid"
          position={seg.position}
          rotation={seg.rotation}
          friction={0.015}
          restitution={0.05}
          userData={{ surface: 'slide' }}
        >
          {/* Main Slide Floor */}
          <mesh castShadow receiveShadow userData={{ surface: 'slide' }}>
            <boxGeometry args={[width, 0.2, seg.length + 0.02]} />
            <meshStandardMaterial
              color={color}
              roughness={roughness}
              metalness={metalness}
              transparent={isTransparent}
              opacity={opacity}
            />
          </mesh>

          {/* Left Guard Wall */}
          <mesh position={[-width / 2 - 0.08, 0.28, 0]} castShadow>
            <boxGeometry args={[0.16, 0.56, seg.length + 0.02]} />
            <meshStandardMaterial color="#333333" roughness={0.5} />
          </mesh>

          {/* Right Guard Wall */}
          <mesh position={[width / 2 + 0.08, 0.28, 0]} castShadow>
            <boxGeometry args={[0.16, 0.56, seg.length + 0.02]} />
            <meshStandardMaterial color="#333333" roughness={0.5} />
          </mesh>

          {/* Colorful border trim on walls */}
          <mesh position={[-width / 2 - 0.08, 0.57, 0]}>
            <boxGeometry args={[0.18, 0.06, seg.length + 0.04]} />
            <meshStandardMaterial color={color} roughness={0.2} emissive={color} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[width / 2 + 0.08, 0.57, 0]}>
            <boxGeometry args={[0.18, 0.06, seg.length + 0.04]} />
            <meshStandardMaterial color={color} roughness={0.2} emissive={color} emissiveIntensity={0.2} />
          </mesh>
        </RigidBody>
      ))}
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
  const fanBladeRef = useRef<THREE.Group>(null);
  const audioThrottleRef = useRef(0);
  
  // Local state to track Weak/Medium/Strong phase for the HTML speed gauge
  const [phaseName, setPhaseName] = useState<'weak' | 'medium' | 'strong'>('weak');

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    const t = elapsed % 7.5; // 7.5s cycle (2.5s per phase: Weak, Medium, Strong)
    
    // Wind cycle smooth interpolation:
    // Weak: target 0.1, Medium: target 0.5, Strong: target 1.0
    let factor = 0.1;
    if (t < 1.25) {
      const frac = t / 1.25;
      factor = THREE.MathUtils.lerp(0.55, 0.1, frac);
    } else if (t < 3.75) {
      const frac = (t - 1.25) / 2.5;
      factor = THREE.MathUtils.lerp(0.1, 0.5, frac);
    } else if (t < 6.25) {
      const frac = (t - 3.75) / 2.5;
      factor = THREE.MathUtils.lerp(0.5, 1.0, frac);
    } else {
      const frac = (t - 6.25) / 1.25;
      factor = THREE.MathUtils.lerp(1.0, 0.55, frac);
    }

    // Determine current phase name
    const currentP = t < 2.5 ? 'weak' : t < 5.0 ? 'medium' : 'strong';
    if (phaseName !== currentP) {
      setPhaseName(currentP);
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
      fanBladeRef.current.rotation.y += delta * (0.6 + factor * 35.0); // fast spin when active
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

    // Animate wind particles (streaks and leaves) inside the group
    const streaks = groupRef.current?.children.filter((child) => child.name === 'wind-streak');
    const leaves = groupRef.current?.children.filter((child) => child.name === 'wind-leaf');
    
    if (streaks) {
      streaks.forEach((p, idx) => {
        p.position.x += delta * 18.0 * sign * (0.3 + factor * 1.5);
        const halfWidth = size[0] / 2;
        if (sign > 0 && p.position.x > halfWidth) {
          p.position.x = -halfWidth;
        } else if (sign < 0 && p.position.x < -halfWidth) {
          p.position.x = halfWidth;
        }
        
        const mesh = p as THREE.Mesh;
        if (mesh.material) {
          (mesh.material as THREE.MeshBasicMaterial).opacity = factor * 0.28 * (0.3 + 0.7 * Math.sin(state.clock.getElapsedTime() * 4 + idx));
        }
      });
    }

    if (leaves) {
      leaves.forEach((l, idx) => {
        l.position.x += delta * 14.0 * sign * (0.4 + factor * 1.6);
        l.rotation.x += delta * (2.0 + factor * 10.0);
        l.rotation.y += delta * (1.0 + factor * 8.0);
        
        const halfWidth = size[0] / 2;
        if (sign > 0 && l.position.x > halfWidth) {
          l.position.x = -halfWidth;
        } else if (sign < 0 && l.position.x < -halfWidth) {
          l.position.x = halfWidth;
        }
        
        const mesh = l as THREE.Mesh;
        if (mesh.material) {
          (mesh.material as THREE.MeshStandardMaterial).opacity = factor > 0.35
            ? factor * 0.7
            : 0.05;
        }
      });
    }
  });

  // Generate 8 wind streaks and 8 leaves deterministically inside the zone volume
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

  const leafConfigs = useMemo<Array<{ pos: [number, number, number]; scale: number; rotOffset: number }>>(() => {
    const arr: Array<{ pos: [number, number, number]; scale: number; rotOffset: number }> = [];
    for (let i = 0; i < 8; i++) {
      const rx = (Math.random() - 0.5) * size[0];
      const ry = (Math.random() - 0.5) * size[1] + 0.5;
      const rz = (Math.random() - 0.5) * size[2];
      arr.push({
        pos: [rx, ry, rz],
        scale: 0.08 + Math.random() * 0.1,
        rotOffset: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, [size]);

  // Position of the fan body
  const fanX = direction === 'left' ? size[0] / 2 + 0.45 : -size[0] / 2 - 0.45;
  const fanRot = direction === 'left' ? Math.PI / 2 : -Math.PI / 2;

  // Colors based on phase name for the HTML UI and casing lights
  const uiColor = phaseName === 'weak' ? '#00e5ff' : phaseName === 'medium' ? '#ffd60a' : '#ff007f';

  return (
    <group ref={groupRef} position={position} name="wind-zone" userData={{ size, force: [0, 0, 0] }}>
      
      {/* 1. Floating HTML Speed Gauge Dashboard */}
      <Html distanceFactor={11} position={[fanX, 2.2, 0]} transform>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.88)',
          border: `2px solid ${uiColor}aa`,
          borderRadius: '12px',
          padding: '8px 12px',
          boxShadow: `0 4px 20px rgba(0, 0, 0, 0.6), 0 0 10px ${uiColor}44`,
          color: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
          width: '110px',
          userSelect: 'none',
          pointerEvents: 'none',
          textAlign: 'center',
        }}>
          {/* Segmented Arc/Bar */}
          <div style={{ display: 'flex', gap: '4px', width: '100%', height: '8px', marginBottom: '6px' }}>
            <div style={{
              flex: 1,
              background: '#00e5ff',
              borderRadius: '4px',
              opacity: phaseName === 'weak' ? 1 : 0.2,
              boxShadow: phaseName === 'weak' ? '0 0 12px #00e5ff' : 'none',
              transition: 'opacity 0.2s, box-shadow 0.2s',
            }} />
            <div style={{
              flex: 1,
              background: '#ffd60a',
              borderRadius: '4px',
              opacity: phaseName === 'medium' ? 1 : 0.2,
              boxShadow: phaseName === 'medium' ? '0 0 12px #ffd60a' : 'none',
              transition: 'opacity 0.2s, box-shadow 0.2s',
            }} />
            <div style={{
              flex: 1,
              background: '#ff007f',
              borderRadius: '4px',
              opacity: phaseName === 'strong' ? 1 : 0.2,
              boxShadow: phaseName === 'strong' ? '0 0 12px #ff007f' : 'none',
              transition: 'opacity 0.2s, box-shadow 0.2s',
            }} />
          </div>
          
          <div style={{
            fontSize: '0.65rem',
            fontWeight: 800,
            color: 'rgba(255, 255, 255, 0.5)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Wind Power
          </div>
          <div style={{
            fontSize: '0.9rem',
            fontWeight: 900,
            color: uiColor,
            textShadow: `0 0 8px ${uiColor}`,
            textTransform: 'uppercase',
            marginTop: '2px',
          }}>
            {phaseName}
          </div>
        </div>
      </Html>

      {/* 2. Premium Stylized Fan Blower body */}
      <group position={[fanX, 0.5, 0]} rotation={[0, 0, fanRot]}>
        
        {/* Base cylinder housing */}
        <mesh castShadow>
          <cylinderGeometry args={[0.85, 0.95, 0.65, 16]} />
          <meshStandardMaterial color="#bd00ff" roughness={0.15} metalness={0.5} />
        </mesh>
        
        {/* Colorful visual cap accent */}
        <mesh position={[0, -0.32, 0]}>
          <cylinderGeometry args={[0.7, 0.8, 0.1, 16]} />
          <meshStandardMaterial color="#ff007f" roughness={0.1} />
        </mesh>

        {/* Glow Light ring */}
        <mesh position={[0, -0.2, 0]}>
          <torusGeometry args={[0.88, 0.05, 8, 20]} />
          <meshStandardMaterial color={uiColor} emissive={uiColor} emissiveIntensity={0.6} />
        </mesh>

        {/* Rotating Blades */}
        <group ref={fanBladeRef} position={[0, 0.1, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.24, 0.24, 0.28, 12]} />
            <meshStandardMaterial color="#ffd60a" roughness={0.2} />
          </mesh>
          <mesh castShadow position={[0, 0.06, 0.25]} rotation={[0, 0, 0.2]}>
            <boxGeometry args={[0.22, 0.06, 0.5]} />
            <meshStandardMaterial color="#ff6d00" roughness={0.15} />
          </mesh>
          <mesh castShadow position={[0.22, 0.06, -0.13]} rotation={[0, Math.PI * 2 / 3, 0.2]}>
            <boxGeometry args={[0.22, 0.06, 0.5]} />
            <meshStandardMaterial color="#ff6d00" roughness={0.15} />
          </mesh>
          <mesh castShadow position={[-0.22, 0.06, -0.13]} rotation={[0, -Math.PI * 2 / 3, 0.2]}>
            <boxGeometry args={[0.22, 0.06, 0.5]} />
            <meshStandardMaterial color="#ff6d00" roughness={0.15} />
          </mesh>
        </group>

        {/* 3D Curved Protective Dome Grille Over Fan */}
        <group position={[0, 0.16, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.8, 0.06, 6, 20]} />
            <meshStandardMaterial color="#ff007f" roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.05, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.78, 0.045, 6, 16, Math.PI]} />
            <meshStandardMaterial color="#ff3d00" roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.78, 0.045, 6, 16, Math.PI]} />
            <meshStandardMaterial color="#ff3d00" roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <sphereGeometry args={[0.12, 10, 10]} />
            <meshStandardMaterial color="#ff007f" />
          </mesh>
        </group>

      </group>

      {/* 3. Visual Wind streaks */}
      {particleConfigs.map((cfg: { pos: [number, number, number] }, idx: number) => (
        <mesh key={idx} name="wind-streak" position={cfg.pos}>
          <boxGeometry args={[0.9, 0.035, 0.035]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.0} />
        </mesh>
      ))}

      {/* 4. Flying Leaf / Debris Particles */}
      {leafConfigs.map((cfg: { pos: [number, number, number]; scale: number; rotOffset: number }, idx: number) => (
        <mesh
          key={idx}
          name="wind-leaf"
          position={cfg.pos}
          scale={[cfg.scale, cfg.scale * 0.15, cfg.scale * 0.7]}
          rotation={[cfg.rotOffset, cfg.rotOffset, 0]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={idx % 2 === 0 ? '#39ff14' : '#8b5a2b'} transparent opacity={0.0} roughness={0.6} />
        </mesh>
      ))}

      {/* 5. Transparent wind tunnel visual indicator bounds */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={size} />
        <meshBasicMaterial color={uiColor} transparent opacity={0.02} wireframe />
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

// ─── StartLine ────────────────────────────────────────────────────────────────
// Painted START floor marking + checkered tiles + race gantry arch

interface StartLineProps {
  position: [number, number, number];
  width?: number;  // total width of course
}

export const StartLine: React.FC<StartLineProps> = ({
  position,
  width = 12,
}) => {
  const tileCount = 8; // tiles across width
  const tileSize = width / tileCount;
  const TILES_DEEP = 2; // rows of checker

  const tiles = useMemo(() => {
    const out: { x: number; z: number; white: boolean }[] = [];
    for (let row = 0; row < TILES_DEEP; row++) {
      for (let col = 0; col < tileCount; col++) {
        const white = (row + col) % 2 === 0;
        const x = -width / 2 + tileSize * col + tileSize / 2;
        const z = -tileSize * TILES_DEEP / 2 + tileSize * row + tileSize / 2;
        out.push({ x, z, white });
      }
    }
    return out;
  }, [width, tileCount, tileSize]);

  return (
    <group position={position}>
      {/* ── Checkered tile strip ── */}
      {tiles.map((t, i) => (
        <mesh key={i} position={[t.x, 0.005, t.z]} receiveShadow>
          <boxGeometry args={[tileSize - 0.015, 0.012, tileSize - 0.015]} />
          <meshStandardMaterial
            color={t.white ? '#ffffff' : '#111111'}
            roughness={0.15}
            metalness={0.2}
          />
        </mesh>
      ))}



      {/* ── Left gantry pillar ── */}
      <mesh castShadow position={[-width / 2 - 0.3, 1.5, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 3.0, 16]} />
        <meshStandardMaterial color="#ff007f" roughness={0.18} metalness={0.4}
          emissive="#ff007f" emissiveIntensity={0.25} />
      </mesh>
      {/* Left pillar base disc */}
      <mesh position={[-width / 2 - 0.3, 0.04, 0]}>
        <cylinderGeometry args={[0.42, 0.46, 0.08, 16]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.2} metalness={0.5} />
      </mesh>
      {/* Left pillar cap sphere */}
      <mesh position={[-width / 2 - 0.3, 3.12, 0]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.12} metalness={0.55}
          emissive="#ffd60a" emissiveIntensity={0.4} />
      </mesh>

      {/* ── Right gantry pillar ── */}
      <mesh castShadow position={[width / 2 + 0.3, 1.5, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 3.0, 16]} />
        <meshStandardMaterial color="#00e5ff" roughness={0.18} metalness={0.4}
          emissive="#00e5ff" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[width / 2 + 0.3, 0.04, 0]}>
        <cylinderGeometry args={[0.42, 0.46, 0.08, 16]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.2} metalness={0.5} />
      </mesh>
      <mesh position={[width / 2 + 0.3, 3.12, 0]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.12} metalness={0.55}
          emissive="#ffd60a" emissiveIntensity={0.4} />
      </mesh>

      {/* ── Horizontal arch bar ── */}
      <mesh castShadow position={[0, 3.0, 0]}>
        <boxGeometry args={[width + 1.2, 0.38, 0.38]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.16} metalness={0.45}
          emissive="#ffd60a" emissiveIntensity={0.2} />
      </mesh>

      {/* ── Flag banners on arch ── */}
      {[-4.5, -1.5, 1.5, 4.5].map((x, i) => (
        <group key={i} position={[x, 3.18, 0]}>
          <mesh castShadow position={[0, -0.35, 0]}>
            <boxGeometry args={[0.6, 0.7, 0.04]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#ff007f' : '#00e5ff'}
              roughness={0.2} metalness={0.1}
              emissive={i % 2 === 0 ? '#ff007f' : '#00e5ff'}
              emissiveIntensity={0.25}
            />
          </mesh>
        </group>
      ))}

      {/* ── Emissive light pods (decorative) ── */}
      {[-5.0, 5.0].map((x, i) => (
        <mesh key={`light-${i}`} position={[x, 3.22, 0]}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3.0}
            roughness={0.0} metalness={0.0} />
        </mesh>
      ))}

      {/* ── Thin red start line stripe across full width ── */}
      <mesh position={[0, 0.013, -tileSize * TILES_DEEP / 2 - 0.06]}>
        <boxGeometry args={[width, 0.014, 0.12]} />
        <meshStandardMaterial color="#ff0000" roughness={0.15} emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
};

// ─── GoalLine ─────────────────────────────────────────────────────────────────
// GOAL floor text + checkered tiles + celebration arch + balloons + confetti

interface GoalLineProps {
  position: [number, number, number];
  width?: number;
}

export const GoalLine: React.FC<GoalLineProps> = ({
  position,
  width = 14,
}) => {
  const tileCount = 8;
  const tileSize = width / tileCount;
  const TILES_DEEP = 3;

  const tiles = useMemo(() => {
    const out: { x: number; z: number; white: boolean }[] = [];
    for (let row = 0; row < TILES_DEEP; row++) {
      for (let col = 0; col < tileCount; col++) {
        const white = (row + col) % 2 === 0;
        const x = -width / 2 + tileSize * col + tileSize / 2;
        const z = -tileSize * TILES_DEEP / 2 + tileSize * row + tileSize / 2;
        out.push({ x, z, white });
      }
    }
    return out;
  }, [width, tileCount, tileSize]);

  // Slowly bouncing balloons
  const balloonData = useMemo(() => [
    { x: -5.5, y: 4.5, z: -0.8, color: '#ff007f', speed: 0.8, amp: 0.22 },
    { x: -3.5, y: 5.5, z: 0.6,  color: '#ffd60a', speed: 1.1, amp: 0.18 },
    { x: 0.0,  y: 6.2, z: -0.3, color: '#00e5ff', speed: 0.65, amp: 0.25 },
    { x: 3.5,  y: 5.0, z: 0.7,  color: '#ff007f', speed: 0.9, amp: 0.2 },
    { x: 5.5,  y: 4.8, z: -0.5, color: '#ffd60a', speed: 1.05, amp: 0.15 },
  ], []);

  const balloonRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    balloonData.forEach((b, i) => {
      const ref = balloonRefs.current[i];
      if (ref) {
        ref.position.y = b.y + Math.sin(t * b.speed + i) * b.amp;
      }
    });
  });

  return (
    <group position={position}>
      {/* ── Wide checkered tile strip ── */}
      {tiles.map((t, i) => (
        <mesh key={i} position={[t.x, 0.005, t.z]} receiveShadow>
          <boxGeometry args={[tileSize - 0.015, 0.012, tileSize - 0.015]} />
          <meshStandardMaterial
            color={t.white ? '#ffffff' : '#111111'}
            roughness={0.12}
            metalness={0.25}
          />
        </mesh>
      ))}



      {/* ── Left arch pillar ── */}
      <mesh castShadow position={[-width / 2 - 0.3, 2.0, 0]}>
        <cylinderGeometry args={[0.26, 0.3, 4.0, 18]} />
        <meshStandardMaterial color="#ff007f" roughness={0.16} metalness={0.4}
          emissive="#ff007f" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[-width / 2 - 0.3, 0.04, 0]}>
        <cylinderGeometry args={[0.48, 0.52, 0.08, 18]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.2} metalness={0.5} />
      </mesh>
      <mesh position={[-width / 2 - 0.3, 4.18, 0]}>
        <sphereGeometry args={[0.34, 16, 16]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.1} metalness={0.6}
          emissive="#ffd60a" emissiveIntensity={0.5} />
      </mesh>

      {/* ── Right arch pillar ── */}
      <mesh castShadow position={[width / 2 + 0.3, 2.0, 0]}>
        <cylinderGeometry args={[0.26, 0.3, 4.0, 18]} />
        <meshStandardMaterial color="#00e5ff" roughness={0.16} metalness={0.4}
          emissive="#00e5ff" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[width / 2 + 0.3, 0.04, 0]}>
        <cylinderGeometry args={[0.48, 0.52, 0.08, 18]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.2} metalness={0.5} />
      </mesh>
      <mesh position={[width / 2 + 0.3, 4.18, 0]}>
        <sphereGeometry args={[0.34, 16, 16]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.1} metalness={0.6}
          emissive="#ffd60a" emissiveIntensity={0.5} />
      </mesh>

      {/* ── Arch cross-bar ── */}
      <mesh castShadow position={[0, 4.1, 0]}>
        <boxGeometry args={[width + 1.6, 0.5, 0.45]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.14} metalness={0.48}
          emissive="#ffd60a" emissiveIntensity={0.28} />
      </mesh>

      {/* ── "GOAL" banner on arch bar front face (faces approaching player) ── */}
      {/* Player approaches from -Z toward +Z; rotation [0,PI,0] makes text face -Z */}
      <Text
        position={[0, 4.08, -0.26]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.72}
        color="#ff007f"
        outlineColor="#000000"
        outlineWidth={0.048}
        anchorX="center"
        anchorY="middle"
        castShadow={false}
      >
        GOAL
      </Text>

      {/* ── Celebration flag banners on arch ── */}
      {[-5.5, -2.8, 0, 2.8, 5.5].map((x, i) => (
        <group key={i} position={[x, 4.35, 0]}>
          <mesh castShadow position={[0, -0.4, 0]}>
            <boxGeometry args={[0.7, 0.8, 0.04]} />
            <meshStandardMaterial
              color={['#ff007f', '#ffd60a', '#00e5ff', '#ffd60a', '#ff007f'][i]}
              roughness={0.18} metalness={0.1}
              emissive={['#ff007f', '#ffd60a', '#00e5ff', '#ffd60a', '#ff007f'][i]}
              emissiveIntensity={0.3}
            />
          </mesh>
        </group>
      ))}

      {/* ── Glowing light pods on arch ── */}
      {[-6.0, -3.0, 0, 3.0, 6.0].map((x, i) => (
        <mesh key={`pod-${i}`} position={[x, 4.42, 0]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#ff007f' : '#ffd60a'}
            emissive={i % 2 === 0 ? '#ff007f' : '#ffd60a'}
            emissiveIntensity={4.0}
            roughness={0.0}
          />
        </mesh>
      ))}

      {/* ── Floating balloons ── */}
      {balloonData.map((b, i) => (
        <group key={`balloon-${i}`}>
          <mesh
            ref={(el) => { balloonRefs.current[i] = el; }}
            castShadow
            position={[b.x, b.y, b.z]}
          >
            <sphereGeometry args={[0.38, 16, 16]} />
            <meshStandardMaterial color={b.color} roughness={0.15} metalness={0.1}
              emissive={b.color} emissiveIntensity={0.3} />
          </mesh>
          {/* String */}
          <mesh position={[b.x, b.y - 0.75, b.z]}>
            <cylinderGeometry args={[0.012, 0.012, 1.5, 6]} />
            <meshStandardMaterial color="#cccccc" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* ── Yellow GOAL stripe across full width ── */}
      <mesh position={[0, 0.013, -tileSize * TILES_DEEP / 2 - 0.06]}>
        <boxGeometry args={[width, 0.014, 0.14]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.1}
          emissive="#ffd60a" emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
};

