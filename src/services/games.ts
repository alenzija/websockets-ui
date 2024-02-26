import { UsersService } from 'services';
import { Game, Room } from 'types';

export const games: Record<string, Game> = {};

export const getGameById = (gameId: string | number) => games[gameId];

export const createGame = (room: Room) => {
  if (!room.users[0] || !room.users[1]) {
    return;
  }

  const firstPlayerID = Date.now();
  const secondPlayerID = Date.now() + 1;

  const game = {
    id: Date.now(),
    players: [
      {
        id: firstPlayerID,
        userName: room.users[0],
        steps: [],
        countKilledShips: 0,
      },
      {
        id: secondPlayerID,
        userName: room.users[1],
        steps: [],
        countKilledShips: 0,
      },
    ],
    roomId: room.id,
    currentPlayerId: firstPlayerID,
  };

  games[game.id] = game;
  return game;
};

export const getPlayerById = (game: Game, playerId: string | number) => {
  return game.players.find((player) => player.id === playerId);
};

export const notifyAllPlayers = (game: Game, message: string) => {
  game.players.forEach((player) => {
    UsersService.getUserByName(player.userName)?.wsRef.send(message);
  });
};
