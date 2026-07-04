import React, { useMemo } from 'react';
import { Bot } from './Bot';
import { useGameStore } from '../store/useGameStore';

export const BotManager: React.FC = () => {
  const phase = useGameStore((state) => state.phase);
  const currentLevelId = useGameStore((state) => state.currentLevelId);
  const activeBots = useGameStore((state) => state.activeBots);

  const botsList = useMemo(() => {
    return activeBots.map((bot, i) => {
      // Y height varies based on level spawn deck
      let spawnHeight = 0.4;
      if (currentLevelId === 'final_1') {
        spawnHeight = 9.8;
      } else if (currentLevelId === 'logic_1') {
        spawnHeight = 2.1;
      }

      // Distribute bots in a grid behind and next to the player centered around X = 0
      let spawnPos: [number, number, number] = [0, spawnHeight, 0];
      if (i === 0) spawnPos = [-1.5, spawnHeight, 0];
      else if (i === 1) spawnPos = [1.5, spawnHeight, 0];
      else if (i === 2) spawnPos = [-1.8, spawnHeight, -1.5];
      else if (i === 3) spawnPos = [-0.6, spawnHeight, -1.5];
      else if (i === 4) spawnPos = [0.6, spawnHeight, -1.5];
      else if (i === 5) spawnPos = [1.8, spawnHeight, -1.5];
      else if (i === 6) spawnPos = [-1.2, spawnHeight, -3.0];
      else if (i === 7) spawnPos = [0.0, spawnHeight, -3.0];
      else if (i === 8) spawnPos = [1.2, spawnHeight, -3.0];

      return {
        ...bot,
        spawnPos,
      };
    });
  }, [currentLevelId, phase, activeBots]);

  if (phase === 'MENU') return null;

  return (
    <group name="bot-manager">
      {botsList.map((bot) => (
        <Bot key={bot.id} {...bot} />
      ))}
    </group>
  );
};
