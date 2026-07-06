import { useMusicStore, TrackInfo } from '../store/useMusicStore';
import { useGameStore } from '../store/useGameStore';

class MusicManager {
  private activeAudio: HTMLAudioElement | null = null;
  private fadeAudio: HTMLAudioElement | null = null;
  
  // Web Audio Fallback Synth Contexts
  private synthCtx: AudioContext | null = null;
  private synthGain: GainNode | null = null;
  private synthIntervalId: number | null = null;
  private synthStep = 0;
  private synthIsPlaying = false;
  
  private duckMultiplier = 1.0;
  private duckTimeoutId: number | null = null;
  private timeUpdateIntervalId: number | null = null;
  
  private isFallbackMode = false;
  private autoplayBlocked = false;

  constructor() {
    // Listen to changes in the music store
    useMusicStore.subscribe((state, prevState) => {
      // Handle Enable Music toggle
      if (state.enableMusic !== prevState.enableMusic) {
        if (state.enableMusic) {
          if (state.isPlaying) {
            this.resume();
          } else {
            this.playTrack(state.playlist[state.currentTrackIndex]);
          }
        } else {
          this.pause();
        }
        return;
      }

      if (!state.enableMusic) {
        this.pause();
        return;
      }

      // Track change
      if (state.currentTrackIndex !== prevState.currentTrackIndex) {
        this.playTrack(state.playlist[state.currentTrackIndex]);
        return;
      }

      // Play / Pause toggle
      if (state.isPlaying !== prevState.isPlaying) {
        if (state.isPlaying) {
          this.resume();
        } else {
          this.pause();
        }
      }

      // Volume change
      if (state.musicVolume !== prevState.musicVolume || state.masterVolume !== prevState.masterVolume) {
        this.updateGainVolumes();
      }
    });

    // Automatically trigger notification when track starts
    useMusicStore.subscribe((state, prevState) => {
      if (state.currentTrackIndex !== prevState.currentTrackIndex && state.enableMusic) {
        const track = state.playlist[state.currentTrackIndex];
        state.triggerNowPlaying(track);
      }
    });

    // Change song automatically when transitioning from MENU to ROUND_INTRO (game starts)
    // or when exiting/returning to the lobby menu from gameplay
    useGameStore.subscribe((state, prevState) => {
      if (!useMusicStore.getState().enableMusic) return;

      // 1. Transition: Lobby (MENU) -> Game Start (ROUND_INTRO)
      if (state.phase === 'ROUND_INTRO' && prevState.phase === 'MENU') {
        const store = useMusicStore.getState();
        const indices = store.playlist.map((_, i) => i).filter(i => i !== store.currentTrackIndex);
        const nextIndex = indices[Math.floor(Math.random() * indices.length)];
        store.playTrack(nextIndex);
      }

      // 2. Transition: Gameplay/Results -> Lobby (MENU) [User exited or finished level]
      if (state.phase === 'MENU' && prevState.phase !== 'MENU') {
        const store = useMusicStore.getState();
        const indices = store.playlist.map((_, i) => i).filter(i => i !== store.currentTrackIndex);
        const nextIndex = indices[Math.floor(Math.random() * indices.length)];
        store.playTrack(nextIndex);
      }
    });
    this.addAutoplayListeners();
  }

  // Starts the music system on game boot (hard refresh starts playing a random track immediately)
  public init() {
    const store = useMusicStore.getState();
    if (store.enableMusic && !this.activeAudio && !this.synthIsPlaying) {
      store.setPlaying(true);
      const randomIndex = Math.floor(Math.random() * store.playlist.length);
      store.playTrack(randomIndex);
    }
  }

  private playTrack(track: TrackInfo) {
    this.stopSynthMelody();
    this.isFallbackMode = false;

    // Trigger overlay
    useMusicStore.getState().triggerNowPlaying(track);

    // Stop and clear previous fade out audio
    if (this.fadeAudio) {
      this.fadeAudio.pause();
      this.fadeAudio = null;
    }

    // Set up crossfade: move current active to fadeOut
    if (this.activeAudio) {
      this.fadeAudio = this.activeAudio;
      this.fadeOutAndDispose(this.fadeAudio);
    }

    // Start loading new active audio
    const audio = new Audio(track.file);
    audio.loop = false;
    this.activeAudio = audio;
    
    // Set initial volume to 0 (for fade in)
    audio.volume = 0;

    // Check volumes
    const targetVol = this.getTargetVolume();

    // Register handlers
    audio.onloadedmetadata = () => {
      if (audio.duration && this.activeAudio === audio) {
        const store = useMusicStore.getState();
        const updatedPlaylist = [...store.playlist];
        if (updatedPlaylist[store.currentTrackIndex]) {
          updatedPlaylist[store.currentTrackIndex] = {
            ...updatedPlaylist[store.currentTrackIndex],
            duration: Math.round(audio.duration)
          };
          useMusicStore.setState({ playlist: updatedPlaylist });
        }
      }
    };

    audio.oncanplay = () => {
      if (useMusicStore.getState().isPlaying && this.activeAudio === audio) {
        audio.play().then(() => {
          this.fadeIn(audio, targetVol);
        }).catch((err) => {
          // If browser blocked autoplay, wait for user interaction to resume
          if (err && err.name === 'NotAllowedError') {
            console.log("Audio autoplay blocked, waiting for user click/interaction...");
            this.autoplayBlocked = true;
            this.addAutoplayListeners();
          } else {
            // Actual missing file or decode error, fall back to synth
            this.activateSynthFallback(track);
          }
        });
      }
    };

    audio.onerror = () => {
      if (this.activeAudio === audio) {
        this.activateSynthFallback(track);
      }
    };

    audio.onended = () => {
      if (this.activeAudio === audio) {
        useMusicStore.getState().nextTrack();
      }
    };

    // Tracker for progress bar
    if (this.timeUpdateIntervalId) {
      window.clearInterval(this.timeUpdateIntervalId);
    }
    this.timeUpdateIntervalId = window.setInterval(() => {
      if (audio && !audio.paused && audio.duration) {
        const progress = (audio.currentTime / audio.duration) * 100;
        useMusicStore.getState().setPlaybackProgress(progress);
      }
    }, 250);
  }

