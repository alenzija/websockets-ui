import { Ship } from '../types';

export const checkAttack = (
  x: number,
  y: number,
  ships: Ship[],
  steps: { x: number; y: number }[],
) => {
  let flag = true;

  if (steps.some((step) => step.x === x && step.y === y)) {
    flag = false;
  } else {
    steps.push({ x, y });
    flag = true;
  }

  for (let i = 0; i < ships.length; i += 1) {
    const ship = ships[i];
    if (!ship) {
      return { status: 'miss' };
    }
    const { direction, position, length } = ship;
    if (direction) {
      if (x === position.x && y >= position.y && y <= position.y + length - 1) {
        if (flag) {
          ship.shots = (ship.shots || 0) + 1;
        }
        if (ship.length === ship.shots) {
          return { status: 'killed', ship };
        }
        return { status: 'shot' };
      }
    } else {
      if (y === position.y && x >= position.x && x <= position.x + length - 1) {
        if (flag) {
          ship.shots = (ship.shots || 0) + 1;
        }
        if (ship.length === ship.shots) {
          return { status: 'killed', ship };
        }
        return { status: 'shot' };
      }
    }
  }
  return { status: 'miss' };
};
