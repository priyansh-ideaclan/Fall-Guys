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
  cinematicActive: boolean;

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
  showDebugCheckpoints: boolean;
  splashes: Array<{ id: string; position: [number, number, number]; color: string }>;
  isNitroActive: boolean;
  nitroCooldown: number;
  setNitroActive: (active: boolean) => void;
  setNitroCooldown: (cooldown: number) => void;
  triggerNitro: () => void;
  tickNitro: (dt: number) => void;

  // Actions
  setPhase: (phase: GamePhase) => void;
  setCinematicActive: (active: boolean) => void;
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
  toggleDebugCheckpoints: () => void;
  triggerSplash: (position: [number, number, number], color?: string) => void;
}

const THEMES: VisualTheme[] = ['SKY_BLUE', 'SUNSET_ORANGE', 'PURPLE_NEON', 'CANDY_LAND', 'SPACE'];

// Starting spawn points for each level type
const SPAWN_POINTS: Record<string, [number, number, number]> = {
  // Race Levels
  'race_1': [0, 0.4, 0],
  'race_2': [0, 0.4, 0],
  'race_3': [0, 0.4, 0],
  // Survival Levels
  'survival_1': [0, 0.4, 0],
  'survival_2': [0, 0.4, 0],
  // Logic Levels
  'logic_1': [0, 2.1, -5.8],
  'logic_2': [0, 0.4, 0],
  // Hunt Levels
  'hunt_1': [0, 0.4, 0],
  // Final Levels
  'final_1': [0, 9.8, 0],
  'final_2': [0, 0.4, 0],
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

// Fixed 5-round tournament progression
// Round: 1=Race, 2=Survival, 3=Logic, 4=Hunt, 5=Final
const ROUND_PROGRESSION: Array<{
  levelId: string;
  type: LevelType;
  objective: string;
  qualifyLimit: number;
  timeLimit: number;
}> = [
  {
    levelId: 'race_1',
    type: 'RACE',
    objective: 'Reach the finish line before slots fill up!',
    qualifyLimit: 8,
    timeLimit: 0,
  },
  {
    levelId: 'survival_1',
    type: 'SURVIVAL',
    objective: 'Stay alive on the spinning arena! Don\u0027t fall off!',
    qualifyLimit: 6,
    timeLimit: 30,
  },
  {
    levelId: 'logic_1',
    type: 'LOGIC',
    objective: 'Stand on the correct color tile before the wrong ones drop!',
    qualifyLimit: 4,
    timeLimit: 42,
  },
  {
    levelId: 'hunt_1',
    type: 'HUNT',
    objective: 'Collect the most stars — top 3 advance to the Final!',
    qualifyLimit: 3,
    timeLimit: 35,
  },
  {
    levelId: 'final_2',
    type: 'FINAL',
    objective: 'Climb to the summit and grab the Crown — last one standing wins!',
    qualifyLimit: 1,
    timeLimit: 0,
  },
];

// Map legacy level select index (0-4) to unique mode level IDs
const CAMPAIGN_LEVEL_IDS = ['race_1', 'survival_1', 'logic_1', 'hunt_1', 'final_2'];

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
  cinematicActive: false,

  levelSeed: 0.5,
  visualTheme: 'SKY_BLUE',
  racerProgress: {},

  // Legacy campaign defaults
  currentLevelIndex: 0,
  maxLevelUnlocked: 4, // DEV: all levels unlocked for testing
  qualifiedBots: [],
  eliminatedBots: [],

  // Audio settings
  masterVolume: getStoredNumber('chaorunners_vol_master', 1.0),
  musicVolume: getStoredNumber('chaorunners_vol_music', 0.6),
  sfxVolume: getStoredNumber('chaorunners_vol_sfx', 0.7),
  musicMuted: getStoredBoolean('chaorunners_mute_music', false),
  sfxMuted: getStoredBoolean('chaorunners_mute_sfx', false),
  showDebugCheckpoints: false,
  splashes: [],
  isNitroActive: false,
  nitroCooldown: 0,

  setPhase: (phase) => set({ phase }),
  setCinematicActive: (active) => set({ cinematicActive: active }),

  setPlayerName: (name) => {
    const trimmed = name.trim();
    localStorage.setItem('chaorunners_player_name', trimmed);
    set({ playerName: trimmed });
  },
  toggleDebugCheckpoints: () => set((state) => ({ showDebugCheckpoints: !state.showDebugCheckpoints })),
  triggerSplash: (position, color = '#39ff14') => {
    const id = Math.random().toString();
    set((state) => ({ splashes: [...state.splashes, { id, position, color }] }));
    setTimeout(() => {
      set((state) => ({ splashes: state.splashes.filter((s) => s.id !== id) }));
    }, 1000);
  },
  setNitroActive: (active) => set({ isNitroActive: active }),
  setNitroCooldown: (cooldown) => set({ nitroCooldown: cooldown }),
  triggerNitro: () => {
    const state = useGameStore.getState();
    if (state.nitroCooldown > 0 || state.isNitroActive || state.phase !== 'PLAYING') return;
    set({ isNitroActive: true, nitroCooldown: 5.0 });
  },
  tickNitro: (dt) => {
    set((state) => {
      let nextCooldown = state.nitroCooldown - dt;
      if (nextCooldown < 0) nextCooldown = 0;
      let nextActive = state.isNitroActive;
      if (state.isNitroActive && nextCooldown <= 4.0) {
        nextActive = false;
      }
      return {
        nitroCooldown: nextCooldown,
        isNitroActive: nextActive
      };
    });
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
      cinematicActive: true,
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

    // Filter surviving bots to only those who qualified this round
    const nextBots = activeBots.filter((bot) => winnersList.includes(bot.id));

    // Look up the fixed round configuration (rounds are 1-indexed; array is 0-indexed)
    const roundConfig = ROUND_PROGRESSION[nextRound - 1];

    // If no more rounds defined, it's already the end — shouldn't happen normally
    if (!roundConfig) {
      set({ phase: 'VICTORY', wins: get().wins + 1 });
      return;
    }

    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const spawnPoint = SPAWN_POINTS[roundConfig.levelId] || [0, 4, 0];

    set({
      currentRound: nextRound,
      currentLevelId: roundConfig.levelId,
      currentLevelType: roundConfig.type,
      roundObjective: roundConfig.objective,
      botQualifyingLimit: roundConfig.qualifyLimit,
      roundTimeLimit: roundConfig.timeLimit,
      roundTimer: roundConfig.timeLimit,
      activeBots: nextBots,
      playerQualified: false,
      winnersList: [],
      scores: {},
      racerProgress: {},
      eliminatedBots: [],
      lastCheckpoint: spawnPoint,
      visualTheme: theme,
      levelSeed: Math.random(),
      phase: 'ROUND_INTRO',
      cinematicActive: true,
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
    const levelId = CAMPAIGN_LEVEL_IDS[levelIdx] || 'race_1';
    const roundConfig = ROUND_PROGRESSION[levelIdx] || ROUND_PROGRESSION[0];
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
      phase: 'ROUND_INTRO',
      cinematicActive: true,
      tournamentActive: false,
      currentLevelId: levelId,
      currentLevelType: roundConfig.type,
      roundObjective: roundConfig.objective,
      botQualifyingLimit: roundConfig.qualifyLimit,
      roundTimeLimit: roundConfig.timeLimit,
      roundTimer: roundConfig.timeLimit,
      playerQualified: false,
      winnersList: [],
      scores: {},
      racerProgress: {},
      eliminatedBots: [],
      lastCheckpoint: spawnPoint,
      visualTheme: nextTheme,
      levelSeed: nextSeed,
      startTime: null,
      timeElapsed: 0,
      activeBots: seededBots,
    });
  },

  selectLevel: (index) => {
    const sanitizedIndex = Math.max(0, Math.min(4, index));
    const levelId = CAMPAIGN_LEVEL_IDS[sanitizedIndex] || 'race_1';
    set({ 
      currentLevelIndex: sanitizedIndex,
      currentLevelId: levelId,
    });
  },

  unlockNextLevel: () => set((state) => {
    const nextMax = Math.min(4, state.maxLevelUnlocked + 1);
    localStorage.setItem('chaorunners_max_unlocked', nextMax.toString());
    return { maxLevelUnlocked: nextMax };
  }),
}));
