import React, { useMemo } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { 
  RotatingSweeper, 
  Checkpoint, 
  JumpPad,
  IcePlatform, 
  MudPlatform, 
  WindFanZone, 
  PendulumHammer,
  MovingPlatform,
  PowerJumpPad,
  DecorativeTree,
  DecorativeCloud,
  WavingFlag,
  DecorativeRuins,
  ConfettiCannon,
  KillZonePlane,
  SpeedPad,
  DebugLandmark,
  SlimeSplash,
  TiltingDeck,
  Windmill,
  PatternWindmill,
  HorizontalWindBlower,
  CandyHill,
  CandyMountain,
  DriftingCloud,
  SpinningHammer,
  StartLine,
  GoalLine
} from '../LevelObstacles';
import { useGameStore } from '../../store/useGameStore';
import { getThemeConfig } from '../../utils/themeManager';
import { LEVEL_1_LANDMARKS } from '../../utils/landmarks';

export const Level1: React.FC = () => {
  const triggerWinAction = useGameStore((state) => state.triggerWin);
  const qualifyRacerAction = useGameStore((state) => state.qualifyRacer);
  const lastCheckpoint = useGameStore((state) => state.lastCheckpoint);
  const splashes = useGameStore((state) => state.splashes);
  const theme = useGameStore((state) => state.visualTheme);
  const config = getThemeConfig(theme);

  // Deterministic procedural background scenery generation for Candy Hills theme
  const backgroundProps = useMemo(() => {
    const list: Array<{ type: 'tree'; pos: [number, number, number]; scale: number; variant: 'candy-pink' | 'candy-yellow' | 'candy-blue' | 'candy-purple' | 'candy-green' }> = [];
    const seedRandom = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    // Hills positions surrounding the course track (Z = -20 to Z = 150)
    const hills = [
      // Left side hills
      { pos: [-24, -9, 0] as [number, number, number], r: 16, color: '#a8e6cf' },
      { pos: [-28, -7, 25] as [number, number, number], r: 20, color: '#dcedc1' },
      { pos: [-22, -10, 50] as [number, number, number], r: 18, color: '#ffd3b6' },
      { pos: [-32, -6, 75] as [number, number, number], r: 22, color: '#a8e6cf' },
      { pos: [-25, -8, 100] as [number, number, number], r: 19, color: '#dcedc1' },
      { pos: [-28, -7, 125] as [number, number, number], r: 17, color: '#ffd3b6' },
      { pos: [-24, -9, 145] as [number, number, number], r: 16, color: '#a8e6cf' },
      
      // Right side hills
      { pos: [24, -9, 5] as [number, number, number], r: 18, color: '#dcedc1' },
      { pos: [29, -7, 30] as [number, number, number], r: 21, color: '#ffd3b6' },
      { pos: [23, -10, 55] as [number, number, number], r: 17, color: '#a8e6cf' },
      { pos: [33, -6, 80] as [number, number, number], r: 23, color: '#dcedc1' },
      { pos: [26, -8, 105] as [number, number, number], r: 20, color: '#ffd3b6' },
      { pos: [27, -7, 130] as [number, number, number], r: 16, color: '#a8e6cf' },
      { pos: [24, -9, 150] as [number, number, number], r: 18, color: '#dcedc1' },
    ];

    // Mountains further out on the horizon
    const mountains = [
      // Left horizon
      { pos: [-65, -5, -20] as [number, number, number], r: 28, h: 42 },
      { pos: [-75, -5, 20] as [number, number, number], r: 35, h: 55 },
      { pos: [-60, -5, 60] as [number, number, number], r: 30, h: 45 },
      { pos: [-70, -5, 100] as [number, number, number], r: 32, h: 48 },
      { pos: [-62, -5, 140] as [number, number, number], r: 29, h: 44 },
      
      // Right horizon
      { pos: [65, -5, -15] as [number, number, number], r: 30, h: 46 },
      { pos: [72, -5, 25] as [number, number, number], r: 34, h: 50 },
      { pos: [60, -5, 70] as [number, number, number], r: 28, h: 40 },
      { pos: [78, -5, 110] as [number, number, number], r: 36, h: 58 },
      { pos: [65, -5, 145] as [number, number, number], r: 27, h: 42 },
      
      // Far back horizon (behind finish)
      { pos: [-35, -5, 168] as [number, number, number], r: 32, h: 48 },
      { pos: [0, -8, 178] as [number, number, number], r: 40, h: 62 },
      { pos: [35, -5, 162] as [number, number, number], r: 30, h: 45 },
    ];

    // Populate foliage trees deterministically on the hills
    let seed = 9876;
    hills.forEach((hill) => {
      const count = 4;
      for (let i = 0; i < count; i++) {
        seed += 1;
        const angle = seedRandom(seed) * Math.PI * 2;
        const dist = seedRandom(seed + 1) * (hill.r - 2.5);
        const px = hill.pos[0] + Math.cos(angle) * dist;
        const pz = hill.pos[2] + Math.sin(angle) * dist;
        
        const diffSq = hill.r * hill.r - dist * dist;
        const py = hill.pos[1] + (diffSq > 0 ? Math.sqrt(diffSq) : 0);

        seed += 2;
        const val = seedRandom(seed);
        const scale = 0.5 + val * 0.75;
        
        let variant: 'candy-pink' | 'candy-yellow' | 'candy-blue' | 'candy-purple' | 'candy-green' = 'candy-pink';
        if (val < 0.22) variant = 'candy-yellow';
        else if (val < 0.44) variant = 'candy-blue';
        else if (val < 0.66) variant = 'candy-purple';
        else if (val < 0.88) variant = 'candy-green';

        list.push({
          type: 'tree',
          pos: [px, py - 0.1, pz] as [number, number, number],
          scale,
          variant
        });
      }
    });

    return { hills, mountains, sceneryProps: list };
  }, []);

  const handleFinish = (event: any) => {
    if (event.rigidBodyObject) {
      const name = event.rigidBodyObject.name;
      if (name === 'player') {
        triggerWinAction();
      } else if (name === 'bot') {
        const botId = event.rigidBodyObject.userData?.id;
        if (botId) {
          qualifyRacerAction(botId);
        }
      }
    }
  };

  // Checkpoint celebration states
  const isCp1Active = !!(lastCheckpoint && Math.abs(lastCheckpoint[2] - 20) < 1.5);
  const isCp2Active = !!(lastCheckpoint && Math.abs(lastCheckpoint[2] - 42.6) < 1.5);
  const isCp3Active = !!(lastCheckpoint && Math.abs(lastCheckpoint[2] - 76.5) < 1.5);
  const isCp4Active = !!(lastCheckpoint && Math.abs(lastCheckpoint[2] - 100.0) < 1.5);

  return (
    <group name="level1">
      {/* ── BACKGROUND SCENERY (CANDY HILLS LIVING WORLD) ────────────────────────── */}
      {/* Rolling green landscape hills */}
      {backgroundProps.hills.map((hill, idx) => (
        <CandyHill key={`hill-${idx}`} position={hill.pos} radius={hill.r} color={hill.color} />
      ))}

      {/* Snow-capped pink mountains */}
      {backgroundProps.mountains.map((mtn, idx) => (
        <CandyMountain key={`mtn-${idx}`} position={mtn.pos} radius={mtn.r} height={mtn.h} />
      ))}

      {/* Fluffy cartoon scenery trees on hills */}
      {backgroundProps.sceneryProps.map((prop, idx) => (
        <DecorativeTree 
          key={`scenery-tree-${idx}`} 
          type="candy" 
          variant={prop.variant} 
          position={prop.pos} 
          scale={prop.scale} 
        />
      ))}

      {/* Cartoon Drifting Clouds */}
      <DriftingCloud position={[-28, 22, -15]} scale={1.5} speed={0.8} />
      <DriftingCloud position={[25, 26, 20]} scale={1.8} speed={0.6} />
      <DriftingCloud position={[-30, 24, 60]} scale={1.6} speed={0.9} />
      <DriftingCloud position={[28, 28, 100]} scale={1.4} speed={0.7} />
      <DriftingCloud position={[-24, 25, 135]} scale={1.5} speed={0.8} />

      {/* ── OCEAN KILL ZONE ────────────────────────────────────────── */}
      <KillZonePlane position={[0, -9.0, 75]} size={[120, 280]} type="slime" />


      {/* ── SECTION 1: SPAWN AREA (LUSH FOREST ZONE) (Z = -6 to Z = 20) ── */}
      {/* Spawn Base */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[6.0, 0.4, 4.5]} position={[0, -0.4, -1.5]} />
        <mesh receiveShadow position={[0, -0.4, -1.5]}>
          <boxGeometry args={[12, 0.8, 9]} />
          <meshStandardMaterial color="#2e8b57" roughness={0.7} /> {/* Lush grass green */}
        </mesh>
        
        {/* Spawn Border Walls */}
        <mesh castShadow position={[-6.0, 0.4, -1.5]}>
          <boxGeometry args={[0.15, 0.8, 9]} />
          <meshStandardMaterial color={config.obstacleColor1} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[6.0, 0.4, -1.5]}>
          <boxGeometry args={[0.15, 0.8, 9]} />
          <meshStandardMaterial color={config.obstacleColor1} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 0.4, -6.0]}>
          <boxGeometry args={[12, 0.8, 0.15]} />
          <meshStandardMaterial color={config.obstacleColor1} roughness={0.5} />
        </mesh>
      </RigidBody>
      {/* ── START LINE GANTRY & CHECKERED FLOOR ── */}
      <StartLine position={[0, -0.0, 3.0]} width={12} />

      {/* Forest Trees and Flags at Spawn */}
      <DecorativeTree position={[-7.5, -0.8, -3.0]} type="candy" variant="candy-pink" scale={1.1} />
      <DecorativeTree position={[7.5, -0.8, -1.0]} type="candy" variant="candy-yellow" scale={0.9} />
      <WavingFlag position={[-5.2, 0, -5.5]} color="#ff007f" />
      <WavingFlag position={[5.2, 0, -5.5]} color="#00e5ff" />

      {/* Walkway 1 */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[4.5, 0.4, 3.5]} position={[0, -0.4, 6.5]} />
        <mesh receiveShadow position={[0, -0.4, 6.5]}>
          <boxGeometry args={[9, 0.8, 7]} />
          <meshStandardMaterial color="#3cb371" roughness={0.6} />
        </mesh>
        
        {/* Hurdle Obstacle */}
        <mesh castShadow position={[0, 0.25, 8.5]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 9, 12]} />
          <meshStandardMaterial color={config.obstacleColor2} roughness={0.4} />
        </mesh>
      </RigidBody>
      
      {/* Walkway 2 */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[4.5, 0.4, 5.0]} position={[0, -0.4, 15.0]} />
        <mesh receiveShadow position={[0, -0.4, 15.0]}>
          <boxGeometry args={[9, 0.8, 10]} />
          <meshStandardMaterial color="#2e8b57" roughness={0.7} />
        </mesh>
      </RigidBody>
      <DecorativeTree position={[-5.8, -0.8, 13.0]} type="candy" variant="candy-blue" scale={1.0} />
      <DecorativeTree position={[5.8, -0.8, 17.0]} type="candy" variant="candy-purple" scale={1.0} />


      {/* ── SECTION 2: ZIG-ZAG PLATFORMS (MOUNTAIN ZONE) (Z = 20 to Z = 45) ── */}
      <Checkpoint position={[0, 0, 20]} id={1} />
      <ConfettiCannon position={[-4.0, 0, 20]} active={isCp1Active} />
      <ConfettiCannon position={[4.0, 0, 20]} active={isCp1Active} />

      {/* Platform 1: Tilting Deck Platforming */}
      <TiltingDeck position={[-1.5, 0.1, 24.5]} size={[4.0, 0.5, 4.0]} color="#00e5ff" />

      {/* ── LEFT PATHWAY (EASY / LONG) ── */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.25, 0.4, 11.0]} position={[-7.5, 0.1, 26.5]} />
        <mesh receiveShadow position={[-7.5, 0.1, 26.5]}>
          <boxGeometry args={[4.5, 0.8, 22.0]} />
          <meshStandardMaterial color="#4287f5" roughness={0.9} />
        </mesh>
      </RigidBody>
      <PatternWindmill position={[-7.5, 3.2, 22.0]} color="#ffd60a" />

      {/* ── MIDDLE PATHWAY (BALANCED / ZIG-ZAG) ── */}
      {/* Platform A: Fixed flat stone platform */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.0, 0.25, 2.0]} position={[1.5, 0.1, 28.2]} />
        <mesh receiveShadow position={[1.5, 0.1, 28.2]}>
          <boxGeometry args={[4.0, 0.5, 4.0]} />
          <meshStandardMaterial color="#8b8589" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Platform B: Moving X flat platform */}
      <MovingPlatform position={[-1.2, 0.35, 31.8]} size={[4.0, 0.5, 4.0]} direction="x" range={1.2} speed={1.2} color="#ffd60a" />

      {/* Platform C: Fixed flat stone platform */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.0, 0.25, 2.0]} position={[1.2, 0.6, 35.4]} />
        <mesh receiveShadow position={[1.2, 0.6, 35.4]}>
          <boxGeometry args={[4.0, 0.5, 4.0]} />
          <meshStandardMaterial color="#8b8589" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Platform D: Moving Z flat platform */}
      <MovingPlatform position={[-1.2, 0.85, 39.0]} size={[4.0, 0.5, 4.0]} direction="z" range={0.8} speed={1.0} color="#ff2a85" />

      {/* ── RIGHT PATHWAY (HARD / SHORT) ── */}
      <MovingPlatform position={[7.5, 0.1, 22.5]} size={[4.0, 0.5, 4.0]} direction="y" range={0.8} speed={1.5} color="#ffd60a" />
      <SpeedPad position={[7.5, 0.4, 28.0]} color="#39ff14" />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.0, 0.4, 4.0]} position={[7.5, 0.1, 34.0]} />
        <mesh receiveShadow position={[7.5, 0.1, 34.0]}>
          <boxGeometry args={[4.0, 0.8, 8.0]} />
          <meshStandardMaterial color="#ff0055" roughness={0.6} />
        </mesh>
      </RigidBody>
      <PendulumHammer position={[7.5, 1.2, 34.0]} length={2.8} speed={3.0} color="#ffd60a" />
      
      {/* Mountain Scenery details */}
      <DecorativeTree position={[-11.0, -0.8, 25]} type="candy" variant="candy-pink" scale={1.0} />
      <DecorativeTree position={[11.0, -0.8, 35]} type="candy" variant="candy-yellow" scale={1.1} />
      <DecorativeTree position={[-11.0, -0.8, 30]} type="candy" variant="candy-blue" scale={1.2} />
      <DecorativeTree position={[11.0, -0.8, 22]} type="candy" variant="candy-green" scale={1.1} />


      {/* ── SECTION 3: POWER JUMP & VERTICAL STORY (SKY ZONE) (Z = 45 to Z = 80) ── */}
      <Checkpoint position={[0, 1.0, 40.6]} id={2} />
      <ConfettiCannon position={[-5.5, 1.0, 40.6]} active={isCp2Active} />
      <ConfettiCannon position={[5.5, 1.0, 40.6]} active={isCp2Active} />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[7.0, 0.4, 4.5]} position={[0, 0.6, 44.5]} />
        <mesh receiveShadow position={[0, 0.6, 44.5]}>
          <boxGeometry args={[14, 0.8, 9]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.5} />
        </mesh>
      </RigidBody>
      
      {/* Horizontal Wind Blower at Checkpoint 2 (Landmark 21) */}
      <HorizontalWindBlower position={[0.0, 1.0, 42.5]} size={[14.0, 2.0, 2.5]} baseForce={34.0} direction="left" color="#00e5ff" />

      {/* Dual Large Jump Pads side-by-side! Launches players high into sky storey platform */}
      <JumpPad position={[-2.2, 1.05, 47.0]} boostForce={24.0} color="#00e5ff" scale={1.6} />
      <JumpPad position={[2.2, 1.05, 47.0]} boostForce={24.0} color="#00e5ff" scale={1.6} />
      
      {/* Horizontal Wind Blower at Jump Pad launch (Landmark 22) */}
      <HorizontalWindBlower position={[0.0, 1.4, 46.5]} size={[14.0, 2.0, 2.5]} baseForce={34.0} direction="right" color="#ff007f" />

      {/* Autumn Forest Scenery along Section 3 */}
      <DecorativeTree position={[-7.5, 6.7, 52]} type="candy" variant="candy-purple" scale={1.2} />
      <DecorativeTree position={[7.5, 6.7, 56]} type="candy" variant="candy-pink" scale={1.0} />
      <DecorativeTree position={[-7.5, 6.7, 60]} type="candy" variant="candy-green" scale={1.1} />
      <DecorativeTree position={[7.5, 6.7, 66]} type="candy" variant="candy-blue" scale={1.3} />

      {/* Storey 1 (High Landing Deck) at Z = 54.0, Y = 7.5 */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[6.0, 0.4, 4.0]} position={[0, 7.1, 54.0]} />
        <mesh receiveShadow position={[0, 7.1, 54.0]}>
          <boxGeometry args={[12.0, 0.8, 8.0]} />
          <meshStandardMaterial color="#00e5ff" roughness={0.3} metalness={0.2} />
        </mesh>
      </RigidBody>
      <WavingFlag position={[-5.5, 7.5, 54.0]} color="#00e5ff" />
      <WavingFlag position={[5.5, 7.5, 54.0]} color="#ff007f" />

      {/* ── STOREY 2: Ice Platform (left) + Windmill Bridge (right) at Z = 61.0, Y = 8.3 ── */}
      {/* Ice Platform – left side */}
      <IcePlatform position={[-3.5, 7.9, 61.0]} size={[5.0, 0.8, 5.0]} color="#b2f2ff" />
      <DecorativeTree position={[-7.5, 8.3, 61.0]} type="candy" variant="candy-purple" scale={0.8} />

      {/* Right-side static bridge for windmills */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.5, 0.4, 2.5]} position={[3.5, 7.9, 61.0]} />
        <mesh receiveShadow position={[3.5, 7.9, 61.0]}>
          <boxGeometry args={[5.0, 0.8, 5.0]} />
          <meshStandardMaterial color="#ffd60a" roughness={0.4} metalness={0.1} />
        </mesh>
      </RigidBody>
      {/* Windmill pair on the right bridge – opposite rotations force timing */}
      <Windmill position={[1.9, 9.6, 61.0]} speed={1.8} color="#ffd60a" />
      <Windmill position={[5.1, 9.6, 61.0]} speed={-1.6} color="#ffd60a" />

      {/* ── SPINNING HAMMER ARENA (LM27–29) — One large merged platform ── */}
      {/* Wide open arena: 18m × 12m, spanning Z = 63.5 to 75.5, centered at Z = 69.5 */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[9.0, 0.4, 6.0]} position={[0, 8.7, 69.5]} />
        <mesh receiveShadow position={[0, 8.7, 69.5]}>
          <boxGeometry args={[18.0, 0.8, 12.0]} />
          <meshStandardMaterial color="#7b2fff" roughness={0.35} metalness={0.18} />
        </mesh>
      </RigidBody>
      {/* Gold edge trim */}
      <mesh position={[0, 8.76, 69.5]}>
        <boxGeometry args={[18.2, 0.07, 12.2]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.15} metalness={0.5}
          emissive="#ffd60a" emissiveIntensity={0.22} />
      </mesh>
      {/* Subtle floor pattern inlay strips (visual only) */}
      {[65.5, 69.5, 73.5].map((z, i) => (
        <mesh key={i} position={[0, 8.77, z]}>
          <boxGeometry args={[17.8, 0.02, 0.18]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} opacity={0.18} transparent />
        </mesh>
      ))}

      {/* ── HAMMER 1 — Slow (introduction) — center entry — */}
      {/* Position: front-center of arena, Z=65.0 — players enter from left/right */}
      <SpinningHammer position={[0, 9.5, 65.5]} speed={1.1} armLength={2.4}
        color="#ff2d6f" armColor="#ffe033" />

      {/* ── HAMMER 2 — Medium CW — left lane — */}
      <SpinningHammer position={[-4.5, 9.5, 67.5]} speed={-1.8} armLength={2.2}
        color="#00c9ff" armColor="#ffe033" />

      {/* ── HAMMER 3 — Medium CCW — right lane — */}
      <SpinningHammer position={[4.5, 9.5, 67.5]} speed={2.0} armLength={2.2}
        color="#ff6b00" armColor="#ffe033" />

      {/* ── HAMMER 4 — Fast — dead center — */}
      <SpinningHammer position={[0, 9.5, 70.5]} speed={-2.8} armLength={2.4}
        color="#ff2d6f" armColor="#ffe033" />

      {/* ── HAMMER 5 — Variable speed (slow→fast→slow) — far left — */}
      <SpinningHammer position={[-4.5, 9.5, 72.5]} speed={2.2} armLength={2.0}
        color="#a855f7" armColor="#ffe033" variable />

      {/* ── HAMMER 6 — Fast CW — far right — hardest to dodge near the exit — */}
      <SpinningHammer position={[4.5, 9.5, 72.5]} speed={-2.6} armLength={2.0}
        color="#00c9ff" armColor="#ffe033" />

      {/* Checkpoint 3 merge deck — immediately after hammer arena exit (Z=75.5) */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[6.0, 0.4, 2.5]} position={[0, 8.7, 76.5]} />
        <mesh receiveShadow position={[0, 8.7, 76.5]}>
          <boxGeometry args={[12.0, 0.8, 5.0]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.6} />
        </mesh>
      </RigidBody>
      <Checkpoint position={[0, 8.7, 76.5]} id={3} />

      {/* Parallel Slides (Left, Middle, Right) */}

      {/* Left: Water slide (Blue) */}
      <RigidBody type="fixed" colliders={false} userData={{ surface: 'slide' }}>
        <CuboidCollider args={[1.5, 0.4, 5.0]} position={[-5.0, 7.4, 81.0]} rotation={[0.463, 0, 0]} />
        <mesh receiveShadow position={[-5.0, 7.4, 81.0]} rotation={[0.463, 0, 0]} userData={{ surface: 'slide' }}>
          <boxGeometry args={[3.0, 0.8, 10.0]} />
          <meshStandardMaterial color="#0066ff" roughness={0.1} transparent opacity={0.8} />
        </mesh>
      </RigidBody>

      {/* Middle: Rainbow slide (Yellow) */}
      <RigidBody type="fixed" colliders={false} userData={{ surface: 'slide' }}>
        <CuboidCollider args={[1.5, 0.4, 5.0]} position={[0.0, 7.4, 81.0]} rotation={[0.463, 0, 0]} />
        <mesh receiveShadow position={[0.0, 7.4, 81.0]} rotation={[0.463, 0, 0]} userData={{ surface: 'slide' }}>
          <boxGeometry args={[3.0, 0.8, 10.0]} />
          <meshStandardMaterial color="#ffd60a" roughness={0.1} />
        </mesh>
      </RigidBody>

      {/* Right: Ice slide (White) */}
      <RigidBody type="fixed" colliders={false} userData={{ surface: 'slide' }}>
        <CuboidCollider args={[1.5, 0.4, 5.0]} position={[5.0, 7.4, 81.0]} rotation={[0.463, 0, 0]} />
        <mesh receiveShadow position={[5.0, 7.4, 81.0]} rotation={[0.463, 0, 0]} userData={{ surface: 'slide' }}>
          <boxGeometry args={[3.0, 0.8, 10.0]} />
          <meshStandardMaterial color="#ffffff" roughness={0.01} metalness={0.6} />
        </mesh>
      </RigidBody>

      {/* Slide landing deck at Z = 88.0, Y = 4.5 */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[9.0, 0.4, 2.0]} position={[0, 4.1, 88.0]} />
        <mesh receiveShadow position={[0, 4.1, 88.0]}>
          <boxGeometry args={[18.0, 0.8, 4.0]} />
          <meshStandardMaterial color="#8b8589" roughness={0.7} />
        </mesh>
      </RigidBody>
      
      {/* Dual rotating sweepers on landing deck to test timing! */}
      <RotatingSweeper position={[-4.0, 4.5, 88.0]} radius={2.2} height={0.5} speed={1.8} color="#ffaa00" />
      <RotatingSweeper position={[4.0, 4.5, 88.0]} radius={2.2} height={0.5} speed={-1.8} color="#ffaa00" />
      
      {/* Side slowing mud traps */}
      <MudPlatform position={[-8.5, 4.1, 88.0]} size={[3.0, 0.85, 4.0]} color="#4d2f1d" />
      <MudPlatform position={[8.5, 4.1, 88.0]} size={[3.0, 0.85, 4.0]} color="#4d2f1d" />

      {/* Dual swinging pendulum hammers above the slide landing */}
      <PendulumHammer position={[-3.5, 5.2, 94.0]} length={3.0} speed={2.5} color="#ff007f" />
      <PendulumHammer position={[3.5, 5.2, 94.0]} length={3.0} speed={-2.2} color="#ff007f" />
      
      {/* Snow environment trees */}
      <DecorativeTree position={[-9.5, 4.5, 86.0]} type="candy" variant="candy-pink" scale={0.9} />
      <DecorativeTree position={[9.5, 4.5, 90.0]} type="candy" variant="candy-blue" scale={1.0} />


      {/* ── SECTION 5: FINAL SPRINT & BOUNCERS (DESERT ZONE) (Z = 100 to Z = 131) ── */}
      <Checkpoint position={[0, 4.5, 100.0]} id={4} />
      <ConfettiCannon position={[-5.5, 4.5, 100.0]} active={isCp4Active} />
      <ConfettiCannon position={[5.5, 4.5, 100.0]} active={isCp4Active} />

      {/* Flat sprint road */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[6.0, 0.4, 5.0]} position={[0, 4.1, 105.0]} />
        <mesh receiveShadow position={[0, 4.1, 105.0]}>
          <boxGeometry args={[12.0, 0.8, 10.0]} />
          <meshStandardMaterial color="#e4a853" roughness={0.8} />
        </mesh>
      </RigidBody>
      
      {/* Speed Boost pads */}
      <SpeedPad position={[-3.0, 4.52, 104.0]} />
      <SpeedPad position={[0.0, 4.52, 104.0]} />
      <SpeedPad position={[3.0, 4.52, 104.0]} />

      {/* Moving gates obstacle - Dual Gates side-by-side */}
      <MovingPlatform position={[-3.0, 5.2, 109.0]} size={[5.6, 1.2, 0.3]} direction="y" range={1.5} speed={2.2} color={config.obstacleColor1} />
      <MovingPlatform position={[3.0, 5.2, 109.0]} size={[5.6, 1.2, 0.3]} direction="y" range={1.5} speed={1.8} color={config.obstacleColor1} />

      {/* Narrow Balance Beams (Dual paths) with cross-wind blowers combo */}
      <RigidBody type="fixed">
        <CuboidCollider args={[0.3, 0.2, 2.5]} position={[-3.0, 4.1, 112.5]} />
        <mesh receiveShadow position={[-3.0, 4.1, 112.5]}>
          <boxGeometry args={[0.6, 0.4, 5.0]} />
          <meshStandardMaterial color="#8b4513" roughness={0.9} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed">
        <CuboidCollider args={[0.3, 0.2, 2.5]} position={[3.0, 4.1, 112.5]} />
        <mesh receiveShadow position={[3.0, 4.1, 112.5]}>
          <boxGeometry args={[0.6, 0.4, 5.0]} />
          <meshStandardMaterial color="#8b4513" roughness={0.9} />
        </mesh>
      </RigidBody>
      <WindFanZone position={[-6.5, 4.8, 112.5]} size={[2.0, 2.0, 4.0]} force={[2.8, 0, 0]} />
      <WindFanZone position={[6.5, 4.8, 112.5]} size={[2.0, 2.0, 4.0]} force={[-2.8, 0, 0]} />

      {/* Downhill slanted speed slide to finish platform */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[7.0, 0.4, 6.0]} position={[0, 1.1, 120.0]} rotation={[0.45, 0, 0]} />
        <mesh receiveShadow position={[0, 1.1, 120.0]} rotation={[0.45, 0, 0]} userData={{ surface: 'speed-ramp' }}>
          <boxGeometry args={[14.0, 0.8, 12.0]} />
          <meshStandardMaterial color="#ffd60a" roughness={0.15} metalness={0.3} />
        </mesh>
      </RigidBody>

      {/* Final sweeper hazards at bottom - Dual sweepers */}
      <RotatingSweeper position={[-3.5, -1.8, 128.0]} radius={2.2} height={0.6} speed={2.5} color={config.obstacleColor2} />
      <RotatingSweeper position={[3.5, -1.8, 128.0]} radius={2.2} height={0.6} speed={-2.2} color={config.obstacleColor2} />

      {/* Desert Ruins Scenery details */}
      <DecorativeRuins position={[-8.0, 4.5, 106.0]} type="broken-pillar" scale={0.7} />
      <DecorativeRuins position={[8.0, 4.5, 103.0]} type="pillar" scale={0.8} />
      <DecorativeTree position={[-7.5, 4.5, 112.0]} type="candy" variant="candy-yellow" scale={1.1} />
      <DecorativeTree position={[7.5, 4.5, 112.0]} type="candy" variant="candy-pink" scale={1.0} />

      {/* ── GOAL LINE ARCH & CHECKERED FLOOR ── */}
      {/* Replaces old plain arch; balloons, flags, glow pods included in GoalLine */}
      <GoalLine position={[0, -2.4, 135.0]} width={14} />

      {/* Finish platform solid physics floor */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[7.0, 0.4, 4.0]} position={[0, -2.4, 135.0]} />
        <mesh receiveShadow position={[0, -2.4, 135.0]}>
          <boxGeometry args={[14.0, 0.8, 8.0]} />
          <meshStandardMaterial color="#2e8b57" roughness={0.6} />
        </mesh>
      </RigidBody>
      <WavingFlag position={[-7.5, -2.0, 137.5]} color="#ff007f" />
      <WavingFlag position={[7.5, -2.0, 137.5]} color="#00e5ff" />

      {/* Finish trigger sensor – positioned on the checkered line */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider 
          args={[6.8, 1.5, 0.2]} 
          sensor 
          onIntersectionEnter={handleFinish} 
          position={[0, -1.0, 135.0]} 
        />
      </RigidBody>

      {/* --- Numbered Debug Checkpoint Landmarks (Developer Mode) --- */}
      {LEVEL_1_LANDMARKS.map((lm, idx) => {
        const numStr = String(idx + 1).padStart(3, '0');
        const idLabel = `LM_${numStr}`;
        return (
          <DebugLandmark 
            key={idLabel} 
            position={lm.pos} 
            number={idx + 1} 
            label={idLabel} 
          />
        );
      })}

      {/* Dynamic Slime Splashes */}
      {splashes.map((s) => (
        <SlimeSplash key={s.id} position={s.position} color={s.color} />
      ))}
    </group>
  );
};
