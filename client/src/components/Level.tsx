import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { Level1 } from './levels/Level1';
import { Survival1 } from './levels/SurvivalLevels';
import { Logic1 } from './levels/LogicLevels';
import { Level4 } from './levels/Level4';

export const Level: React.FC = () => {
  const currentLevelId = useGameStore((state) => state.currentLevelId);

  switch (currentLevelId) {
    case 'race_1':
      return <Level1 />;
    case 'survival_1':
      return <Survival1 />;
    case 'logic_1':
      return <Logic1 />;
    case 'survival_2':
      return <Level4 />;
    default:
      return <Level1 />;
  }
};
