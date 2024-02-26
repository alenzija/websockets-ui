import { RoomsService } from 'services';
import { User } from 'types';

export type CreateRoomCommandRequest = {
  type: 'create_room';
  id: number;
  data: string;
};

export type CreateRoomCommandResponse = null;

export const createRoomCommand = (user?: User) => {
  RoomsService.createRoom(user);
};
