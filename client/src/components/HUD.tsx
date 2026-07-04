import React, { useEffect, useState, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Timer, Trophy, RotateCcw, Home, HelpCircle, Volume2, VolumeX, Sparkles, Shield, Zap, Star, Brain, Target, Users, Crown, Music, SkipBack, SkipForward, Play, Pause, Eye } from 'lucide-react';
import { RaceLeaderboard } from './RaceLeaderboard';
import { audioManager } from '../utils/audioManager';
import { musicManager } from '../utils/musicManager';
import { useMusicStore } from '../store/useMusicStore';

// ─── Level display names ──────────────────────────────────────────────────────
const LEVEL_NAMES: Record<string, string> = {
  'race_1':     'Round 1 · Race',
  'race_2':     'Round 1 · Race',
  'race_3':     'Round 1 · Race',
  'survival_1': 'Round 2 · Survival',
  'survival_2': 'Round 2 · Survival',
  'logic_1':    'Round 3 · Memory Tiles',
  'logic_2':    'Round 3 · Gate Maze',
  'hunt_1':     'Round 4 · Star Hunt',
  'final_1':    'FINAL · Honeycomb Collapse',
  'final_2':    'FINAL · Crown Peak Climb',
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
    isNitroActive,
    nitroCooldown,
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
      } else if (e.key === 'o' || e.key === 'O') {
        useGameStore.getState().toggleDebugCheckpoints();
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
    if (phase !== 'ROUND_OUTCOME') return;
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

  // Survivors count for Survival
  const survivorsCount = activeBots.length + 1; // +1 for player
  const eliminatedCount = (eliminatedBots || []).length;

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
              <div className="glass-panel" style={{ padding: '12px 18px', textAlign: 'right', border: `2px solid ${modeColor}`, boxShadow: `0 0 10px ${modeColor}33` }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: modeColor, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                  <Users size={12} /> Alive
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>{survivorsCount}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,0,85,0.8)', fontWeight: 700 }}>
                  ✗ {eliminatedCount} out
                </div>
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
              <div>RND <span style={{ color: modeColor, fontWeight: 800 }}>{currentRound}/5</span></div>
              <div>FPS <span style={{ color: 'var(--yellow)', fontWeight: 800 }}>{fps}</span></div>
            </div>

            {/* Mute button */}
            <button className="ui-interactive glass-panel" onClick={() => toggleMute('music')} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', height: '46px', boxSizing: 'border-box' }}>
              {musicMuted ? <VolumeX size={16} color="var(--primary)" /> : <Volume2 size={16} color="var(--secondary)" />}
            </button>
          </div>
        </div>
      )}

      {/* ── ROUND OUTCOME (QUALIFIED) ─────────────────────────────────────── */}
      {phase === 'ROUND_OUTCOME' && (
        <div className="ui-interactive glass-panel pulse-animation" style={{
          margin: 'auto', maxWidth: '500px', width: '92%',
          padding: '36px', textAlign: 'center', boxSizing: 'border-box',
          border: `2.5px solid ${modeColor}`, boxShadow: `0 0 25px ${modeColor}44`,
        }}>
          <div style={{ display: 'inline-flex', background: `${modeColor}1a`, padding: '14px', borderRadius: '50%', marginBottom: '16px', border: `1px solid ${modeColor}` }}>
            <Trophy size={36} color="#ffd60a" />
          </div>
          <h2 className="neon-text-cyan" style={{ fontSize: '2.2rem', margin: '0 0 6px 0', fontWeight: 900 }}>QUALIFIED!</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', margin: '0 0 16px 0' }}>
            Congratulations, <strong>{playerName || 'Racer'}</strong>! You passed Round {currentRound}.
          </p>

          <div style={{ display: 'flex', gap: '16px', margin: '0 0 20px 0', textAlign: 'left', maxHeight: '160px', overflowY: 'auto', border: '1.5px solid rgba(255,255,255,0.06)', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid rgba(0,229,255,0.15)', paddingBottom: '3px' }}>Qualified ({qualifiedRacers.length})</div>
              {qualifiedRacers.map((r, i) => (
                <div key={r.id} style={{ fontSize: '0.78rem', color: '#fff', margin: '4px 0', display: 'flex', justifyContent: 'space-between', fontWeight: r.id === 'player' ? 800 : 500 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{i + 1}. {r.name}</span>
                  <span style={{ color: 'var(--secondary)', fontWeight: 800 }}>✓</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, borderLeft: '1.5px solid rgba(255,255,255,0.06)', paddingLeft: '12px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid rgba(255,0,85,0.15)', paddingBottom: '3px' }}>Eliminated ({eliminatedRacers.length})</div>
              {eliminatedRacers.map((r) => (
                <div key={r.id} style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{r.name}</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 800 }}>✗</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '12px' }}>
            {currentRound < 5
              ? <>Next Round starting in <span style={{ color: modeColor, fontWeight: 900, fontSize: '1rem' }}>{outcomeCountdown}</span>s...</>
              : 'Tournament Complete!'}
          </div>

          <button className="btn-primary" onClick={advanceToNextRound} style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '0.95rem' }}>
            {currentRound < 5 ? 'Next Round →' : 'See Results →'}
          </button>
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

          <button className="ui-interactive btn-secondary" style={{ pointerEvents: 'all', padding: '10px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }} onClick={resetTournament}>
            <Home size={14} /> Leave Match
          </button>
        </div>
      )}

      {/* Live Leaderboard */}
      <RaceLeaderboard />
    </div>
  );
};
