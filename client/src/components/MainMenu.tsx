import React, { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { audioManager } from '../utils/audioManager';
import { Sparkles, Trophy, Play, Volume2, VolumeX, Lock, Unlock } from 'lucide-react';

const LEVEL_NAMES = [
  'Level 1: Beginner Bounds',
  'Level 2: Conveyor Crossing',
  'Level 3: Slippery Slopes',
  'Level 4: Precise Pendulums',
  'Level 5: Final Ascent',
];

const COLORS = [
  { name: 'Pink Dream', value: '#ff007f' },
  { name: 'Electric Cyan', value: '#00e5ff' },
  { name: 'Neon Purple', value: '#bd00ff' },
  { name: 'Gold Crown', value: '#ffd60a' },
  { name: 'Lime Rush', value: '#39ff14' },
  { name: 'Orange Burst', value: '#ff6700' },
];

const ACCESSORIES = [
  { id: 'none', name: 'No Accessory' },
  { id: 'crown', name: 'Golden Crown 👑' },
  { id: 'party', name: 'Party Cone 🎉' },
  { id: 'glasses', name: 'Rad Glasses 🕶️' },
];

export const MainMenu: React.FC = () => {
  const { 
    phase, 
    startGame, 
    startTournament,
    customization, 
    updateCustomization, 
    wins, 
    failures,
    currentLevelIndex,
    maxLevelUnlocked,
    selectLevel,
    masterVolume,
    musicVolume,
    sfxVolume,
    musicMuted,
    sfxMuted,
    setVolume,
    toggleMute,
    playerName,
    setPlayerName,
  } = useGameStore();

  // Start background music loop on main lobby entry
  useEffect(() => {
    if (phase === 'MENU') {
      audioManager.startMusic();
    }
  }, [phase]);

  if (phase !== 'MENU') return null;

  const handleLevelClick = (idx: number) => {
    if (idx <= maxLevelUnlocked) {
      selectLevel(idx);
      audioManager.playClick();
    }
  };

  const handleVolumeChange = (type: 'master' | 'music' | 'sfx', val: number) => {
    setVolume(type, val);
    if (type === 'sfx') {
      audioManager.playClick(); // Play a test click to test volume
    }
  };

  return (
    <div className="ui-interactive glass-panel pulse-animation" style={{
      maxWidth: '880px',
      width: '95%',
      margin: 'auto',
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr',
      gap: '24px',
      padding: '30px',
      boxSizing: 'border-box',
      pointerEvents: 'auto',
    }}>
      {/* Left Column: Title, Levels Selection, and Play */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Sparkles size={16} color="var(--secondary)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--secondary)' }}>
              Sequential fixed campaign
            </span>
          </div>
          <h1 className="gradient-title" style={{ fontSize: '2.5rem', margin: '0 0 6px 0', lineHeight: 1.1 }}>
            CHAO RUNNERS
          </h1>
          {/* Player identity badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Welcome,</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--secondary)', fontWeight: 800 }}>{playerName}</span>
            <button
              onClick={() => { setPlayerName(''); audioManager.playClick(); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.3)',
                fontSize: '0.7rem',
                cursor: 'pointer',
                padding: '0',
                textDecoration: 'underline',
                fontFamily: 'inherit',
              }}
              title="Change your racer name"
            >
              change
            </button>
          </div>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem', margin: '0 0 16px 0' }}>
            Handcrafted courses, sliding ice fields, slowing mud, and high-performance competitive AI bots. Race, jump, and dive to grab the crown!
          </p>
        </div>

        {/* Level Progression Section */}
        <div>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800, display: 'block', marginBottom: '8px' }}>
            Select Level ({maxLevelUnlocked + 1} / 5 Unlocked)
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {LEVEL_NAMES.map((name, idx) => {
              const isLocked = idx > maxLevelUnlocked;
              const isSelected = idx === currentLevelIndex;

              return (
                <button
                  key={idx}
                  onClick={() => handleLevelClick(idx)}
                  disabled={isLocked}
                  className="btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    opacity: isLocked ? 0.4 : 1,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    borderColor: isSelected ? 'var(--secondary)' : 'var(--glass-border)',
                    background: isSelected ? 'rgba(0, 229, 255, 0.08)' : 'var(--glass-bg)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: isSelected ? 800 : 500 }}>
                    {isSelected ? '▶ ' : ''}{name}
                  </span>
                  {isLocked ? <Lock size={12} color="rgba(255,255,255,0.5)" /> : <Unlock size={12} color="var(--secondary)" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats & Start Game button */}
        <div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.02)',
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.04)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600 }}>Crown Wins</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--yellow)' }}>{wins}</div>
            </div>
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.02)',
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.04)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600 }}>Tries</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>{wins + failures}</div>
            </div>
          </div>

          <button className="btn-primary" onClick={startTournament} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
            <Play size={18} fill="white" />
            Launch Tournament
          </button>
        </div>
      </div>

      {/* Right Column: Customization & Audio Settings */}
      <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Customization */}
        <div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>
            Custom Appearance
          </h3>

          <div style={{ marginBottom: '10px' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Body Skin Color
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => { updateCustomization({ color: c.value }); audioManager.playClick(); }}
                  style={{
                    backgroundColor: c.value,
                    height: '28px',
                    borderRadius: '6px',
                    border: customization.color === c.value ? '2px solid white' : '1px solid rgba(0,0,0,0.3)',
                    cursor: 'pointer',
                    transform: customization.color === c.value ? 'scale(1.08)' : 'none',
                  }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Accessory
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {ACCESSORIES.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => { updateCustomization({ accessory: acc.id }); audioManager.playClick(); }}
                  className="btn-secondary"
                  style={{
                    padding: '6px 8px',
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    borderColor: customization.accessory === acc.id ? 'var(--secondary)' : 'var(--glass-border)',
                    background: customization.accessory === acc.id ? 'rgba(0, 229, 255, 0.08)' : 'var(--glass-bg)',
                  }}
                >
                  {acc.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Audio settings */}
        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Volume2 size={16} color="var(--secondary)" />
            Synthesizer Audio Settings
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Master Volume */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                <span>Master Volume</span>
                <span>{Math.round(masterVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={masterVolume}
                onChange={(e) => handleVolumeChange('master', parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--secondary)', cursor: 'pointer' }}
              />
            </div>

            {/* Music Volume */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                <span>Music Volume</span>
                <button
                  onClick={() => toggleMute('music')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--secondary)',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {musicMuted ? 'Unmute BGM 🔇' : 'Mute BGM 🔊'}
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={musicVolume}
                disabled={musicMuted}
                onChange={(e) => handleVolumeChange('music', parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer', opacity: musicMuted ? 0.3 : 1 }}
              />
            </div>

            {/* SFX Volume */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                <span>SFX Volume</span>
                <button
                  onClick={() => toggleMute('sfx')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--secondary)',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {sfxMuted ? 'Unmute SFX 🔇' : 'Mute SFX 🔊'}
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={sfxVolume}
                disabled={sfxMuted}
                onChange={(e) => handleVolumeChange('sfx', parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--yellow)', cursor: 'pointer', opacity: sfxMuted ? 0.3 : 1 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
