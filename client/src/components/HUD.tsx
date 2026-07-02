import React, { useEffect, useState, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Timer, Trophy, RotateCcw, Home, HelpCircle, Volume2, VolumeX, Sparkles, Shield, Compass, Star } from 'lucide-react';
import { RaceLeaderboard } from './RaceLeaderboard';

const LEVEL_NAMES: Record<string, string> = {
  'race_1': 'Level 1: Beginner Bounds (Race)',
  'race_2': 'Level 2: Conveyor Crossing (Race)',
  'race_3': 'Level 3: Slippery Slopes (Race)',
  'survival_1': 'Level 4: Spinning Hazards (Survival)',
  'survival_2': 'Level 5: Rising Lava (Survival)',
  'logic_1': 'Level 6: Memory Tiles (Logic)',
  'logic_2': 'Level 7: Gate Maze (Logic)',
  'hunt_1': 'Level 8: Star Collector (Hunt)',
  'final_1': 'Finals: Honeycomb Collapse',
  'final_2': 'Finals: Crown Peak Climb',
};

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
  } = useGameStore();
  
  const [fps, setFps] = useState(60);
  const [introCountdown, setIntroCountdown] = useState(3);
  const [outcomeCountdown, setOutcomeCountdown] = useState(5);

  // Tick the stopwatch/timer if playing
  useEffect(() => {
    if (phase !== 'PLAYING') return;

    const interval = setInterval(() => {
      tick();
    }, 50);

    return () => clearInterval(interval);
  }, [phase, tick]);

  // Round intro screen automatic countdown
  useEffect(() => {
    if (phase !== 'ROUND_INTRO') return;
    setIntroCountdown(3);

    const interval = setInterval(() => {
      setIntroCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          startRoundGameplay();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, startRoundGameplay]);

  // Round outcome screen automatic transition countdown
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

  // Simple FPS counter
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

  // Decide what format of time to show
  const isTimeLimited = currentLevelType === 'SURVIVAL' || currentLevelType === 'LOGIC' || currentLevelType === 'HUNT' || currentLevelId === 'final_1';
  const displayTimerText = isTimeLimited 
    ? `${roundTimer.toFixed(1)}s` 
    : `${timeElapsed.toFixed(2)}s`;

  const playerScore = scores['player'] || 0;
  const allParticipants = useMemo<{ id: string; name: string }[]>(() => [
    { id: 'player', name: playerName || 'You' },
    ...activeBots.map(b => ({ id: b.id, name: b.name }))
  ], [playerName, activeBots]);

  const qualifiedRacers = useMemo<{ id: string; name: string; qualified: boolean }[]>(() => winnersList.map(wId => {
    const found = allParticipants.find(p => p.id === wId);
    return found ? { id: found.id, name: found.name, qualified: true } : null;
  }).filter((r): r is { id: string; name: string; qualified: boolean } => r !== null), [winnersList, allParticipants]);

  const eliminatedRacers = useMemo<{ id: string; name: string; qualified: boolean }[]>(() => allParticipants.filter(p => !winnersList.includes(p.id)).map(p => ({ id: p.id, name: p.name, qualified: false })), [allParticipants, winnersList]);

  const totalCompetitorsCount = allParticipants.length;

  if (phase === 'MENU') return null;

  return (
    <div className="ui-layer">
      {/* 2.5. IMMEDIATELY DISPLAY PLAYER QUALIFIED OVERLAY */}
      {phase === 'PLAYING' && playerQualified && (
        <div style={{
          position: 'fixed',
          top: '32%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 229, 255, 0.22)',
          backdropFilter: 'blur(20px)',
          border: '3px solid var(--secondary)',
          boxShadow: '0 0 45px var(--secondary-glow)',
          padding: '24px 60px',
          borderRadius: '18px',
          textAlign: 'center',
          zIndex: 1000,
          pointerEvents: 'none',
          animation: 'pulse-animation 1.5s infinite',
        }}>
          <h1 style={{
            fontSize: '3.2rem',
            margin: 0,
            fontWeight: 950,
            color: 'white',
            letterSpacing: '0.08em',
            textShadow: '0 0 15px rgba(255,255,255,0.95)'
          }}>
            QUALIFIED!
          </h1>
          <p style={{ color: 'var(--secondary)', fontSize: '1.2rem', margin: '8px 0 0 0', fontWeight: 800 }}>
            Place #{winnersList.indexOf('player') + 1}
          </p>
        </div>
      )}

      {/* 1. ROUND INTRO OVERLAY CARD */}
      {phase === 'ROUND_INTRO' && (
        <div className="ui-interactive glass-panel pulse-animation" style={{
          margin: 'auto',
          maxWidth: '520px',
          width: '92%',
          padding: '48px 40px',
          textAlign: 'center',
          border: '2.5px solid var(--secondary)',
          boxShadow: '0 0 35px var(--secondary-glow)',
          boxSizing: 'border-box',
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--secondary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            ROUND {currentRound} · {currentLevelType} CHALLENGE
          </span>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 900, margin: '12px 0 6px 0', color: 'white' }}>
            {LEVEL_NAMES[currentLevelId] || 'Chao Stage'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', margin: '0 0 28px 0', lineHeight: 1.4 }}>
            🎯 <strong>Objective:</strong> {roundObjective}
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(0, 229, 255, 0.1)',
            border: '2px solid var(--secondary)',
            fontSize: '2.2rem',
            fontWeight: 900,
            color: 'var(--secondary)',
            marginBottom: '10px'
          }}>
            {introCountdown}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 700 }}>
            Get Ready...
          </div>
        </div>
      )}

      {/* 2. IN-GAME TOP HUD */}
      {phase === 'PLAYING' && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          pointerEvents: 'none',
        }}>
          {/* Left panel: Timer, level title and objective */}
          <div className="glass-panel" style={{
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
          }}>
            <Timer size={22} color="var(--secondary)" />
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--secondary)', letterSpacing: '0.05em' }}>
                {LEVEL_NAMES[currentLevelId] || 'Chao Stage'}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace', color: 'white', lineHeight: 1.1 }}>
                {displayTimerText}
              </div>
            </div>
          </div>

          {/* Center info panel: current objective */}
          <div className="glass-panel" style={{
            padding: '10px 20px',
            alignSelf: 'center',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#ffd60a',
            border: '1.5px solid rgba(255, 214, 10, 0.25)',
          }}>
            🎯 {roundObjective}
          </div>

          {/* Right panel: qualified details / scores */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            {currentLevelType === 'HUNT' && (
              <div className="glass-panel" style={{
                padding: '12px 20px',
                textAlign: 'right',
                border: '2.5px solid #ffd60a',
                boxShadow: '0 0 10px rgba(255, 214, 10, 0.2)',
              }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#ffd60a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                  <Star size={12} fill="#ffd60a" /> Stars Grabbed
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white' }}>{playerScore}</div>
              </div>
            )}

            <div className="glass-panel" style={{
              padding: '12px 20px',
              textAlign: 'right',
              border: '2px solid var(--primary)',
              boxShadow: '0 0 10px var(--primary-glow)',
            }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 800 }}>
                {currentLevelType === 'FINAL' ? 'Remaining' : 'Qualifying'}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white' }}>
                {currentLevelType === 'FINAL' 
                  ? `${totalCompetitorsCount} Racers` 
                  : `${winnersList.length} / ${botQualifyingLimit}`}
              </div>
            </div>

            {/* Diagnostics */}
            <div className="glass-panel" style={{
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.6)',
              gap: '2px',
              fontWeight: 600,
            }}>
              <div>ROUND: <span style={{ color: 'var(--secondary)', fontWeight: 800 }}>{currentRound}/4</span></div>
              <div>FPS: <span style={{ color: 'var(--yellow)', fontWeight: 800 }}>{fps}</span></div>
            </div>

            {/* Mute toggle button */}
            <button
              className="ui-interactive glass-panel"
              onClick={() => toggleMute('music')}
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                height: '46px',
                boxSizing: 'border-box'
              }}
            >
              {musicMuted ? <VolumeX size={16} color="var(--primary)" /> : <Volume2 size={16} color="var(--secondary)" />}
            </button>
          </div>
        </div>
      )}

      {/* 3. ROUND OUTCOME SCREEN (QUALIFIED PANEL) */}
      {phase === 'ROUND_OUTCOME' && (
        <div className="ui-interactive glass-panel pulse-animation" style={{
          margin: 'auto',
          maxWidth: '500px',
          width: '92%',
          padding: '36px',
          textAlign: 'center',
          boxSizing: 'border-box',
          border: '2.5px solid var(--secondary)',
          boxShadow: '0 0 25px var(--secondary-glow)',
        }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(0, 229, 255, 0.1)',
            padding: '14px',
            borderRadius: '50%',
            marginBottom: '16px',
            border: '1px solid var(--secondary)',
          }}>
            <Trophy size={36} color="var(--yellow)" />
          </div>
          <h2 className="neon-text-cyan" style={{ fontSize: '2.2rem', margin: '0 0 6px 0', fontWeight: 900 }}>
            QUALIFIED!
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', margin: '0 0 16px 0' }}>
            Congratulations, <strong>{playerName || 'Racer'}</strong>! You passed Round {currentRound}.
          </p>

          {/* Qualified / Eliminated Lists */}
          <div style={{
            display: 'flex',
            gap: '16px',
            margin: '0 0 20px 0',
            textAlign: 'left',
            maxHeight: '160px',
            overflowY: 'auto',
            border: '1.5px solid rgba(255,255,255,0.06)',
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(0,0,0,0.3)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid rgba(0, 229, 255, 0.15)', paddingBottom: '3px' }}>
                Qualified ({qualifiedRacers.length})
              </div>
              {qualifiedRacers.map((r: { id: string; name: string; qualified: boolean }, i: number) => (
                <div key={r.id} style={{ fontSize: '0.78rem', color: '#fff', margin: '4px 0', display: 'flex', justifyContent: 'space-between', fontWeight: r.id === 'player' ? 800 : 500 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                    {i + 1}. {r.name}
                  </span>
                  <span style={{ color: 'var(--secondary)', fontWeight: 800 }}>✓</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, borderLeft: '1.5px solid rgba(255,255,255,0.06)', paddingLeft: '12px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid rgba(255, 0, 85, 0.15)', paddingBottom: '3px' }}>
                Eliminated ({eliminatedRacers.length})
              </div>
              {eliminatedRacers.map((r: { id: string; name: string; qualified: boolean }) => (
                <div key={r.id} style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                    {r.name}
                  </span>
                  <span style={{ color: 'var(--primary)', fontWeight: 800 }}>✗</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '12px' }}>
            Next Round starting in <span style={{ color: 'var(--secondary)', fontWeight: 900, fontSize: '1rem' }}>{outcomeCountdown}</span> seconds...
          </div>

          <button className="btn-primary" onClick={advanceToNextRound} style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '0.95rem' }}>
            Next Round →
          </button>
        </div>
      )}

      {/* 4. GAME OVER (ELIMINATION OVERLAY) */}
      {phase === 'GAMEOVER' && (
        <div className="ui-interactive glass-panel pulse-animation" style={{
          margin: 'auto',
          maxWidth: '500px',
          width: '92%',
          padding: '36px',
          textAlign: 'center',
          boxSizing: 'border-box',
          border: '2.5px solid var(--primary)',
          boxShadow: '0 0 25px var(--primary-glow)',
        }}>
          <h2 className="neon-text-pink" style={{ fontSize: '2.2rem', margin: '0 0 6px 0', fontWeight: 900 }}>
            ELIMINATED!
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', margin: '0 0 16px 0' }}>
            You failed to qualify in Round {currentRound} of the tournament.
          </p>

          {/* Qualified / Eliminated Lists */}
          <div style={{
            display: 'flex',
            gap: '16px',
            margin: '0 0 24px 0',
            textAlign: 'left',
            maxHeight: '160px',
            overflowY: 'auto',
            border: '1.5px solid rgba(255,255,255,0.06)',
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(0,0,0,0.3)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid rgba(0, 229, 255, 0.15)', paddingBottom: '3px' }}>
                Qualified ({qualifiedRacers.length})
              </div>
              {qualifiedRacers.map((r: { id: string; name: string; qualified: boolean }, i: number) => (
                <div key={r.id} style={{ fontSize: '0.78rem', color: '#fff', margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                    {i + 1}. {r.name}
                  </span>
                  <span style={{ color: 'var(--secondary)', fontWeight: 800 }}>✓</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, borderLeft: '1.5px solid rgba(255,255,255,0.06)', paddingLeft: '12px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid rgba(255, 0, 85, 0.15)', paddingBottom: '3px' }}>
                Eliminated ({eliminatedRacers.length})
              </div>
              {eliminatedRacers.map((r: { id: string; name: string; qualified: boolean }) => (
                <div key={r.id} style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: '4px 0', display: 'flex', justifyContent: 'space-between', fontWeight: r.id === 'player' ? 800 : 500 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                    {r.name}
                  </span>
                  <span style={{ color: 'var(--primary)', fontWeight: 800 }}>✗</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="btn-primary" onClick={resetTournament} style={{ width: '100%', justifyContent: 'center' }}>
              <Home size={18} />
              Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* 5. VICTORY CHAMPIONSHIP PODIUM OVERLAY */}
      {phase === 'VICTORY' && (
        <div className="ui-interactive glass-panel pulse-animation" style={{
          margin: 'auto',
          maxWidth: '520px',
          width: '92%',
          padding: '48px 40px',
          textAlign: 'center',
          boxSizing: 'border-box',
          border: '3.0px solid #ffd60a',
          boxShadow: '0 0 35px rgba(255, 214, 10, 0.4)',
        }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(255, 214, 10, 0.15)',
            padding: '20px',
            borderRadius: '50%',
            marginBottom: '24px',
            border: '2px solid #ffd60a',
          }}>
            <Trophy size={48} color="#ffd60a" />
          </div>
          <h2 style={{ fontSize: '2.8rem', fontWeight: 900, color: '#ffd60a', margin: '0 0 8px 0', textShadow: '0 0 12px rgba(255, 214, 10, 0.3)' }}>
            VICTORY! 👑
          </h2>
          <p style={{ color: '#ffffff', fontSize: '1.15rem', fontWeight: 700, margin: '0 0 12px 0' }}>
            YOU GAVE IT YOUR ALL AND WON THE CROWN!
          </p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.9rem', margin: '0 0 32px 0' }}>
            Racer <strong>{playerName || 'You'}</strong> outlasted all AI competitors in a grueling 4-round tournament.
          </p>
          
          <button className="btn-primary" onClick={resetTournament} style={{ width: '100%', justifyContent: 'center', background: '#ffd60a', color: '#000', borderColor: '#ffd60a' }}>
            Return to Lobby
          </button>
        </div>
      )}

      {/* Leaderboard and instructions while playing */}
      {phase === 'PLAYING' && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          width: '100%',
          pointerEvents: 'none',
        }}>
          {/* Controls instructions */}
          <div className="glass-panel" style={{
            padding: '14px 20px',
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.7)',
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            border: '1px solid var(--glass-border)',
          }}>
            <HelpCircle size={16} color="var(--secondary)" />
            <div style={{ display: 'flex', gap: '12px' }}>
              <span><strong>WASD</strong> Run</span>
              <span><strong>Space</strong> Jump</span>
              <span><strong>Shift</strong> Dive</span>
              <span><strong>E</strong> Grab</span>
              <span><strong>Mouse</strong> Look</span>
            </div>
          </div>

          {/* Return Lobby Button */}
          <button
            className="ui-interactive btn-secondary"
            onClick={resetTournament}
            style={{
              padding: '10px 16px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800,
            }}
          >
            <Home size={14} />
            Leave Match
          </button>
        </div>
      )}
      
      {/* Live Leaderboard list panel */}
      <RaceLeaderboard />
    </div>
  );
};
