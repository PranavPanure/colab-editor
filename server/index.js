const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory temp storage
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, username }) => {
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        code: '// Welcome to the collaborative editor!\n// Type your code here...\n',
        users: new Map(), // socketId -> username
        chat: [],
      });
    }

    const room = rooms.get(roomId);
    room.users.set(socket.id, username);
    socket.join(roomId);

    console.log(`${username} (${socket.id}) joined room: ${roomId}`);

    // Send the current room state to the new user
    socket.emit('room-state', {
      code: room.code,
      users: Array.from(room.users.values()),
      chat: room.chat,
    });

    // Notify other users in the room
    socket.to(roomId).emit('user-joined', {
      username,
      users: Array.from(room.users.values()),
    });
  });

  socket.on('edit-code', ({ roomId, code }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.code = code;
      // Broadcast to everyone else in the room
      socket.to(roomId).emit('code-update', code);
    }
  });

  socket.on('chat-message', ({ roomId, message }) => {
    const room = rooms.get(roomId);
    if (room) {
      const username = room.users.get(socket.id);
      const chatMsg = { id: Date.now(), user: username, text: message };
      room.chat.push(chatMsg);
      io.to(roomId).emit('chat-update', chatMsg);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const [roomId, room] of rooms.entries()) {
      if (room.users.has(socket.id)) {
        const username = room.users.get(socket.id);
        room.users.delete(socket.id);
        
        io.to(roomId).emit('user-left', {
          username,
          users: Array.from(room.users.values()),
        });

        // Clean up empty rooms after some time, or immediately.
        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.send('Collab Editor Server is running');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
