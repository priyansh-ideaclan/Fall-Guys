import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { audioManager } from '../utils/audioManager';
import { getThemeConfig } from '../utils/themeManager';

// Static pre-allocated configuration to prevent color object instantiations every frame
const STATIC_WEATHER_PARAMS = {
  ambColor: new THREE.Color("#ffffff"),
  ambInt: 0.9,
  dirColor: new THREE.Color("#ffffff"),
  dirInt: 1.35,
  fogColor: new THREE.Color("#87ceeb"), // sky blue
  fogFar: 220,
  rain: 0.0,
  leaves: 0.35,
  snow: 0.0,
};

export const WeatherController: React.FC = () => {
  const { scene } = useThree();
  const currentLevelId = useGameStore((state) => state.currentLevelId);
  const phase = useGameStore((state) => state.phase);

  // References for light & fog
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const playerMeshRef = useRef<THREE.Object3D | null>(null);

  // Particle Refs
  const rainRef = useRef<THREE.Points>(null);
  const snowRef = useRef<THREE.Points>(null);
  const leavesRef = useRef<THREE.Points>(null);
  const confettiRef = useRef<THREE.Points>(null);

  // Particle count sizes
  const RAIN_COUNT = 150;
  const SNOW_COUNT = 120;
  const LEAVES_COUNT = 80;
  const CONFETTI_COUNT = 120;

  // Rain initialization
  const rainData = useMemo(() => {
    const arr = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 20;     // X
      arr[i * 3 + 1] = Math.random() * 15;         // Y
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20; // Z
    }
    return arr;
  }, []);

  // Snow initialization
  const snowData = useMemo(() => {
    const arr = new Float32Array(SNOW_COUNT * 3);
    for (let i = 0; i < SNOW_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 1] = Math.random() * 15;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return arr;
  }, []);

  // Leaves initialization
  const leavesData = useMemo(() => {
    const arr = new Float32Array(LEAVES_COUNT * 3);
    for (let i = 0; i < LEAVES_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 1] = Math.random() * 15;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return arr;
  }, []);

  // Confetti initialization
  const confettiData = useMemo(() => {
    const arr = new Float32Array(CONFETTI_COUNT * 3);
    const colors = new Float32Array(CONFETTI_COUNT * 3);
    const palette = [
      new THREE.Color("#ff007f"),
      new THREE.Color("#00e5ff"),
      new THREE.Color("#ffd60a"),
      new THREE.Color("#39ff14"),
      new THREE.Color("#ff5722")
    ];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = Math.random() * 15;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 16;

      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    return { positions: arr, colors };
  }, []);

  useFrame((state, delta) => {
    // 1. Locate player mesh if not cached
    if (!playerMeshRef.current) {
      scene.traverse((child) => {
        if (child.name === 'player') {
          playerMeshRef.current = child;
        }
      });
    }

    const playerPos = new THREE.Vector3();
    if (playerMeshRef.current) {
      playerMeshRef.current.getWorldPosition(playerPos);
    } else {
      playerPos.z = 0;
    }

    // Only apply dynamic weather to race_1 level
    const isRaceLevel = currentLevelId === 'race_1';
    if (!isRaceLevel) {
      const theme = useGameStore.getState().visualTheme;
      const config = getThemeConfig(theme);

      if (ambientLightRef.current) {
        ambientLightRef.current.color.set(config.ambientColor);
        ambientLightRef.current.intensity = config.ambientIntensity;
      }
      if (directionalLightRef.current) {
        directionalLightRef.current.color.set("#ffffff");
        directionalLightRef.current.position.set(...config.skyColor);
        directionalLightRef.current.intensity = 1.25;
      }
      if (fogRef.current) {
        fogRef.current.color.set(config.fogColor);
        fogRef.current.far = 180;
      }
      audioManager.updateWeatherAmbience(0, 0); // mute in other levels
      return;
    }

    const evalZ = playerPos.z;
    const params = {
      ...STATIC_WEATHER_PARAMS,
      z: evalZ,
      confetti: evalZ > 115.0 ? 0.95 : 0.0
    };

    // 2. Interpolate lighting & fog
    if (ambientLightRef.current) {
      ambientLightRef.current.color.copy(params.ambColor);
      ambientLightRef.current.intensity = params.ambInt;
    }
    if (directionalLightRef.current) {
      directionalLightRef.current.color.copy(params.dirColor);
      directionalLightRef.current.position.set(25, 45, 15);
      directionalLightRef.current.intensity = params.dirInt;
    }
    if (fogRef.current) {
      fogRef.current.color.copy(params.fogColor);
      fogRef.current.far = params.fogFar;
    }

    // Update synthesized ambient audio gains
    if (phase === 'PLAYING') {
      if (currentLevelId === 'race_1') {
        audioManager.updateWeatherAmbience(0.12, 0.0); // soft breeze only
      } else {
        audioManager.updateWeatherAmbience(params.snow + params.rain * 0.5, params.rain);
      }
    } else {
      audioManager.updateWeatherAmbience(0, 0); // mute in menu / intros
    }

    const time = state.clock.getElapsedTime();

    // 3. Update local rain particles
    if (rainRef.current) {
      const showRain = params.rain > 0.01 && isRaceLevel;
      rainRef.current.visible = showRain;
      if (showRain) {
        const positions = rainRef.current.geometry.attributes.position.array as Float32Array;
        (rainRef.current.material as THREE.PointsMaterial).opacity = params.rain * 0.7;
        for (let i = 0; i < RAIN_COUNT; i++) {
          positions[i * 3 + 1] -= delta * 24.0; // fall down fast
          positions[i * 3] += Math.sin(time + i) * delta * 0.5; // slight sway
          // Wrap particles around player Z position
          const worldY = positions[i * 3 + 1] + playerPos.y;
          if (worldY < -3.0) {
            positions[i * 3] = (Math.random() - 0.5) * 20;
            positions[i * 3 + 1] = 14.0;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
          }
        }
        rainRef.current.geometry.attributes.position.needsUpdate = true;
        // Keep emitter centered on player Z
        rainRef.current.position.set(playerPos.x, playerPos.y, playerPos.z);
      }
    }

    // 4. Update local snow particles
    if (snowRef.current) {
      const showSnow = params.snow > 0.01 && isRaceLevel;
      snowRef.current.visible = showSnow;
      if (showSnow) {
        const positions = snowRef.current.geometry.attributes.position.array as Float32Array;
        (snowRef.current.material as THREE.PointsMaterial).opacity = params.snow * 0.85;
        for (let i = 0; i < SNOW_COUNT; i++) {
          positions[i * 3 + 1] -= delta * 3.5; // fall slow
          positions[i * 3] += Math.sin(time * 0.8 + i) * delta * 1.2; // sway side to side
          const worldY = positions[i * 3 + 1] + playerPos.y;
          if (worldY < -3.0) {
            positions[i * 3] = (Math.random() - 0.5) * 20;
            positions[i * 3 + 1] = 14.0;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
          }
        }
        snowRef.current.geometry.attributes.position.needsUpdate = true;
        snowRef.current.position.set(playerPos.x, playerPos.y, playerPos.z);
      }
    }

    // 5. Update local autumn leaves
    if (leavesRef.current) {
      const showLeaves = params.leaves > 0.01 && isRaceLevel;
      leavesRef.current.visible = showLeaves;
      if (showLeaves) {
        const positions = leavesRef.current.geometry.attributes.position.array as Float32Array;
        (leavesRef.current.material as THREE.PointsMaterial).opacity = params.leaves * 0.85;
        for (let i = 0; i < LEAVES_COUNT; i++) {
          positions[i * 3 + 1] -= delta * 2.2; // fall slowly
          positions[i * 3] += Math.cos(time * 0.5 + i) * delta * 2.0; // drift side to side
          positions[i * 3 + 2] -= delta * 0.5; // push backward slightly by wind
          const worldY = positions[i * 3 + 1] + playerPos.y;
          if (worldY < -3.0) {
            positions[i * 3] = (Math.random() - 0.5) * 20;
            positions[i * 3 + 1] = 14.0;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
          }
        }
        leavesRef.current.geometry.attributes.position.needsUpdate = true;
        leavesRef.current.position.set(playerPos.x, playerPos.y, playerPos.z);
      }
    }

    // 6. Update local celebration confetti
    if (confettiRef.current) {
      const showConf = params.confetti > 0.01 && isRaceLevel;
      confettiRef.current.visible = showConf;
      if (showConf) {
        const positions = confettiRef.current.geometry.attributes.position.array as Float32Array;
        (confettiRef.current.material as THREE.PointsMaterial).opacity = params.confetti * 0.9;
        for (let i = 0; i < CONFETTI_COUNT; i++) {
          positions[i * 3 + 1] -= delta * 5.0; // fall spinning
          positions[i * 3] += Math.sin(time * 2.0 + i) * delta * 1.5;
          positions[i * 3 + 2] += Math.cos(time * 2.0 + i) * delta * 1.5;
          const worldY = positions[i * 3 + 1] + playerPos.y;
          if (worldY < -4.0) {
            positions[i * 3] = (Math.random() - 0.5) * 16;
            positions[i * 3 + 1] = 14.0;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 16;
          }
        }
        confettiRef.current.geometry.attributes.position.needsUpdate = true;
        confettiRef.current.position.set(playerPos.x, playerPos.y, playerPos.z);
      }
    }
  });

  return (
    <group>
      {/* Fog, Ambient Light, and Directional Light under Weather Control */}
      <fog ref={fogRef} attach="fog" args={["#a3d2ff", 10, 180]} />
      <ambientLight ref={ambientLightRef} color="#ffffff" intensity={0.8} />
      
      <directionalLight
        ref={directionalLightRef}
        castShadow
        position={[25, 45, 15]}
        intensity={1.25}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={180}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0005}
      />

      {/* RAIN PARTICLE SYSTEM */}
      <points ref={rainRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[rainData, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#00e5ff"
          size={0.12}
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </points>

      {/* SNOW PARTICLE SYSTEM */}
      <points ref={snowRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[snowData, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={0.22}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </points>

      {/* AUTUMN LEAVES PARTICLE SYSTEM */}
      <points ref={leavesRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[leavesData, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#ff7a00"
          size={0.28}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </points>

      {/* CELEBRATION CONFETTI PARTICLE SYSTEM */}
      <points ref={confettiRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[confettiData.positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[confettiData.colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.25}
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </points>
    </group>
  );
};
