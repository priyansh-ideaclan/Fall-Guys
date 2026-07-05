import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { getThemeConfig } from '../../utils/themeManager';
import { audioManager } from '../../utils/audioManager';

// ─── Procedural Audio Synth for Jungle Ambience ──────────────────────────────
const useJungleAmbience = (isActive: boolean) => {
  const weatherVolume = useGameStore((state) => state.weatherVolume);
  const weatherMuted = useGameStore((state) => state.weatherMuted);

  useEffect(() => {
    if (!isActive || weatherMuted || weatherVolume <= 0) return;

    let ctx: AudioContext | null = null;
    let masterGain: GainNode | null = null;
    let chirpInterval: any = null;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new AudioContextClass();
      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(weatherVolume * 0.15, ctx.currentTime);
      masterGain.connect(ctx.destination);

      // 1. Water Rushing (Waterfall Rumble)
      const bufferSize = ctx.sampleRate * 2.0;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const waterfallNoise = ctx.createBufferSource();
      waterfallNoise.buffer = noiseBuffer;
      waterfallNoise.loop = true;

      // Filter rumble to sound deep
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, ctx.currentTime);

      const waterfallGain = ctx.createGain();
      waterfallGain.gain.setValueAtTime(0.7, ctx.currentTime);

      waterfallNoise.connect(filter);
      filter.connect(waterfallGain);
      waterfallGain.connect(masterGain);
      waterfallNoise.start(0);

      // 2. High-pitch Cricket Hum
      const cricketOsc = ctx.createOscillator();
      cricketOsc.type = 'sine';
      cricketOsc.frequency.setValueAtTime(3200, ctx.currentTime);
      
      const cricketGain = ctx.createGain();
      cricketGain.gain.setValueAtTime(0.015, ctx.currentTime);

      // Soft LFO modulation for crickets
      const cricketLfo = ctx.createOscillator();
      cricketLfo.frequency.setValueAtTime(14, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.01, ctx.currentTime);

      cricketLfo.connect(lfoGain);
      lfoGain.connect(cricketGain.gain);
      cricketOsc.connect(cricketGain);
      cricketGain.connect(masterGain);
      cricketLfo.start(0);
      cricketOsc.start(0);

      // 3. Periodic FM Bird Chirping Sweeps
      const playBirdChirp = () => {
        if (!ctx || ctx.state === 'suspended') return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(masterGain!);

        osc.type = 'sine';
        const now = ctx.currentTime;
        
        // Dynamic pitch sweep
        const startFreq = 2200 + Math.random() * 1400;
        const endFreq = startFreq + 1200;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.18);

        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.start(now);
        osc.stop(now + 0.2);
      };

      chirpInterval = setInterval(() => {
        if (Math.random() < 0.72) {
          playBirdChirp();
          // Short echo chirp
          setTimeout(() => playBirdChirp(), 220);
        }
      }, 3500);

    } catch (e) {
      console.warn("Jungle audio synth failed to init", e);
    }

    return () => {
      if (chirpInterval) clearInterval(chirpInterval);
      if (ctx) {
        ctx.close();
      }
    };
  }, [isActive, weatherVolume, weatherMuted]);
};

