import React, { useEffect, useState, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Timer, Trophy, RotateCcw, Home, HelpCircle, Volume2, VolumeX, Sparkles, Shield, Zap, Star, Brain, Target, Users, UserX, Crown, Music, SkipBack, SkipForward, Play, Pause, Eye } from 'lucide-react';
import { RaceLeaderboard } from './RaceLeaderboard';
import { audioManager } from '../utils/audioManager';
import { musicManager } from '../utils/musicManager';
import { useMusicStore } from '../store/useMusicStore';
import { LEVEL_1_LANDMARKS } from '../utils/landmarks';

// ─── Level display names ──────────────────────────────────────────────────────
const LEVEL_NAMES: Record<string, string> = {
  'race_1':     'Round 1 · Race',
  'survival_1': 'Round 2 · Survival',
  'logic_1':    'Round 3 · Memory Tiles',
  'survival_2': 'Round 4 · Hex-A-Terrestrial',
};

const MODE_ICONS: Record<string, React.ReactNode> = {
  RACE:     <Zap size={16} color="#ffd60a" />,
  SURVIVAL: <Shield size={16} color="#00e5ff" />,
  LOGIC:    <Brain size={16} color="#bd00ff" />,
  HUNT:     <Star size={16} color="#ffd60a" fill="#ffd60a" />,
  FINAL:    <Crown size={16} color="#ffd60a" />,
};

const MODE_COLORS: Record<string, string> = {
  RACE:     '#ffd60a',
  SURVIVAL: '#00e5ff',
  LOGIC:    '#bd00ff',
  HUNT:     '#39ff14',
  FINAL:    '#ffd60a',
};

const MODE_INTRO_LABELS: Record<string, string> = {
  RACE:     '🏁 RACE CHALLENGE',
  SURVIVAL: '🛡️ SURVIVAL CHALLENGE',
  LOGIC:    '🧠 MEMORY CHALLENGE',
  HUNT:     '⭐ COLLECTION CHALLENGE',
  FINAL:    '👑 FINAL ROUND',
};

