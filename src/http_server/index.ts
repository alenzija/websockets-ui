import fs from 'fs';
import path from 'path';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { checkAttack, getMissPositions } from 'utils';
import { Game, Room, User } from 'types';

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

const users: Record<string, User> = {};
const rooms: Record<string | number, Room> = {};
const games: Record<string, Game> = {};
const winners: Record<string, { name?: string; wins: number }> = {};

const wss = new WebSocketServer({ port: 3000 });

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

const updateWinners = (playerName: string) => {
  const winner = winners[playerName];
  if (winner) {
    winner.wins += 0.5;
  } else {
    winners[playerName] = {
      name: playerName,
      wins: 1,
    };
  }
};

const finishGame = (winPlayer: number | string) => {
  const user = Object.values(users).find((user) => user.index === winPlayer);
  if (!user) {
    return;
  }
  updateWinners(user.name);
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: 'update_winners',
          data: JSON.stringify(Object.values(winners)),
          id: 0,
        }),
      );
    }
  });
};

wss.on('connection', function connection(ws, req) {
  ws.on('error', console.error);

  ws.on('message', function message(payload: string) {
    const userID = req.headers['sec-websocket-key'] as string;
    const currentUser = Object.values(users).find(
      (user) => user.index === userID,
    );
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
        const roomId = Date.now();
        rooms[roomId] = {
          id: roomId,
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
        if (
          room &&
          currentUser &&
          room.users[0] &&
          currentUser &&
          room.users.length < 2 &&
          !room.users.some((userName) => userName === currentUser.name)
        ) {
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
                userName: currentUser.name,
                steps: [],
                countKilledShips: 0,
              },
            ],
            roomId: room.id,
            currentPlayerId: firstPlayerID,
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
          (player) => player.id && +indexPlayer === +player.id,
        );

        if (!currentPlayer) {
          return;
        }

        currentPlayer.ships = data.ships;

        if (
          game.players.map((player) => player.ships).filter((ships) => ships)
            .length === 2
        ) {
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

        if (indexPlayer !== game?.currentPlayerId) {
          return;
        }

        if (!game) {
          return;
        }

        const currentPlayer = game.players.find(
          (player) => player.id === game.currentPlayerId,
        );

        // if (
        //   currentPlayer?.steps.some(
        //     (position) => position.x === x && position.y === y,
        //   )
        // ) {
        //   return;
        // }

        const enemy = game.players.find((player) => player.id !== indexPlayer);

        if (!enemy || !enemy.ships || !currentPlayer) {
          return;
        }

        const resultAttack = checkAttack(
          x,
          y,
          enemy.ships,
          currentPlayer.steps,
        );
        if (resultAttack.status === 'killed') {
          currentPlayer.countKilledShips += 1;
          const ship = resultAttack.ship;
          if (!ship) {
            return;
          }
          const { length, position, direction } = ship;
          for (let i = 0; i < length; i += 1) {
            game.players.forEach((player) => {
              users[player.userName]?.wsRef.send(
                JSON.stringify({
                  type: 'attack',
                  data: JSON.stringify({
                    position: direction
                      ? { x: position.x, y: position.y + i }
                      : { x: position.x + i, y: position.y },
                    currentPlayer: indexPlayer,
                    status: 'killed',
                  }),
                  id: 0,
                }),
              );
            });
            if (currentPlayer.countKilledShips === 10) {
              const winPlayer = users[currentPlayer.userName]?.index;
              if (!winPlayer) {
                return;
              }
              game.players.forEach((player) => {
                users[player.userName]?.wsRef.send(
                  JSON.stringify({
                    type: 'finish',
                    data: JSON.stringify({
                      winPlayer,
                    }),
                    id: 0,
                  }),
                );
              });
              finishGame(winPlayer);
              delete rooms[game.roomId];
              wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(getUpdateRoomData());
                }
              });
            }
          }
          getMissPositions(ship).forEach(({ x, y }) => {
            game.players.forEach((player) => {
              users[player.userName]?.wsRef.send(
                JSON.stringify({
                  type: 'attack',
                  data: JSON.stringify({
                    position: { x, y },
                    currentPlayer: indexPlayer,
                    status: 'miss',
                  }),
                  id: 0,
                }),
              );
            });
          });
        } else {
          game.players.forEach((player) => {
            users[player.userName]?.wsRef.send(
              JSON.stringify({
                type: 'attack',
                data: JSON.stringify({
                  position: { x, y },
                  currentPlayer: indexPlayer,
                  status: resultAttack.status,
                }),
                id: 0,
              }),
            );
          });
        }
        game.currentPlayerId =
          resultAttack.status === 'miss' ? enemy.id : indexPlayer;
        game.players.forEach((player) => {
          users[player.userName]?.wsRef.send(
            JSON.stringify({
              type: 'turn',
              data: JSON.stringify({
                currentPlayer: game.currentPlayerId,
              }),
              id: 0,
            }),
          );
        });
        break;
      }
      case 'randomAttack': {
        const { gameId, indexPlayer } = data;
        const game = games[gameId];
        if (!game) {
          return;
        }
        const player = game.players.find(({ id }) => id === indexPlayer);
        const enemy = game.players.find(({ id }) => id !== indexPlayer);
        if (!player || !enemy || !enemy.ships) {
          return;
        }

        let x = Math.ceil(Math.random() * 9);
        let y = Math.ceil(Math.random() * 9);
        while (player.steps.some((step) => step.x === x && step.y === y)) {
          x = Math.ceil(Math.random() * 9);
          y = Math.ceil(Math.random() * 9);
        }
        const resultAttack = checkAttack(x, y, enemy.ships, player.steps);
        if (resultAttack.status === 'killed') {
          player.countKilledShips += 1;
          const ship = resultAttack.ship;
          if (!ship) {
            return;
          }
          const { length, position, direction } = ship;
          for (let i = 0; i < length; i += 1) {
            game.players.forEach((player) => {
              users[player.userName]?.wsRef.send(
                JSON.stringify({
                  type: 'attack',
                  data: JSON.stringify({
                    position: direction
                      ? { x: position.x, y: position.y + i }
                      : { x: position.x + i, y: position.y },
                    currentPlayer: indexPlayer,
                    status: 'killed',
                  }),
                  id: 0,
                }),
              );
            });
            if (player.countKilledShips === 10) {
              const winPlayer = users[player.userName]?.index;
              if (!winPlayer) {
                return;
              }
              game.players.forEach((player) => {
                users[player.userName]?.wsRef.send(
                  JSON.stringify({
                    type: 'finish',
                    data: JSON.stringify({
                      winPlayer,
                    }),
                    id: 0,
                  }),
                );
              });
              finishGame(winPlayer);
              delete rooms[game.roomId];
              wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(getUpdateRoomData());
                }
              });
            }
          }
          getMissPositions(ship).forEach(({ x, y }) => {
            game.players.forEach((player) => {
              users[player.userName]?.wsRef.send(
                JSON.stringify({
                  type: 'attack',
                  data: JSON.stringify({
                    position: { x, y },
                    currentPlayer: indexPlayer,
                    status: 'miss',
                  }),
                  id: 0,
                }),
              );
            });
          });
        } else {
          game.players.forEach((player) => {
            users[player.userName]?.wsRef.send(
              JSON.stringify({
                type: 'attack',
                data: JSON.stringify({
                  position: { x, y },
                  currentPlayer: indexPlayer,
                  status: resultAttack.status,
                }),
                id: 0,
              }),
            );
          });
        }
        game.currentPlayerId =
          resultAttack.status === 'miss' ? enemy.id : indexPlayer;
        game.players.forEach((player) => {
          users[player.userName]?.wsRef.send(
            JSON.stringify({
              type: 'turn',
              data: JSON.stringify({
                currentPlayer: game.currentPlayerId,
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
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(getUpdateRoomData());
      }
    });
  });
});
