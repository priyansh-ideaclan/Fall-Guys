import { create } from 'zustand';
import { generateBotNames } from '../utils/botNames';

export type GamePhase = 'MENU' | 'ROUND_INTRO' | 'PLAYING' | 'QUALIFIED' | 'ROUND_OUTCOME' | 'GAMEOVER' | 'VICTORY';
export type VisualTheme = 'SKY_BLUE' | 'SUNSET_ORANGE' | 'PURPLE_NEON' | 'CANDY_LAND' | 'SPACE';
export type LevelType = 'RACE' | 'SURVIVAL' | 'LOGIC' | 'HUNT' | 'FINAL';

export interface RacerProgress {
  id: string;          // 'player' | 'bot_0' ... 'bot_8'
  name: string;
  progressValue: number; // Continuous progress calculated using spline projection
  yPos: number;        // Height for sorting Survival/Lava/Honeycomb
  score: number;       // Hunt star/crystal points
  finished: boolean;
  finishTime?: number;
}

export interface PlayerCustomization {
  color: string;
  accessory: string;
}

export interface BotRacer {
  id: string;
  name: string;
  color: string;
  accessory: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

interface GameState {
  phase: GamePhase;
  startTime: number | null;
  timeElapsed: number;
  lastCheckpoint: [number, number, number] | null;
  customization: PlayerCustomization;
  wins: number;
  failures: number;

  // Player identity
  playerName: string;

  // Tournament States
  tournamentActive: boolean;
  currentRound: number;
  currentLevelId: string;
  currentLevelType: LevelType;
  roundObjective: string;
  roundTimeLimit: number;
  roundTimer: number;
  scores: Record<string, number>; // Used for Hunt collections
  activeColorPattern: string; // Used for memory logic blocks
  winnersList: string[]; // List of racer IDs that qualified this round
  activeBots: BotRacer[]; // Surviving bots in the tournament
  botQualifyingLimit: number;
  playerQualified: boolean;

  // Legacy campaign variables
  currentLevelIndex: number;
  maxLevelUnlocked: number;
  qualifiedBots: string[];
  eliminatedBots: string[];

  // Level & Theme configs
  levelSeed: number;
  visualTheme: VisualTheme;
  racerProgress: Record<string, RacerProgress>;

  // Audio settings (Persisted)
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;

  // Actions
  setPhase: (phase: GamePhase) => void;
  setPlayerName: (name: string) => void;
  updateCustomization: (customization: Partial<PlayerCustomization>) => void;
  updateRacerProgress: (progress: RacerProgress) => void;
  updateScore: (id: string, amount: number) => void;
  setActiveColorPattern: (color: string) => void;

  // Tournament flow
  startTournament: () => void;
  startRoundGameplay: () => void;
  qualifyRacer: (id: string) => void;
  eliminateRacer: (id: string) => void;
  advanceToNextRound: () => void;
  resetTournament: () => void;
  passCheckpoint: (position: [number, number, number]) => void;
  tick: () => void;
  triggerWin: () => void;
  triggerLoss: () => void;

  // Audio Actions
  setVolume: (type: 'master' | 'music' | 'sfx', value: number) => void;
  toggleMute: (type: 'music' | 'sfx') => void;

  // Legacy campaign actions
  startGame: () => void;
  selectLevel: (index: number) => void;
  unlockNextLevel: () => void;
}

const THEMES: VisualTheme[] = ['SKY_BLUE', 'SUNSET_ORANGE', 'PURPLE_NEON', 'CANDY_LAND', 'SPACE'];

// Starting spawn points for each level type
const SPAWN_POINTS: Record<string, [number, number, number]> = {
  // Race Levels
  'race_1': [0, 4, 0],
  'race_2': [0, 4, 0],
  'race_3': [0, 4, 0],
  // Survival Levels
  'survival_1': [0, 4, 0],
  'survival_2': [0, 4, 0],
  // Logic Levels
  'logic_1': [0, 4, 0],
  'logic_2': [0, 4, 0],
  // Hunt Levels
  'hunt_1': [0, 4, 0],
  // Final Levels
  'final_1': [0, 10, 0],
  'final_2': [0, 4, 0],
};

const getStoredNumber = (key: string, fallback: number): number => {
  const val = localStorage.getItem(key);
  return val ? parseFloat(val) : fallback;
};

const getStoredBoolean = (key: string, fallback: boolean): boolean => {
  const val = localStorage.getItem(key);
  return val ? val === 'true' : fallback;
};

// Available levels by category
const RACE_LEVELS = ['race_1', 'race_2', 'race_3'];
const SURVIVAL_LEVELS = ['survival_1', 'survival_2'];
const LOGIC_LEVELS = ['logic_1', 'logic_2'];
const HUNT_LEVELS = ['hunt_1'];
const FINAL_LEVELS = ['final_1', 'final_2'];

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'MENU',
  startTime: null,
  timeElapsed: 0,
  lastCheckpoint: null,
  customization: {
    color: '#ff007f', // Hot Pink
    accessory: 'none',
  },
  wins: 0,
  failures: 0,

