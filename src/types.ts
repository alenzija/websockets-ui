import { WebSocket } from 'ws';

export type User = {
  name: string;
  password: string;
  index: string | number;
  wsRef: WebSocket;
};

export type Room = {
  id: string | number;
  users: User['name'][];
};

export type Ship = {
  position: {
    x: number;
    y: number;
  };
  direction: boolean;
  shots?: number;
  length: 1 | 2 | 3 | 4;
  type: 'small' | 'medium' | 'large' | 'huge';
};

export type Game = {
  id: number;
  players: {
    id?: string | number;
    userName: User['name'];
    ships?: Ship[];
    steps: { x: number; y: number }[];
    countKilledShips: number;
  }[];
  winner?: User['name'];
  roomId: number | string;
  currentPlayerId: string | number;
};
