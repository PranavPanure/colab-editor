const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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
const colors = ['#FFC312', '#C4E538', '#12CBC4', '#FDA7DF', '#ED4C67', '#F79F1F', '#A3CB38', '#1289A7', '#D980FA'];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, username }) => {
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        files: {
          'main.js': { content: '// Welcome to the collaborative editor!\n// Type your code here...\n', language: 'javascript' }
        },
        users: new Map(), // socketId -> user config
        chat: [],
        adminId: socket.id,
      });
    }

    const room = rooms.get(roomId);
    const userColor = colors[Math.floor(Math.random() * colors.length)];
    room.users.set(socket.id, { id: socket.id, username, color: userColor, canEdit: true, canSpeak: true });
    socket.join(roomId);

    console.log(`${username} (${socket.id}) joined room: ${roomId}`);

    // Send the current room state to the new user
    socket.emit('room-state', {
      files: room.files,
      users: Array.from(room.users.values()),
      chat: room.chat,
      adminId: room.adminId,
      whiteboard: room.whiteboard
    });

    // Notify other users in the room
    socket.to(roomId).emit('user-joined', {
      username,
      users: Array.from(room.users.values()),
      adminId: room.adminId
    });
  });

  socket.on('edit-code', ({ roomId, filename, code }) => {
    const room = rooms.get(roomId);
    if (room && room.users.get(socket.id)?.canEdit && room.files[filename]) {
      room.files[filename].content = code;
      // Broadcast to everyone else in the room
      socket.to(roomId).emit('code-update', { filename, code });
    }
  });

  socket.on('create-file', ({ roomId, filename, language }) => {
    const room = rooms.get(roomId);
    if (room && room.users.get(socket.id)?.canEdit && !room.files[filename]) {
      room.files[filename] = { content: '', language: language || 'javascript' };
      io.to(roomId).emit('file-created', { filename, language: language || 'javascript' });
    }
  });

  socket.on('delete-file', ({ roomId, filename }) => {
    const room = rooms.get(roomId);
    if (room && room.users.get(socket.id)?.canEdit && room.files[filename]) {
      delete room.files[filename];
      io.to(roomId).emit('file-deleted', filename);
    }
  });

  socket.on('rename-file', ({ roomId, oldName, newName }) => {
    const room = rooms.get(roomId);
    if (room && room.users.get(socket.id)?.canEdit && room.files[oldName] && !room.files[newName]) {
      room.files[newName] = room.files[oldName];
      delete room.files[oldName];
      io.to(roomId).emit('file-renamed', { oldName, newName });
    }
  });

  socket.on('change-language', ({ roomId, filename, language }) => {
    const room = rooms.get(roomId);
    if (room && room.adminId === socket.id && room.files[filename]) {
      room.files[filename].language = language;
      socket.to(roomId).emit('language-update', { filename, language });
    }
  });

  socket.on('whiteboard-edit', ({ roomId, elements }) => {
    const room = rooms.get(roomId);
    if (room && room.users.get(socket.id)?.canEdit) {
      room.whiteboard = elements;
      socket.to(roomId).emit('whiteboard-update', elements);
    }
  });

  socket.on('admin-action', ({ roomId, action, targetId }) => {
    const room = rooms.get(roomId);
    if (room && room.adminId === socket.id) {
      if (action === 'kick') {
        const targetSocket = io.sockets.sockets.get(targetId);
        if (targetSocket) {
          targetSocket.emit('kicked');
          targetSocket.disconnect();
        }
      } else if (action === 'toggle-edit') {
        const user = room.users.get(targetId);
        if (user) {
          user.canEdit = !user.canEdit;
          io.to(roomId).emit('permissions-update', Array.from(room.users.values()));
        }
      } else if (action === 'toggle-mute') {
        const user = room.users.get(targetId);
        if (user) {
          user.canSpeak = !user.canSpeak;
          io.to(roomId).emit('permissions-update', Array.from(room.users.values()));
        }
      }
    }
  });

  socket.on('cursor-move', ({ roomId, cursorParams }) => {
    const room = rooms.get(roomId);
    if (room) {
      socket.to(roomId).emit('cursor-update', { socketId: socket.id, ...cursorParams });
    }
  });

  socket.on('execute-code', ({ roomId, code, language }) => {
    const room = rooms.get(roomId);
    if (room && room.users.get(socket.id)?.canEdit) {
      // Execute only javascript or python for this demo
      const isJs = language === 'javascript';
      const isPy = language === 'python';
      
      if (!isJs && !isPy) {
        socket.emit('execution-result', { error: 'Unsupported language. Only JS and Python are currently supported.' });
        return;
      }
      
      const ext = isJs ? 'js' : 'py';
      const cmd = isJs ? 'node' : 'python';
      const tmpPath = path.join(__dirname, `tmp-${socket.id}-${Date.now()}.${ext}`);
      
      fs.writeFile(tmpPath, code, (err) => {
        if (err) {
          socket.emit('execution-output', 'Failed to write execution file on server.\n');
          return;
        }

        // Kill existing process for this room if any
        if (activeProcesses.has(roomId)) {
          activeProcesses.get(roomId).kill();
          activeProcesses.delete(roomId);
        }

        const cmdArgs = isJs ? [tmpPath] : ['-u', tmpPath]; // -u prevents python from buffering output
        const child = spawn(cmd, cmdArgs);
        activeProcesses.set(roomId, child);

        // Terminate hanging processes after 30 seconds
        const timeout = setTimeout(() => {
          if (activeProcesses.get(roomId) === child) {
            child.kill();
            io.to(roomId).emit('execution-output', '\n[Execution Timeout: Process killed after 30s]\n');
          }
        }, 30000);

        child.stdout.on('data', (data) => {
          io.to(roomId).emit('execution-output', data.toString());
        });

        child.stderr.on('data', (data) => {
          io.to(roomId).emit('execution-output', data.toString());
        });

        child.on('close', (exitCode) => {
          clearTimeout(timeout);
          io.to(roomId).emit('execution-output', `\n[Process exited with code ${exitCode}]\n`);
          if (activeProcesses.get(roomId) === child) {
            activeProcesses.delete(roomId);
          }
          fs.unlink(tmpPath, () => {});
        });
      });
    }
  });

  socket.on('terminal-input', ({ roomId, input }) => {
    const child = activeProcesses.get(roomId);
    if (child && child.stdin) {
      child.stdin.write(input);
    }
  });

  socket.on('chat-message', ({ roomId, message }) => {
    const room = rooms.get(roomId);
    if (room) {
      const userObj = room.users.get(socket.id);
      const username = userObj ? userObj.username : 'Unknown';
      const chatMsg = { id: Date.now(), user: username, text: message };
      room.chat.push(chatMsg);
      io.to(roomId).emit('chat-update', chatMsg);
    }
  });

  // WebRTC Signaling
  socket.on('webrtc-offer', ({ targetId, sdp }) => {
    io.to(targetId).emit('webrtc-offer', { senderId: socket.id, sdp });
  });

  socket.on('webrtc-answer', ({ targetId, sdp }) => {
    io.to(targetId).emit('webrtc-answer', { senderId: socket.id, sdp });
  });

  socket.on('webrtc-ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('webrtc-ice-candidate', { senderId: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const [roomId, room] of rooms.entries()) {
      if (room.users.has(socket.id)) {
        const userObj = room.users.get(socket.id);
        room.users.delete(socket.id);
        
        if (room.adminId === socket.id && room.users.size > 0) {
          // Assign next admin
          room.adminId = room.users.keys().next().value;
        }

        io.to(roomId).emit('user-left', {
          username: userObj.username,
          users: Array.from(room.users.values()),
          adminId: room.adminId
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