  // Player identity
  playerName: localStorage.getItem('chaorunners_player_name') || '',

  // Tournament States
  tournamentActive: false,
  currentRound: 1,
  currentLevelId: 'race_1',
  currentLevelType: 'RACE',
  roundObjective: 'Reach the finish line!',
  roundTimeLimit: 0,
  roundTimer: 0,
  scores: {},
  activeColorPattern: 'RED',
  winnersList: [],
  activeBots: [],
  botQualifyingLimit: 8,
  playerQualified: false,

  levelSeed: 0.5,
  visualTheme: 'SKY_BLUE',
  racerProgress: {},

  // Legacy campaign defaults
  currentLevelIndex: 0,
  maxLevelUnlocked: Math.round(getStoredNumber('chaorunners_max_unlocked', 0)),
  qualifiedBots: [],
  eliminatedBots: [],

  // Audio settings
  masterVolume: getStoredNumber('chaorunners_vol_master', 1.0),
  musicVolume: getStoredNumber('chaorunners_vol_music', 0.6),
  sfxVolume: getStoredNumber('chaorunners_vol_sfx', 0.7),
  musicMuted: getStoredBoolean('chaorunners_mute_music', false),
  sfxMuted: getStoredBoolean('chaorunners_mute_sfx', false),

  setPhase: (phase) => set({ phase }),

  setPlayerName: (name) => {
    const trimmed = name.trim();
    localStorage.setItem('chaorunners_player_name', trimmed);
    set({ playerName: trimmed });
  },

  updateCustomization: (customization) => set((state) => ({
    customization: { ...state.customization, ...customization }
  })),

  updateRacerProgress: (progress) => set((state) => ({
    racerProgress: { ...state.racerProgress, [progress.id]: progress },
  })),

  updateScore: (id, amount) => set((state) => {
    const currentScore = state.scores[id] || 0;
    return {
      scores: { ...state.scores, [id]: currentScore + amount }
    };
  }),

  setActiveColorPattern: (color) => set({ activeColorPattern: color }),

  startTournament: () => {
    // Select first level (always Race)
    const levelId = RACE_LEVELS[Math.floor(Math.random() * RACE_LEVELS.length)];
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const spawnPoint = SPAWN_POINTS[levelId] || [0, 4, 0];

    // Seed 9 bots with unique names/colors/difficulties
    const botNames = generateBotNames(9, get().playerName);
    const botColors = ['#ffd60a', '#39ff14', '#00e5ff', '#ff6700', '#bd00ff', '#ff0055', '#00ffc4', '#ff7da7', '#a8ff00'];
    const accessories = ['none', 'crown', 'party', 'glasses'];
    const difficulties: ('EASY' | 'MEDIUM' | 'HARD')[] = ['EASY', 'MEDIUM', 'HARD', 'EASY', 'MEDIUM', 'MEDIUM', 'EASY', 'MEDIUM', 'HARD'];
    const seededBots = Array.from({ length: 9 }, (_, i) => ({
      id: `bot_${i}`,
      name: botNames[i] || `Runner_${i}`,
      color: botColors[i % botColors.length],
      accessory: accessories[Math.floor(Math.random() * accessories.length)],
      difficulty: difficulties[i % difficulties.length],
    }));

    set({
      tournamentActive: true,
      currentRound: 1,
      currentLevelId: levelId,
      currentLevelType: 'RACE',
      roundObjective: 'Reach the finish line before slot fills!',
      botQualifyingLimit: 8, // Top 8 qualify
      playerQualified: false,
      winnersList: [],
      scores: {},
      racerProgress: {},
      lastCheckpoint: spawnPoint,
      visualTheme: theme,
      levelSeed: Math.random(),
      phase: 'ROUND_INTRO',
      startTime: null,
      timeElapsed: 0,
      roundTimer: 0,
      roundTimeLimit: 0,
      activeBots: seededBots,
    });
  },