// ─── Component ────────────────────────────────────────────────────────────────
export const HUD: React.FC = () => {
  const {
    phase,
    timeElapsed,
    tick,
    setPhase,
    currentLevelId,
    currentLevelType,
    roundObjective,
    roundTimer,
    scores,
    winnersList,
    activeBots,
    currentRound,
    playerQualified,
    botQualifyingLimit,
    musicMuted,
    toggleMute,
    playerName,
    startRoundGameplay,
    advanceToNextRound,
    resetTournament,
    eliminatedBots,
    cinematicActive,
    setCinematicActive,
    showDebugCheckpoints,
    devLandmarkIndex,
    devLandmarkDistance,
    devShowDetails,
    isGodMode,
    isNitroActive,
    nitroCooldown,
    botsEnabled,
    isPlayerEliminated,
  } = useGameStore();
  const {
    playlist,
    currentTrackIndex,
    isPlaying,
    enableMusic,
    setPlaying,
  } = useMusicStore();

  const currentTrack = playlist[currentTrackIndex];

  const [fps, setFps] = useState(60);
  const [introCountdown, setIntroCountdown] = useState(3);
  const [outcomeCountdown, setOutcomeCountdown] = useState(5);

  // Keyboard shortcut listener for BGM controls during gameplay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Always prevent spacebar from activating focused buttons/links
      // This stops jump key from accidentally clicking any HUD button that
      // retained focus after being clicked.
      if (e.key === ' ' || e.code === 'Space') {
        const active = document.activeElement;
        if (active && (active.tagName === 'BUTTON' || active.tagName === 'A')) {
          e.preventDefault();
          (active as HTMLElement).blur();
          return;
        }
      }

      if (phase !== 'PLAYING') return;

      // Skip shortcuts if typing in any text inputs
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === '[') {
        musicManager.skipToPrev();
      } else if (e.key === ']') {
        musicManager.skipToNext();
      } else if (e.key === 'm' || e.key === 'M') {
        useMusicStore.getState().setEnableMusic(!useMusicStore.getState().enableMusic);
      } else if (e.key === 'o' || e.key === 'O' || e.key === 'F8') {
        useGameStore.getState().toggleDebugCheckpoints();
      } else if (e.key === 'F9') {
        useGameStore.getState().toggleDevShowDetails();
      } else if (e.key === 'F10') {
        const isDevMode = import.meta.env.DEV;
        if (isDevMode) {
          useGameStore.getState().toggleGodMode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase]);

  // Tick the stopwatch/timer if playing
  useEffect(() => {
    if (phase !== 'PLAYING') return;
    const interval = setInterval(() => { tick(); }, 50);
    return () => clearInterval(interval);
  }, [phase, tick]);

  // Adjust background music volume multiplier during ROUND_INTRO cinematic
  useEffect(() => {
    if (phase === 'ROUND_INTRO' && cinematicActive) {
      audioManager.setMusicVolumeMultiplier(0.3);
    }
  }, [phase, cinematicActive]);

  // Round intro automatic countdown (only starts when cinematicActive is false)
  useEffect(() => {
    if (phase !== 'ROUND_INTRO' || cinematicActive) return;
    setIntroCountdown(3);
    
    // Play first countdown sound immediately and set BGM multiplier to 0.5
    audioManager.setMusicVolumeMultiplier(0.55);
    audioManager.playCountdown();

    const interval = setInterval(() => {
      setIntroCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          startRoundGameplay();
          // Full music volume
          audioManager.setMusicVolumeMultiplier(1.0);
          audioManager.playMatchStart();
          return 0;
        }
        
        // Increase intensity as countdown progresses
        const nextStep = prev - 1;
        if (nextStep === 2) audioManager.setMusicVolumeMultiplier(0.7);
        if (nextStep === 1) audioManager.setMusicVolumeMultiplier(0.85);

        audioManager.playCountdown();
        return nextStep;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, cinematicActive, startRoundGameplay]);

  // Round outcome auto-transition
  useEffect(() => {
    if (phase !== 'ROUND_OUTCOME' && phase !== 'QUALIFIED') return;
    setOutcomeCountdown(5);
    const interval = setInterval(() => {
      setOutcomeCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          advanceToNextRound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, advanceToNextRound]);

  // FPS counter
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;
    const loop = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────────
  const isTimeLimited = currentLevelType === 'SURVIVAL' || currentLevelType === 'LOGIC' || currentLevelType === 'HUNT' || currentLevelId === 'final_1';
  const displayTimerText = isTimeLimited
    ? `${Math.ceil(roundTimer)}s`
    : `${timeElapsed.toFixed(1)}s`;

  const playerScore = scores['player'] || 0;
  const modeColor = MODE_COLORS[currentLevelType] || 'var(--secondary)';

  const allParticipants = useMemo<{ id: string; name: string }[]>(() => [
    { id: 'player', name: playerName || 'You' },
    ...activeBots.map(b => ({ id: b.id, name: b.name }))
  ], [playerName, activeBots]);

  const qualifiedRacers = useMemo(() => winnersList.map(wId => {
    const found = allParticipants.find(p => p.id === wId);
    return found ? { id: found.id, name: found.name } : null;
  }).filter((r): r is { id: string; name: string } => r !== null), [winnersList, allParticipants]);

  const eliminatedRacers = useMemo(() =>
    allParticipants.filter(p => !winnersList.includes(p.id))
      .map(p => ({ id: p.id, name: p.name })),
    [allParticipants, winnersList]
  );

  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const playerAlive = !isPlayerEliminated;
  const survivorsCount = activeBots.length + (playerAlive ? 1 : 0);
  const eliminatedCount = (eliminatedBots || []).length + (playerAlive ? 0 : 1);
  const totalParticipants = survivorsCount + eliminatedCount;

  // Hunt rankings
  const huntRankings = useMemo(() => {
    const all = [
      { id: 'player', name: playerName || 'You', score: scores['player'] || 0 },
      ...activeBots.map(b => ({ id: b.id, name: b.name, score: scores[b.id] || 0 })),
    ].sort((a, b) => b.score - a.score);
    return all;
  }, [scores, activeBots, playerName]);

  const playerHuntRank = huntRankings.findIndex(r => r.id === 'player') + 1;

  if (phase === 'MENU') return null;

  return (
    <div className="ui-layer">

      {/* ── QUALIFIED overlay during PLAYING ─────────────────────────────── */}
      {phase === 'PLAYING' && playerQualified && (
        <div style={{
          position: 'fixed', top: '32%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 229, 255, 0.22)',
          backdropFilter: 'blur(20px)',
          border: `3px solid ${modeColor}`,
          boxShadow: `0 0 45px ${modeColor}55`,
          padding: '24px 60px', borderRadius: '18px',
          textAlign: 'center', zIndex: 1000, pointerEvents: 'none',
          animation: 'pulse-animation 1.5s infinite',
        }}>
          <h1 style={{ fontSize: '3.2rem', margin: 0, fontWeight: 950, color: 'white', textShadow: '0 0 15px rgba(255,255,255,0.95)' }}>
            QUALIFIED!
          </h1>
          <p style={{ color: modeColor, fontSize: '1.2rem', margin: '8px 0 0 0', fontWeight: 800 }}>
            Place #{winnersList.indexOf('player') + 1}
          </p>
        </div>
      )}

      {/* ── ROUND INTRO OVERLAY ──────────────────────────────────────────── */}
      {phase === 'ROUND_INTRO' && cinematicActive && (
        <div className="ui-interactive glass-panel pulse-animation" style={{
          margin: 'auto', maxWidth: '540px', width: '92%',
          padding: '48px 40px', textAlign: 'center',
          border: `2.5px solid ${modeColor}`,
          boxShadow: `0 0 40px ${modeColor}44`,
          boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            {MODE_ICONS[currentLevelType]}
            <span style={{ fontSize: '0.8rem', color: modeColor, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              {MODE_INTRO_LABELS[currentLevelType] || `ROUND ${currentRound}`}
            </span>
          </div>

          <h2 style={{ fontSize: '2.4rem', fontWeight: 900, margin: '10px 0 6px 0', color: 'white' }}>
            {LEVEL_NAMES[currentLevelId] || 'Chao Stage'}
          </h2>

          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', margin: '0 0 18px 0', lineHeight: 1.5 }}>
            🎯 <strong>Objective:</strong> {roundObjective}
          </p>

          {/* Mode-specific hint */}
          <div style={{
            background: `${modeColor}11`,
            border: `1px solid ${modeColor}33`,
            borderRadius: '10px',
            padding: '10px 16px',
            marginBottom: '24px',
            fontSize: '0.82rem',
            color: 'rgba(255,255,255,0.65)',
          }}>
            {currentLevelType === 'RACE' && '🏃 Run and jump to the finish line. Top 8 qualify!'}
            {currentLevelType === 'SURVIVAL' && '🌀 Stay on the spinning platform! Fall off = eliminated.'}
            {currentLevelType === 'LOGIC' && '🎨 Memorize the safe color. Stand on it before tiles drop!'}
            {currentLevelType === 'HUNT' && '⭐ Collect stars scattered across the arena. Top 3 scores advance!'}
            {currentLevelType === 'FINAL' && '👑 Climb to the peak and grab the Crown to win the tournament!'}
          </div>

          <div 
            onClick={() => setCinematicActive(false)}
            style={{
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              width: '100%', padding: '12px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)',
              fontSize: '0.82rem', fontWeight: 800, color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ animation: 'pulse-animation 1.5s infinite' }}>🎥</span>
              <span>DRONE FLYOVER ACTIVE</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px', fontWeight: 500 }}>
              Press SPACE, ESC or CLICK HERE to Skip
            </div>
          </div>
        </div>
      )}

      {/* ── BIG COUNTDOWN OVERLAY DURING CAMERA SLIDE ────────────────────── */}
      {phase === 'ROUND_INTRO' && !cinematicActive && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', zIndex: 1000, pointerEvents: 'none',
        }}>
          <h1 style={{
            fontSize: '8.5rem', margin: 0, fontWeight: 950,
            color: 'white',
            letterSpacing: '0.05em',
            textShadow: `0 0 40px ${modeColor}, 0 0 10px white`,
            animation: 'scale-up-pop 1.0s infinite ease-out',
          }}>
            {introCountdown}
          </h1>
          <div style={{
            fontSize: '1.2rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: modeColor,
            letterSpacing: '0.2em',
            marginTop: '8px',
            textShadow: `0 0 10px ${modeColor}99`,
          }}>
            Get Ready...
          </div>
        </div>
      )}

      {/* ── IN-GAME TOP HUD (mode-specific) ─────────────────────────────── */}
      {phase === 'PLAYING' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', pointerEvents: 'none' }}>

          {/* Left: Timer + level name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="glass-panel" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', border: '2px solid rgba(255,255,255,0.1)' }}>
              <Timer size={20} color={modeColor} />
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: modeColor, letterSpacing: '0.05em' }}>
                  {LEVEL_NAMES[currentLevelId] || 'Chao Stage'}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'monospace', color: 'white', lineHeight: 1.1 }}>
                  {displayTimerText}
                </div>
              </div>
            </div>

            {isGodMode && (
              <div className="pulse-animation" style={{
                padding: '8px 16px',
                background: 'linear-gradient(90deg, #ff007f, #ffd60a)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.86rem',
                borderRadius: '8px',
                boxShadow: '0 0 14px rgba(255, 0, 127, 0.45)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                letterSpacing: '1px',
                border: '1.5px solid rgba(255,255,255,0.25)',
              }}>
                <span style={{ fontSize: '1rem' }}>🛠</span> GOD MODE ENABLED
              </div>
            )}
          </div>

          {/* Center: Mode-specific objective bar */}
          <div className="glass-panel" style={{
            padding: '10px 20px', alignSelf: 'center',
            fontSize: '0.85rem', fontWeight: 700,
            color: modeColor, border: `1.5px solid ${modeColor}44`,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {MODE_ICONS[currentLevelType]}
            {roundObjective}
          </div>

          {/* Right: Mode-specific stats panel */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>

            {/* RACE: Qualifiers panel */}
            {currentLevelType === 'RACE' && (
              <div className="glass-panel" style={{ padding: '12px 18px', textAlign: 'right', border: `2px solid ${modeColor}`, boxShadow: `0 0 10px ${modeColor}33` }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: modeColor, fontWeight: 800 }}>Qualified</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>{winnersList.length} / {botQualifyingLimit}</div>
              </div>
            )}

            {/* SURVIVAL: Survivors panel */}
            {currentLevelType === 'SURVIVAL' && (
              <div className="glass-panel" style={{
                padding: '12px 18px',
                textAlign: 'right',
                border: `2px solid ${modeColor}`,
                boxShadow: `0 0 10px ${modeColor}33`,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: modeColor, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                  <Users size={12} /> Survival Status
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white', lineHeight: 1.1 }}>
                  {playerAlive ? 'ALIVE' : 'ELIMINATED'}
                </div>
                <div style={{ fontSize: '0.75rem', color: playerAlive ? '#39ff14' : '#ff0055', fontWeight: 800 }}>
                  {playerAlive ? '🟢 Safe' : '🔴 Out'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginTop: '2px' }}>
                  Alive: <span style={{ color: 'white', fontWeight: 900 }}>{survivorsCount}</span> / {totalParticipants}
                </div>
                {playerAlive && (
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                    Placement: <span style={{ color: '#ffd60a', fontWeight: 900 }}>{getOrdinal(survivorsCount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* LOGIC: Memory phase panel */}
            {currentLevelType === 'LOGIC' && (
              <div className="glass-panel" style={{ padding: '12px 18px', textAlign: 'right', border: `2px solid ${modeColor}`, boxShadow: `0 0 10px ${modeColor}33` }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: modeColor, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                  <Brain size={12} /> Survivors
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>{survivorsCount}</div>
              </div>
            )}

            {/* HUNT: Stars + Rank panel */}
            {currentLevelType === 'HUNT' && (
              <>
                <div className="glass-panel" style={{ padding: '12px 18px', textAlign: 'right', border: `2.5px solid #ffd60a`, boxShadow: '0 0 12px rgba(255,214,10,0.25)' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#ffd60a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                    <Star size={12} fill="#ffd60a" /> Stars
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>{playerScore}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                    Rank #{playerHuntRank}
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '12px 14px', border: '1.5px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 800, marginBottom: '4px' }}>Top 3</div>
                  {huntRankings.slice(0, 3).map((r, i) => (
                    <div key={r.id} style={{ fontSize: '0.7rem', color: r.id === 'player' ? '#ffd60a' : 'rgba(255,255,255,0.6)', fontWeight: r.id === 'player' ? 800 : 500, display: 'flex', gap: '6px' }}>
                      <span>{i + 1}.</span>
                      <span style={{ maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                      <span style={{ color: '#ffd60a' }}>★{r.score}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* FINAL: Remaining competitors */}
            {currentLevelType === 'FINAL' && (
              <div className="glass-panel" style={{ padding: '12px 18px', textAlign: 'right', border: `2px solid #ffd60a`, boxShadow: '0 0 12px rgba(255,214,10,0.2)' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#ffd60a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                  <Crown size={12} /> Remaining
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>{survivorsCount}</div>
              </div>
            )}

            {/* Round indicator + FPS */}
            <div className="glass-panel" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', gap: '2px', fontWeight: 600 }}>
              <div>RND <span style={{ color: modeColor, fontWeight: 800 }}>{currentRound}/4</span></div>
              <div>FPS <span style={{ color: 'var(--yellow)', fontWeight: 800 }}>{fps}</span></div>
            </div>

            {/* Mute button */}
            <button className="ui-interactive glass-panel" onClick={() => toggleMute('music')} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', height: '46px', boxSizing: 'border-box' }}>
              {musicMuted ? <VolumeX size={16} color="var(--primary)" /> : <Volume2 size={16} color="var(--secondary)" />}
            </button>
          </div>
        </div>
      )}

      {/* ── POLISHED ROUND OUTCOME & CELEBRATION (QUALIFIED) ────────────────── */}
      {((phase === 'ROUND_OUTCOME' || phase === 'QUALIFIED') && playerQualified) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          boxSizing: 'border-box'
        }}>
          {/* Confetti pieces container */}
          <div style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden', zIndex: 1 }}>
            {Array.from({ length: 48 }).map((_, i) => {
              const left = Math.random() * 100;
              const delay = Math.random() * 2.5;
              const duration = 2.0 + Math.random() * 2.5;
              const size = 6 + Math.random() * 10;
              const colorsList = ['#ff007f', '#00e5ff', '#ffd60a', '#39ff14', '#bd00ff'];
              const color = colorsList[i % colorsList.length];
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: '-20px',
                    left: `${left}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    background: color,
                    borderRadius: i % 2 === 0 ? '50%' : '2px',
                    opacity: 0.8,
                    animation: `confetti-fall ${duration}s linear infinite`,
                    animationDelay: `${delay}s`,
                  }}
                />
              );
            })}
          </div>

          <div className="ui-interactive glass-panel pulse-animation" style={{
            maxWidth: '520px', width: '92%',
            padding: '40px', textAlign: 'center', boxSizing: 'border-box',
            border: `3px solid var(--secondary)`, 
            boxShadow: `0 0 35px var(--secondary-glow)`,
            position: 'relative',
            zIndex: 10
          }}>
            <div style={{ display: 'inline-flex', background: 'rgba(0, 229, 255, 0.15)', padding: '16px', borderRadius: '50%', marginBottom: '20px', border: '2px solid var(--secondary)' }}>
              <Trophy size={48} color="#ffd60a" />
            </div>

            <h1 className="neon-text-cyan" style={{ fontSize: '2.5rem', margin: '0 0 8px 0', fontWeight: 950, textTransform: 'uppercase' }}>
              🎉 Congratulations!
            </h1>
            <h2 style={{ fontSize: '1.7rem', color: '#fff', margin: '0 0 24px 0', fontWeight: 800 }}>
              You Qualified!
            </h2>

            <div style={{
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1.5px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '16px 28px',
              display: 'inline-block',
              margin: '0 auto 24px auto',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
            }}>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', fontWeight: 800, letterSpacing: '0.05em' }}>FINISHING POSITION</div>
              <div style={{ fontSize: '2.6rem', color: '#ffd60a', fontWeight: 900, textShadow: '0 0 12px rgba(255,214,10,0.5)', marginTop: '4px' }}>
                {(() => {
                  const place = winnersList.indexOf('player') + 1;
                  if (place === 0) return '1st Place'; // fallback
                  const lastDigit = place % 10;
                  const lastTwoDigits = place % 100;
                  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return `${place}th Place`;
                  if (lastDigit === 1) return `${place}st Place`;
                  if (lastDigit === 2) return `${place}nd Place`;
                  if (lastDigit === 3) return `${place}rd Place`;
                  return `${place}th Place`;
                })()}
              </div>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.98rem', margin: '0 0 12px 0', fontWeight: 700 }}>
              Moving to the Next Round...
            </p>

            {/* Progress bar countdown */}
            <div style={{
              width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '28px'
            }}>
              <div style={{
                height: '100%', background: 'var(--secondary)', width: `${(outcomeCountdown / 5) * 100}%`,
                transition: 'width 1s linear'
              }} />
            </div>

            <button className="btn-primary" onClick={advanceToNextRound} style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1rem', fontWeight: 800 }}>
              {currentRound < 5 ? 'Next Round →' : 'See Results →'}
            </button>
          </div>
        </div>
      )}

      {/* ── GAME OVER (ELIMINATED) ────────────────────────────────────────── */}
      {phase === 'GAMEOVER' && (
        <div className="ui-interactive glass-panel pulse-animation" style={{
          margin: 'auto', maxWidth: '500px', width: '92%',
          padding: '36px', textAlign: 'center', boxSizing: 'border-box',
          border: '2.5px solid var(--primary)', boxShadow: '0 0 25px var(--primary-glow)',
        }}>
          <h2 className="neon-text-pink" style={{ fontSize: '2.6rem', margin: '0 0 6px 0', fontWeight: 900 }}>ELIMINATED! 💀</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', margin: '0 0 8px 0' }}>
            You were eliminated in{' '}
            <strong style={{ color: MODE_COLORS[currentLevelType] }}>
              {LEVEL_NAMES[currentLevelId] || 'Round ' + currentRound}
            </strong>
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', margin: '0 0 24px 0' }}>
            {currentLevelType === 'SURVIVAL' && 'You fell off the arena.'}
            {currentLevelType === 'LOGIC' && 'You stood on the wrong tile.'}
            {currentLevelType === 'HUNT' && "You didn't collect enough stars."}
            {currentLevelType === 'RACE' && "You didn't reach the finish line in time."}
            {currentLevelType === 'FINAL' && 'Better luck next time, champion!'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="btn-primary" onClick={resetTournament} style={{ width: '100%', justifyContent: 'center' }}>
              <Home size={18} /> Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* ── VICTORY ───────────────────────────────────────────────────────── */}
      {phase === 'VICTORY' && (
        <div className="ui-interactive glass-panel pulse-animation" style={{
          margin: 'auto', maxWidth: '540px', width: '92%',
          padding: '52px 40px', textAlign: 'center', boxSizing: 'border-box',
          border: '3px solid #ffd60a', boxShadow: '0 0 50px rgba(255,214,10,0.35)',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '8px' }}>👑</div>
          <div style={{ display: 'inline-flex', background: 'rgba(255,214,10,0.15)', padding: '18px', borderRadius: '50%', marginBottom: '20px', border: '2px solid #ffd60a' }}>
            <Trophy size={52} color="#ffd60a" />
          </div>
          <h2 style={{ fontSize: '3rem', fontWeight: 900, color: '#ffd60a', margin: '0 0 8px 0', textShadow: '0 0 14px rgba(255,214,10,0.4)' }}>
            CHAMPION! 🎉
          </h2>
          <p style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px 0' }}>
            {playerName || 'You'} conquered all 5 rounds!
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', margin: '0 0 36px 0' }}>
            Race → Survival → Memory → Hunt → Final. The crown is yours.
          </p>
          <button className="btn-primary" onClick={resetTournament} style={{ width: '100%', justifyContent: 'center', background: '#ffd60a', color: '#000', borderColor: '#ffd60a' }}>
            Return to Lobby
          </button>
        </div>
      )}

      {/* ── BOTTOM HUD: controls + leave button ──────────────────────────── */}
      {phase === 'PLAYING' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' }}>
            
            {/* Nitro Dash Gauge */}
            <div className="glass-panel" style={{
              padding: '10px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              border: '1px solid var(--glass-border)',
              width: '210px',
              pointerEvents: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 800 }}>
                <span style={{ color: isNitroActive ? '#00e5ff' : nitroCooldown > 0 ? '#ffd60a' : '#39ff14' }}>
                  {isNitroActive ? '⚡ NITRO ACTIVE' : nitroCooldown > 0 ? '⏳ COOLING DOWN' : '✅ NITRO READY'}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Shift</span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '4px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  height: '100%',
                  width: isNitroActive 
                    ? `${((nitroCooldown - 4.0) / 1.0) * 100}%`
                    : nitroCooldown > 0 
                      ? `${((5.0 - nitroCooldown) / 5.0) * 100}%`
                      : '100%',
                  background: isNitroActive 
                    ? 'linear-gradient(90deg, #00d6ff, #00e5ff)' 
                    : nitroCooldown > 0 
                      ? 'linear-gradient(90deg, #ff9f0a, #ffd60a)' 
                      : 'linear-gradient(90deg, #30d158, #39ff14)',
                  boxShadow: isNitroActive 
                    ? '0 0 10px #00e5ff' 
                    : nitroCooldown > 0 
                      ? 'none' 
                      : '0 0 8px #39ff14',
                  transition: isNitroActive ? 'none' : 'width 0.1s linear'
                }} />
              </div>
            </div>

            {/* Movement Controls Panel */}
            <div className="glass-panel" style={{ padding: '12px 18px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', display: 'flex', gap: '14px', alignItems: 'center', border: '1px solid var(--glass-border)' }}>
              <HelpCircle size={15} color="var(--secondary)" />
              <div style={{ display: 'flex', gap: '10px' }}>
                <span><strong>WASD</strong> Move</span>
                <span><strong>Space</strong> Jump</span>
                <span><strong>Shift</strong> Nitro</span>
                <span><strong>C / Ctrl</strong> Dive</span>
                <span><strong>E</strong> Grab</span>
                <span><strong>Click</strong> Look</span>
              </div>
            </div>

            {/* In-Game Music Radio Widget */}
            <div className="glass-panel" style={{ padding: '8px 14px', display: 'flex', gap: '12px', alignItems: 'center', border: '1px solid var(--glass-border)', fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)' }}>
              <Music size={14} color="var(--secondary)" />
              
              <span style={{ fontWeight: 800, color: 'white', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentTrack?.title || 'No Track'}
              </span>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '8px' }}>
                <button onClick={() => musicManager.skipToPrev()} className="ui-interactive" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Previous Song ([)">
                  <SkipBack size={13} fill="currentColor" />
                </button>
                
                <button onClick={() => setPlaying(!isPlaying)} className="ui-interactive" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title={isPlaying && enableMusic ? 'Pause' : 'Play'}>
                  {isPlaying && enableMusic ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                </button>
                
                <button onClick={() => musicManager.skipToNext()} className="ui-interactive" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Next Song (])">
                  <SkipForward size={13} fill="currentColor" />
                </button>
                
                <button onClick={() => useMusicStore.getState().setEnableMusic(!enableMusic)} className="ui-interactive" style={{ background: 'none', border: 'none', color: enableMusic ? 'var(--secondary)' : 'var(--primary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Mute/Unmute BGM (M)">
                  {enableMusic ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </button>
              </div>

              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '8px', display: 'flex', gap: '6px' }}>
                <span><strong>[</strong> Prev</span>
                <span><strong>]</strong> Next</span>
                <span><strong>M</strong> Mute</span>
              </div>
            </div>
          </div>
          
          <button 
            className="ui-interactive btn-secondary" 
            tabIndex={-1}
            style={{ 
              pointerEvents: 'all', 
              padding: '10px 16px', 
              fontSize: '0.9rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontWeight: 800,
              borderColor: showDebugCheckpoints ? 'var(--secondary)' : 'var(--glass-border)',
              background: showDebugCheckpoints ? 'rgba(0, 229, 255, 0.15)' : 'var(--glass-bg)'
            }} 
            onClick={() => useGameStore.getState().toggleDebugCheckpoints()}
          >
            <Eye size={14} /> {showDebugCheckpoints ? 'Hide Dev Landmarks' : 'Show Dev Landmarks (O)'}
          </button>

          {import.meta.env.DEV && (
            <button 
              className="ui-interactive btn-secondary" 
              tabIndex={-1}
              style={{ 
                pointerEvents: 'all', 
                padding: '10px 16px', 
                fontSize: '0.9rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontWeight: 800,
                borderColor: isGodMode ? '#ff007f' : 'var(--glass-border)',
                background: isGodMode ? 'rgba(255, 0, 127, 0.15)' : 'var(--glass-bg)'
              }} 
              onClick={() => useGameStore.getState().toggleGodMode()}
            >
              <Sparkles size={14} /> {isGodMode ? 'Disable God Mode' : 'Enable God Mode (F10)'}
            </button>
          )}

          {/* Bots Toggle — always visible in the dev toolbar */}
          <button
            className="ui-interactive btn-secondary"
            tabIndex={-1}
            style={{
              pointerEvents: 'all',
              padding: '10px 16px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800,
              borderColor: botsEnabled ? 'var(--glass-border)' : '#ff6b00',
              background: botsEnabled ? 'var(--glass-bg)' : 'rgba(255, 107, 0, 0.15)',
            }}
            onClick={() => useGameStore.getState().toggleBots()}
          >
            {botsEnabled ? <Users size={14} /> : <UserX size={14} />}
            {botsEnabled ? 'Disable Bots' : 'Enable Bots'}
          </button>

          <button className="ui-interactive btn-secondary" tabIndex={-1} style={{ pointerEvents: 'all', padding: '10px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }} onClick={resetTournament}>
            <Home size={14} /> Leave Match
          </button>
        </div>
      )}

      {/* Developer Mode Landmarks Overlay */}
      {showDebugCheckpoints && devShowDetails && devLandmarkIndex !== -1 && (
        <div className="glass-panel" style={{
          position: 'absolute',
          top: '90px',
          left: '20px',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          border: '1.5px solid var(--secondary)',
          background: 'rgba(189, 0, 255, 0.12)', // neon purple glow
          boxShadow: '0 0 12px rgba(189, 0, 255, 0.25)',
          borderRadius: '10px',
          width: '260px',
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: '0.82rem',
          pointerEvents: 'none',
          zIndex: 1000
        }}>
          <div style={{ fontWeight: 800, color: 'var(--secondary)', fontSize: '0.85rem', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '4px', marginBottom: '2px' }}>
            🛠️ DEV LANDMARK DETAILS (F9)
          </div>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Current Landmark:</span>{' '}
            <strong style={{ color: '#fff', fontSize: '0.9rem' }}>
              {devLandmarkIndex + 1} <span style={{ color: 'var(--secondary)', fontSize: '0.75rem' }}>(LM_{String(devLandmarkIndex + 1).padStart(3, '0')})</span>
            </strong>
          </div>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Next Landmark:</span>{' '}
            <strong>{devLandmarkIndex < 41 ? devLandmarkIndex + 2 : 'N/A'}</strong>
          </div>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Distance:</span>{' '}
            <strong style={{ color: '#ffd60a' }}>{devLandmarkDistance.toFixed(1)} m</strong>
          </div>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Section:</span>{' '}
            <strong style={{ color: '#39ff14' }}>
              {LEVEL_1_LANDMARKS[devLandmarkIndex]?.section || 'Unknown'}
            </strong>
          </div>
        </div>
      )}

      {/* ── SPECTATOR OVERLAY ────────────────── */}
      {isPlayerEliminated && phase === 'PLAYING' && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          pointerEvents: 'none',
          zIndex: 1001
        }}>
          <div className="glass-panel pulse-animation" style={{
            padding: '12px 24px',
            border: '2px solid var(--primary)',
            boxShadow: '0 0 15px var(--primary-glow)',
            color: 'white',
            fontWeight: 800,
            textTransform: 'uppercase',
            fontSize: '1.1rem',
            textAlign: 'center',
            background: 'rgba(255, 0, 85, 0.4)'
          }}>
            💀 YOU WERE ELIMINATED! ({getOrdinal(survivorsCount + 1)} Place)
          </div>
          {activeBots.length > 0 && (
            <div className="glass-panel" style={{
              padding: '6px 16px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '0.82rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}>
              🎥 Spectating: <span style={{ color: 'var(--cyan)', fontWeight: 800 }}>{activeBots[0].name}</span>
            </div>
          )}
        </div>
      )}

      {/* Live Leaderboard */}
      {currentLevelType === 'RACE' && <RaceLeaderboard />}
    </div>
  );
};
