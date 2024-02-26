import { Room, User } from 'types';

export const rooms: Record<string | number, Room> = {};

export const createRoom = (user?: User) => {
  const roomId = Date.now();
  rooms[roomId] = {
    id: roomId,
    users: user ? [user.name] : [],
  };
};

export const getRoomByIndex = (indexRoom: string) => {
  return rooms[indexRoom];
};

export const isUserInRoom = (room: Room, user: User) => {
  return room.users.some((userName) => userName === user.name);
};
