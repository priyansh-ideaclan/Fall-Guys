import { create } from 'zustand';
import { generateBotNames } from '../utils/botNames';

function computeSurvivalWinners(
  activeBots: BotRacer[],
  eliminationOrder: string[],
  racerProgress: Record<string, RacerProgress>,
  playerAlive: boolean
): string[] {
  const survivors = [
    ...(playerAlive ? ['player'] : []),
    ...activeBots.map(b => b.id)
  ];
  
  // Sort survivors by distanceToCenter (ascending)
  survivors.sort((a, b) => {
    const distA = racerProgress[a]?.distanceToCenter ?? 999;
    const distB = racerProgress[b]?.distanceToCenter ?? 999;
    return distA - distB;
  });

  // Eliminated in reverse order (last to die gets highest rank)
  const eliminated = [...eliminationOrder].reverse();

  return [...survivors, ...eliminated];
}

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
  distanceToCenter?: number;
  survivalDuration?: number;
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
  eliminationOrder: string[]; // Order of racer IDs eliminated this round
  activeBots: BotRacer[]; // Surviving bots in the tournament
  botQualifyingLimit: number;
  playerQualified: boolean;
  cinematicActive: boolean;
  isPlayerEliminated: boolean;

  // Spectator Mode
  isSpectating: boolean;
  spectatingBotId: string | null;

  // Legacy campaign variables
  currentLevelIndex: number;
  maxLevelUnlocked: number;
  unlockAllLevels: boolean;
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
  weatherVolume: number;
  uiVolume: number;
  weatherMuted: boolean;
  uiMuted: boolean;
  showDebugCheckpoints: boolean;
  devModeEnabled: boolean;
  setDevModeEnabled: (enabled: boolean) => void;
  devLandmarkIndex: number;
  devLandmarkDistance: number;
  devShowDetails: boolean;
  isGodMode: boolean;
  setDevLandmarkInfo: (index: number, distance: number) => void;
  toggleDevShowDetails: () => void;
  toggleGodMode: () => void;
  splashes: Array<{ id: string; position: [number, number, number]; color: string }>;
  gameDifficulty: 'EASY' | 'MEDIUM' | 'HARD';
  setGameDifficulty: (diff: 'EASY' | 'MEDIUM' | 'HARD') => void;
  isNitroActive: boolean;
  nitroCooldown: number;
  setNitroActive: (active: boolean) => void;
  setNitroCooldown: (cooldown: number) => void;
  triggerNitro: () => void;
  tickNitro: (dt: number) => void;

  isPlayerSliding: boolean;
  setPlayerSliding: (sliding: boolean) => void;

  cameraShake: number;
  triggerCameraShake: (amount: number) => void;
  tickCameraShake: (dt: number) => void;

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
  setVolume: (type: 'master' | 'music' | 'sfx' | 'weather' | 'ui', value: number) => void;
  toggleMute: (type: 'music' | 'sfx' | 'weather' | 'ui') => void;

  // Legacy campaign actions
  startGame: () => void;
  selectLevel: (index: number) => void;
  unlockNextLevel: () => void;
  setUnlockAllLevels: (val: boolean) => void;
  toggleDebugCheckpoints: () => void;
  botsEnabled: boolean;
  toggleBots: () => void;
  triggerSplash: (position: [number, number, number], color?: string) => void;

  // Spectator actions
  enterSpectatorMode: () => void;
  exitSpectatorMode: () => void;
  spectateNext: () => void;
  spectatePrev: () => void;
  setSpectatingBotId: (id: string) => void;
}

const THEMES: VisualTheme[] = ['SKY_BLUE', 'SUNSET_ORANGE', 'PURPLE_NEON', 'CANDY_LAND', 'SPACE'];