  startRoundGameplay: () => {
    set({
      phase: 'PLAYING',
      startTime: Date.now(),
      timeElapsed: 0,
    });
  },

  qualifyRacer: (id) => set((state) => {
    if (state.phase !== 'PLAYING') return {};
    if (state.winnersList.includes(id)) return {};

    const nextWinners = [...state.winnersList, id];
    const isPlayer = id === 'player';
    const playerOk = state.playerQualified || isPlayer;

    // Check if slots are fully filled
    const limitReached = nextWinners.length >= state.botQualifyingLimit;

    // If limit is reached or player wins final
    let nextPhase: GamePhase = state.phase;
    let nextWinsCount = state.wins;
    let nextFailuresCount = state.failures;

    if (!state.tournamentActive) {
      if (isPlayer) {
        nextPhase = 'QUALIFIED';
        nextWinsCount += 1;
      }
    } else if (state.currentLevelType === 'FINAL') {
      if (isPlayer) {
        nextPhase = 'VICTORY';
        nextWinsCount += 1;
      } else {
        // A bot won the final!
        nextPhase = 'GAMEOVER';
        nextFailuresCount += 1;
      }
    } else if (limitReached) {
      nextPhase = 'ROUND_OUTCOME';
      if (!playerOk) {
        // Player failed to qualify!
        nextPhase = 'GAMEOVER';
        nextFailuresCount += 1;
      }
    }

    // Lock finishing position for racerProgress
    const currentProg = state.racerProgress[id];
    const nextProg = currentProg ? { ...currentProg, finished: true, finishTime: Date.now() } : undefined;

    // Update qualifiedBots list for bots
    const nextQualifiedBots = isPlayer ? state.qualifiedBots : [...state.qualifiedBots, id];

    return {
      winnersList: nextWinners,
      qualifiedBots: nextQualifiedBots,
      playerQualified: playerOk,
      phase: nextPhase,
      wins: nextWinsCount,
      failures: nextFailuresCount,
      racerProgress: nextProg ? { ...state.racerProgress, [id]: nextProg } : state.racerProgress,
    };
  }),

  eliminateRacer: (id) => set((state) => {
    if (state.phase !== 'PLAYING') return {};

    // If player falls in Survival or Logic, it's instant Game Over
    if (id === 'player') {
      return {
        phase: 'GAMEOVER',
        failures: state.failures + 1
      };
    }

    // Bots just get filtered out
    return {
      activeBots: state.activeBots.filter(b => b.id !== id),
      eliminatedBots: [...state.eliminatedBots, id],
    };
  }),

