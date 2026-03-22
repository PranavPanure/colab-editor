import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import ChatPanel from '../components/ChatPanel';
import CodeEditor from '../components/CodeEditor';
import TerminalPanel from '../components/TerminalPanel';
import MediaChat from '../components/MediaChat';
import { FiPlus, FiTrash2, FiFileText, FiPlay, FiDownload, FiSettings } from 'react-icons/fi';
import './Room.css';

const Room = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [chat, setChat] = useState([]);
  const [files, setFiles] = useState({ 'main.js': { content: '// Loading...', language: 'javascript' } });
  const [activeFile, setActiveFile] = useState('main.js');
  const [remoteCursors, setRemoteCursors] = useState({});
  const [adminId, setAdminId] = useState(null);
  const [terminalOutput, setTerminalOutput] = useState(null);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');

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
      if (state.files) setFiles(state.files);
      setUsers(state.users);
      setChat(state.chat);
      setAdminId(state.adminId);
    });

    // Handle other users joining
    newSocket.on('user-joined', ({ username: newUsername, users: updatedUsers, adminId: newAdminId }) => {
      setUsers(updatedUsers);
      setAdminId(newAdminId);
      setChat((prev) => [...prev, { id: Date.now(), user: 'System', text: `${newUsername} joined the room`, isSystem: true }]);
    });

    // Handle users leaving
    newSocket.on('user-left', ({ username: leftUser, users: updatedUsers, adminId: newAdminId }) => {
      setUsers(updatedUsers);
      setAdminId(newAdminId);
      setChat((prev) => [...prev, { id: Date.now(), user: 'System', text: `${leftUser} left the room`, isSystem: true }]);
    });

    // Handle permission updates
    newSocket.on('permissions-update', (updatedUsers) => {
      setUsers(updatedUsers);
    });

    // Handle being kicked
    newSocket.on('kicked', () => {
      alert("You have been kicked from the room by the admin.");
      navigate('/');
    });

    // Handle code execution streaming
    newSocket.on('execution-output', (data) => {
      setTerminalOutput(prev => (prev || '') + data);
    });

    // Handle language updates
    newSocket.on('language-update', ({ filename, language }) => {
      setFiles(prev => ({
        ...prev,
        [filename]: { ...(prev[filename] || {}), language }
      }));
    });

    // Handle code updates from others
    newSocket.on('code-update', ({ filename, code }) => {
      setFiles(prev => ({
        ...prev,
        [filename]: { ...(prev[filename] || {}), content: code }
      }));
    });

    // Handle file operations
    newSocket.on('file-created', ({ filename, language }) => {
      setFiles(prev => ({ ...prev, [filename]: { content: '', language } }));
    });

    newSocket.on('file-deleted', (filename) => {
      setFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[filename];
        return newFiles;
      });
      if (activeFile === filename) setActiveFile('main.js');
    });

    newSocket.on('file-renamed', ({ oldName, newName }) => {
      setFiles(prev => {
        const newFiles = { ...prev, [newName]: prev[oldName] };
        delete newFiles[oldName];
        return newFiles;
      });
      if (activeFile === oldName) setActiveFile(newName);
    });

    // Handle cursor updates from others
    newSocket.on('cursor-update', (cursorData) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [cursorData.socketId]: cursorData,
      }));
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
    setFiles(prev => ({ ...prev, [activeFile]: { ...prev[activeFile], content: newCode } }));
    if (socket) {
      socket.emit('edit-code', { roomId, filename: activeFile, code: newCode });
    }
  };

  const handleCursorChange = (cursorParams) => {
    if (socket) {
      socket.emit('cursor-move', { roomId, cursorParams });
    }
  };

  const handleAdminAction = (action, targetId) => {
    if (socket) {
      socket.emit('admin-action', { roomId, action, targetId });
    }
  };

  const handleRunCode = (codeToRun, language) => {
    if (socket) {
      setTerminalOutput('');
      socket.emit('execute-code', { roomId, code: codeToRun, language });
    }
  };

  const handleTerminalInput = (inputTxt) => {
    if (socket) {
      socket.emit('terminal-input', { roomId, input: inputTxt });
    }
  };

  const handleDownloadFile = () => {
    const codeObj = files[activeFile];
    if (!codeObj) return;
    const blob = new Blob([codeObj.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLanguageChange = (lang) => {
    setFiles(prev => ({ ...prev, [activeFile]: { ...prev[activeFile], language: lang } }));
    if (socket && adminId === socket.id) {
      socket.emit('change-language', { roomId, filename: activeFile, language: lang });
    }
  };

  const handleFileCreate = (filename) => {
    if (socket) {
      socket.emit('create-file', { roomId, filename, language: 'javascript' });
      setIsCreatingFile(false);
      setNewFileName('');
    }
  };
  const handleFileDelete = (filename) => {
    if (socket) socket.emit('delete-file', { roomId, filename });
  };

  const handleSendMessage = (messageText) => {
    if (socket) {
      socket.emit('chat-message', { roomId, message: messageText });
    }
  };

  if (!socket) return <div className="loading-screen">Connecting to room...</div>;

  const currentUser = users.find(u => u.id === socket?.id);
  const canEdit = currentUser ? currentUser.canEdit : true;
  const canSpeak = currentUser ? currentUser.canSpeak : true;

  return (
    <div className="room-layout">
      <Sidebar 
        users={users} 
        roomId={roomId} 
        adminId={adminId} 
        currentSocketId={socket?.id} 
        onAdminAction={handleAdminAction} 
      >
        <MediaChat socket={socket} users={users} canSpeak={canSpeak} />
      </Sidebar>
      <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* VS Code Style Unified Tab Bar */}
        <div style={{ display: 'flex', background: '#2d2d2d', borderBottom: '1px solid #1e1e1e', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', overflowX: 'auto', flex: 1 }}>
            {Object.keys(files).map(file => (
              <div 
                key={file} 
                onClick={() => setActiveFile(file)}
                style={{
                  padding: '8px 16px',
                  background: activeFile === file ? '#1e1e1e' : '#2d2d2d',
                  color: activeFile === file ? '#fff' : '#9da5b4',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderTop: activeFile === file ? '2px solid #007acc' : '2px solid transparent',
                  minWidth: '100px',
                  fontSize: '13px'
                }}
              >
                <FiFileText />
                <span style={{ flex: 1 }}>{file}</span>
                {file !== 'main.js' && adminId === socket?.id && (
                  <FiTrash2 
                    onClick={(e) => { e.stopPropagation(); handleFileDelete(file); }} 
                    style={{ cursor: 'pointer', color: '#888' }} 
                  />
                )}
              </div>
            ))}
            {isCreatingFile ? (
              <form 
                onSubmit={(e) => { e.preventDefault(); if (newFileName.trim()) handleFileCreate(newFileName.trim()); }} 
                style={{ padding: '0 8px', display: 'flex', alignItems: 'center' }}
              >
                <input 
                  autoFocus
                  type="text" 
                  value={newFileName} 
                  onChange={e => setNewFileName(e.target.value)}
                  onBlur={() => setIsCreatingFile(false)}
                  placeholder="name.js"
                  style={{ width: '80px', padding: '4px', fontSize: '12px', background: '#1e1e1e', color: '#fff', border: '1px solid #007acc', outline: 'none' }}
                />
              </form>
            ) : (
              <div 
                style={{ padding: '8px 16px', cursor: 'pointer', color: '#9da5b4', display: 'flex', alignItems: 'center' }} 
                onClick={() => setIsCreatingFile(true)}
              >
                <FiPlus />
              </div>
            )}
          </div>

          <div className="editor-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '16px' }}>
            <select 
              className="lang-select" 
              value={files[activeFile]?.language || 'javascript'} 
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={adminId !== socket?.id}
              style={{ opacity: adminId === socket?.id ? 1 : 0.6, cursor: adminId === socket?.id ? 'pointer' : 'not-allowed', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '4px 8px' }}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="cpp">C++</option>
              <option value="json">JSON</option>
            </select>
            
            <button title="Run Code" onClick={() => handleRunCode(files[activeFile]?.content || '', files[activeFile]?.language || 'javascript')} style={{ background: 'none', border: 'none', color: '#4CAF50', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <FiPlay size={18} />
            </button>
            <button title="Download Code" onClick={handleDownloadFile} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <FiDownload size={18} />
            </button>
          </div>
        </div>
        
        <div style={{ flex: 1, overflow: 'hidden', display: 'block' }}>
          <CodeEditor 
            code={files[activeFile]?.content || ''} 
            onChange={handleCodeChange} 
            onCursorChange={handleCursorChange}
            onRunCode={handleRunCode}
            remoteCursors={remoteCursors}
            users={users}
            canEdit={canEdit}
            language={files[activeFile]?.language || 'javascript'}
            onLanguageChange={handleLanguageChange}
            isAdmin={adminId === socket?.id}
          />
        </div>

        <TerminalPanel 
          output={terminalOutput} 
          onClear={() => setTerminalOutput('')} 
          onClose={() => setTerminalOutput(null)} 
          onTerminalInput={handleTerminalInput}
        />
      </div>
      <ChatPanel chat={chat} onSendMessage={handleSendMessage} />
    </div>
  );
};

export default Room;