// Starting spawn points for each level type
const SPAWN_POINTS: Record<string, [number, number, number]> = {
  'race_1': [0, 0.4, 0],
  'survival_1': [0, 1.2, 5.5],
  'survival_2': [0, 8.5, 2.4],
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
const RACE_LEVELS = ['race_1'];
const SURVIVAL_LEVELS = ['survival_1', 'survival_2'];
const LOGIC_LEVELS: string[] = [];
const HUNT_LEVELS: string[] = [];
const FINAL_LEVELS: string[] = [];

// Fixed 3-round tournament progression
// Round: 1=Race (Jungle Sprint), 2=Survival (Spin Out), 3=Hex (Hex-A-Terrestrial, Final Showdown)
const ROUND_PROGRESSION: Array<{
  levelId: string;
  type: LevelType;
  objective: string;
  maxPlayers: number;
  qualifyLimit: number;
  timeLimit: number;
}> = [
  {
    levelId: 'race_1',
    type: 'RACE',
    objective: 'Jungle Sprint: Dash to the finish line across see-saws, wind blowers, and sliding beams!',
    maxPlayers: 12,
    qualifyLimit: 8,
    timeLimit: 0,
  },
  {
    levelId: 'survival_1',
    type: 'SURVIVAL',
    objective: 'Spin Out: Dodge the spinning log sweeps and stay on the rotating platform!',
    maxPlayers: 10,
    qualifyLimit: 5,
    timeLimit: 40,
  },
  {
    levelId: 'survival_2',
    type: 'FINAL',
    objective: 'Hex-A-Terrestrial: Run, jump, and stay alive as the hexagonal tiles disintegrate beneath your feet!',
    maxPlayers: 8,
    qualifyLimit: 1, // Final round, only 1 winner!
    timeLimit: 90,
  },
];

// Map campaign level select index (0-2) to level IDs
const CAMPAIGN_LEVEL_IDS = ['race_1', 'survival_1', 'survival_2'];

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
  eliminationOrder: [],
  activeBots: [],
  botQualifyingLimit: 8,
  playerQualified: false,
  cinematicActive: false,
  isPlayerEliminated: false,

  // Spectator Mode defaults
  isSpectating: false,
  spectatingBotId: null,

  levelSeed: 0.5,
  visualTheme: 'SKY_BLUE',
  racerProgress: {},

  // Legacy campaign defaults
  currentLevelIndex: 0,
  maxLevelUnlocked: getStoredNumber('chaorunners_max_unlocked', 0),
  unlockAllLevels: getStoredBoolean('chaorunners_unlock_all', false),
  qualifiedBots: [],
  eliminatedBots: [],

  // Audio settings
  masterVolume: getStoredNumber('chaorunners_vol_master', 1.0),
  musicVolume: getStoredNumber('chaorunners_vol_music', 0.6),
  sfxVolume: getStoredNumber('chaorunners_vol_sfx', 0.7),
  musicMuted: getStoredBoolean('chaorunners_mute_music', false),
  sfxMuted: getStoredBoolean('chaorunners_mute_sfx', false),
  weatherVolume: getStoredNumber('chaorunners_vol_weather', 0.4),
  uiVolume: getStoredNumber('chaorunners_vol_ui', 0.7),
  weatherMuted: getStoredBoolean('chaorunners_mute_weather', false),
  uiMuted: getStoredBoolean('chaorunners_mute_ui', false),
  showDebugCheckpoints: false,
  devModeEnabled: getStoredBoolean('chaorunners_dev_mode_enabled', false),
  setDevModeEnabled: (enabled) => {
    localStorage.setItem('chaorunners_dev_mode_enabled', String(enabled));
    set({ devModeEnabled: enabled });
  },
  botsEnabled: getStoredBoolean('chaorunners_bots_enabled', true),
  devLandmarkIndex: -1,
  devLandmarkDistance: 0,
  devShowDetails: true,
  isGodMode: false,
  setDevLandmarkInfo: (index, distance) => set({ devLandmarkIndex: index, devLandmarkDistance: distance }),
  toggleDevShowDetails: () => set((state) => ({ devShowDetails: !state.devShowDetails })),
  toggleGodMode: () => set((state) => ({ isGodMode: !state.isGodMode })),
  splashes: [],
  gameDifficulty: 'MEDIUM',
  setGameDifficulty: (diff) => set({ gameDifficulty: diff }),
  isNitroActive: false,
  nitroCooldown: 0,
  isPlayerSliding: false,
  cameraShake: 0,

  setPhase: (phase) => set({ phase }),
  setCinematicActive: (active) => set({ cinematicActive: active }),

  setPlayerName: (name) => {
    const trimmed = name.trim();
    localStorage.setItem('chaorunners_player_name', trimmed);
    const isSuperTester = trimmed === 'Super Tester';
    // Auto-enable dev mode for Super Tester; reset all dev flags for everyone else
    if (isSuperTester) {
      localStorage.setItem('chaorunners_dev_mode_enabled', 'true');
    }
    set({
      playerName: trimmed,
      devModeEnabled: isSuperTester ? true : false,
      isGodMode: isSuperTester ? get().isGodMode : false,
      showDebugCheckpoints: isSuperTester ? get().showDebugCheckpoints : false,
    });
  },
  toggleDebugCheckpoints: () => set((state) => ({ showDebugCheckpoints: !state.showDebugCheckpoints })),
  toggleBots: () => set((state) => {
    const next = !state.botsEnabled;
    localStorage.setItem('chaorunners_bots_enabled', String(next));
    return { botsEnabled: next };
  }),
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
  setPlayerSliding: (sliding) => set({ isPlayerSliding: sliding }),

  triggerCameraShake: (amount) => set((state) => ({ cameraShake: Math.max(state.cameraShake, amount) })),
  tickCameraShake: (dt) => set((state) => ({ cameraShake: Math.max(0, state.cameraShake - dt * 2.8) })),

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

    // Seed 11 bots with unique names/colors/difficulties for 12 total players in Round 1
    const botNames = generateBotNames(11, get().playerName);
    const botColors = ['#ffd60a', '#39ff14', '#00e5ff', '#ff6700', '#bd00ff', '#ff0055', '#00ffc4', '#ff7da7', '#a8ff00', '#00ffc4', '#ff00ff'];
    const accessories = ['none', 'crown', 'party', 'glasses'];
    
    const currentMode = get().gameDifficulty;
    const difficulties: ('EASY' | 'MEDIUM' | 'HARD')[] = currentMode === 'EASY' 
      ? ['EASY', 'EASY', 'MEDIUM', 'EASY', 'EASY', 'EASY', 'MEDIUM', 'EASY', 'EASY', 'MEDIUM', 'EASY']
      : currentMode === 'HARD'
      ? ['HARD', 'HARD', 'MEDIUM', 'HARD', 'HARD', 'HARD', 'MEDIUM', 'HARD', 'HARD', 'MEDIUM', 'HARD']
      : ['EASY', 'MEDIUM', 'HARD', 'EASY', 'MEDIUM', 'MEDIUM', 'EASY', 'MEDIUM', 'HARD', 'MEDIUM', 'HARD'];

    const seededBots = Array.from({ length: 11 }, (_, i) => ({
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
      botQualifyingLimit: 8, // Top 8 qualify (for 8 players in Round 2)
      playerQualified: false,
      winnersList: [],
      eliminationOrder: [],
      scores: {},
      racerProgress: {},
      lastCheckpoint: spawnPoint,
      visualTheme: theme,
      levelSeed: Math.random(),
      phase: 'ROUND_INTRO',
      cinematicActive: true,
      isPlayerEliminated: false,
      isSpectating: false,
      spectatingBotId: null,
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

    if (state.currentLevelType === 'FINAL') {
      if (isPlayer) {
        nextPhase = 'VICTORY';
        nextWinsCount += 1;
      } else {
        // A bot won the final!
        nextPhase = 'GAMEOVER';
        nextFailuresCount += 1;
      }
    } else if (state.currentLevelType === 'RACE') {
      if (isPlayer) {
        nextWinsCount += 1;
      }
      if (limitReached) {
        nextPhase = playerOk ? (state.tournamentActive ? 'ROUND_OUTCOME' : 'QUALIFIED') : 'GAMEOVER';
        if (!playerOk) {
          nextFailuresCount += 1;
        }
      }
    } else {
      if (!state.tournamentActive) {
        if (isPlayer) {
          nextPhase = 'QUALIFIED';
          nextWinsCount += 1;
        }
      } else if (limitReached) {
        nextPhase = 'ROUND_OUTCOME';
        if (!playerOk) {
          nextPhase = 'GAMEOVER';
          nextFailuresCount += 1;
        }
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

    const now = Date.now();
    const elapsed = state.startTime ? (now - state.startTime) / 1000 : 0;
    
    // Track elimination order
    const nextEliminationOrder = state.eliminationOrder.includes(id)
      ? state.eliminationOrder
      : [...state.eliminationOrder, id];

    // Update progress
    const currentProg = state.racerProgress[id];
    const nextProg = currentProg
      ? { ...currentProg, finished: true, finishTime: now, survivalDuration: elapsed }
      : { id, name: id === 'player' ? (state.playerName || 'You') : id, progressValue: 0, yPos: 0, score: 0, finished: true, finishTime: now, survivalDuration: elapsed };
    const nextProgress = { ...state.racerProgress, [id]: nextProg };

    if (id === 'player') {
      const isSurvival = state.currentLevelId === 'survival_1' || state.currentLevelId === 'survival_2';
      if (isSurvival) {
        const totalRemainingBots = state.activeBots.length;
        if (state.currentLevelId === 'survival_1') {
          if (totalRemainingBots <= state.botQualifyingLimit) {
            const finalWinners = computeSurvivalWinners(state.activeBots, nextEliminationOrder, nextProgress, false);
            const qualifiers = finalWinners.slice(0, state.botQualifyingLimit);
            return {
              isPlayerEliminated: true,
              eliminationOrder: nextEliminationOrder,
              racerProgress: nextProgress,
              winnersList: qualifiers,
              phase: 'GAMEOVER',
              failures: state.failures + 1
            };
          }
        } else if (state.currentLevelId === 'survival_2') {
          if (totalRemainingBots <= 1) {
            return {
              isPlayerEliminated: true,
              eliminationOrder: nextEliminationOrder,
              racerProgress: nextProgress,
              winnersList: [],
              phase: 'GAMEOVER',
              failures: state.failures + 1
            };
          }
        }
        return {
          isPlayerEliminated: true,
          eliminationOrder: nextEliminationOrder,
          racerProgress: nextProgress,
        };
      }
      return {
        phase: 'GAMEOVER',
        failures: state.failures + 1,
        eliminationOrder: nextEliminationOrder,
        racerProgress: nextProgress,
      };
    }

    // Bots just get filtered out
    const nextBots = state.activeBots.filter(b => b.id !== id);
    const nextEliminated = [...state.eliminatedBots, id];

    if (state.currentLevelId === 'survival_1') {
      const playerAlive = !state.isPlayerEliminated;
      const totalRemaining = nextBots.length + (playerAlive ? 1 : 0);

      // If survivors count drops below or equals the qualify limit, end early!
      if (totalRemaining <= state.botQualifyingLimit && totalRemaining > 0) {
        const finalWinners = computeSurvivalWinners(nextBots, nextEliminationOrder, nextProgress, playerAlive);
        const qualifiers = finalWinners.slice(0, state.botQualifyingLimit);
        const playerOk = qualifiers.includes('player');
        
        return {
          activeBots: nextBots,
          eliminatedBots: nextEliminated,
          eliminationOrder: nextEliminationOrder,
          racerProgress: nextProgress,
          playerQualified: playerOk,
          winnersList: qualifiers,
          phase: playerOk ? 'ROUND_OUTCOME' : 'GAMEOVER',
          failures: playerOk ? state.failures : state.failures + 1,
        };
      }

      if (totalRemaining === 0) {
        const finalWinners = computeSurvivalWinners(nextBots, nextEliminationOrder, nextProgress, false);
        const qualifiers = finalWinners.slice(0, state.botQualifyingLimit);
        return {
          activeBots: nextBots,
          eliminatedBots: nextEliminated,
          eliminationOrder: nextEliminationOrder,
          racerProgress: nextProgress,
          winnersList: qualifiers,
          phase: 'GAMEOVER',
          failures: state.failures + 1
        };
      }

      return {
        activeBots: nextBots,
        eliminatedBots: nextEliminated,
        eliminationOrder: nextEliminationOrder,
        racerProgress: nextProgress,
      };
    }

    if (state.currentLevelId === 'survival_2') {
      const playerAlive = !state.isPlayerEliminated;
      const totalRemaining = nextBots.length + (playerAlive ? 1 : 0);

      if (totalRemaining === 1) {
        if (playerAlive) {
          const nextPhase = state.tournamentActive ? 'VICTORY' : 'QUALIFIED';
          return {
            activeBots: nextBots,
            eliminatedBots: nextEliminated,
            eliminationOrder: nextEliminationOrder,
            racerProgress: nextProgress,
            playerQualified: true,
            winnersList: ['player'],
            phase: nextPhase,
            wins: nextPhase === 'VICTORY' || nextPhase === 'QUALIFIED' ? state.wins + 1 : state.wins
          };
        } else {
          return {
            activeBots: nextBots,
            eliminatedBots: nextEliminated,
            eliminationOrder: nextEliminationOrder,
            racerProgress: nextProgress,
            phase: 'GAMEOVER',
            failures: state.failures + 1
          };
        }
      } else if (totalRemaining === 0) {
        return {
          activeBots: nextBots,
          eliminatedBots: nextEliminated,
          eliminationOrder: nextEliminationOrder,
          racerProgress: nextProgress,
          phase: 'GAMEOVER',
          failures: state.failures + 1
        };
      }
    }

    return {
      activeBots: nextBots,
      eliminatedBots: nextEliminated,
      eliminationOrder: nextEliminationOrder,
      racerProgress: nextProgress,
    };
  }),

  advanceToNextRound: () => {
    const { currentRound, winnersList, activeBots, tournamentActive } = get();
    if (!tournamentActive) {
      set({ phase: 'MENU' });
      return;
    }
    const nextRound = currentRound + 1;

    // Look up the fixed round configuration (rounds are 1-indexed; array is 0-indexed)
    const roundConfig = ROUND_PROGRESSION[nextRound - 1];

    // If no more rounds defined, it's already the end — shouldn't happen normally
    if (!roundConfig) {
      set({ phase: 'VICTORY', wins: get().wins + 1 });
      return;
    }

    // Filter surviving bots to only those who qualified this round
    let nextBots = activeBots.filter((bot) => winnersList.includes(bot.id));
    const maxBotsAllowed = roundConfig.maxPlayers - 1;
    if (nextBots.length > maxBotsAllowed) {
      nextBots = nextBots.slice(0, maxBotsAllowed);
    }

    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const spawnPoint = SPAWN_POINTS[roundConfig.levelId] || [0, 4, 0];

    let nextQualifyLimit = roundConfig.qualifyLimit;
    if (get().tournamentActive && nextRound === 2) {
      nextQualifyLimit = 4; // 4 qualify in Round 2 when progressed from Round 1 (8 total players)
    }

    set({
      currentRound: nextRound,
      currentLevelId: roundConfig.levelId,
      currentLevelType: roundConfig.type,
      roundObjective: roundConfig.objective,
      botQualifyingLimit: nextQualifyLimit,
      roundTimeLimit: roundConfig.timeLimit,
      roundTimer: roundConfig.timeLimit,
      activeBots: nextBots,
      playerQualified: false,
      winnersList: [],
      eliminationOrder: [],
      scores: {},
      racerProgress: {},
      eliminatedBots: [],
      lastCheckpoint: spawnPoint,
      visualTheme: theme,
      levelSeed: Math.random(),
      phase: 'ROUND_INTRO',
      cinematicActive: true,
      isPlayerEliminated: false,
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
    get().qualifyRacer('player');
    if (!get().tournamentActive) {
      get().unlockNextLevel();
    }
  },

  triggerLoss: () => {
    get().eliminateRacer('player');
  },

  setVolume: (type, value) => set((state) => {
    const val = Math.max(0, Math.min(1.0, value));
    if (type === 'master') {
      localStorage.setItem('chaorunners_vol_master', val.toString());
      return { masterVolume: val };
    } else if (type === 'music') {
      localStorage.setItem('chaorunners_vol_music', val.toString());
      return { musicVolume: val };
    } else if (type === 'weather') {
      localStorage.setItem('chaorunners_vol_weather', val.toString());
      return { weatherVolume: val };
    } else if (type === 'ui') {
      localStorage.setItem('chaorunners_vol_ui', val.toString());
      return { uiVolume: val };
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
    } else if (type === 'weather') {
      const nextVal = !state.weatherMuted;
      localStorage.setItem('chaorunners_mute_weather', nextVal.toString());
      return { weatherMuted: nextVal };
    } else if (type === 'ui') {
      const nextVal = !state.uiMuted;
      localStorage.setItem('chaorunners_mute_ui', nextVal.toString());
      return { uiMuted: nextVal };
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
            if (get().currentLevelId === 'survival_2') {
              const playerAlive = !get().isPlayerEliminated;
              const nextPhase = playerAlive ? (get().tournamentActive ? 'VICTORY' : 'QUALIFIED') : 'GAMEOVER';
              set({
                playerQualified: playerAlive,
                winnersList: playerAlive ? ['player'] : [],
                phase: nextPhase,
                wins: playerAlive ? get().wins + 1 : get().wins,
                failures: playerAlive ? get().failures : get().failures + 1
              });
            } else {
              // Top remaining survivors qualify up to the qualify limit!
              const playerOk = !get().isPlayerEliminated;
              const finalWinners = computeSurvivalWinners(activeBots, get().eliminationOrder, get().racerProgress, playerOk);
              const qualifiers = finalWinners.slice(0, botQualifyingLimit);
              const playerQualifiedState = qualifiers.includes('player');
              set({
                playerQualified: playerQualifiedState,
                winnersList: qualifiers,
                phase: playerQualifiedState ? 'ROUND_OUTCOME' : 'GAMEOVER',
                failures: playerQualifiedState ? get().failures : get().failures + 1,
              });
            }
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
          } else if (currentLevelType === 'RACE') {
            const playerOk = get().playerQualified;
            const nextPhase = playerOk ? (get().tournamentActive ? 'ROUND_OUTCOME' : 'QUALIFIED') : 'GAMEOVER';
            set({
              phase: nextPhase,
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

    // Seed bots matching the user's player limits for each Round (1 human player + N bots)
    const numBots = roundConfig.maxPlayers - 1;

    const botNames = generateBotNames(numBots, get().playerName);
    const botColors = ['#ffd60a', '#39ff14', '#00e5ff', '#ff6700', '#bd00ff', '#ff0055', '#00ffc4', '#ff7da7', '#a8ff00', '#00ffc4', '#ff00ff'];
    const accessories = ['none', 'crown', 'party', 'glasses'];
    
    const currentMode = get().gameDifficulty;
    const difficulties: ('EASY' | 'MEDIUM' | 'HARD')[] = currentMode === 'EASY' 
      ? ['EASY', 'EASY', 'MEDIUM', 'EASY', 'EASY', 'EASY', 'MEDIUM', 'EASY', 'EASY', 'MEDIUM', 'EASY']
      : currentMode === 'HARD'
      ? ['HARD', 'HARD', 'MEDIUM', 'HARD', 'HARD', 'HARD', 'MEDIUM', 'HARD', 'HARD', 'MEDIUM', 'HARD']
      : ['EASY', 'MEDIUM', 'HARD', 'EASY', 'MEDIUM', 'MEDIUM', 'EASY', 'MEDIUM', 'HARD', 'MEDIUM', 'HARD'];

    const seededBots = Array.from({ length: numBots }, (_, i) => ({
      id: `bot_${i}`,
      name: botNames[i] || `Runner_${i}`,
      color: botColors[i % botColors.length],
      accessory: accessories[Math.floor(Math.random() * accessories.length)],
      difficulty: difficulties[i % difficulties.length],
    }));

    set({
      phase: 'ROUND_INTRO',
      cinematicActive: true,
      isPlayerEliminated: false,
      isSpectating: false,
      spectatingBotId: null,
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
    const sanitizedIndex = Math.max(0, Math.min(2, index));
    const levelId = CAMPAIGN_LEVEL_IDS[sanitizedIndex] || 'race_1';
    set({ 
      currentLevelIndex: sanitizedIndex,
      currentLevelId: levelId,
    });
  },

  unlockNextLevel: () => set((state) => {
    const nextMax = Math.min(2, state.maxLevelUnlocked + 1);
    localStorage.setItem('chaorunners_max_unlocked', nextMax.toString());
    return { maxLevelUnlocked: nextMax };
  }),

  setUnlockAllLevels: (val) => {
    localStorage.setItem('chaorunners_unlock_all', val.toString());
    set({ unlockAllLevels: val });
  },

  // ─── Spectator Mode actions ────────────────────────────────────────────
  enterSpectatorMode: () => {
    const { activeBots, currentLevelType, winnersList } = useGameStore.getState();
    const isRace = currentLevelType === 'RACE';
    const candidates = activeBots.filter((b) => !isRace || !winnersList.includes(b.id));
    if (candidates.length > 0) {
      set({ isSpectating: true, spectatingBotId: candidates[0].id });
    } else if (activeBots.length > 0) {
      set({ isSpectating: true, spectatingBotId: activeBots[0].id });
    }
  },

  exitSpectatorMode: () => {
    set({ isSpectating: false, spectatingBotId: null });
  },

  setSpectatingBotId: (id) => {
    set({ spectatingBotId: id });
  },

  spectateNext: () => {
    const { activeBots, spectatingBotId, currentLevelType, winnersList } = useGameStore.getState();
    if (activeBots.length === 0) return;
    const isRace = currentLevelType === 'RACE';
    const candidates = activeBots.filter((b) => !isRace || !winnersList.includes(b.id));
    if (candidates.length === 0) return;
    const currentIdx = candidates.findIndex((b) => b.id === spectatingBotId);
    const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % candidates.length;
    set({ spectatingBotId: candidates[nextIdx].id });
  },

  spectatePrev: () => {
    const { activeBots, spectatingBotId, currentLevelType, winnersList } = useGameStore.getState();
    if (activeBots.length === 0) return;
    const isRace = currentLevelType === 'RACE';
    const candidates = activeBots.filter((b) => !isRace || !winnersList.includes(b.id));
    if (candidates.length === 0) return;
    const currentIdx = candidates.findIndex((b) => b.id === spectatingBotId);
    const prevIdx = currentIdx === -1 ? 0 : (currentIdx - 1 + candidates.length) % candidates.length;
    set({ spectatingBotId: candidates[prevIdx].id });
  },
}));
