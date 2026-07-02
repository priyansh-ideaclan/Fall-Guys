import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, useRapier, RapierRigidBody } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameControls } from '../hooks/useGameControls';
import { useGameStore } from '../store/useGameStore';
import { audioManager } from '../utils/audioManager';
import { getRacerProgressValue } from '../utils/progress';

export const Player: React.FC = () => {
  const controls = useGameControls();
  const { lastCheckpoint, phase, triggerWin, triggerLoss } = useGameStore();
  const { camera } = useThree();
  const { rapier, world } = useRapier();

  const playerName = useGameStore((state) => state.playerName);
  const updateRacerProgress = useGameStore((state) => state.updateRacerProgress);
  const playerQualified = useGameStore((state) => state.playerQualified);
  const currentLevelId = useGameStore((state) => state.currentLevelId);
  const scores = useGameStore((state) => state.scores);

  // Ref for camera-distance opacity of name label
  const nameLabelRef = useRef<any>(null);

  // Refs
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const visualGroupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  const customization = useGameStore((state) => state.customization);

  // States
  const isGroundedRef = useRef(false);
  const wasGroundedRef = useRef(false);
  const isDivingRef = useRef(false);
  const diveTimerRef = useRef(0);
  const diveCooldownRef = useRef(0);
  const isGrabbingRef = useRef(false);
  const jumpCountRef = useRef(0);
  const wasJumpPressedRef = useRef(false);

  // Sound repeat rate timers
  const slideSoundTimer = useRef(0);
  const mudSoundTimer = useRef(0);

  // Reset player position when match starts
  useEffect(() => {
    if (phase === 'PLAYING' && rigidBodyRef.current && lastCheckpoint) {
      rigidBodyRef.current.setTranslation(new THREE.Vector3(...lastCheckpoint), true);
      rigidBodyRef.current.setLinvel(new THREE.Vector3(0, 0, 0), true);
      rigidBodyRef.current.setAngvel(new THREE.Vector3(0, 0, 0), true);
      isDivingRef.current = false;
      diveTimerRef.current = 0;
      diveCooldownRef.current = 0;
      isGrabbingRef.current = false;
      audioManager.playMatchStart();
    }
  }, [phase, lastCheckpoint]);

  // Phase change sound triggers
  const lastPhase = useRef(phase);
  const lastQualified = useRef(false);

  useEffect(() => {
    if (phase === 'QUALIFIED' && lastPhase.current === 'PLAYING') {
      audioManager.playVictory();
    } else if (phase === 'GAMEOVER' && lastPhase.current === 'PLAYING') {
      audioManager.playDefeat();
    }
    lastPhase.current = phase;
  }, [phase]);

  useEffect(() => {
    if (playerQualified && !lastQualified.current) {
      audioManager.playVictory();
      lastQualified.current = true;
    }
    if (!playerQualified) {
      lastQualified.current = false;
    }
  }, [playerQualified]);

  useFrame((state, delta) => {
    if (phase !== 'PLAYING') return;

    const activeControls = {
      forward: playerQualified ? false : controls.forward,
      backward: playerQualified ? false : controls.backward,
      left: playerQualified ? false : controls.left,
      right: playerQualified ? false : controls.right,
      jump: playerQualified ? false : controls.jump,
      dive: playerQualified ? false : controls.dive,
      grab: playerQualified ? false : controls.grab,
    };

    const rigidBody = rigidBodyRef.current;
    if (!rigidBody) return;

    const pos = rigidBody.translation();
    const progressValue = getRacerProgressValue(currentLevelId, pos);

    // Update live leaderboard progress
    updateRacerProgress({
      id: 'player',
      name: playerName || 'You',
      progressValue,
      yPos: pos.y,
      score: scores['player'] || 0,
      finished: playerQualified,
    });

    // Update name label opacity based on camera distance
    if (nameLabelRef.current) {
      const dist = camera.position.distanceTo(new THREE.Vector3(pos.x, pos.y, pos.z));
      nameLabelRef.current.fillOpacity = dist > 30 ? Math.max(0, 1 - (dist - 30) / 15) : 1;
    }

    // 1. Respawn if fell into void
    if (pos.y < -8) {
      const respawnPoint = lastCheckpoint || [0, 4, 0];
      rigidBody.setTranslation(new THREE.Vector3(...respawnPoint), true);
      rigidBody.setLinvel(new THREE.Vector3(0, 0, 0), true);
      rigidBody.setAngvel(new THREE.Vector3(0, 0, 0), true);
      isDivingRef.current = false;
      audioManager.playDefeat(); // Respawn penalty sound
      return;
    }

    // 2. Check if grounded using Rapier Raycast (Velocity Locked & Offset Origin)
    const rayOrigin = new THREE.Vector3(pos.x, pos.y - 0.51, pos.z);
    const rayDir = { x: 0, y: -1, z: 0 };
    const maxToi = 0.08; // 8cm range below the capsule
    const ray = new rapier.Ray(rayOrigin, rayDir);
    const hit = world.castRay(ray, maxToi, true);
    
    const vel = rigidBody.linvel();
    const isMovingUp = vel.y > 0.05;
    isGroundedRef.current = hit !== null && !isMovingUp;

    // Trigger landing thud sound
    if (isGroundedRef.current && !wasGroundedRef.current) {
      audioManager.playLand();
    }
    wasGroundedRef.current = isGroundedRef.current;

    // Reset jump counts on ground contact, or apply airborne penalty
    if (isGroundedRef.current) {
      jumpCountRef.current = 0;
    } else if (jumpCountRef.current === 0) {
      jumpCountRef.current = 1; // fell off a ledge, only 1 jump remaining
    }

    const isJumpPressed = activeControls.jump;
    const justPressedJump = isJumpPressed && !wasJumpPressedRef.current;
    wasJumpPressedRef.current = isJumpPressed;

    // 3. Three.js Raycaster for surface detection (ice, mud, conveyors)
    let currentSurface = 'normal';
    let conveyorSpeed = 0;
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(pos.x, pos.y, pos.z),
      new THREE.Vector3(0, -1, 0)
    );
    const intersects = raycaster.intersectObjects(state.scene.children, true);
    if (intersects.length > 0 && intersects[0].distance < 0.65) {
      const hitObj = intersects[0].object;
      if (hitObj.userData && hitObj.userData.surface) {
        currentSurface = hitObj.userData.surface;
        if (currentSurface === 'conveyor') {
          conveyorSpeed = hitObj.userData.pushSpeed || 0;
        }
      } else if (hitObj.parent && hitObj.parent.userData && hitObj.parent.userData.surface) {
        currentSurface = hitObj.parent.userData.surface;
        if (currentSurface === 'conveyor') {
          conveyorSpeed = hitObj.parent.userData.pushSpeed || 0;
        }
      }
    }

    // 4. Calibrate movement values based on surface type
    let moveSpeed = 4.8;
    let accelerationRatio = isGroundedRef.current ? 0.22 : 0.08;
    let jumpImpulse = 6.2;

    if (currentSurface === 'ice') {
      // Ice surface: extremely slippery slide drift
      accelerationRatio = 0.035;
      moveSpeed = 5.2; // Slide momentum slightly faster
      slideSoundTimer.current -= delta;
      if (slideSoundTimer.current <= 0 && isGroundedRef.current) {
        audioManager.playIceSlide();
        slideSoundTimer.current = 0.16; // Loop sliding swish
      }
    } else if (currentSurface === 'mud') {
      // Mud surface: slows down speeds and halves jumps
      moveSpeed = 2.0;
      jumpImpulse = 3.2;
      mudSoundTimer.current -= delta;
      if (mudSoundTimer.current <= 0 && isGroundedRef.current && new THREE.Vector3(rigidBody.linvel().x, 0, rigidBody.linvel().z).length() > 0.4) {
        audioManager.playMudSplat();
        mudSoundTimer.current = 0.22; // Loop mud squelches
      }
    }

    // 4b. Wind Zone detection
    let windForceX = 0;
    let windForceZ = 0;
    const windZones = state.scene.children.filter((child) => child.name === 'wind-zone');
    windZones.forEach((zone) => {
      const zonePos = new THREE.Vector3();
      zone.getWorldPosition(zonePos);
      const zoneSize = zone.userData.size;
      const zoneForce = zone.userData.force;
      if (zoneSize && zoneForce) {
        const dx = pos.x - zonePos.x;
        const dy = pos.y - zonePos.y;
        const dz = pos.z - zonePos.z;
        if (
          Math.abs(dx) < zoneSize[0] / 2 &&
          Math.abs(dy - 0.5) < zoneSize[1] / 2 &&
          Math.abs(dz) < zoneSize[2] / 2
        ) {
          windForceX += zoneForce[0] * 0.12;
          windForceZ += zoneForce[2] * 0.12;
        }
      }
    });

    if (isDivingRef.current) {
      moveSpeed = 6.8;
    } else if (activeControls.grab) {
      moveSpeed = 2.2;
      isGrabbingRef.current = true;
    } else {
      isGrabbingRef.current = false;
    }

    // 5. Calculate movement relative to camera vector
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();

    const camRight = new THREE.Vector3();
    camRight.crossVectors(new THREE.Vector3(0, 1, 0), camDir).normalize();

    const moveDir = new THREE.Vector3(0, 0, 0);
    if (activeControls.forward) moveDir.add(camDir);
    if (activeControls.backward) moveDir.sub(camDir);
    if (activeControls.left) moveDir.add(camRight);
    if (activeControls.right) moveDir.sub(camRight);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
    }

    // Linear velocity updates
    const currentVel = rigidBody.linvel();
    let targetX = moveDir.x * moveSpeed;
    let targetZ = moveDir.z * moveSpeed;

    // Handle diving trigger
    if (activeControls.dive && !isDivingRef.current && diveCooldownRef.current <= 0) {
      isDivingRef.current = true;
      diveTimerRef.current = 0.6;
      diveCooldownRef.current = 1.4;

      const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(visualGroupRef.current?.quaternion || new THREE.Quaternion());
      lookDir.y = 0.15;
      lookDir.normalize();

      rigidBody.setLinvel({
        x: lookDir.x * 8.2,
        y: 3.2,
        z: lookDir.z * 8.2
      }, true);
      audioManager.playDive();
    }

    if (diveTimerRef.current > 0) {
      diveTimerRef.current -= delta;
      if (diveTimerRef.current <= 0) {
        isDivingRef.current = false;
      }
    }
    if (diveCooldownRef.current > 0) {
      diveCooldownRef.current -= delta;
    }

    const nextVelX = THREE.MathUtils.lerp(currentVel.x, targetX + windForceX, accelerationRatio);
    const nextVelZ = THREE.MathUtils.lerp(currentVel.z, targetZ + windForceZ + conveyorSpeed, accelerationRatio);

    let nextVelY = currentVel.y;
    
    // Jump trigger (Double Jump Limit)
    if (justPressedJump && !isDivingRef.current) {
      if (isGroundedRef.current || jumpCountRef.current === 1) {
        nextVelY = jumpImpulse;
        jumpCountRef.current++;
        audioManager.playJump();
      }
    }

    rigidBody.setLinvel({ x: nextVelX, y: nextVelY, z: nextVelZ }, true);

    // Rotate player visuals
    if (moveDir.lengthSq() > 0.01 && visualGroupRef.current) {
      const targetRotation = Math.atan2(moveDir.x, moveDir.z);
      const currentRotation = visualGroupRef.current.rotation.y;
      
      let diff = targetRotation - currentRotation;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      
      visualGroupRef.current.rotation.y += diff * 0.18;
    }

    // 6. Procedural Animations states
    const clockTime = state.clock.getElapsedTime();
    const speed = new THREE.Vector3(currentVel.x, 0, currentVel.z).length();

    const visual = visualGroupRef.current;
    const lLeg = leftLegRef.current;
    const rLeg = rightLegRef.current;
    const lArm = leftArmRef.current;
    const rArm = rightArmRef.current;

    if (visual && lLeg && rLeg && lArm && rArm) {
      visual.scale.set(0.6, 0.6, 0.6);
      visual.rotation.x = 0;
      visual.rotation.z = 0;
      lLeg.rotation.set(0, 0, 0);
      rLeg.rotation.set(0, 0, 0);
      lArm.rotation.set(0, 0, 0.1);
      rArm.rotation.set(0, 0, -0.1);
      visual.position.y = -0.12;

      if (playerQualified) {
        // Celebration bounce dance!
        visual.position.y = -0.12 + Math.abs(Math.sin(clockTime * 12)) * 0.25;
        lLeg.rotation.x = Math.sin(clockTime * 12) * 0.2;
        rLeg.rotation.x = -Math.sin(clockTime * 12) * 0.2;
        lArm.rotation.set(Math.sin(clockTime * 10) * 0.5 - 1.2, 0, 0.4);
        rArm.rotation.set(Math.sin(clockTime * 10) * 0.5 - 1.2, 0, -0.4);
      } else if (isDivingRef.current) {
        visual.rotation.x = Math.PI / 2;
        lLeg.rotation.x = 0.5;
        rLeg.rotation.x = 0.5;
        lLeg.rotation.z = -0.2;
        rLeg.rotation.z = 0.2;
        lArm.rotation.x = -1.2;
        rArm.rotation.x = -1.2;
        visual.position.y = -0.22;
      } else if (!isGroundedRef.current) {
        visual.scale.set(0.54, 0.69, 0.54);
        const flailFreq = 22;
        lLeg.rotation.x = Math.sin(clockTime * flailFreq) * 0.6;
        rLeg.rotation.x = Math.cos(clockTime * flailFreq) * 0.6;
        lArm.rotation.z = -Math.PI / 2.5 + Math.sin(clockTime * flailFreq) * 0.5;
        rArm.rotation.z = Math.PI / 2.5 + Math.cos(clockTime * flailFreq) * 0.5;
      } else if (isGrabbingRef.current) {
        const waddleFreq = 10;
        lLeg.rotation.x = Math.sin(clockTime * waddleFreq) * 0.3;
        rLeg.rotation.x = -Math.sin(clockTime * waddleFreq) * 0.3;
        lArm.rotation.x = -Math.PI / 2;
        lArm.rotation.y = 0.15;
        rArm.rotation.x = -Math.PI / 2;
        rArm.rotation.y = -0.15;
        visual.position.y = -0.12 + Math.abs(Math.sin(clockTime * waddleFreq)) * 0.05;
      } else if (speed > 0.3) {
        const runningFreq = Math.max(12, speed * 2.8);
        lLeg.rotation.x = Math.sin(clockTime * runningFreq) * 0.5;
        rLeg.rotation.x = -Math.sin(clockTime * runningFreq) * 0.5;
        lArm.rotation.x = -Math.sin(clockTime * runningFreq) * 0.6;
        rArm.rotation.x = Math.sin(clockTime * runningFreq) * 0.6;
        visual.position.y = -0.12 + Math.abs(Math.sin(clockTime * runningFreq)) * 0.12;
        visual.rotation.z = Math.sin(clockTime * runningFreq) * 0.08;
      } else {
        const idleFreq = 2.5;
        visual.position.y = -0.12 + Math.sin(clockTime * idleFreq) * 0.03;
        lArm.rotation.z = -Math.sin(clockTime * idleFreq) * 0.05 - 0.15;
        rArm.rotation.z = Math.sin(clockTime * idleFreq) * 0.05 + 0.15;
      }
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      colliders={false}
      enabledRotations={[false, false, false]}
      name="player"
      position={[0, 4, 0]}
      friction={0.6}
      restitution={0.1}
    >
      <CapsuleCollider args={[0.25, 0.24]} />

      <group ref={visualGroupRef} name="player-visual" scale={[0.6, 0.6, 0.6]}>
        <mesh castShadow receiveShadow>
          <capsuleGeometry args={[0.4, 0.7, 10, 20]} />
          <meshStandardMaterial color={customization.color} roughness={0.2} metalness={0.1} />
        </mesh>

        <group position={[0, 0.28, 0.3]} scale={[1, 0.75, 1]}>
          <mesh castShadow>
            <sphereGeometry args={[0.22, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.2} />
          </mesh>
          <mesh position={[-0.08, 0.05, 0.2]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          <mesh position={[0.08, 0.05, 0.2]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
        </group>

        <group ref={leftArmRef} position={[-0.45, 0.1, 0]}>
          <mesh castShadow><capsuleGeometry args={[0.08, 0.2, 8, 8]} /><meshStandardMaterial color={customization.color} roughness={0.2} /></mesh>
        </group>
        <group ref={rightArmRef} position={[0.45, 0.1, 0]}>
          <mesh castShadow><capsuleGeometry args={[0.08, 0.2, 8, 8]} /><meshStandardMaterial color={customization.color} roughness={0.2} /></mesh>
        </group>
        <group ref={leftLegRef} position={[-0.2, -0.65, 0]}>
          <mesh castShadow><capsuleGeometry args={[0.1, 0.15, 8, 8]} /><meshStandardMaterial color={customization.color} roughness={0.2} /></mesh>
        </group>
        <group ref={rightLegRef} position={[0.2, -0.65, 0]}>
          <mesh castShadow><capsuleGeometry args={[0.1, 0.15, 8, 8]} /><meshStandardMaterial color={customization.color} roughness={0.2} /></mesh>
        </group>

        {customization.accessory === 'crown' && (
          <group position={[0, 0.72, 0]}>
            <mesh castShadow><cylinderGeometry args={[0.22, 0.2, 0.15, 12]} /><meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.2} /></mesh>
            <mesh position={[0, 0.1, 0]} castShadow><coneGeometry args={[0.22, 0.12, 12, 1, true]} /><meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.2} /></mesh>
          </group>
        )}
        {customization.accessory === 'party' && (
          <mesh position={[0, 0.8, 0.05]} rotation={[-0.2, 0, 0]} castShadow>
            <coneGeometry args={[0.16, 0.35, 12]} />
            <meshStandardMaterial color="#ff00a0" roughness={0.4} />
          </mesh>
        )}
        {customization.accessory === 'glasses' && (
          <group position={[0, 0.3, 0.49]}>
            <mesh castShadow><boxGeometry args={[0.36, 0.06, 0.04]} /><meshStandardMaterial color="#000000" roughness={0.1} /></mesh>
            <mesh position={[-0.08, -0.02, 0.01]} castShadow><boxGeometry args={[0.12, 0.08, 0.02]} /><meshStandardMaterial color="#00e5ff" metalness={0.9} roughness={0.0} transparent opacity={0.8} /></mesh>
            <mesh position={[0.08, -0.02, 0.01]} castShadow><boxGeometry args={[0.12, 0.08, 0.02]} /><meshStandardMaterial color="#00e5ff" metalness={0.9} roughness={0.0} transparent opacity={0.8} /></mesh>
          </group>
        )}

        {/* Billboard name label above player head */}
        <Text
          ref={nameLabelRef}
          position={[0, 1.45, 0]}
          fontSize={0.22}
          color="#00e5ff"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.008}
          outlineColor="#000000"
          renderOrder={999}
          depthOffset={-1}
        >
          {playerName || 'You'}
        </Text>
      </group>
    </RigidBody>
  );
};
