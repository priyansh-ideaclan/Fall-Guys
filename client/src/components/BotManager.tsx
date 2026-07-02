import React, { useMemo } from 'react';
import { Bot } from './Bot';
import { useGameStore } from '../store/useGameStore';

export const BotManager: React.FC = () => {
  const phase = useGameStore((state) => state.phase);
  const currentLevelId = useGameStore((state) => state.currentLevelId);
  const activeBots = useGameStore((state) => state.activeBots);

  const botsList = useMemo(() => {
    return activeBots.map((bot, i) => {
      // Distribute bots in a grid behind the player
      const row = Math.floor(i / 3); // 0, 1, 2
      const col = i % 3;             // 0, 1, 2

      // Y height varies based on level spawn deck
      const spawnHeight = currentLevelId === 'final_1' ? 9.8 : 4.0;

      const spawnPos: [number, number, number] = [
        (col - 1) * 1.3 + (Math.random() - 0.5) * 0.15,
        spawnHeight,
        -1.8 - row * 1.5
      ];

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