  advanceToNextRound: () => {
    const { currentRound, winnersList, activeBots } = get();
    const nextRound = currentRound + 1;

    // Filter surviving bots to only those who qualified
    const nextBots = activeBots.filter((bot) => winnersList.includes(bot.id));

    let nextLevelId = 'race_2';
    let nextType: LevelType = 'RACE';
    let nextObjective = 'Reach the finish line!';
    let nextLimit = 6;
    let timeLimit = 0;

    if (nextRound === 2) {
      // Round 2: Survival or Hunt
      const options = Math.random() < 0.5 ? SURVIVAL_LEVELS : HUNT_LEVELS;
      nextLevelId = options[Math.floor(Math.random() * options.length)];
      nextType = nextLevelId.startsWith('survival') ? 'SURVIVAL' : 'HUNT';
      nextObjective = nextType === 'SURVIVAL' ? 'Survive until the timer runs out!' : 'Collect stars to rank in top 6!';
      nextLimit = 6; // Top 6 qualify
      timeLimit = nextType === 'SURVIVAL' ? 25 : 30; // 25s for survival, 30s for hunt
    } else if (nextRound === 3) {
      // Round 3: Logic or Hunt
      const options = Math.random() < 0.5 ? LOGIC_LEVELS : HUNT_LEVELS;
      nextLevelId = options[Math.floor(Math.random() * options.length)];
      nextType = nextLevelId.startsWith('logic') ? 'LOGIC' : 'HUNT';
      nextObjective = nextType === 'LOGIC' ? 'Avoid the fake blocks when the timer ends!' : 'Collect stars to rank in top 4!';
      nextLimit = 4; // Top 4 qualify
      timeLimit = nextType === 'LOGIC' ? 30 : 30;
    } else if (nextRound === 4) {
      // Round 4: Final
      nextLevelId = FINAL_LEVELS[Math.floor(Math.random() * FINAL_LEVELS.length)];
      nextType = 'FINAL';
      nextObjective = nextLevelId === 'final_1' ? 'Be the last survivor standing!' : 'Climb to the summit and grab the crown!';
      nextLimit = 1; // 1 Winner
      timeLimit = nextLevelId === 'final_1' ? 40 : 0; // Honeycomb is time-limited survival
    }

    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const spawnPoint = SPAWN_POINTS[nextLevelId] || [0, 4, 0];

    set({
      currentRound: nextRound,
      currentLevelId: nextLevelId,
      currentLevelType: nextType,
      roundObjective: nextObjective,
      botQualifyingLimit: nextLimit,
      roundTimeLimit: timeLimit,
      roundTimer: timeLimit,
      activeBots: nextBots,
      playerQualified: false,
      winnersList: [],
      scores: {},
      racerProgress: {},
      lastCheckpoint: spawnPoint,
      visualTheme: theme,
      levelSeed: Math.random(),
      phase: 'ROUND_INTRO',
      startTime: null,
      timeElapsed: 0,
    });
  },

  resetTournament: () => {
    set({
      tournamentActive: false,
      currentRound: 1,
      winnersList: [],
      activeBots: [],
      scores: {},
      racerProgress: {},
      phase: 'MENU',
    });
  },

  passCheckpoint: (position) => {
    const current = get().lastCheckpoint;
    if (!current || current[0] !== position[0] || current[2] !== position[2]) {
      set({ lastCheckpoint: position });
    }
  },

  triggerWin: () => {
    if (!get().tournamentActive) {
      set({
        phase: 'QUALIFIED',
        wins: get().wins + 1,
        playerQualified: true,
      });
      get().unlockNextLevel();
    } else {
      get().qualifyRacer('player');
    }
  },

  triggerLoss: () => {
    if (!get().tournamentActive) {
      set({
        phase: 'GAMEOVER',
        failures: get().failures + 1,
      });
    } else {
      get().eliminateRacer('player');
    }
  },

  setVolume: (type, value) => set((state) => {
    const val = Math.max(0, Math.min(1.0, value));
    if (type === 'master') {
      localStorage.setItem('chaorunners_vol_master', val.toString());
      return { masterVolume: val };
    } else if (type === 'music') {
      localStorage.setItem('chaorunners_vol_music', val.toString());
      return { musicVolume: val };
    } else {
      localStorage.setItem('chaorunners_vol_sfx', val.toString());
      return { sfxVolume: val };
    }
  }),

  toggleMute: (type) => set((state) => {
    if (type === 'music') {
      const nextVal = !state.musicMuted;
      localStorage.setItem('chaorunners_mute_music', nextVal.toString());
      return { musicMuted: nextVal };
    } else {
      const nextVal = !state.sfxMuted;
      localStorage.setItem('chaorunners_mute_sfx', nextVal.toString());
      return { sfxMuted: nextVal };
    }
  }),

