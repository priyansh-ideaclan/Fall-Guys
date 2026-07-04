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
  Seesaw,
  BumpyPillar,
  CurvedSlide,
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

      {/* Platform 1 (LM10): SEESAW — tilts left/right based on player X position
          axis='z' means rotation is around Z-axis (left-right tilt) */}
      <Seesaw
        position={[-1.5, 0.25, 24.5]}
        length={4.5}
        width={3.5}
        thickness={0.3}
        axis="z"
        color="#00e5ff"
        pivotColor="#445566"
      />

      {/* ── LEFT PATHWAY (EASY / LONG) ── */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.25, 0.4, 11.0]} position={[-7.5, 0.1, 26.5]} />
        <mesh receiveShadow position={[-7.5, 0.1, 26.5]}>
          <boxGeometry args={[4.5, 0.8, 22.0]} />
          <meshStandardMaterial color="#4287f5" roughness={0.9} />
        </mesh>
      </RigidBody>
      <PatternWindmill position={[-7.5, 3.2, 22.0]} color="#ffd60a" />

      {/* Platform A (LM14): SEESAW — tilts front/back as player walks across
          axis='x' means rotation is around X-axis (front-back tilt)
          Longer plank bridges the Middle path gap — extra challenge */}
      <Seesaw
        position={[1.5, 0.25, 28.2]}
        length={5.0}
        width={3.2}
        thickness={0.28}
        axis="x"
        color="#ff9500"
        pivotColor="#554433"
      />

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

      {/* Storey 1 (High Landing Deck + Bumpy Pillar Arena) at Z = 53.5, Y = 7.5
          Platform shortened to 9m depth to introduce a gap to the next platform */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[6.0, 0.4, 4.5]} position={[0, 7.1, 53.5]} />
        <mesh receiveShadow position={[0, 7.1, 53.5]}>
          <boxGeometry args={[12.0, 0.8, 9.0]} />
          <meshStandardMaterial color="#00e5ff" roughness={0.3} metalness={0.2} />
        </mesh>
      </RigidBody>
      {/* Subtle warning-stripe overlay on the platform surface */}
      <mesh position={[0, 7.52, 53.5]}>
        <boxGeometry args={[12.2, 0.04, 9.2]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.2} metalness={0.3}
          transparent opacity={0.18} emissive="#ffd60a" emissiveIntensity={0.06} />
      </mesh>
      <WavingFlag position={[-5.5, 7.5, 50.0]} color="#00e5ff" />
      <WavingFlag position={[5.5, 7.5, 50.0]} color="#ff007f" />

      {/* ── BUMPY PILLAR ARENA (LM24–25): diamond layout ── */}
      {/* Pillar 1 — entry left, hot-pink, slow CCW */}
      <BumpyPillar position={[-2.5, 8.5, 51.0]} speed={-1.2} color="#ff007f" bumpColor="#ffd60a" bumpCount={5} rings={2} />
      {/* Pillar 2 — entry right, cyan, medium CW */}
      <BumpyPillar position={[2.5, 8.5, 51.0]}  speed={1.8}  color="#00e5ff" bumpColor="#ff007f" bumpCount={5} rings={2} />
      {/* Pillar 3 — center, gold, fast CCW */}
      <BumpyPillar position={[0.0, 8.5, 53.5]}  speed={-2.4} color="#ffd60a" bumpColor="#bd00ff" bumpCount={6} rings={2} />
      {/* Pillar 4 — exit left, purple, medium CW */}
      <BumpyPillar position={[-2.5, 8.5, 56.5]} speed={1.6}  color="#bd00ff" bumpColor="#00e5ff" bumpCount={5} rings={2} />
      {/* Pillar 5 — exit right, orange, slow CW */}
      <BumpyPillar position={[2.5, 8.5, 56.5]}  speed={-1.4} color="#ff6b00" bumpColor="#ffd60a" bumpCount={5} rings={2} />

      {/* ── STOREY 2: Combined Windmill Crossing Platform at Z = 61.8, Y = 7.9 ── */}
      {/* Single platform: 12m × 5.2m, centered at Z=61.8, creating a 1.2m gap from Storey 1 and 1.2m gap to Hammer Arena */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[6.0, 0.4, 2.6]} position={[0, 7.9, 61.8]} />
        <mesh receiveShadow position={[0, 7.9, 61.8]}>
          <boxGeometry args={[12.0, 0.8, 5.2]} />
          <meshStandardMaterial color="#ffd60a" roughness={0.35} metalness={0.12} />
        </mesh>
      </RigidBody>
      {/* Subtle ice-blue inlay stripe on the left half (visual nod to old ice platform) */}
      <mesh position={[-3.5, 7.95, 61.8]}>
        <boxGeometry args={[5.0, 0.04, 5.0]} />
        <meshStandardMaterial color="#b2f2ff" roughness={0.15} metalness={0.3} transparent opacity={0.55} />
      </mesh>
      {/* Gold edge trim on both long sides */}
      <mesh position={[0, 7.97, 61.8]}>
        <boxGeometry args={[12.2, 0.04, 5.4]} />
        <meshStandardMaterial color="#ff9500" roughness={0.2} metalness={0.4} emissive="#ff9500" emissiveIntensity={0.12} />
      </mesh>
      {/* Decorative tree on the far left edge */}
      <DecorativeTree position={[-7.0, 8.3, 61.8]} type="candy" variant="candy-purple" scale={0.8} />

      {/* Three windmills evenly spaced across the combined platform */}
      {/* Windmill 1 — left third */}
      <Windmill position={[-3.8, 9.6, 61.8]} speed={1.5} color="#00e5ff" />
      {/* Windmill 2 — center */}
      <Windmill position={[0.0, 9.6, 61.8]} speed={-2.0} color="#ffd60a" />
      {/* Windmill 3 — right third */}
      <Windmill position={[3.8, 9.6, 61.8]} speed={1.7} color="#ff007f" />

      {/* Two resized Jump Pads (left and right) at Z = 63.5 to launch onto Hammer Arena */}
      <JumpPad position={[-2.5, 8.3, 63.5]} boostForce={12.5} boostZ={10.0} color="#00e5ff" scale={1.1} />
      <JumpPad position={[2.5, 8.3, 63.5]} boostForce={12.5} boostZ={10.0} color="#00e5ff" scale={1.1} />


      {/* ── SPINNING HAMMER ARENA (LM27–29) — One large merged platform ── */}
      {/* Wide open arena: 18m × 10m, spanning Z = 65.6 to 75.6, centered at Z = 70.6 */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[9.0, 0.4, 5.0]} position={[0, 8.7, 70.6]} />
        <mesh receiveShadow position={[0, 8.7, 70.6]}>
          <boxGeometry args={[18.0, 0.8, 10.0]} />
          <meshStandardMaterial color="#7b2fff" roughness={0.35} metalness={0.18} />
        </mesh>
      </RigidBody>
      {/* Gold edge trim */}
      <mesh position={[0, 8.76, 70.6]}>
        <boxGeometry args={[18.2, 0.07, 10.2]} />
        <meshStandardMaterial color="#ffd60a" roughness={0.15} metalness={0.5}
          emissive="#ffd60a" emissiveIntensity={0.22} />
      </mesh>
      {/* Subtle floor pattern inlay strips (visual only) */}
      {[67.0, 71.0, 74.0].map((z, i) => (
        <mesh key={i} position={[0, 8.77, z]}>
          <boxGeometry args={[17.8, 0.02, 0.18]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} opacity={0.18} transparent />
        </mesh>
      ))}

      {/* ── HAMMER 1 — Slow CW (above head — safe to run under) ── */}
      <SpinningHammer position={[0, 9.5, 67.0]} speed={-1.3} armLength={2.4}
        color="#ff2d6f" armColor="#ffe033" mountingHeight={1.62} />

      {/* ── HAMMER 2 — Medium CW (jumpable height) — left lane ── */}
      <SpinningHammer position={[-4.5, 9.5, 69.0]} speed={-1.8} armLength={2.2}
        color="#00c9ff" armColor="#ffe033" mountingHeight={1.15} />

      {/* ── HAMMER 3 — Medium CCW (body level — must dodge sideways or jump precisely) — right lane ── */}
      <SpinningHammer position={[4.5, 9.5, 69.0]} speed={2.2} armLength={2.2}
        color="#ff6b00" armColor="#ffe033" mountingHeight={0.78} />

      {/* ── HAMMER 4 — Fast CCW (jumpable height) — center lane ── */}
      <SpinningHammer position={[0, 9.5, 71.5]} speed={2.8} armLength={2.4}
        color="#ff2d6f" armColor="#ffe033" mountingHeight={1.1} />

      {/* ── HAMMER 5 — Variable speed CCW (body level — must time or dodge sideways) — far left ── */}
      <SpinningHammer position={[-4.5, 9.5, 73.8]} speed={2.4} armLength={2.0}
        color="#a855f7" armColor="#ffe033" variable mountingHeight={0.78} />

      {/* ── HAMMER 6 — Fast CW (above head — safe to run under) — far right ── */}
      <SpinningHammer position={[4.5, 9.5, 73.8]} speed={-2.6} armLength={2.0}
        color="#00c9ff" armColor="#ffe033" mountingHeight={1.62} />

      {/* Checkpoint 3 merge deck — immediately after hammer arena exit (Z=75.6), ending exactly at Z=77.0 where slides start */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[6.0, 0.4, 0.7]} position={[0, 8.7, 76.3]} />
        <mesh receiveShadow position={[0, 8.7, 76.3]}>
          <boxGeometry args={[12.0, 0.8, 1.4]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.6} />
        </mesh>
      </RigidBody>
      <Checkpoint position={[0, 8.7, 76.3]} id={3} />

      {/* Parallel Curved Slides (Left, Middle, Right) — Z = 77.0 to Z = 90.0, Y = 9.1 to Y = 4.5 */}

      {/* Left Slide: Curved Water Slide (Blue) — narrower lane, curves to the left */}
      <CurvedSlide
        startX={-4.5}
        endX={-5.5}
        startY={9.1}
        endY={4.5}
        startZ={77.0}
        endZ={90.0}
        width={2.6}
        color="#0066ff"
        sideOffset={-0.8}
        segmentsCount={10}
        opacity={0.8}
      />

      {/* Middle Slide: Straight Rainbow Slide (Gold) — medium lane */}
      <CurvedSlide
        startX={0.0}
        endX={0.0}
        startY={9.1}
        endY={4.5}
        startZ={77.0}
        endZ={90.0}
        width={3.2}
        color="#ffd60a"
        sideOffset={0}
        segmentsCount={10}
        opacity={0.95}
      />

      {/* Right Slide: Curved Ice Slide (White) — wider lane, curves to the right */}
      <CurvedSlide
        startX={4.5}
        endX={5.5}
        startY={9.1}
        endY={4.5}
        startZ={77.0}
        endZ={90.0}
        width={3.8}
        color="#ffffff"
        sideOffset={0.8}
        segmentsCount={10}
        metalness={0.6}
        roughness={0.02}
        opacity={0.95}
      />

      {/* Slide landing deck at Z = 92.0, Y = 4.5 (extends Z = 90.0 to 94.0 connecting seamlessly to slides) */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[9.0, 0.4, 2.0]} position={[0, 4.1, 92.0]} />
        <mesh receiveShadow position={[0, 4.1, 92.0]}>
          <boxGeometry args={[18.0, 0.8, 4.0]} />
          <meshStandardMaterial color="#8b8589" roughness={0.7} />
        </mesh>
      </RigidBody>
      
      {/* Dual rotating sweepers on landing deck to test timing! */}
      <RotatingSweeper position={[-4.0, 4.5, 92.0]} radius={2.2} height={0.5} speed={1.8} color="#ffaa00" />
      <RotatingSweeper position={[4.0, 4.5, 92.0]} radius={2.2} height={0.5} speed={-1.8} color="#ffaa00" />
      
      {/* Side slowing mud traps */}
      <MudPlatform position={[-8.5, 4.1, 92.0]} size={[3.0, 0.85, 4.0]} color="#4d2f1d" />
      <MudPlatform position={[8.5, 4.1, 92.0]} size={[3.0, 0.85, 4.0]} color="#4d2f1d" />

      {/* Dual swinging pendulum hammers above the slide landing path */}
      <PendulumHammer position={[-3.0, 5.2, 97.0]} length={3.0} speed={2.5} color="#ff007f" />
      <PendulumHammer position={[3.0, 5.2, 97.0]} length={3.0} speed={-2.2} color="#ff007f" />

      {/* Two narrow wooden bridge planks spanning the gap from Landmark 36 (Z=94) to Landmark 37 (Z=100) */}
      <RigidBody type="fixed" colliders="cuboid" friction={0.8} restitution={0.05}>
        {/* Left bridge plank */}
        <mesh receiveShadow position={[-3.0, 4.1, 97.0]}>
          <boxGeometry args={[1.2, 0.4, 6.0]} />
          <meshStandardMaterial color="#8b5a2b" roughness={0.8} />
        </mesh>
        {/* Right bridge plank */}
        <mesh receiveShadow position={[3.0, 4.1, 97.0]}>
          <boxGeometry args={[1.2, 0.4, 6.0]} />
          <meshStandardMaterial color="#8b5a2b" roughness={0.8} />
        </mesh>
      </RigidBody>
      
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

      {/* Desert Ruins Scenery details */}
      <DecorativeRuins position={[-8.0, 4.5, 106.0]} type="broken-pillar" scale={0.7} />
      <DecorativeRuins position={[8.0, 4.5, 103.0]} type="pillar" scale={0.8} />
      <DecorativeTree position={[-7.5, 4.5, 112.0]} type="candy" variant="candy-yellow" scale={1.1} />
      <DecorativeTree position={[7.5, 4.5, 112.0]} type="candy" variant="candy-pink" scale={1.0} />

      {/* ── GOAL LINE ARCH & CHECKERED FLOOR ── */}
      <GoalLine position={[0, 4.1, 114.0]} width={14} />

      {/* Finish platform solid physics floor - placed directly adjacent to the final sprint deck */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[7.0, 0.4, 4.0]} position={[0, 4.1, 114.0]} />
        <mesh receiveShadow position={[0, 4.1, 114.0]}>
          <boxGeometry args={[14.0, 0.8, 8.0]} />
          <meshStandardMaterial color="#2e8b57" roughness={0.6} />
        </mesh>
      </RigidBody>
      <WavingFlag position={[-7.5, 4.5, 116.5]} color="#ff007f" />
      <WavingFlag position={[7.5, 4.5, 116.5]} color="#00e5ff" />

      {/* Finish trigger sensor – positioned on the checkered line */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider 
          args={[6.8, 1.5, 0.2]} 
          sensor 
          onIntersectionEnter={handleFinish} 
          position={[0, 5.5, 114.0]} 
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
