import React from 'react';
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
  TiltingDeck
} from '../LevelObstacles';
import { useGameStore } from '../../store/useGameStore';
import { getThemeConfig } from '../../utils/themeManager';

export const Level1: React.FC = () => {
  const triggerWinAction = useGameStore((state) => state.triggerWin);
  const qualifyRacerAction = useGameStore((state) => state.qualifyRacer);
  const lastCheckpoint = useGameStore((state) => state.lastCheckpoint);
  const splashes = useGameStore((state) => state.splashes);
  const theme = useGameStore((state) => state.visualTheme);
  const config = getThemeConfig(theme);

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
  const isCp2Active = !!(lastCheckpoint && Math.abs(lastCheckpoint[2] - 45) < 1.5);
  const isCp3Active = !!(lastCheckpoint && Math.abs(lastCheckpoint[2] - 80) < 1.5);
  const isCp4Active = !!(lastCheckpoint && Math.abs(lastCheckpoint[2] - 110) < 1.5);

  return (
    <group name="level1">
      {/* ── BACKGROUND SCENERY (LIVING WORLD) ────────────────────────── */}
      {/* Distant Mountains */}
      <mesh position={[-35, -2, 40]} rotation={[0, 0.4, 0]}>
        <coneGeometry args={[12, 22, 4]} />
        <meshStandardMaterial color="#3f4d63" roughness={0.9} />
      </mesh>
      <mesh position={[35, -4, 90]} rotation={[0, -0.2, 0]}>
        <coneGeometry args={[15, 26, 4]} />
        <meshStandardMaterial color="#4a5a73" roughness={0.9} />
      </mesh>

      {/* Floating Sky Clouds */}
      <DecorativeCloud position={[-15, 12, 15]} scale={1.2} />
      <DecorativeCloud position={[18, 16, 45]} scale={1.4} />
      <DecorativeCloud position={[-20, 22, 85]} scale={1.5} />
      <DecorativeCloud position={[16, 18, 120]} scale={1.1} />

      {/* ── OCEAN KILL ZONE ────────────────────────────────────────── */}
      <KillZonePlane position={[0, -9.0, 75]} size={[120, 280]} type="slime" />


      {/* ── SECTION 1: SPAWN AREA (LUSH FOREST ZONE) (Z = -6 to Z = 20) ── */}
      {/* Spawn Base */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3.0, 0.4, 4.5]} position={[0, -0.4, -1.5]} />
        <mesh receiveShadow position={[0, -0.4, -1.5]}>
          <boxGeometry args={[6, 0.8, 9]} />
          <meshStandardMaterial color="#2e8b57" roughness={0.7} /> {/* Lush grass green */}
        </mesh>
        
        {/* Spawn Border Walls */}
        <mesh castShadow position={[-3.0, 0.4, -1.5]}>
          <boxGeometry args={[0.15, 0.8, 9]} />
          <meshStandardMaterial color={config.obstacleColor1} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[3.0, 0.4, -1.5]}>
          <boxGeometry args={[0.15, 0.8, 9]} />
          <meshStandardMaterial color={config.obstacleColor1} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 0.4, -6.0]}>
          <boxGeometry args={[6, 0.8, 0.15]} />
          <meshStandardMaterial color={config.obstacleColor1} roughness={0.5} />
        </mesh>
      </RigidBody>

      {/* Forest Trees and Flags at Spawn */}
      <DecorativeTree position={[-4.5, -0.8, -3.0]} type="pine" scale={1.1} />
      <DecorativeTree position={[4.5, -0.8, -1.0]} type="pine" scale={0.9} />
      <WavingFlag position={[-2.4, 0, -5.5]} color="#ff007f" />
      <WavingFlag position={[2.4, 0, -5.5]} color="#00e5ff" />

      {/* Walkway 1 */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2, 0.4, 3.5]} position={[0, -0.4, 6.5]} />
        <mesh receiveShadow position={[0, -0.4, 6.5]}>
          <boxGeometry args={[4, 0.8, 7]} />
          <meshStandardMaterial color="#3cb371" roughness={0.6} />
        </mesh>
        
        {/* Hurdle Obstacle */}
        <mesh castShadow position={[0, 0.25, 8.5]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 4, 12]} />
          <meshStandardMaterial color={config.obstacleColor2} roughness={0.4} />
        </mesh>
      </RigidBody>
      
      {/* Walkway 2 */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2, 0.4, 5.0]} position={[0, -0.4, 15.0]} />
        <mesh receiveShadow position={[0, -0.4, 15.0]}>
          <boxGeometry args={[4, 0.8, 10]} />
          <meshStandardMaterial color="#2e8b57" roughness={0.7} />
        </mesh>
      </RigidBody>
      <DecorativeTree position={[-3.2, -0.8, 13.0]} type="pine" scale={1.0} />
      <DecorativeTree position={[3.2, -0.8, 17.0]} type="pine" scale={1.0} />


      {/* ── SECTION 2: ZIG-ZAG PLATFORMS (MOUNTAIN ZONE) (Z = 20 to Z = 45) ── */}
      <Checkpoint position={[0, 0, 20]} id={1} />
      <ConfettiCannon position={[-1.8, 0, 20]} active={isCp1Active} />
      <ConfettiCannon position={[1.8, 0, 20]} active={isCp1Active} />

      {/* Platform 1: Tilting Deck Platforming */}
      <TiltingDeck position={[-1.0, 0.1, 24.5]} size={[3.0, 0.5, 3.0]} color="#00e5ff" />

      {/* Platform A: Fixed flat stone platform */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.25, 0.25, 1.25]} position={[1.0, 0.1, 28.2]} />
        <mesh receiveShadow position={[1.0, 0.1, 28.2]}>
          <boxGeometry args={[2.5, 0.5, 2.5]} />
          <meshStandardMaterial color="#8b8589" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Platform B: Moving X flat platform */}
      <MovingPlatform position={[-0.8, 0.35, 31.8]} size={[2.5, 0.5, 2.5]} direction="x" range={0.8} speed={1.2} color="#ffd60a" />

      {/* Platform C: Fixed flat stone platform */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.25, 0.25, 1.25]} position={[0.8, 0.6, 35.4]} />
        <mesh receiveShadow position={[0.8, 0.6, 35.4]}>
          <boxGeometry args={[2.5, 0.5, 2.5]} />
          <meshStandardMaterial color="#8b8589" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Platform D: Moving Z flat platform */}
      <MovingPlatform position={[-0.8, 0.85, 39.0]} size={[2.5, 0.5, 2.5]} direction="z" range={0.6} speed={1.0} color="#ff2a85" />
      
      {/* Mountain Scenery details */}
      <DecorativeTree position={[-6.0, -0.8, 25]} type="oak" scale={1.0} />
      <DecorativeTree position={[6.0, -0.8, 35]} type="oak" scale={1.1} />


      {/* ── SECTION 3: POWER JUMP & VERTICAL STORY (SKY ZONE) (Z = 45 to Z = 80) ── */}
      <Checkpoint position={[0, 1.0, 42.6]} id={2} />
      <ConfettiCannon position={[-1.8, 1.0, 42.6]} active={isCp2Active} />
      <ConfettiCannon position={[1.8, 1.0, 42.6]} active={isCp2Active} />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.0, 0.4, 2.5]} position={[0, 0.6, 42.6]} />
        <mesh receiveShadow position={[0, 0.6, 42.6]}>
          <boxGeometry args={[4.0, 0.8, 5.0]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.5} />
        </mesh>
      </RigidBody>

      {/* Power Jump Pad! Launches players high into sky storey platform */}
      <PowerJumpPad position={[0, 1.05, 44.5]} boostForce={22.0} color="#00e5ff" />

      {/* Storey 1 (High Landing Deck) at Z = 57, Y = 7.5 */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3.0, 0.4, 4.0]} position={[0, 7.1, 57.0]} />
        <mesh receiveShadow position={[0, 7.1, 57.0]}>
          <boxGeometry args={[6.0, 0.8, 8.0]} />
          <meshStandardMaterial color="#00e5ff" roughness={0.3} metalness={0.2} />
        </mesh>
      </RigidBody>
      <WavingFlag position={[-2.6, 7.5, 57.0]} color="#00e5ff" />
      <WavingFlag position={[2.6, 7.5, 57.0]} color="#ff007f" />

      {/* Storey 2 (Ice Platform left) at Z = 63.5, Y = 8.3 */}
      <IcePlatform position={[-3.0, 7.9, 63.5]} size={[3.0, 0.8, 4.0]} color="#b2f2ff" />
      <DecorativeTree position={[-6.0, 8.3, 63.5]} type="pine" variant="snow" scale={0.8} />

      {/* Storey 3 (Conveyor Platform right) at Z = 68.0, Y = 9.5 */}
      <MovingPlatform position={[3.0, 9.1, 68.0]} size={[3.0, 0.8, 4.0]} direction="y" range={1.2} speed={1.6} color="#ffd60a" />

      {/* Storey 4 (Merge deck with Checkpoint) at Z = 73.0, Y = 10.7 */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.5, 0.4, 2.5]} position={[0, 10.3, 73.0]} />
        <mesh receiveShadow position={[0, 10.3, 73.0]}>
          <boxGeometry args={[5.0, 0.8, 5.0]} />
          <meshStandardMaterial color={config.groundColor} roughness={0.6} />
        </mesh>
      </RigidBody>


      {/* ── SECTION 4: ICE/MUD SLIDE & SWEEPERS (SNOW ZONE) (Z = 73 to Z = 100) ── */}
      <Checkpoint position={[0, 10.7, 73.0]} id={3} />
      <ConfettiCannon position={[-2.0, 10.7, 73.0]} active={isCp3Active} />
      <ConfettiCannon position={[2.0, 10.7, 73.0]} active={isCp3Active} />

      {/* Slanted Ice slide ramp going down */}
      <RigidBody type="fixed" colliders={false} friction={0.01}>
        <CuboidCollider args={[3.0, 0.4, 5.0]} position={[0, 7.4, 81.0]} rotation={[0.463, 0, 0]} />
        <mesh receiveShadow position={[0, 7.4, 81.0]} rotation={[0.463, 0, 0]}>
          <boxGeometry args={[6.0, 0.8, 10.0]} />
          <meshStandardMaterial color="#7ce8ff" roughness={0.02} metalness={0.6} transparent opacity={0.9} />
        </mesh>
      </RigidBody>

      {/* Slide landing deck at Z = 88.0, Y = 4.5 */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3.5, 0.4, 2.0]} position={[0, 4.1, 88.0]} />
        <mesh receiveShadow position={[0, 4.1, 88.0]}>
          <boxGeometry args={[7.0, 0.8, 4.0]} />
          <meshStandardMaterial color="#8b8589" roughness={0.7} />
        </mesh>
      </RigidBody>
      
      {/* Rotating sweeper on landing deck to test timing! */}
      <RotatingSweeper position={[0, 4.5, 88.0]} radius={2.0} height={0.5} speed={1.8} color="#ffaa00" />
      
      {/* Side slowing mud traps */}
      <MudPlatform position={[-2.6, 4.1, 88.0]} size={[1.8, 0.85, 4.0]} color="#4d2f1d" />
      <MudPlatform position={[2.6, 4.1, 88.0]} size={[1.8, 0.85, 4.0]} color="#4d2f1d" />

      {/* Swinging pendulum hammers above the slide landing */}
      <PendulumHammer position={[0, 5.2, 94.0]} length={3.0} speed={2.5} color="#ff007f" />
      
      {/* Snow environment trees */}
      <DecorativeTree position={[-5.0, 4.5, 86.0]} type="pine" variant="snow" scale={0.9} />
      <DecorativeTree position={[5.0, 4.5, 90.0]} type="pine" variant="snow" scale={1.0} />


      {/* ── SECTION 5: FINAL SPRINT & BOUNCERS (DESERT ZONE) (Z = 100 to Z = 131) ── */}
      <Checkpoint position={[0, 4.5, 100.0]} id={4} />
      <ConfettiCannon position={[-1.8, 4.5, 100.0]} active={isCp4Active} />
      <ConfettiCannon position={[1.8, 4.5, 100.0]} active={isCp4Active} />

      {/* Flat sprint road */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3.0, 0.4, 5.0]} position={[0, 4.1, 105.0]} />
        <mesh receiveShadow position={[0, 4.1, 105.0]}>
          <boxGeometry args={[6.0, 0.8, 10.0]} />
          <meshStandardMaterial color="#e4a853" roughness={0.8} />
        </mesh>
      </RigidBody>
      
      {/* Speed Boost pads */}
      <SpeedPad position={[-1.5, 4.52, 104.0]} />
      <SpeedPad position={[1.5, 4.52, 104.0]} />

      {/* Moving gates obstacle */}
      <MovingPlatform position={[0, 5.2, 109.0]} size={[5.8, 1.2, 0.3]} direction="y" range={1.5} speed={2.2} color={config.obstacleColor1} />

      {/* Narrow Balance Beam with cross-wind blowers combo */}
      <RigidBody type="fixed">
        <CuboidCollider args={[0.3, 0.2, 2.5]} position={[0, 4.1, 112.5]} />
        <mesh receiveShadow position={[0, 4.1, 112.5]}>
          <boxGeometry args={[0.6, 0.4, 5.0]} />
          <meshStandardMaterial color="#8b4513" roughness={0.9} />
        </mesh>
      </RigidBody>
      <WindFanZone position={[-3.0, 4.8, 112.5]} size={[2.0, 2.0, 4.0]} force={[2.8, 0, 0]} />

      {/* Downhill slanted speed slide to finish platform */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3.0, 0.4, 6.0]} position={[0, 1.1, 120.0]} rotation={[0.45, 0, 0]} />
        <mesh receiveShadow position={[0, 1.1, 120.0]} rotation={[0.45, 0, 0]} userData={{ surface: 'speed-ramp' }}>
          <boxGeometry args={[6.0, 0.8, 12.0]} />
          <meshStandardMaterial color="#ffd60a" roughness={0.15} metalness={0.3} />
        </mesh>
      </RigidBody>

      {/* Final sweeper hazard at bottom */}
      <RotatingSweeper position={[0, -1.8, 128.0]} radius={2.2} height={0.6} speed={2.5} color={config.obstacleColor2} />

      {/* Desert Ruins Scenery details */}
      <DecorativeRuins position={[-5.0, 4.5, 106.0]} type="broken-pillar" scale={0.7} />
      <DecorativeRuins position={[5.0, 4.5, 103.0]} type="pillar" scale={0.8} />
      <DecorativeTree position={[-4.5, 4.5, 112.0]} type="palm" scale={1.1} />
      <DecorativeTree position={[4.5, 4.5, 112.0]} type="palm" scale={1.0} />


      {/* ── FINISH LINE PLATFORM ────────────────────────────────────── */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3.5, 0.4, 4.0]} position={[0, -2.4, 135.0]} />
        <mesh receiveShadow position={[0, -2.4, 135.0]}>
          <boxGeometry args={[7.0, 0.8, 8.0]} />
          <meshStandardMaterial color="#2e8b57" roughness={0.6} />
        </mesh>

        {/* Victory Archway Pillars */}
        <mesh castShadow position={[-2.4, -0.6, 135.0]}>
          <cylinderGeometry args={[0.18, 0.18, 2.8, 12]} />
          <meshStandardMaterial color={config.obstacleColor2} />
        </mesh>
        <mesh castShadow position={[2.4, -0.6, 135.0]}>
          <cylinderGeometry args={[0.18, 0.18, 2.8, 12]} />
          <meshStandardMaterial color={config.obstacleColor2} />
        </mesh>
        <mesh castShadow position={[0, 0.8, 135.0]}>
          <boxGeometry args={[5.0, 0.4, 0.4]} />
          <meshStandardMaterial color={config.obstacleColor1} />
        </mesh>
      </RigidBody>

      {/* Celebration flags at finish */}
      <WavingFlag position={[-3.0, -2.0, 137.5]} color="#ff007f" />
      <WavingFlag position={[3.0, -2.0, 137.5]} color="#00e5ff" />

      {/* Finish trigger sensor */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider 
          args={[2.8, 1.5, 0.2]} 
          sensor 
          onIntersectionEnter={handleFinish} 
          position={[0, -1.0, 135.0]} 
        />
      </RigidBody>

      {/* --- Numbered Debug Checkpoint Landmarks (Developer Mode) --- */}
      <DebugLandmark position={[2.0, 0, 5.0]} number={1} label="CP_01" />
      <DebugLandmark position={[-2.0, 0, 12.0]} number={2} label="CP_02" />
      <DebugLandmark position={[2.0, 0, 20.0]} number={3} label="CP_03" />
      <DebugLandmark position={[3.0, 0.1, 32.0]} number={4} label="CP_04" />
      <DebugLandmark position={[2.0, 0.6, 39.5]} number={5} label="CP_05" />
      <DebugLandmark position={[-2.0, 0.6, 42.0]} number={6} label="CP_06" />
      <DebugLandmark position={[2.0, 7.1, 57.0]} number={7} label="CP_07" />
      <DebugLandmark position={[-5.0, 7.9, 63.5]} number={8} label="CP_08" />
      <DebugLandmark position={[2.0, 4.5, 100.0]} number={9} label="CP_09" />
      <DebugLandmark position={[2.0, -1.8, 128.0]} number={10} label="CP_10" />

      {/* Dynamic Slime Splashes */}
      {splashes.map((s) => (
        <SlimeSplash key={s.id} position={s.position} color={s.color} />
      ))}
    </group>
  );
};
