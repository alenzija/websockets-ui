import fs from 'fs';
import path from 'path';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { checkAttack, getMissPositions } from 'utils';
import {
  regCommand,
  createRoomCommand,
  addUserToRoomCommand,
  addShipsCommand,
} from 'commands';
import { GamesService, RoomsService, UsersService } from 'services';

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

const winners: Record<string, { name?: string; wins: number }> = {};

const wss = new WebSocketServer({ port: 3000 });
const { rooms } = RoomsService;
const { games } = GamesService;

const getUpdateRoomData = () => {
  return JSON.stringify({
    type: 'update_room',
    id: 0,
    data: JSON.stringify(
      Object.entries(rooms).map(([roomId, room]) => ({
        roomId,
        roomUsers: room.users.map((userName) => ({
          name: userName,
          index: UsersService.getUserByName(userName)?.index,
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
  const user = UsersService.getUserByIndex(winPlayer);
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
    const currentUser = UsersService.getUserByIndex(userID);

    const request = JSON.parse(payload.toString());
    const data = request.data.length > 0 ? JSON.parse(request.data) : {};

    let response: string | object = '';
    const responseType = request.type;

    switch (request.type) {
      case 'reg': {
        response = regCommand(data, userID, ws);
        break;
      }
      case 'create_room': {
        createRoomCommand(currentUser);
        break;
      }
      case 'add_user_to_room': {
        addUserToRoomCommand(data, ws, currentUser);
        break;
      }
      case 'add_ships': {
        addShipsCommand(data);
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
              UsersService.getUserByName(player.userName)?.wsRef.send(
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
              const winPlayer = UsersService.getUserByName(
                currentPlayer.userName,
              )?.index;

              if (!winPlayer) {
                return;
              }
              game.players.forEach((player) => {
                UsersService.getUserByName(player.userName)?.wsRef.send(
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
              UsersService.getUserByName(player.userName)?.wsRef.send(
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
            UsersService.getUserByName(player.userName)?.wsRef.send(
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
          UsersService.getUserByName(player.userName)?.wsRef.send(
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
              UsersService.getUserByName(player.userName)?.wsRef.send(
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
              const winPlayer = UsersService.getUserByName(
                player.userName,
              )?.index;
              if (!winPlayer) {
                return;
              }
              game.players.forEach((player) => {
                UsersService.getUserByName(player.userName)?.wsRef.send(
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
              UsersService.getUserByName(player.userName)?.wsRef.send(
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
            UsersService.getUserByName(player.userName)?.wsRef.send(
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
          UsersService.getUserByName(player.userName)?.wsRef.send(
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
