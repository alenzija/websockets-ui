import { GamesService, UsersService } from 'services';
import { Ship } from 'types';
import { MAX_USERS_IN_ROOM } from './addUserToRoom';

export type AddShipsCommandRequest = {
  type: 'add_ships';
  id: number;
  data: {
    gameId: string;
    indexPlayer: number;
    ships: Ship[];
  };
};

export type AddShipsCommandResponse = null;

export const addShipsCommand = (data: AddShipsCommandRequest['data']) => {
  const { gameId, indexPlayer } = data;
  const game = GamesService.getGameById(gameId);

  if (!game) {
    return;
  }

  const currentPlayer = game.players.find(
    (player) => player.id && +indexPlayer === +player.id,
  );

  if (!currentPlayer) {
    return;
  }

  currentPlayer.ships = data.ships;

  if (
    game.players.map((player) => player.ships).filter((ships) => ships)
      .length === MAX_USERS_IN_ROOM
  ) {
    game.players.forEach((player) => {
      UsersService.getUserByName(player.userName)?.wsRef?.send(
        JSON.stringify({
          type: 'start_game',
          data: JSON.stringify({
            ships: player.ships,
            currentPlayerIndex: player.id,
          }),
          id: 0,
        }),
      );
    });

    if (!game.players[0]) {
      return;
    }

    UsersService.getUserByName(game.players[0].userName)?.wsRef?.send(
      JSON.stringify({
        type: 'turn',
        data: JSON.stringify({
          currentPlayer: game.players[0].id,
        }),
        id: 0,
      }),
    );
  }
};