  tick: () => {
    const { startTime, phase, roundTimeLimit, currentLevelType } = get();
    if (phase === 'PLAYING' && startTime) {
      const elapsed = (Date.now() - startTime) / 1000;
      let nextTimer = 0;

      if (roundTimeLimit > 0) {
        nextTimer = Math.max(0, roundTimeLimit - elapsed);
        
        // Handle time expiration for Survival / Logic / Hunt levels
        if (nextTimer <= 0) {
          // Round finished due to timer expiration!
          const { activeBots, scores, playerQualified, winnersList, botQualifyingLimit } = get();
          
          if (currentLevelType === 'SURVIVAL' || currentLevelType === 'LOGIC') {
            // Everyone still in the arena qualifies!
            const playerOk = true; // Player survived!
            const botIds = activeBots.map(b => b.id);
            set({
              playerQualified: playerOk,
              winnersList: [...winnersList, 'player', ...botIds],
              phase: 'ROUND_OUTCOME',
            });
          } else if (currentLevelType === 'HUNT') {
            // Qualify the top players by score
            const racers = [
              { id: 'player', score: scores['player'] || 0 },
              ...activeBots.map(b => ({ id: b.id, score: scores[b.id] || 0 }))
            ];
            racers.sort((a, b) => b.score - a.score);
            
            const qualifiers = racers.slice(0, botQualifyingLimit).map(r => r.id);
            const playerOk = qualifiers.includes('player');
            
            set({
              playerQualified: playerOk,
              winnersList: qualifiers,
              phase: playerOk ? 'ROUND_OUTCOME' : 'GAMEOVER',
              failures: playerOk ? get().failures : get().failures + 1,
            });
          } else if (currentLevelType === 'FINAL') {
            // Honeycomb Collapse time-out: last standing player or whoever is highest height or random survivor wins
            const playerOk = true;
            set({
              phase: 'VICTORY',
              wins: get().wins + 1,
            });
          }
        }
      }

      set({ 
        timeElapsed: elapsed,
        roundTimer: nextTimer,
      });
    }
  },

  startGame: () => {
    const levelIdx = get().currentLevelIndex;
    const raceLevels = ['race_1', 'race_2', 'race_3', 'race_1', 'race_2'];
    const levelId = raceLevels[levelIdx] || 'race_1';
    const nextTheme = THEMES[levelIdx % THEMES.length] || 'SKY_BLUE';
    const nextSeed = Math.random();
    const spawnPoint = SPAWN_POINTS[levelId] || [0, 4, 0];

    // Seed 9 bots
    const botNames = generateBotNames(9, get().playerName);
    const botColors = ['#ffd60a', '#39ff14', '#00e5ff', '#ff6700', '#bd00ff', '#ff0055', '#00ffc4', '#ff7da7', '#a8ff00'];
    const accessories = ['none', 'crown', 'party', 'glasses'];
    const difficulties: ('EASY' | 'MEDIUM' | 'HARD')[] = ['EASY', 'MEDIUM', 'HARD', 'EASY', 'MEDIUM', 'MEDIUM', 'EASY', 'MEDIUM', 'HARD'];
    const seededBots = Array.from({ length: 9 }, (_, i) => ({
      id: `bot_${i}`,
      name: botNames[i] || `Runner_${i}`,
      color: botColors[i % botColors.length],
      accessory: accessories[Math.floor(Math.random() * accessories.length)],
      difficulty: difficulties[i % difficulties.length],
    }));

    set({
      phase: 'PLAYING',
      tournamentActive: false,
      currentLevelId: levelId,
      currentLevelType: 'RACE',
      roundObjective: 'Reach the finish line!',
      botQualifyingLimit: 8,
      playerQualified: false,
      winnersList: [],
      scores: {},
      racerProgress: {},
      lastCheckpoint: spawnPoint,
      visualTheme: nextTheme,
      levelSeed: nextSeed,
      startTime: Date.now(),
      timeElapsed: 0,
      activeBots: seededBots,
    });
  },

  selectLevel: (index) => {
    const sanitizedIndex = Math.max(0, Math.min(4, index));
    const raceLevels = ['race_1', 'race_2', 'race_3', 'race_1', 'race_2']; // Map indices to valid level ids
    set({ 
      currentLevelIndex: sanitizedIndex,
      currentLevelId: raceLevels[sanitizedIndex] || 'race_1'
    });
  },

  unlockNextLevel: () => set((state) => {
    const nextMax = Math.min(4, state.maxLevelUnlocked + 1);
    localStorage.setItem('chaorunners_max_unlocked', nextMax.toString());
    return { maxLevelUnlocked: nextMax };
  }),
}));
