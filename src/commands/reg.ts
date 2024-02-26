import { UsersService } from 'services';
import { WebSocket } from 'ws';

export type RegCommandRequest = {
  type: 'reg';
  id: number;
  data: {
    name: string;
    password: string;
  };
};

export type RegCommandResponse = {
  name: string;
  index: string | number;
  error: boolean;
  errorText: string;
};

export const regCommand = (
  data: RegCommandRequest['data'],
  index: string,
  wsRef: WebSocket,
) => {
  try {
    const user = UsersService.getOrCreateUser({
      ...data,
      index,
      wsRef,
    });
    return {
      name: user.name,
      index: user.index,
      error: false,
      errorText: '',
    };
  } catch (e) {
    return {
      name: data.name,
      index: '',
      error: true,
      errorText: e ? (e as Error).message : 'something went wrong',
    };
  }
};
