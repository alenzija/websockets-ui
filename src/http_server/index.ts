import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import WebSocket, { WebSocketServer } from 'ws';

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
  index: number;
};

type Room = {
  id: string | number;
  name: string;
  users: Array<User['name']>;
};

const users: Record<string, User> = {};
const rooms: Record<string | number, Room> = {};

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
wss.on('connection', function connection(ws) {
  ws.on('error', console.error);

  ws.on('message', function message(payload: string) {
    // console.log("receive: ")
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
            index: Object.keys(users).length + 1,
          } as User;

          users[data.name] = user;
        }

        response = {
          name: user.name,
          index: user.index,
          error: false,
          errorText: '',
        };

        // ws.send(
        //   JSON.stringify({
        //     type: responseType,
        //     id: request.id,
        //     data: JSON.stringify(response),
        //   }),
        // );

        // ws.send(
        //   JSON.stringify({
        //     type: 'update_room',
        //     id: request.id,
        //     data: '',
        //   }),
        // );

        // ws.send(
        //   JSON.stringify({
        //     type: 'update_winners',
        //     id: request.id,
        //     data: '',
        //   }),
        // );

        break;
      }
      case 'create_room': {
        const roomName = 'SOME ROOM';
        const roomId = Date.now();
        rooms[roomId] = {
          id: roomId,
          name: roomName,
          users: [],
        };

        response = {
          roomId,
          roomUsers: [],
        };
        responseType = 'update_room';
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
