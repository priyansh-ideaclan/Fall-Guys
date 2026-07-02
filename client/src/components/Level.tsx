import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { Level1 } from './levels/Level1';
import { Level2 } from './levels/Level2';
import { Level3 } from './levels/Level3';
import { Level4 } from './levels/Level4';
import { Level5 } from './levels/Level5';
import { Survival1, Survival2 } from './levels/SurvivalLevels';
import { Logic1, Logic2 } from './levels/LogicLevels';
import { Hunt1 } from './levels/HuntLevels';
import { Final1, Final2 } from './levels/FinalLevels';

export const Level: React.FC = () => {
  const currentLevelId = useGameStore((state) => state.currentLevelId);

  switch (currentLevelId) {
    // Campaign level compatibility indices (0 to 4)
    case 'race_1':
      return <Level1 />;
    case 'race_2':
      return <Level2 />;
    case 'race_3':
      return <Level3 />;
    
    // Survival Category
    case 'survival_1':
      return <Survival1 />;
    case 'survival_2':
      return <Survival2 />;

    // Logic Category
    case 'logic_1':
      return <Logic1 />;
    case 'logic_2':
      return <Logic2 />;

    // Hunt Category
    case 'hunt_1':
      return <Hunt1 />;

    // Final Category
    case 'final_1':
      return <Final1 />;
    case 'final_2':
      return <Final2 />;

    // Fallbacks
    default:
      return <Level1 />;
  }
};
