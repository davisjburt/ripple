
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const users = {};
const socketToRoom = {};

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    console.log('Socket.IO: User connected with socket ID:', socket.id);

    socket.on('join room', (roomID, name) => {
      if (users[roomID]) {
        const existingUser = users[roomID].find((user) => user.id === socket.id);
        if (!existingUser) {
          users[roomID].push({ id: socket.id, name });
        }
      } else {
        users[roomID] = [{ id: socket.id, name }];
      }
      socketToRoom[socket.id] = roomID;
      const usersInThisRoom = users[roomID].filter((user) => user.id !== socket.id);

      console.log(`Socket.IO: User ${name} (${socket.id}) joined room ${roomID}`);
      console.log('Socket.IO: Users in this room:', usersInThisRoom);

      socket.emit('all users', usersInThisRoom);
    });

    socket.on('sending signal', (payload) => {
      console.log(`Socket.IO: User ${payload.callerID} sending signal to ${payload.userToSignal}`);
      io.to(payload.userToSignal).emit('user joined', {
        signal: payload.signal,
        callerID: payload.callerID,
        name: payload.name,
      });
    });

    socket.on('returning signal', (payload) => {
      console.log(`Socket.IO: User ${socket.id} returning signal to ${payload.callerID}`);
      io.to(payload.callerID).emit('receiving returned signal', {
        signal: payload.signal,
        id: socket.id,
      });
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO: User disconnected:', socket.id);
      const roomID = socketToRoom[socket.id];
      let room = users[roomID];
      if (room) {
        room = room.filter((user) => user.id !== socket.id);
        users[roomID] = room;
        if (room.length === 0) {
          delete users[roomID];
        }
        socket.to(roomID).emit('user left', socket.id);
      }
      delete socketToRoom[socket.id];
    });
  });

  const port = process.env.PORT || 9002;
  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
