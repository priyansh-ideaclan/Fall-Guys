import React, { useMemo } from 'react';
import { useGameStore, RacerProgress } from '../store/useGameStore';

function sortRacers(
  progress: Record<string, RacerProgress>,
  levelId: string,
  levelType: string
): RacerProgress[] {
  return Object.values(progress).sort((a, b) => {
    // 1. Finished racers bubble to top sorted by finishTime
    if (a.finished && b.finished) {
      return (a.finishTime ?? 0) - (b.finishTime ?? 0);
    }
    if (a.finished) return -1;
    if (b.finished) return 1;

    // 2. Active sorting by category
    if (levelType === 'HUNT') {
      if (b.score !== a.score) return b.score - a.score;
      return b.yPos - a.yPos;
    }
    if (levelType === 'SURVIVAL' || levelType === 'LOGIC' || levelId === 'final_1') {
      // Sort by height Y descending (higher position = safer/surviving)
      if (Math.abs(b.yPos - a.yPos) > 0.05) return b.yPos - a.yPos;
      return b.progressValue - a.progressValue;
    }
    
    // Default: project along race course
    return b.progressValue - a.progressValue;
  });
}

export const RaceLeaderboard: React.FC = () => {
  const phase = useGameStore((state) => state.phase);
  const currentLevelId = useGameStore((state) => state.currentLevelId);
  const currentLevelType = useGameStore((state) => state.currentLevelType);
  const racerProgress = useGameStore((state) => state.racerProgress);

  const sorted = useMemo(() => {
    return sortRacers(racerProgress, currentLevelId, currentLevelType);
  }, [racerProgress, currentLevelId, currentLevelType]);

  if (phase === 'MENU') return null;
  if (sorted.length === 0) return null;

  const ROW_HEIGHT = 30;
  const GAP = 2;
  const containerHeight = sorted.slice(0, 10).length * (ROW_HEIGHT + GAP) + 12;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '72px',
        right: '16px',
        width: '230px',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'rgba(15, 15, 20, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(0, 229, 255, 0.35)',
          borderRadius: '12px 12px 0 0',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span style={{ fontSize: '0.9rem' }}>🏆</span>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 900,
            color: '#fff',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {currentLevelType === 'HUNT' ? 'Star Leaderboard' : 'Race Standings'}
        </span>
      </div>

      {/* Rows Container */}
      <div
        style={{
          background: 'rgba(15, 15, 20, 0.75)',
          backdropFilter: 'blur(12px)',
          border: '1.5px solid rgba(0, 229, 255, 0.2)',
          borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          padding: '6px 6px',
          position: 'relative',
          height: `${containerHeight}px`,
          overflow: 'hidden',
          transition: 'height 0.3s ease',
        }}
      >
        {sorted.slice(0, 10).map((racer, idx) => {
          const isPlayer = racer.id === 'player';
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;

          return (
            <div
              key={racer.id}
              style={{
                position: 'absolute',
                top: `${6 + idx * (ROW_HEIGHT + GAP)}px`,
                left: '6px',
                right: '6px',
                height: `${ROW_HEIGHT}px`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 10px',
                borderRadius: '6px',
                background: isPlayer
                  ? 'linear-gradient(90deg, rgba(0, 229, 255, 0.22), rgba(0, 229, 255, 0.06))'
                  : 'rgba(255, 255, 255, 0.03)',
                borderLeft: isPlayer ? '3px solid var(--secondary)' : '3px solid transparent',
                border: isPlayer ? '1px solid rgba(0, 229, 255, 0.25)' : '1px solid transparent',
                transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), background 0.3s ease, border 0.3s ease',
                boxSizing: 'border-box',
              }}
            >
              {/* Position / Medal */}
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  color: isPlayer ? 'var(--secondary)' : 'rgba(255,255,255,0.4)',
                  minWidth: '16px',
                  textAlign: 'right',
                }}
              >
                {medal || `${idx + 1}`}
              </span>

              {/* Name */}
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: isPlayer ? 800 : 600,
                  color: isPlayer ? '#fff' : 'rgba(255,255,255,0.8)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {racer.name}
                {isPlayer && (
                  <span
                    style={{
                      fontSize: '0.6rem',
                      color: 'rgba(0, 229, 255, 0.85)',
                      marginLeft: '4px',
                      fontWeight: 700,
                    }}
                  >
                    (you)
                  </span>
                )}
              </span>

              {/* Hunt score or status */}
              {currentLevelType === 'HUNT' && (
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ffd60a', marginRight: '4px' }}>
                  ★ {racer.score}
                </span>
              )}

              {/* Finish status checkmark */}
              {racer.finished ? (
                <span
                  style={{
                    fontSize: '0.62rem',
                    background: 'rgba(0, 229, 255, 0.15)',
                    border: '1px solid var(--secondary)',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    color: 'var(--secondary)',
                    fontWeight: 800,
                  }}
                >
                  QUALIFIED
                </span>
              ) : (
                racer.id !== 'player' && (
                  <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
                    ACTIVE
                  </span>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