// ─── Environment Component ──────────────────────────────────────────────────
const JungleEnvironment: React.FC = () => {
  // Generate random tree positions
  const trees = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i * Math.PI * 2) / 20 + (Math.random() - 0.5) * 0.18;
      const radius = 10.5 + Math.random() * 8.0;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const height = 3.5 + Math.random() * 3.0;
      const scale = 0.8 + Math.random() * 0.6;
      arr.push({ x, z, height, scale, id: i });
    }
    return arr;
  }, []);

  // Generate random bamboo positions
  const bamboos = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 28; i++) {
      const angle = (i * Math.PI * 2) / 28 + (Math.random() - 0.5) * 0.12;
      const radius = 9.0 + Math.random() * 4.5;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const height = 4.0 + Math.random() * 2.5;
      arr.push({ x, z, height, id: i });
    }
    return arr;
  }, []);

  // Generate random rocks
  const rocks = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 14; i++) {
      const angle = (i * Math.PI * 2) / 14 + (Math.random() - 0.5) * 0.22;
      const radius = 8.5 + Math.random() * 2.0;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const scale = 0.5 + Math.random() * 0.7;
      arr.push({ x, z, scale, id: i });
    }
    return arr;
  }, []);

  return (
    <group name="jungle-scenery">
      {/* ── 1. Sun God Rays ── */}
      {Array.from({ length: 4 }).map((_, i) => {
        const x = -6.0 + i * 4.0;
        const z = -6.0 + (i % 2) * 5.0;
        const rotX = 0.2 + i * 0.05;
        const rotZ = -0.15 + i * 0.04;
        return (
          <mesh key={i} position={[x, 10.0, z]} rotation={[rotX, 0.0, rotZ]}>
            <coneGeometry args={[1.6, 22.0, 8]} />
            <meshBasicMaterial 
              color="#e6fbd0" 
              transparent 
              opacity={0.08} 
              blending={THREE.AdditiveBlending} 
              depthWrite={false} 
            />
          </mesh>
        );
      })}

      {/* ── 2. Rainforest Trees ── */}
      {trees.map((t) => (
        <group key={t.id} position={[t.x, -0.4, t.z]} scale={[t.scale, t.scale, t.scale]}>
          {/* Tree trunk */}
          <mesh castShadow receiveShadow position={[0, t.height / 2, 0]}>
            <cylinderGeometry args={[0.2, 0.35, t.height, 8]} />
            <meshStandardMaterial color="#5c4033" roughness={0.95} />
          </mesh>
          {/* Foliage (stacked spheres for stylized cartoon look) */}
          <mesh castShadow position={[0, t.height + 0.3, 0]}>
            <dodecahedronGeometry args={[1.3]} />
            <meshStandardMaterial color="#1a5c1a" roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0, t.height + 1.2, 0]}>
            <dodecahedronGeometry args={[0.9]} />
            <meshStandardMaterial color="#2d7d2d" roughness={0.75} />
          </mesh>
        </group>
      ))}

      {/* ── 3. Bamboo stalks ── */}
      {bamboos.map((b) => (
        <mesh key={b.id} castShadow position={[b.x, -0.4 + b.height / 2, b.z]}>
          <cylinderGeometry args={[0.08, 0.1, b.height, 6]} />
          <meshStandardMaterial color="#4a8f3c" roughness={0.7} />
        </mesh>
      ))}

      {/* ── 4. Riverbed rocks ── */}
      {rocks.map((r) => (
        <mesh key={r.id} castShadow receiveShadow position={[r.x, -0.4, r.z]} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, 0]} scale={[r.scale, r.scale, r.scale]}>
          <dodecahedronGeometry args={[0.65]} />
          <meshStandardMaterial color="#555d50" roughness={0.85} />
        </mesh>
      ))}

      {/* ── 5. Background Waterfalls ── */}
      {Array.from({ length: 2 }).map((_, i) => {
        const x = i === 0 ? -13.0 : 13.0;
        const z = -12.0;
        return (
          <group key={i} position={[x, 2.5, z]}>
            {/* Waterfall cascade plane */}
            <mesh>
              <planeGeometry args={[3.5, 9.0]} />
              <meshStandardMaterial 
                color="#7fffd4" 
                emissive="#00ffc4" 
                emissiveIntensity={0.35} 
                transparent 
                opacity={0.75} 
                roughness={0.05} 
              />
            </mesh>
            {/* Rocks behind the waterfall */}
            <mesh position={[0, -2.8, -0.3]}>
              <boxGeometry args={[4.2, 3.0, 1.0]} />
              <meshStandardMaterial color="#333a30" roughness={0.9} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// ─── Fireflies / Butterflies Component ───────────────────────────────────────
const Fireflies: React.FC = () => {
  const count = 12;
  const refs = useRef<Array<THREE.Group | null>>([]);
  const offsets = React.useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      angleOffset: i * (Math.PI * 2 / count),
      radius: 4.5 + Math.random() * 3.5,
      yPos: 0.6 + Math.random() * 2.2,
      speed: 0.4 + Math.random() * 0.5,
      bobSpeed: 1.8 + Math.random() * 1.5
    }));
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    refs.current.forEach((ref, i) => {
      if (!ref) return;
      const off = offsets[i];
      const currentAngle = time * off.speed + off.angleOffset;
      const x = Math.sin(currentAngle) * off.radius;
      const z = Math.cos(currentAngle) * off.radius;
      const y = off.yPos + Math.sin(time * off.bobSpeed) * 0.28;
      ref.position.set(x, y, z);
    });
  });

  return (
    <group name="fireflies-group">
      {offsets.map((_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <mesh>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshBasicMaterial color="#7fff00" />
          </mesh>
          <pointLight color="#7fff00" intensity={0.4} distance={2.0} />
        </group>
      ))}
    </group>
  );
};

