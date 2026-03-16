import React from 'react';
import './Sidebar.css';
import { FiUsers, FiLink, FiCheck } from 'react-icons/fi';
import { useState } from 'react';

const Sidebar = ({ users, roomId }) => {
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
              <div className="avatar">
                {user.charAt(0).toUpperCase()}
                <div className="status-dot"></div>
              </div>
              <span className="user-name">{user}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
