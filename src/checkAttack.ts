import { Ship } from 'http_server';

type AttackStatus = 'killed' | 'miss' | 'shot';

export const checkAttack = (x: number, y: number, ships: Ship[]) => {
  for (let i = 0; i < ships.length; i += 1) {
    const ship = ships[i];
    if (!ship) {
      return 'miss';
    }
    const { direction, position, length } = ship;
    if (direction) {
      if (x === position.x && y >= position.y && y <= position.y + length - 1) {
        ship.shots = (ship.shots || 0) + 1;
        if (ship.length === ship.shots) {
          return 'killed';
        }
        return 'shot';
      }
    } else {
      if (y === position.y && x >= position.x && x <= position.x + length - 1) {
        ship.shots = (ship.shots || 0) + 1;
        if (ship.length === ship.shots) {
          return 'killed';
        }
        return 'shot';
      }
    }
  }
  return 'miss';
};
