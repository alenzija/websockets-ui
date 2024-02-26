import { GamesService, RoomsService, UsersService } from 'services';
import { User } from 'types';
import { WebSocket } from 'ws';

export type AddUserToRoomCommandRequest = {
  type: 'add_user_to_room';
  id: number;
  data: {
    indexRoom: string;
  };
};

export type AddUserToRoomCommandResponse = null;

export const MAX_USERS_IN_ROOM = 2;

export const addUserToRoomCommand = (
  data: AddUserToRoomCommandRequest['data'],
  wsRef: WebSocket,
  user?: User,
) => {
  const room = RoomsService.getRoomByIndex(data.indexRoom);
  if (
    room &&
    user &&
    room.users[0] &&
    room.users.length < MAX_USERS_IN_ROOM &&
    !RoomsService.isUserInRoom(room, user)
  ) {
    room.users.push(user.name);
    const game = GamesService.createGame(room);

    if (!game) {
      return;
    }

    wsRef.send(
      JSON.stringify({
        type: 'create_game',
        data: JSON.stringify({
          idGame: game.id,
          idPlayer: game.players[1]?.id,
        }),
        id: 0,
      }),
    );

    UsersService.getUserByName(room.users[0])?.wsRef?.send(
      JSON.stringify({
        type: 'create_game',
        data: JSON.stringify({
          idGame: game.id,
          idPlayer: game.players[0]?.id,
        }),
        id: 0,
      }),
    );
  }
};
