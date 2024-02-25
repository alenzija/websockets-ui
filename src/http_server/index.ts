import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { checkAttack } from 'checkAttack';

// import WebSocket from 'ws';

// const wss = new WebSocket.Server({ port: 8080 });

export const httpServer = http.createServer(function (req, res) {
  const __dirname = path.resolve(path.dirname(''));
  const file_path =
    __dirname + (req.url === '/' ? '/front/index.html' : '/front' + req.url);
  fs.readFile(file_path, function (err, data) {
    if (err) {
      res.writeHead(404);
      res.end(JSON.stringify(err));
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
});

type User = {
  name: string;
  password: string;
  index: string | number;
  wsRef: WebSocket;
};

type Room = {
  id: string | number;
  name: string;
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

type Game = {
  id: number;
  players: {
    id: number;
    userName: User['name'];
    ships?: Ship[];
    steps: { x: number; y: number }[];
  }[];
  // creator: {
  //   id: number;
  //   userName: User['name'];
  //   ships?: Ship[];
  // };
  // secondPlayer: {
  //   id: number;
  //   userName: User['name'];
  //   ships?: Ship[];
  // };
  winner?: User['name'];
};

const users: Record<string, User> = {};
const rooms: Record<string | number, Room> = {};
const games: Record<string, Game> = {};

const getUpdateRoomData = () => {
  return JSON.stringify({
    type: 'update_room',
    id: 0,
    data: JSON.stringify(
      Object.entries(rooms).map(([roomId, room]) => ({
        roomId,
        roomUsers: room.users.map((userName) => ({
          name: users[userName]?.name,
          index: users[userName]?.index,
        })),
      })),
    ),
  });
};

const wss = new WebSocketServer({ port: 3000 });
wss.on('connection', function connection(ws, req) {
  ws.on('error', console.error);

  ws.on('message', function message(payload: string) {
    const userID = req.headers['sec-websocket-key'] as string;
    const currentUser = Object.values(users).find(
      (user) => user.index === userID,
    );
    // console.log('receive user: ', userID);
    const request = JSON.parse(payload.toString());
    const data = request.data.length > 0 ? JSON.parse(request.data) : {};
    let response: string | object = '';
    let responseType = request.type;

    switch (request.type) {
      case 'reg': {
        let user = users[data.name];
        if (!user) {
          user = {
            ...data,
            index: userID,
            wsRef: ws,
          } as User;

          users[data.name] = user;
        } else {
          user.index = userID;
        }

        response = {
          name: user.name,
          index: user.index,
          error: false,
          errorText: '',
        };
        break;
      }
      case 'create_room': {
        const roomName = 'SOME ROOM';
        const roomId = Date.now();
        rooms[roomId] = {
          id: roomId,
          name: roomName,
          users: currentUser ? [currentUser.name] : [],
        };
        response = {
          roomId,
          roomUsers: [],
        };
        responseType = 'update_room';
      }
      case 'add_user_to_room': {
        const room = rooms[data.indexRoom];
        // if (!room.users[0]) {
        //   return;
        // }

        if (
          room &&
          currentUser &&
          room.users[0] &&
          !room.users.some((userName) => userName === currentUser.name)
        ) {
          const game = {
            id: Date.now(),
            players: [
              {
                id: Date.now(),
                userName: room.users[0],
                steps: [],
              },
              {
                id: Date.now() + 1,
                userName: currentUser.name,
                steps: [],
              },
            ],
          };

          games[game.id] = game;

          room.users.push(currentUser.name);

          ws.send(
            JSON.stringify({
              type: 'create_game',
              data: JSON.stringify({
                idGame: game.id,
                idPlayer: game.players[1]?.id,
              }),
              id: 0,
            }),
          );

          users[room.users[0]]?.wsRef?.send(
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
        break;
      }
      case 'add_ships': {
        const { gameId, indexPlayer } = data;
        const game = games[gameId];

        if (!game) {
          return;
        }

        const currentPlayer = game.players.find(
          (player) => +indexPlayer === +player.id,
        );

        if (!currentPlayer) {
          return;
        }

        currentPlayer.ships = data.ships;

        if (
          game.players.map((player) => player.ships).filter((ships) => ships)
            .length === 2
        ) {
          console.log('game is ready to start');
          game.players.forEach((player) => {
            users[player.userName]?.wsRef?.send(
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

          users[game.players[0].userName]?.wsRef?.send(
            JSON.stringify({
              type: 'turn',
              data: JSON.stringify({
                currentPlayer: game.players[0].id,
              }),
              id: 0,
            }),
          );
        }
        break;
      }
      case 'attack': {
        const { x, y, gameId, indexPlayer } = data;
        const game = games[gameId];

        if (!game) {
          return;
        }

        console.log('info', {
          players: game.players,
          indexPlayer,
        });

        const enemy = game.players.find((player) => player.id !== indexPlayer);

        if (!enemy || !enemy.ships) {
          return;
        }

        const resultAttack = checkAttack(x, y, enemy.ships);

        game.players.forEach((player) => {
          users[player.userName]?.wsRef.send(
            JSON.stringify({
              type: 'attack',
              data: JSON.stringify({
                position: { x, y },
                currentPlayer: indexPlayer,
                status: resultAttack, //"miss"|"killed"|"shot",
              }),
              id: 0,
            }),
          );
        });

        game.players.forEach((player) => {
          users[player.userName]?.wsRef.send(
            JSON.stringify({
              type: 'turn',
              data: JSON.stringify({
                currentPlayer:
                  resultAttack === 'killed' || resultAttack === 'shot'
                    ? indexPlayer
                    : enemy.id,
              }),
              id: 0,
            }),
          );
        });

        break;
      }
    }
    if (response) {
      ws.send(
        JSON.stringify({
          type: responseType,
          id: request.id,
          data: JSON.stringify(response),
        }),
      );
    }

    // console.log('current users: ', users);
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(getUpdateRoomData());
      }
    });
  });
});