// ─── Main SURVIVAL 1 Component ───────────────────────────────────────────────
export const Survival1: React.FC = () => {
  const phase = useGameStore((state) => state.phase);
  const theme = useGameStore((state) => state.visualTheme);
  const config = getThemeConfig(theme);
  const eliminateRacer = useGameStore((state) => state.eliminateRacer);
  const difficulty = useGameStore((state) => state.gameDifficulty);

  // Synced state triggers
  const isActive = phase === 'PLAYING' || phase === 'ROUND_INTRO';
  useJungleAmbience(isActive);

  // Platform rotation states
  const platformRbRef = useRef<RapierRigidBody>(null);
  const platformAngle = useRef(0);
  const isPlatformRotating = useRef(false);
  const platformRotateTimer = useRef(0);
  const platformRotateDuration = 2.5; // Rotate floor smoothly over 2.5s
  const platformStartAngle = useRef(0);
  const platformTargetAngle = useRef(0);
  const nextRotationTime = useRef(10.0); // Trigger every 10 seconds

  // Lower & Upper independent spinning obstacle beams refs
  const lowerBeamRbRef = useRef<RapierRigidBody>(null);
  const upperBeamRbRef = useRef<RapierRigidBody>(null);

  const lowerBeamAngle = useRef(0);
  const lowerBeamSpeed = useRef(0);
  const lowerBeamTargetSpeed = useRef(1.2);
  const lowerBeamSpeedChangeTimer = useRef(8.0);

  const upperBeamAngle = useRef(0);
  const upperBeamSpeed = useRef(0);
  const upperBeamTargetSpeed = useRef(-0.9);
  const upperBeamSpeedChangeTimer = useRef(8.0);

  const playTime = useRef(0);

  const isSynchronized = useRef(false);
  const syncPatternTimer = useRef(15.0);
  const syncDurationTimer = useRef(0);
  const syncPatternType = useRef<'same' | 'opposite'>('opposite');

  // Animated emerald lake waves Y bobbing
  const lakeRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const speedMult = difficulty === 'EASY' ? 0.65 : difficulty === 'MEDIUM' ? 1.0 : 1.35;
    // ── 1. Rotate the Arena Floor (Platform) ──
    const plat = platformRbRef.current;
    if (plat) {
      if (phase === 'PLAYING') {
        nextRotationTime.current -= delta;
        if (nextRotationTime.current <= 0 && !isPlatformRotating.current) {
          isPlatformRotating.current = true;
          platformRotateTimer.current = 0;
          platformStartAngle.current = platformAngle.current;
          
          // Random rotate 45 to 90 degrees in random direction
          const dir = Math.random() > 0.5 ? 1 : -1;
          const rad = (Math.PI / 4) + Math.random() * (Math.PI / 4); // 45 to 90 deg
          platformTargetAngle.current = platformAngle.current + dir * rad;
          audioManager.playCollision(); // Audio thud on rotate trigger
        }

        if (isPlatformRotating.current) {
          platformRotateTimer.current += delta;
          const t = Math.min(1.0, platformRotateTimer.current / platformRotateDuration);
          const ease = t * t * (3 - 2 * t); // smoothstep ease
          platformAngle.current = THREE.MathUtils.lerp(platformStartAngle.current, platformTargetAngle.current, ease);

          if (t >= 1.0) {
            isPlatformRotating.current = false;
            nextRotationTime.current = 10.0 + Math.random() * 2.0; // schedule next rotation
          }
        }
      }

      // Platform dynamic wobble, tilt, and shake scaled by difficulty and match progress
      const tiltMult = difficulty === 'EASY' ? 0.5 : difficulty === 'MEDIUM' ? 1.0 : 1.5;
      const time = state.clock.getElapsedTime();
      const progressIntensity = Math.min(1.0, playTime.current / 45.0); // ramp up intensity over 45s

      // Wobble angles on X and Z
      const tiltX = Math.sin(time * 1.3) * 0.045 * tiltMult * progressIntensity;
      const tiltZ = Math.cos(time * 1.6) * 0.045 * tiltMult * progressIntensity;

      // High-frequency shake/vibration
      const shakeVal = Math.sin(time * 28.0) * 0.004 * tiltMult * progressIntensity;

      const euler = new THREE.Euler(tiltX + shakeVal, platformAngle.current, tiltZ + shakeVal);
      const qPlat = new THREE.Quaternion().setFromEuler(euler);
      plat.setNextKinematicRotation(qPlat);
    }

    // Save platform rotation state to global store so bots can read if platform is rotating
    (useGameStore.getState() as any).isPlatformRotating = isPlatformRotating.current;

    const participantPositions: THREE.Vector3[] = [];
    state.scene.traverse((child) => {
      if (child.name === 'player' || child.name === 'bot') {
        participantPositions.push(child.position);
      }
    });

    const isAnyParticipantNearLower = participantPositions.some((pos) => {
      const angle = Math.atan2(pos.x, pos.z);
      const diff = (angle - lowerBeamAngle.current) % Math.PI;
      const distToCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      const perpDist = Math.abs(Math.sin(diff)) * distToCenter;
      return perpDist < 2.5;
    });

    const isAnyParticipantNearUpper = participantPositions.some((pos) => {
      const angle = Math.atan2(pos.x, pos.z);
      const diff = (angle - upperBeamAngle.current) % Math.PI;
      const distToCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      const perpDist = Math.abs(Math.sin(diff)) * distToCenter;
      return perpDist < 2.5;
    });

    if (phase === 'PLAYING') {
      playTime.current += delta;

      // Handle synchronization pattern scheduling
      if (isSynchronized.current) {
        syncDurationTimer.current -= delta;
        if (syncDurationTimer.current <= 0) {
          isSynchronized.current = false;
          syncPatternTimer.current = 20.0 + Math.random() * 10.0; // Next sync in 20-30s
          
          // Reset change timers to trigger normal behavior
          lowerBeamSpeedChangeTimer.current = 0.5;
          upperBeamSpeedChangeTimer.current = 0.5;
        }
      } else {
        syncPatternTimer.current -= delta;
        if (syncPatternTimer.current <= 0) {
          isSynchronized.current = true;
          syncDurationTimer.current = 10.0 + Math.random() * 4.0; // Synchronize for 10-14 seconds
          syncPatternType.current = Math.random() > 0.5 ? 'same' : 'opposite';
          
          // Choose a synchronized speed magnitude (0.8 to 1.2 rad/s)
          const syncSpeed = (0.8 + Math.random() * 0.4) * speedMult;
          const dir = Math.random() > 0.5 ? 1 : -1;
          
          lowerBeamTargetSpeed.current = dir * syncSpeed;
          upperBeamTargetSpeed.current = (syncPatternType.current === 'same' ? dir : -dir) * syncSpeed;
          
          // Hold speed changes during synchronization
          lowerBeamSpeedChangeTimer.current = syncDurationTimer.current;
          upperBeamSpeedChangeTimer.current = syncDurationTimer.current;
        }
      }
    } else {
      playTime.current = 0;
      isSynchronized.current = false;
      syncPatternTimer.current = 15.0;
      syncDurationTimer.current = 0;
      
      lowerBeamSpeed.current = 0;
      lowerBeamTargetSpeed.current = 1.2 * speedMult;
      lowerBeamSpeedChangeTimer.current = 9.0 + Math.random() * 6.0;

      upperBeamSpeed.current = 0;
      upperBeamTargetSpeed.current = -0.9 * speedMult;
      upperBeamSpeedChangeTimer.current = 9.0 + Math.random() * 6.0;
    }

    const rawRamp = Math.min(1.0, playTime.current / 6.0);
    const ease = rawRamp * rawRamp * (3 - 2 * rawRamp); // smoothstep ease
    const ramp = 0.15 + 0.85 * ease; // Starts rotating slowly at 15% and ramps up to 100% over 6 seconds

    // ── 2. Rotate Lower Beam ──
    const lowerB = lowerBeamRbRef.current;
    if (lowerB) {
      if (phase === 'PLAYING' && !isSynchronized.current) {
        lowerBeamSpeedChangeTimer.current -= delta;
        if (lowerBeamSpeedChangeTimer.current <= 0) {
          if (isAnyParticipantNearLower) {
            // Postpone speed change by 1.0 second for player safety
            lowerBeamSpeedChangeTimer.current = 1.0;
          } else {
            const currentDir = Math.sign(lowerBeamTargetSpeed.current) || 1;
            const shouldReverse = Math.random() < 0.3; // 30% chance to reverse
            const nextDir = shouldReverse ? -currentDir : currentDir;
            const nextSpeedMag = (0.9 + Math.random() * 0.9) * speedMult; // Rebalanced speed scaled by difficulty
            lowerBeamTargetSpeed.current = nextDir * nextSpeedMag;
            lowerBeamSpeedChangeTimer.current = 9.0 + Math.random() * 6.0; // 9-15s gap
          }
        }
      }
      lowerBeamSpeed.current = THREE.MathUtils.lerp(lowerBeamSpeed.current, lowerBeamTargetSpeed.current, delta * 0.45);
      lowerBeamAngle.current += lowerBeamSpeed.current * ramp * delta;
      
      const qLower = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), lowerBeamAngle.current);
      lowerB.setNextKinematicRotation(qLower);
      lowerB.userData = { speed: lowerBeamSpeed.current };
    }

    // ── 3. Rotate Upper Beam ──
    const upperB = upperBeamRbRef.current;
    if (upperB) {
      if (phase === 'PLAYING' && !isSynchronized.current) {
        upperBeamSpeedChangeTimer.current -= delta;
        if (upperBeamSpeedChangeTimer.current <= 0) {
          if (isAnyParticipantNearUpper) {
            // Postpone speed change by 1.0 second for player safety
            upperBeamSpeedChangeTimer.current = 1.0;
          } else {
            const currentDir = Math.sign(upperBeamTargetSpeed.current) || -1;
            const shouldReverse = Math.random() < 0.3; // 30% chance to reverse
            const nextDir = shouldReverse ? -currentDir : currentDir;
            const nextSpeedMag = (0.6 + Math.random() * 0.7) * speedMult; // Rebalanced speed scaled by difficulty
            upperBeamTargetSpeed.current = nextDir * nextSpeedMag;
            upperBeamSpeedChangeTimer.current = 9.0 + Math.random() * 6.0; // 9-15s gap
          }
        }
      }
      upperBeamSpeed.current = THREE.MathUtils.lerp(upperBeamSpeed.current, upperBeamTargetSpeed.current, delta * 0.45);
      upperBeamAngle.current += upperBeamSpeed.current * ramp * delta;

      const qUpper = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), upperBeamAngle.current);
      upperB.setNextKinematicRotation(qUpper);
      upperB.userData = { speed: upperBeamSpeed.current };
    }

    // ── 4. Animate Emerald Lake Water Waves ──
    if (lakeRef.current) {
      const time = state.clock.getElapsedTime();
      lakeRef.current.position.y = -3.8 + Math.sin(time * 1.5) * 0.12;
    }
  });

  // Kill zone sensor callback
  const handleKillZone = (event: any) => {
    if (phase !== 'PLAYING') return;
    const rb = event.rigidBodyObject;
    if (!rb) return;
    if (rb.name === 'player') {
      eliminateRacer('player');
    } else if (rb.name === 'bot') {
      const botId = rb.userData?.id;
      if (botId) eliminateRacer(botId);
    }
  };

  return (
    <group name="survival_1">
      {/* Jungle atmospheric fog */}
      <fog attach="fog" args={["#071a0c", 10, 32]} />

      {/* ── 1. Scenery and Scapes ── */}
      <JungleEnvironment />
      <Fireflies />

      {/* ── 2. Kinematic Arena Floor Platform ── */}
      <RigidBody 
        ref={platformRbRef} 
        type="kinematicPosition" 
        colliders={false} 
        position={[0, -0.4, 0]}
        friction={0.8}
        restitution={0.05}
      >
        {/* Physical cylindrical platform bounds */}
        <CylinderCollider args={[0.4, 8.0]} />
        <mesh receiveShadow castShadow>
          <cylinderGeometry args={[8, 8, 0.8, 32]} />
          {/* Green-brown grassy jungle theme */}
          <meshStandardMaterial color="#507c31" roughness={0.88} metalness={0.05} />
        </mesh>
        
        {/* Red concentric safety border ring on platform */}
        <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[7.3, 7.8, 32]} />
          <meshBasicMaterial color="#d93b3b" />
        </mesh>

        {/* Decorative central column structure (Orange/Yellow base support) */}
        <mesh castShadow position={[0, 0.9, 0]}>
          <cylinderGeometry args={[1.0, 1.0, 2.0, 24]} />
          <meshStandardMaterial color="#ffa500" roughness={0.4} metalness={0.1} />
        </mesh>
      </RigidBody>

      {/* ── 3. Dual-Layer Spinning Obstacles ── */}
      {/* Lower Beam: sweeps at waist height (Y = 0.32) */}
      <RigidBody 
        ref={lowerBeamRbRef} 
        type="kinematicPosition" 
        colliders={false} 
        position={[0, 0.32, 0]}
        restitution={1.4} 
        friction={0.3}
        name="lower-beam"
      >
        <CuboidCollider args={[7.2, 0.22, 0.22]} />
        <group>
          {/* Thick pink sweeping cylinder */}
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.22, 0.22, 14.4, 16]} />
            <meshStandardMaterial 
              color="#d91a7e" 
              roughness={0.2} 
              metalness={0.1}
              emissive="#d91a7e" 
              emissiveIntensity={0.25} 
            />
          </mesh>
          {/* Rotating central hub sleeve */}
          <mesh castShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[1.15, 1.15, 0.76, 24]} />
            <meshStandardMaterial color="#d91a7e" roughness={0.3} />
          </mesh>
          {/* Warning chevron stripes on the lower rotating hub */}
          {Array.from({ length: 8 }).map((_, idx) => {
            const rotY = (idx * Math.PI * 2) / 8;
            return (
              <group key={idx} rotation={[0, rotY, 0]}>
                <mesh position={[0, 0.15, 1.16]} rotation={[0, 0, -Math.PI / 4]}>
                  <boxGeometry args={[0.2, 0.08, 0.02]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                <mesh position={[0, -0.15, 1.16]} rotation={[0, 0, Math.PI / 4]}>
                  <boxGeometry args={[0.2, 0.08, 0.02]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              </group>
            );
          })}
        </group>
      </RigidBody>

      {/* Upper Beam: blocks jumps (Y = 1.32) */}
      <RigidBody 
        ref={upperBeamRbRef} 
        type="kinematicPosition" 
        colliders={false} 
        position={[0, 1.32, 0]}
        restitution={1.2} 
        friction={0.4}
        name="upper-beam"
      >
        <CuboidCollider args={[7.2, 0.18, 0.18]} />
        <group>
          {/* Thin lime green sweeping cylinder */}
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 14.4, 16]} />
            <meshStandardMaterial 
              color="#39ff14" 
              roughness={0.15} 
              emissive="#39ff14" 
              emissiveIntensity={0.65} 
            />
          </mesh>
          {/* Rotating central hub sleeve */}
          <mesh castShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[1.08, 1.08, 0.5, 24]} />
            <meshStandardMaterial color="#39ff14" roughness={0.3} emissive="#39ff14" emissiveIntensity={0.2} />
          </mesh>
          {/* Warning bands on upper rotating hub */}
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[1.09, 1.09, 0.06, 24]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, -0.18, 0]}>
            <cylinderGeometry args={[1.09, 1.09, 0.06, 24]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      </RigidBody>

      {/* ── 4. Slime Lake Water (Kill Zone visual) ── */}
      <mesh ref={lakeRef} receiveShadow position={[0, -3.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        {/* Emerald green rainforest lake */}
        <meshStandardMaterial color="#082b17" roughness={0.12} metalness={0.72} opacity={0.9} transparent />
      </mesh>

      {/* ── 5. Kill Zone Sensor plane ── */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[45, 0.5, 45]}
          position={[0, -3.7, 0]}
          sensor
          onIntersectionEnter={handleKillZone}
        />
      </RigidBody>
    </group>
  );
};


