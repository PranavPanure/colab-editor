import React from 'react';
import './Sidebar.css';
import { FiUsers, FiLink, FiCheck, FiMic, FiMicOff, FiEdit, FiLock, FiUserX, FiFolder } from 'react-icons/fi';
import { useState } from 'react';

const Sidebar = ({ users, roomId, adminId, currentSocketId, onAdminAction, children }) => {
  const [copied, setCopied] = useState(false);

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className="room-title">Workspace</h2>
        <button className="copy-btn" onClick={copyRoomId} title="Copy Room ID">
          {copied ? <FiCheck className="text-green" /> : <FiLink />}
          <span className="copy-text">{copied ? 'Copied' : 'Invite'}</span>
        </button>
      </div>

      <div className="users-section">
        <div className="section-title">
          <FiUsers /> ONLINE — {users.length}
        </div>
        <ul className="users-list">
          {users.map((user, idx) => (
            <li key={idx} className="user-item">
              <div className="avatar" style={{ backgroundColor: user.color }}>
                {user.username.charAt(0).toUpperCase()}
                <div className="status-dot"></div>
              </div>
              <span className="user-name">
                {user.username} {user.id === adminId && '👑'} {user.id === currentSocketId && '(You)'}
              </span>
              
              {currentSocketId === adminId && user.id !== currentSocketId && (
                <div className="admin-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                  <button onClick={() => onAdminAction('toggle-mute', user.id)} title="Toggle Mute" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                    {user.canSpeak ? <FiMic /> : <FiMicOff color="red" />}
                  </button>
                  <button onClick={() => onAdminAction('toggle-edit', user.id)} title="Toggle Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                    {user.canEdit ? <FiEdit /> : <FiLock color="red" />}
                  </button>
                  <button onClick={() => onAdminAction('kick', user.id)} title="Kick User" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                    <FiUserX color="red" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {children}
    </div>
  );
};

export default Sidebar;
