import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, useRapier, RapierRigidBody } from '@react-three/rapier';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useGameControls } from '../hooks/useGameControls';
import { useGameStore } from '../store/useGameStore';
import { audioManager } from '../utils/audioManager';
import { getRacerProgressValue } from '../utils/progress';

import { LEVEL_1_LANDMARKS } from '../utils/landmarks';

export const Player: React.FC = () => {
  const controls = useGameControls();
  const { lastCheckpoint, phase, triggerWin, triggerLoss, showDebugCheckpoints, isGodMode, isPlayerEliminated } = useGameStore();
  const isNitroActive = useGameStore((state) => state.isNitroActive);
  const nitroCooldown = useGameStore((state) => state.nitroCooldown);
  const triggerNitro = useGameStore((state) => state.triggerNitro);
  const tickNitro = useGameStore((state) => state.tickNitro);
  const setPlayerSliding = useGameStore((state) => state.setPlayerSliding);

  const wasNitroActiveRef = useRef(false);

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
  const landingSquish = useRef(0);
  const wasGrounded = useRef(true);
  const devTimer = useRef(0);

  const customization = useGameStore((state) => state.customization);

  // States
  const isGroundedRef = useRef(false);
  const wasGroundedRef = useRef(false);
  const isDivingRef = useRef(false);
  const smoothedSpeedRef = useRef(0);
  const diveTimerRef = useRef(0);
  const diveCooldownRef = useRef(0);
  const isGrabbingRef = useRef(false);
  const jumpCountRef = useRef(0);
  const wasJumpPressedRef = useRef(false);
  // Knockback states
  const knockbackTimerRef = useRef(0);
  const knockbackVelRef = useRef(new THREE.Vector3());

  // Sound repeat rate timers
  const slideSoundTimer = useRef(0);
  const mudSoundTimer = useRef(0);

  const lastPhaseRef = useRef(phase);

  // Reset player position when match starts or in round intro
  useEffect(() => {
    // Only teleport/reset player if transitioning from lobby/gameover/victory into intro/playing phase
    if ((phase === 'ROUND_INTRO' || phase === 'PLAYING') && 
        (lastPhaseRef.current === 'MENU' || lastPhaseRef.current === 'GAMEOVER' || lastPhaseRef.current === 'VICTORY')) {
      if (rigidBodyRef.current && lastCheckpoint) {
        rigidBodyRef.current.setTranslation(new THREE.Vector3(...lastCheckpoint), true);
        rigidBodyRef.current.setLinvel(new THREE.Vector3(0, 0, 0), true);
        rigidBodyRef.current.setAngvel(new THREE.Vector3(0, 0, 0), true);
        isDivingRef.current = false;
        diveTimerRef.current = 0;
        diveCooldownRef.current = 0;
        isGrabbingRef.current = false;
        if (visualGroupRef.current) {
          visualGroupRef.current.visible = true;
        }
        if (phase === 'PLAYING') {
          audioManager.playMatchStart();
        }
      }
    }
    lastPhaseRef.current = phase;
  }, [phase, lastCheckpoint]);

  // Teleport player during MENU phase when selected level changes
  useEffect(() => {
    const SPAWN_POINTS: Record<string, [number, number, number]> = {
      'race_1': [0, 4, 0],
      'race_2': [0, 4, 0],
      'race_3': [0, 4, 0],
      'survival_1': [0, 4, 5.5],
      'survival_2': [0, 4, 0],
      'logic_1': [0, 2.5, -5.8],
      'logic_2': [0, 4, 0],
      'hunt_1': [0, 4, 0],
      'final_1': [0, 10, 0],
      'final_2': [0, 4, 0],
    };

    if (phase === 'MENU' && rigidBodyRef.current) {
      const spawnPoint = SPAWN_POINTS[currentLevelId] || [0, 4, 0];
      rigidBodyRef.current.setTranslation(new THREE.Vector3(...spawnPoint), true);
      rigidBodyRef.current.setLinvel(new THREE.Vector3(0, 0, 0), true);
      rigidBodyRef.current.setAngvel(new THREE.Vector3(0, 0, 0), true);
    }
  }, [phase, currentLevelId]);

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
    // Tick nitro cooldown
    tickNitro(delta);

    if (phase !== 'PLAYING') return;

    if (isPlayerEliminated) {
      if (visualGroupRef.current) {
        visualGroupRef.current.visible = false;
      }
      if (rigidBodyRef.current) {
        rigidBodyRef.current.setTranslation(new THREE.Vector3(0, -15, 0), true);
        rigidBodyRef.current.setLinvel(new THREE.Vector3(0, 0, 0), true);
        rigidBodyRef.current.setAngvel(new THREE.Vector3(0, 0, 0), true);
      }
      return;
    }

    // Detect if nitro input is pressed
    if (controls.nitro && !isNitroActive && nitroCooldown <= 0 && !playerQualified) {
      triggerNitro();
      audioManager.playNitro();
    }

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

    // Dev landmarks calculation (throttled to every 0.12 seconds for performance)
    if (showDebugCheckpoints && currentLevelId === 'race_1') {
      devTimer.current += delta;
      if (devTimer.current > 0.12) {
        devTimer.current = 0;
        let nearestIdx = -1;
        let minDist = Infinity;
        for (let i = 0; i < LEVEL_1_LANDMARKS.length; i++) {
          const lm = LEVEL_1_LANDMARKS[i];
          const dx = pos.x - lm.pos[0];
          const dy = pos.y - lm.pos[1];
          const dz = pos.z - lm.pos[2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = i;
          }
        }
        if (nearestIdx !== -1) {
          useGameStore.getState().setDevLandmarkInfo(nearestIdx, minDist);
        }
      }
    }

    // God Mode Free Flight Logic
    if (isGodMode) {
      const flySpeed = controls.nitro ? 75.0 : 25.0;
      
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      camDir.normalize();
      
      const camRight = new THREE.Vector3();
      camRight.crossVectors(new THREE.Vector3(0, 1, 0), camDir).normalize();
      
      const moveVec = new THREE.Vector3();
      if (activeControls.forward) moveVec.add(camDir);
      if (activeControls.backward) moveVec.sub(camDir);
      if (activeControls.left) moveVec.add(camRight);
      if (activeControls.right) moveVec.sub(camRight);
      
      // Space to fly up, Ctrl/C/E to fly down
      if (activeControls.jump) moveVec.y += 1.0;
      if (activeControls.dive || controls.grab) moveVec.y -= 1.0;
      
      if (moveVec.lengthSq() > 0) {
        moveVec.normalize().multiplyScalar(flySpeed * delta);
        const newPos = new THREE.Vector3(pos.x + moveVec.x, pos.y + moveVec.y, pos.z + moveVec.z);
        rigidBody.setNextKinematicTranslation(newPos);
      }
      
      rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      
      if (visualGroupRef.current) {
        const targetRot = Math.atan2(-camDir.x, -camDir.z);
        visualGroupRef.current.rotation.y = targetRot;
      }
      return;
    }

    // Trigger forward boost impulse on activation
    const justActivatedNitro = isNitroActive && !wasNitroActiveRef.current;
    wasNitroActiveRef.current = isNitroActive;

    if (justActivatedNitro && visualGroupRef.current) {
      const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(visualGroupRef.current.quaternion);
      lookDir.y = 0;
      lookDir.normalize();
      
      const currentVel = rigidBody.linvel();
      rigidBody.setLinvel({
        x: currentVel.x + lookDir.x * 5.2, // Strong dash impulse forward
        y: currentVel.y,
        z: currentVel.z + lookDir.z * 5.2
      }, true);
    }

    // Decrement knockback timer and apply knockback velocity if active
    if (knockbackTimerRef.current > 0) {
      knockbackTimerRef.current -= delta;
      const currentVel = rigidBody.linvel();
      rigidBody.setLinvel({
        x: knockbackVelRef.current.x,
        y: currentVel.y,
        z: knockbackVelRef.current.z
      }, true);
      
      if (visualGroupRef.current) {
        visualGroupRef.current.rotation.y += delta * 15; // spin when hit!
      }
      return;
    }

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
    if (pos.y < -8 && !isGodMode) {
      useGameStore.getState().triggerSplash([pos.x, -8.2, pos.z], '#ff007f');
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
    if (intersects.length > 0 && intersects[0].distance < 0.85) {
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
    let moveSpeed = 5.5;
    let accelerationRatio = isGroundedRef.current ? 0.22 : 0.08;
    let jumpImpulse = 6.2;

    if (isNitroActive) {
      moveSpeed *= 1.48; // 48% speed boost as requested by user
      accelerationRatio = Math.min(1.0, accelerationRatio * 1.8);
    }

    if (currentSurface === 'ice') {
      // Ice surface: extremely slippery slide drift
      accelerationRatio = 0.035;
      moveSpeed = 5.2; // Slide momentum slightly faster
      slideSoundTimer.current -= delta;
      if (slideSoundTimer.current <= 0 && isGroundedRef.current) {
        audioManager.playIceSlide();
        slideSoundTimer.current = 0.15; // Loop sliding swish
      }
    } else if (currentSurface === 'mud') {
      // Mud surface: heavy drag & low jumps
      accelerationRatio = 0.12;
      moveSpeed = 2.2;
      jumpImpulse = 3.2; // Mud jump height reduction
      if (mudSoundTimer.current <= 0 && isGroundedRef.current && new THREE.Vector3(rigidBody.linvel().x, 0, rigidBody.linvel().z).length() > 0.4) {
        audioManager.playMudSplat();
        mudSoundTimer.current = 0.22; // Loop mud squelches
      }
    } else if (currentSurface === 'speed-ramp' || currentSurface === 'slide') {
      // Slide surface: slide down with extremely high speed and low steering!
      accelerationRatio = 0.28;
      moveSpeed = 9.2;
      slideSoundTimer.current -= delta;
      if (slideSoundTimer.current <= 0 && isGroundedRef.current) {
        audioManager.playIceSlide();
        slideSoundTimer.current = 0.12;
      }
    }

    setPlayerSliding(currentSurface === 'slide' || currentSurface === 'speed-ramp');

    // 4b. Wind Zone detection
    let windForceX = 0;
    let windForceZ = 0;
    const windZones: THREE.Object3D[] = [];
    state.scene.traverse((child) => {
      if (child.name === 'wind-zone') {
        windZones.push(child);
      }
    });
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

    if (currentSurface === 'slide' || currentSurface === 'speed-ramp') {
      // Automatic slide downstream (+Z direction)
      targetZ = 12.8;
      // Ignore forward/backward controls, only allow slight left/right steering
      let steerX = 0;
      if (activeControls.left) steerX = -2.6;
      else if (activeControls.right) steerX = 2.6;
      targetX = steerX;
      // Slippery glide steering response
      accelerationRatio = 0.065;
    }

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
    
    // Apply slight upward lift when player is caught by strong wind
    if (Math.abs(windForceX) > 2.8) {
      nextVelY += delta * 6.5;
    }
    
    // Jump trigger (Double Jump Limit) - disable on slide
    if (justPressedJump && !isDivingRef.current && currentSurface !== 'slide' && currentSurface !== 'speed-ramp') {
      if (isGroundedRef.current || jumpCountRef.current === 1) {
        nextVelY = jumpImpulse;
        jumpCountRef.current++;
        audioManager.playJump();
      }
    }

    // Apply snappy downward gravity when falling
    if (nextVelY < 0) {
      nextVelY -= delta * 14.0;
      nextVelY = Math.max(nextVelY, -20.0);
    }

    rigidBody.setLinvel({ x: nextVelX, y: nextVelY, z: nextVelZ }, true);

    const isSliding = currentSurface === 'slide' || currentSurface === 'speed-ramp';

    // Update slide wind sound whoosh based on player speed
    if (phase === 'PLAYING') {
      const speed = new THREE.Vector3(nextVelX, 0, nextVelZ).length();
      const slideWindVol = isSliding ? (speed / 12.0) : 0.0;
      audioManager.setSlideWindWhoosh(slideWindVol);
    } else {
      audioManager.setSlideWindWhoosh(0.0);
    }



    // Rotate player visuals
    if (moveDir.lengthSq() > 0.01 && visualGroupRef.current) {
      const targetRotation = Math.atan2(moveDir.x, moveDir.z);
      const currentRotation = visualGroupRef.current.rotation.y;
      
      let diff = targetRotation - currentRotation;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      
      visualGroupRef.current.rotation.y += diff * Math.min(1.0, 8.5 * delta);
    }

    // Track landing squish
    const justLanded = isGroundedRef.current && !wasGrounded.current;
    wasGrounded.current = isGroundedRef.current;
    if (justLanded) {
      landingSquish.current = 0.35;
      audioManager.playLand();
    }
    landingSquish.current = THREE.MathUtils.lerp(landingSquish.current, 0, delta * 12.0);

    // 6. Procedural Animations states
    const clockTime = state.clock.getElapsedTime();
    const speed = new THREE.Vector3(currentVel.x, 0, currentVel.z).length();
    
    // Smooth speed updates to prevent animation blending pops
    smoothedSpeedRef.current = THREE.MathUtils.lerp(smoothedSpeedRef.current, speed, delta * 10.0);

    const visual = visualGroupRef.current;
    const lLeg = leftLegRef.current;
    const rLeg = rightLegRef.current;
    const lArm = leftArmRef.current;
    const rArm = rightArmRef.current;

    if (visual && lLeg && rLeg && lArm && rArm) {
      const squishXZ = 1.0 + landingSquish.current * 0.4;
      const squishY = 1.0 - landingSquish.current * 0.75;
      
      let targetScaleX = 0.6 * squishXZ;
      let targetScaleY = 0.6 * squishY;
      let targetScaleZ = 0.6 * squishXZ;
      let targetPosY = -0.12;

      visual.rotation.x = 0;
      visual.rotation.z = 0;
      lLeg.rotation.set(0, 0, 0);
      rLeg.rotation.set(0, 0, 0);
      lArm.rotation.set(0, 0, 0.1);
      rArm.rotation.set(0, 0, -0.1);

      if (playerQualified) {
        // Celebration bounce dance!
        targetPosY = -0.12 + Math.abs(Math.sin(clockTime * 12)) * 0.25;
        lLeg.rotation.x = Math.sin(clockTime * 12) * 0.2;
        rLeg.rotation.x = -Math.sin(clockTime * 12) * 0.2;
        lArm.rotation.set(Math.sin(clockTime * 10) * 0.5 - 1.2, 0, 0.4);
        rArm.rotation.set(Math.sin(clockTime * 10) * 0.5 - 1.2, 0, -0.4);
      } else if (Math.abs(windForceX) > 0.4 && !isGodMode) {
        const absWindX = Math.abs(windForceX);
        
        // Lean into the wind to fight it
        visual.rotation.z = -windForceX * 0.055;
        
        // Wobble side-to-side losing balance
        const wobble = Math.sin(clockTime * 18.0) * 0.08 * (absWindX / 3.0);
        visual.rotation.x = wobble;
        
        // Feet slide across platform: slide wobble offset
        visual.position.x = Math.cos(clockTime * 22.0) * 0.04 * (absWindX / 2.0);
        
        // Arms & legs flailing frantically
        const flailTime = clockTime * 28.0;
        lArm.rotation.set(-Math.PI / 4, 0.4, -Math.PI / 2.5 + Math.sin(flailTime) * 0.65);
        rArm.rotation.set(-Math.PI / 4, -0.4, Math.PI / 2.5 + Math.cos(flailTime) * 0.65);
        lLeg.rotation.x = Math.sin(flailTime) * 0.4;
        rLeg.rotation.x = Math.cos(flailTime) * 0.4;

        if (!isGroundedRef.current && absWindX > 2.0) {
          // Mid-air tumble: spin visual group continuously
          const spinSpeed = clockTime * 4.2;
          visual.rotation.z = spinSpeed * Math.sign(windForceX);
          visual.rotation.x = spinSpeed * 0.55;
        }
      } else if (isDivingRef.current) {
        visual.rotation.x = Math.PI / 2;
        lLeg.rotation.x = 0.5;
        rLeg.rotation.x = 0.5;
        lLeg.rotation.z = -0.2;
        rLeg.rotation.z = 0.2;
        lArm.rotation.x = -1.2;
        rArm.rotation.x = -1.2;
        targetPosY = -0.22;
      } else if (currentSurface === 'slide' || currentSurface === 'speed-ramp') {
        // Slide pose: lean forward, arms out, feet back
        visual.rotation.x = Math.PI / 4.5;
        lLeg.rotation.x = 0.4;
        rLeg.rotation.x = 0.4;
        lArm.rotation.set(-0.4, 0, 0.5);
        rArm.rotation.set(-0.4, 0, -0.5);
        targetPosY = -0.2;
      } else if (!isGroundedRef.current) {
        targetScaleX = 0.54;
        targetScaleY = 0.69;
        targetScaleZ = 0.54;
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
        targetPosY = -0.12 + Math.abs(Math.sin(clockTime * waddleFreq)) * 0.05;
      } else if (smoothedSpeedRef.current > 0.1) {
        const walkRunBlend = Math.min(1.0, smoothedSpeedRef.current / 5.5);
        const runningFreq = 5.0 + walkRunBlend * 10.0;
        const legSwing = Math.sin(clockTime * runningFreq) * 0.55 * walkRunBlend;
        const armSwing = Math.sin(clockTime * runningFreq) * 0.6 * walkRunBlend;

        lLeg.rotation.x = legSwing;
        rLeg.rotation.x = -legSwing;
        lArm.rotation.x = -armSwing;
        rArm.rotation.x = armSwing;
        targetPosY = -0.12 + Math.abs(Math.sin(clockTime * runningFreq)) * 0.12 * walkRunBlend;
        visual.rotation.z = Math.sin(clockTime * runningFreq) * 0.08 * walkRunBlend;
      } else {
        const idleFreq = 2.5;
        targetPosY = -0.12 + Math.sin(clockTime * idleFreq) * 0.03;
        lArm.rotation.z = -Math.sin(clockTime * idleFreq) * 0.05 - 0.15;
        rArm.rotation.z = Math.sin(clockTime * idleFreq) * 0.05 + 0.15;
      }

      // Smooth visual scale lerp to prevent pop during jumping/landing transitions
      visual.scale.x = THREE.MathUtils.lerp(visual.scale.x, targetScaleX, delta * 12.0);
      visual.scale.y = THREE.MathUtils.lerp(visual.scale.y, targetScaleY, delta * 12.0);
      visual.scale.z = THREE.MathUtils.lerp(visual.scale.z, targetScaleZ, delta * 12.0);

      // Smooth visual position Y lerp to prevent pop between states
      visual.position.y = THREE.MathUtils.lerp(visual.position.y, targetPosY, delta * 12.0);
    }
    // Update name label scale and opacity based on camera distance to avoid clutter
    if (nameLabelRef.current) {
      const camPos = state.camera.position;
      const dist = Math.sqrt(
        (camPos.x - pos.x) ** 2 + (camPos.y - pos.y) ** 2 + (camPos.z - pos.z) ** 2
      );
      const targetScale = dist > 25 ? 0 : Math.max(0.35, 1.0 - (dist - 6) / 20);
      nameLabelRef.current.scale.set(targetScale, targetScale, targetScale);
      nameLabelRef.current.fillOpacity = dist > 25 ? 0 : Math.max(0.35, 1.0 - (dist - 6) / 20);
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      colliders={false}
      enabledRotations={[false, false, false]}
      name="player"
      position={[0, 4, 0]}
      type={isGodMode ? 'kinematicPosition' : (phase === 'MENU' ? 'fixed' : 'dynamic')}
      friction={0.6}
      restitution={0.1}
      onCollisionEnter={(event) => {
        if (isGodMode) return;
        const other = event.other.rigidBodyObject;
        if (other && (other.name === 'rotating-arm' || other.name === 'windmill-blade' || other.name === 'lower-beam' || other.name === 'upper-beam')) {
          const playerPos = rigidBodyRef.current!.translation();
          const otherWorldPos = new THREE.Vector3();
          other.getWorldPosition(otherWorldPos);

          // Radial vector pointing outwards from the obstacle center
          const radial = new THREE.Vector3(playerPos.x - otherWorldPos.x, 0, playerPos.z - otherWorldPos.z).normalize();
          
          // Tangential direction matching rotation direction
          let speedVal = 1.8;
          if (other.userData && typeof other.userData.speed === 'number') {
            speedVal = other.userData.speed;
          }
          const sign = speedVal >= 0 ? 1 : -1;
          const tangent = new THREE.Vector3(-radial.z * sign, 0.2, radial.x * sign);

          // Combine 65% tangent sweep + 35% radial push outward for realistic direction
          const dir = new THREE.Vector3()
            .addScaledVector(tangent, 0.65)
            .addScaledVector(radial, 0.35)
            .normalize();
          dir.y = other.name === 'lower-beam' ? 0.38 : 0.24; // Lower beam launches player high

          const difficulty = useGameStore.getState().gameDifficulty;
          const mult = difficulty === 'EASY' ? 0.6 : difficulty === 'MEDIUM' ? 1.0 : 1.5;

          // Rebalanced lower/upper beam knockback to stagger rather than launch instantly
          let knockForce = 8.5;
          if (other.name === 'lower-beam') {
            knockForce = 5.5 * mult;
          } else if (other.name === 'upper-beam') {
            knockForce = 4.0 * mult;
          } else if (other.name === 'rotating-arm') {
            knockForce = 12.8;
          }
          
          knockbackVelRef.current.copy(dir).multiplyScalar(knockForce);
          knockbackTimerRef.current = 0.5;
          audioManager.playCollision(); // Play bonk sound effect!
          useGameStore.getState().triggerCameraShake((other.name === 'lower-beam' ? 0.65 : 0.35) * mult);
          useGameStore.getState().triggerSplash([playerPos.x, playerPos.y, playerPos.z], '#ff007f'); // Pink splash!
        } else if (other && other.name === 'cannonball') {
          const playerPos = rigidBodyRef.current!.translation();
          const otherWorldPos = new THREE.Vector3();
          other.getWorldPosition(otherWorldPos);
          
          // Push player radially away from the center of the cannonball
          const dir = new THREE.Vector3(playerPos.x - otherWorldPos.x, 0.25, playerPos.z - otherWorldPos.z).normalize();
          dir.y = 0.28; // high upward lift
          
          knockbackVelRef.current.copy(dir).multiplyScalar(13.8); // strong knockback force!
          knockbackTimerRef.current = 0.55;
          audioManager.playCollision(); // Play bonk sound effect!
          useGameStore.getState().triggerSplash([playerPos.x, playerPos.y, playerPos.z], '#ffaa00'); // Orange splash!
        }
      }}
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
        {customization.accessory === 'halo' && (
          <mesh position={[0, 0.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.22, 0.024, 8, 24]} />
            <meshStandardMaterial color="#ffff55" emissive="#ffff55" emissiveIntensity={1.2} roughness={0.1} />
          </mesh>
        )}
        {customization.accessory === 'tophat' && (
          <group position={[0, 0.72, 0]}>
            <mesh position={[0, 0.02, 0]} castShadow>
              <cylinderGeometry args={[0.3, 0.3, 0.02, 16]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.75} />
            </mesh>
            <mesh position={[0, 0.2, 0]} castShadow>
              <cylinderGeometry args={[0.2, 0.2, 0.35, 16]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.75} />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.204, 0.204, 0.05, 16]} />
              <meshStandardMaterial color="#ff0000" roughness={0.4} />
            </mesh>
          </group>
        )}
        {customization.accessory === 'ears' && (
          <group>
            <mesh position={[-0.18, 0.74, 0]} rotation={[0, 0, 0.35]} castShadow>
              <coneGeometry args={[0.1, 0.24, 4]} />
              <meshStandardMaterial color={customization.color} roughness={0.3} />
            </mesh>
            <mesh position={[0.18, 0.74, 0]} rotation={[0, 0, -0.35]} castShadow>
              <coneGeometry args={[0.1, 0.24, 4]} />
              <meshStandardMaterial color={customization.color} roughness={0.3} />
            </mesh>
          </group>
        )}
        {customization.accessory === 'horns' && (
          <group>
            <mesh position={[-0.15, 0.65, 0.15]} rotation={[-0.2, 0, 0.4]} castShadow>
              <coneGeometry args={[0.07, 0.22, 10]} />
              <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} roughness={0.3} />
            </mesh>
            <mesh position={[0.15, 0.65, 0.15]} rotation={[-0.2, 0, -0.4]} castShadow>
              <coneGeometry args={[0.07, 0.22, 10]} />
              <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} roughness={0.3} />
            </mesh>
          </group>
        )}

      </group>

      {/* Visual boost lines/aura and shoe trail */}
      {isNitroActive && (
        <group>
          {/* Glowing aura halo */}
          <mesh position={[0, 0.1, 0]}>
            <sphereGeometry args={[0.55, 16, 16]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.2} wireframe />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <sphereGeometry args={[0.58, 12, 12]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.08} />
          </mesh>
        </group>
      )}



      {/* Billboard name label above player head */}
      <Billboard position={[0, 0.9, 0]}>
        <Text
          ref={nameLabelRef}
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
      </Billboard>
    </RigidBody>
  );
};
