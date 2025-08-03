
const { Server } = require("socket.io");

const io = new Server(3001, {
  cors: {
    origin: "*", 
  },
});

const users = {};
const socketToRoom = {};

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('join room', (roomID, name) => {
    if (users[roomID]) {
      users[roomID].push({ id: socket.id, name });
    } else {
      users[roomID] = [{ id: socket.id, name }];
    }
    socketToRoom[socket.id] = roomID;
    const usersInThisRoom = users[roomID].filter(user => user.id !== socket.id);

    console.log(`User ${name} (${socket.id}) joined room ${roomID}`);
    console.log('Users in this room:', usersInThisRoom);

    socket.emit('all users', usersInThisRoom);
  });

  socket.on('sending signal', (payload) => {
    console.log(`User ${payload.callerID} sending signal to ${payload.userToSignal}`);
    io.to(payload.userToSignal).emit('user joined', {
      signal: payload.signal,
      callerID: payload.callerID,
      name: payload.name
    });
  });

  socket.on('returning signal', (payload) => {
     console.log(`User ${socket.id} returning signal to ${payload.userToSignal}`);
    io.to(payload.userToSignal).emit('receiving returned signal', {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    const roomID = socketToRoom[socket.id];
    let room = users[roomID];
    if (room) {
      room = room.filter(user => user.id !== socket.id);
      users[roomID] = room;
      if (room.length === 0) {
        delete users[roomID];
      }
    }
    socket.broadcast.to(roomID).emit('user left', socket.id);
    delete socketToRoom[socket.id];
  });
});

console.log("Signaling server started on port 3001");
