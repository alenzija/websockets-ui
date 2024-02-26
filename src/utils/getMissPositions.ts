import { Ship } from '../types';

export const getMissPositions = (ship: Ship) => {
  const result: { x: number; y: number }[] = [];
  const { direction, position, length } = ship;
  if (direction && position.x > 0) {
    for (let i = 0; i < length; i += 1) {
      result.push({
        x: position.x - 1,
        y: position.y + i,
      });
    }
    if (direction && position.x < 10) {
      for (let i = 0; i < length; i += 1) {
        result.push({
          x: position.x + 1,
          y: position.y + i,
        });
      }
      if (direction && position.y > 0) {
        result.push({
          x: position.x,
          y: position.y - 1,
        });
        if (position.x > 0) {
          result.push({
            x: ship.position.x - 1,
            y: ship.position.y - 1,
          });
        }
        if (position.x < 10) {
          result.push({
            x: ship.position.x + 1,
            y: ship.position.y - 1,
          });
        }
      }
    }
    if (direction && position.y + length - 1 < 10) {
      result.push({
        x: position.x,
        y: position.y + length,
      });
      if (position.x > 0) {
        result.push({
          x: position.x - 1,
          y: position.y + length,
        });
      }
      if (position.x < 10) {
        result.push({
          x: position.x + 1,
          y: position.y + length,
        });
      }
    }
  }
  // direction false
  if (!direction && position.y > 0) {
    for (let i = 0; i < length; i += 1) {
      result.push({
        x: position.x + i,
        y: position.y - 1,
      });
    }
  }
  if (!direction && position.y < 10) {
    for (let i = 0; i < length; i += 1) {
      result.push({
        x: position.x + i,
        y: position.y + 1,
      });
    }
  }
  if (!direction && position.x > 0) {
    result.push({
      x: position.x - 1,
      y: position.y,
    });
    if (position.y > 0) {
      result.push({
        x: ship.position.x - 1,
        y: ship.position.y - 1,
      });
    }
    if (position.y < 10) {
      result.push({
        x: ship.position.x - 1,
        y: ship.position.y + 1,
      });
    }
  }
  if (!direction && position.x + length - 1 < 10) {
    result.push({
      x: position.x + length,
      y: position.y,
    });
    if (position.y > 0) {
      result.push({
        x: position.x + length,
        y: position.y - 1,
      });
    }
    if (position.y < 10) {
      result.push({
        x: position.x + length,
        y: position.y + 1,
      });
    }
  }
  return result;
};