  private activateSynthFallback(track: TrackInfo) {
    if (this.isFallbackMode) return;
    this.isFallbackMode = true;
    
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio = null;
    }
    
    this.startSynthMelody(track.id);
  }

  private fadeIn(audio: HTMLAudioElement, targetVol: number) {
    let vol = 0;
    const interval = window.setInterval(() => {
      if (!audio || audio.paused) {
        window.clearInterval(interval);
        return;
      }
      vol += 0.05;
      if (vol >= targetVol) {
        audio.volume = targetVol;
        window.clearInterval(interval);
      } else {
        audio.volume = vol;
      }
    }, 50);
  }

  private fadeOutAndDispose(audio: HTMLAudioElement) {
    let vol = audio.volume;
    const interval = window.setInterval(() => {
      vol -= 0.05;
      if (vol <= 0) {
        audio.volume = 0;
        audio.pause();
        window.clearInterval(interval);
      } else {
        audio.volume = vol;
      }
    }, 50);
  }

  public pause() {
    if (this.activeAudio) {
      this.activeAudio.pause();
    }
    this.synthIsPlaying = false;
  }

  public resume() {
    const store = useMusicStore.getState();
    if (!store.enableMusic) return;

    if (this.isFallbackMode) {
      this.startSynthMelody(store.playlist[store.currentTrackIndex].id);
    } else if (this.activeAudio) {
      this.activeAudio.play().catch(() => {
        this.activateSynthFallback(store.playlist[store.currentTrackIndex]);
      });
    } else {
      this.playTrack(store.playlist[store.currentTrackIndex]);
    }
  }

  public skipToNext() {
    useMusicStore.getState().nextTrack();
  }

  public skipToPrev() {
    useMusicStore.getState().prevTrack();
  }

  public restartCurrent() {
    if (this.activeAudio) {
      this.activeAudio.currentTime = 0;
    }
    this.synthStep = 0;
    useMusicStore.getState().setPlaybackProgress(0);
  }

  private getTargetVolume() {
    const store = useMusicStore.getState();
    return store.musicVolume * store.masterVolume * this.duckMultiplier;
  }

  private updateGainVolumes() {
    const targetVol = this.getTargetVolume();
    if (this.activeAudio) {
      this.activeAudio.volume = targetVol;
    }
    if (this.synthGain && this.synthCtx) {
      this.synthGain.gain.setValueAtTime(targetVol * 0.4, this.synthCtx.currentTime); // synth slightly softer
    }
  }

  // Volume ducking for critical moments (qualified, countdown beeps, victory, defeat)
  public duckMusic(amount = 0.25, duration = 2000) {
    this.duckMultiplier = amount;
    this.updateGainVolumes();

    if (this.duckTimeoutId) {
      window.clearTimeout(this.duckTimeoutId);
    }

    this.duckTimeoutId = window.setTimeout(() => {
      // Fade back smoothly
      let current = this.duckMultiplier;
      const interval = window.setInterval(() => {
        current += 0.05;
        if (current >= 1.0) {
          current = 1.0;
          window.clearInterval(interval);
        }
        this.duckMultiplier = current;
        this.updateGainVolumes();
      }, 50);
    }, duration);
  }

  // --- fallback Web Audio API sequencer synthesizer ---
  private startSynthMelody(trackId: number) {
    this.stopSynthMelody();
    
    // Create synth context if not existed
    if (!this.synthCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      this.synthCtx = new AudioContextClass();
      this.synthGain = this.synthCtx.createGain();
      this.synthGain.connect(this.synthCtx.destination);
    }
    
    if (this.synthCtx.state === 'suspended') {
      this.synthCtx.resume();
    }

    this.synthIsPlaying = true;
    this.synthStep = 0;
    this.updateGainVolumes();
    
    // Track parameters
    const BPM_MAP: Record<number, number> = { 
      1: 186, // American Idiot
      2: 112, // Without Me
      3: 128, // Victory Lap Five
      4: 120, // Alive
      5: 122  // Moves Like Jagger
    };
    const bpm = BPM_MAP[trackId] || 120;
    
    // Pitches scale frequencies (Pentatonic/Melodic blend)
    const SCALE = [130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880.00];
    
    // Melodies (length 16 steps)
    const MELODIES: Record<number, number[]> = {
      1: [12, 12, 12, 15, 13, 15, 12, -1, 12, 12, 12, 15, 13, 15, 12, -1], // American Idiot
      2: [14, -1, 12, 11, 10, -1, 10, 11, 12, -1, 13, 12, 11, -1, 12, -1],  // Without Me
      3: [12, 14, 15, 14, 12, 14, 12, 10, 12, 14, 15, 14, 12, 14, 15, 17], // Victory Lap Five
      4: [8, 8, 10, 11, 10, -1, 8, -1, 8, 8, 10, 11, 10, -1, 8, -1],       // Alive
      5: [12, -1, 14, -1, 15, 14, 12, -1, 12, -1, 14, -1, 15, 14, 12, -1]  // Moves Like Jagger
    };
    
    const BASS_LINES: Record<number, number[]> = {
      1: [7, 7, 7, 7, 3, 3, 3, 3, 5, 5, 5, 5, 3, 3, 3, 3],
      2: [9, 9, 9, 9, 7, 7, 7, 7, 5, 5, 5, 5, 7, 7, 7, 7],
      3: [7, 7, 7, 7, 10, 10, 10, 10, 8, 8, 8, 8, 7, 7, 7, 7],
      4: [4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 1, 1, 2, 2, 2, 2],
      5: [7, 7, 7, 7, 5, 5, 5, 5, 3, 3, 3, 3, 5, 5, 5, 5]
    };

    const notes = MELODIES[trackId] || MELODIES[1];
    const bass = BASS_LINES[trackId] || BASS_LINES[1];

    let nextNoteTime = this.synthCtx.currentTime;
    const stepDuration = 60 / bpm / 2; // 8th notes

    const scheduler = () => {
      while (nextNoteTime < this.synthCtx!.currentTime + 0.1) {
        if (!this.synthIsPlaying) return;
        
        // Schedule bass note (quarter notes)
        if (this.synthStep % 2 === 0) {
          const bassIdx = bass[Math.floor(this.synthStep / 2) % bass.length];
          const bassFreq = SCALE[bassIdx] / 2; // lower octave
          this.playSynthNote(bassFreq, nextNoteTime, 'triangle', 0.25, 0.18);
        }

        // Schedule lead note (8th notes)
        const noteIdx = notes[this.synthStep % notes.length];
        if (noteIdx !== -1) {
          const leadFreq = SCALE[noteIdx];
          this.playSynthNote(leadFreq, nextNoteTime, 'sawtooth', 0.08, 0.12);
        }

        nextNoteTime += stepDuration;
        this.synthStep++;
        
        // Update store progress tracker
        const totalSteps = 16 * 8; // simulated duration
        const currentProgress = ((this.synthStep % totalSteps) / totalSteps) * 100;
        useMusicStore.getState().setPlaybackProgress(currentProgress);
        
        if (this.synthStep >= totalSteps) {
          this.synthStep = 0;
          const store = useMusicStore.getState();
          if (store.repeatMode === 'TRACK') {
            // Keep playing current
          } else {
            // Advance to next
            window.setTimeout(() => {
              store.nextTrack();
            }, 0);
            return;
          }
        }
      }
    };

    this.synthIntervalId = window.setInterval(scheduler, 25);
  }

  private playSynthNote(freq: number, time: number, type: OscillatorType, volume: number, duration: number) {
    if (!this.synthCtx || !this.synthGain) return;

    const osc = this.synthCtx.createOscillator();
    const env = this.synthCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    env.gain.setValueAtTime(volume, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration - 0.02);

    osc.connect(env);
    env.connect(this.synthGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private stopSynthMelody() {
    if (this.synthIntervalId) {
      window.clearInterval(this.synthIntervalId);
      this.synthIntervalId = null;
    }
    this.synthIsPlaying = false;
  }

  // --- Browser Autoplay Policy Resolvers ---
  private resolveAutoplay = () => {
    const store = useMusicStore.getState();
    if (store.enableMusic && store.isPlaying) {
      if (this.autoplayBlocked) {
        this.autoplayBlocked = false;
        this.playTrack(store.playlist[store.currentTrackIndex]);
      } else {
        this.resume();
      }
    }
    this.removeAutoplayListeners();
  };

  private addAutoplayListeners() {
    window.addEventListener('click', this.resolveAutoplay);
    window.addEventListener('keydown', this.resolveAutoplay);
    window.addEventListener('mousedown', this.resolveAutoplay);
    window.addEventListener('touchstart', this.resolveAutoplay);
  }

  private removeAutoplayListeners() {
    window.removeEventListener('click', this.resolveAutoplay);
    window.removeEventListener('keydown', this.resolveAutoplay);
    window.removeEventListener('mousedown', this.resolveAutoplay);
    window.removeEventListener('touchstart', this.resolveAutoplay);
  }
}

export const musicManager = new MusicManager();
export default musicManager;
