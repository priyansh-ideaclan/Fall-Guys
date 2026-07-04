import { useEffect, useState } from 'react';

export interface Controls {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  dive: boolean;
  grab: boolean;
  nitro: boolean;
}

export const useGameControls = () => {
  const [controls, setControls] = useState<Controls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    dive: false,
    grab: false,
    nitro: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      setControls((state) => {
        let changed = false;
        const next = { ...state };

        if (key === 'w' || e.key === 'ArrowUp') { next.forward = true; changed = true; }
        if (key === 's' || e.key === 'ArrowDown') { next.backward = true; changed = true; }
        if (key === 'a' || e.key === 'ArrowLeft') { next.left = true; changed = true; }
        if (key === 'd' || e.key === 'ArrowRight') { next.right = true; changed = true; }
        if (e.key === ' ') { next.jump = true; changed = true; }
        if (e.key === 'Shift') { next.nitro = true; changed = true; }
        if (key === 'c' || e.key === 'Control') { next.dive = true; changed = true; }
        if (key === 'e') { next.grab = true; changed = true; }

        return changed ? next : state;
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      setControls((state) => {
        let changed = false;
        const next = { ...state };

        if (key === 'w' || e.key === 'ArrowUp') { next.forward = false; changed = true; }
        if (key === 's' || e.key === 'ArrowDown') { next.backward = false; changed = true; }
        if (key === 'a' || e.key === 'ArrowLeft') { next.left = false; changed = true; }
        if (key === 'd' || e.key === 'ArrowRight') { next.right = false; changed = true; }
        if (e.key === ' ') { next.jump = false; changed = true; }
        if (e.key === 'Shift') { next.nitro = false; changed = true; }
        if (key === 'c' || e.key === 'Control') { next.dive = false; changed = true; }
        if (key === 'e') { next.grab = false; changed = true; }

        return changed ? next : state;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return controls;
};
