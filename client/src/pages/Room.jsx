import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import ChatPanel from '../components/ChatPanel';
import CodeEditor from '../components/CodeEditor';
import './Room.css';

const Room = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [chat, setChat] = useState([]);
  const [code, setCode] = useState('// Loading...');

  useEffect(() => {
    // If no username, redirect back to landing
    if (!location.state?.username) {
      navigate('/');
      return;
    }

    const username = location.state.username;
    
    // Connect to the Socket.io server (use env var for prod, or localhost for dev)
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const newSocket = io(backendUrl);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-room', { roomId, username });
    });

    // Handle initial state
    newSocket.on('room-state', (state) => {
      setCode(state.code);
      setUsers(state.users);
      setChat(state.chat);
    });

    // Handle other users joining
    newSocket.on('user-joined', ({ username: newUsername, users: updatedUsers }) => {
      setUsers(updatedUsers);
      setChat((prev) => [...prev, { id: Date.now(), user: 'System', text: `${newUsername} joined the room`, isSystem: true }]);
    });

    // Handle users leaving
    newSocket.on('user-left', ({ username: leftUser, users: updatedUsers }) => {
      setUsers(updatedUsers);
      setChat((prev) => [...prev, { id: Date.now(), user: 'System', text: `${leftUser} left the room`, isSystem: true }]);
    });

    // Handle code updates from others
    newSocket.on('code-update', (newCode) => {
      setCode(newCode);
    });

    // Handle new chat messages
    newSocket.on('chat-update', (message) => {
      setChat((prev) => [...prev, message]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomId, location.state, navigate]);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socket) {
      socket.emit('edit-code', { roomId, code: newCode });
    }
  };

  const handleSendMessage = (messageText) => {
    if (socket) {
      socket.emit('chat-message', { roomId, message: messageText });
    }
  };

  if (!socket) return <div className="loading-screen">Connecting to room...</div>;

  return (
    <div className="room-layout">
      <Sidebar users={users} roomId={roomId} />
      <div className="main-content">
        <CodeEditor code={code} onChange={handleCodeChange} />
      </div>
      <ChatPanel chat={chat} onSendMessage={handleSendMessage} />
    </div>
  );
};

export default Room;
