import { create } from 'zustand';

export type RepeatMode = 'OFF' | 'TRACK' | 'PLAYLIST';

export interface TrackInfo {
  id: number;
  title: string;
  artist: string;
  file: string;
  duration: number; // estimate for synth fallback
}

export const INITIAL_PLAYLIST: TrackInfo[] = [
  { id: 1, title: 'American Idiot', artist: 'Green Day', file: '/assets/music/green day - american idiot.mp3', duration: 174 },
  { id: 2, title: 'Without Me', artist: 'Eminem', file: '/assets/music/Without Me [tqxRidAWER8].mp3', duration: 290 },
  { id: 3, title: 'Victory Lap Five', artist: 'Fred again..', file: '/assets/music/Victory Lap Five [0wRYvsfhsR8].mp3', duration: 278 },
  { id: 4, title: 'Alive', artist: 'Alok & Zedd', file: '/assets/music/Alive [Y0ZCbKKaJYY].mp3', duration: 140 },
  { id: 5, title: 'Moves Like Jagger', artist: 'Maroon 5 feat. Christina Aguilera', file: '/assets/music/Maroon 5 - Moves Like Jagger (Studio Recording From _The Voice_ Performance) (feat. Christina Aguilera) - (128 Kbps).mp3', duration: 201 },
];

interface MusicState {
  playlist: TrackInfo[];
  currentTrackIndex: number;
  isPlaying: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  musicVolume: number;
  masterVolume: number;
  enableMusic: boolean;
  showNotifications: boolean;
  nowPlayingTrack: TrackInfo | null;
  nowPlayingVisible: boolean;
  playbackProgress: number; // 0 to 100

  // Actions
  setPlaying: (playing: boolean) => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setMusicVolume: (volume: number) => void;
  setMasterVolume: (volume: number) => void;
  setEnableMusic: (enable: boolean) => void;
  setShowNotifications: (show: boolean) => void;
  setPlaybackProgress: (progress: number) => void;
  playTrack: (index: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  restartTrack: () => void;
  triggerNowPlaying: (track: TrackInfo) => void;
  hideNowPlaying: () => void;
}

// Load initial preferences from local storage
const loadPref = (key: string, fallback: any) => {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
};

const savePref = (key: string, val: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
};

export const useMusicStore = create<MusicState>((set, get) => ({
  playlist: INITIAL_PLAYLIST,
  currentTrackIndex: 0,
  isPlaying: false,
  shuffle: loadPref('music_shuffle', false),
  repeatMode: loadPref('music_repeatMode', 'PLAYLIST') as RepeatMode,
  musicVolume: loadPref('music_musicVolume', 0.7),
  masterVolume: loadPref('music_masterVolume', 1.0),
  enableMusic: loadPref('music_enableMusic', true),
  showNotifications: loadPref('music_showNotifications', true),
  nowPlayingTrack: null,
  nowPlayingVisible: false,
  playbackProgress: 0,

  setPlaying: (playing) => set({ isPlaying: playing }),
  setShuffle: (shuffle) => {
    savePref('music_shuffle', shuffle);
    set({ shuffle });
  },
  setRepeatMode: (mode) => {
    savePref('music_repeatMode', mode);
    set({ repeatMode: mode });
  },
  setMusicVolume: (volume) => {
    savePref('music_musicVolume', volume);
    set({ musicVolume: volume });
  },
  setMasterVolume: (volume) => {
    savePref('music_masterVolume', volume);
    set({ masterVolume: volume });
  },
  setEnableMusic: (enable) => {
    savePref('music_enableMusic', enable);
    set({ enableMusic: enable });
  },
  setShowNotifications: (show) => {
    savePref('music_showNotifications', show);
    set({ showNotifications: show });
  },
  setPlaybackProgress: (progress) => set({ playbackProgress: progress }),

  playTrack: (index) => {
    const playlist = get().playlist;
    if (index >= 0 && index < playlist.length) {
      set({ currentTrackIndex: index, isPlaying: true, playbackProgress: 0 });
    }
  },

  nextTrack: () => {
    const { currentTrackIndex, playlist, shuffle, repeatMode } = get();
    if (repeatMode === 'TRACK') {
      set({ playbackProgress: 0 });
      return;
    }

    let nextIndex = currentTrackIndex;
    if (shuffle) {
      // Pick random track not matching the current one
      const indices = playlist.map((_, i) => i).filter(i => i !== currentTrackIndex);
      nextIndex = indices[Math.floor(Math.random() * indices.length)];
    } else {
      nextIndex = currentTrackIndex + 1;
      if (nextIndex >= playlist.length) {
        if (repeatMode === 'PLAYLIST') {
          nextIndex = 0;
        } else {
          set({ isPlaying: false, playbackProgress: 0 });
          return;
        }
      }
    }
    set({ currentTrackIndex: nextIndex, isPlaying: true, playbackProgress: 0 });
  },

  prevTrack: () => {
    const { currentTrackIndex, playlist, shuffle } = get();
    let prevIndex = currentTrackIndex;
    if (shuffle) {
      const indices = playlist.map((_, i) => i).filter(i => i !== currentTrackIndex);
      prevIndex = indices[Math.floor(Math.random() * indices.length)];
    } else {
      prevIndex = currentTrackIndex - 1;
      if (prevIndex < 0) {
        prevIndex = playlist.length - 1;
      }
    }
    set({ currentTrackIndex: prevIndex, isPlaying: true, playbackProgress: 0 });
  },

  restartTrack: () => {
    set({ playbackProgress: 0 });
  },

  triggerNowPlaying: (track) => {
    if (get().showNotifications) {
      set({ nowPlayingTrack: track, nowPlayingVisible: true });
    }
  },

  hideNowPlaying: () => set({ nowPlayingVisible: false, nowPlayingTrack: null }),
}));
