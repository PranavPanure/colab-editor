import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidV4 } from 'uuid';
import './Landing.css';

const Landing = () => {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  const createNewRoom = (e) => {
    e.preventDefault();
    const id = uuidV4();
    setRoomId(id);
  };

  const joinRoom = () => {
    if (!roomId || !username) return;
    navigate(`/room/${roomId}`, {
      state: { username },
    });
  };

  const handleInputEnter = (e) => {
    if (e.code === 'Enter') {
      joinRoom();
    }
  };

  return (
    <div className="landing-page">
      <div className="bg-animation"></div>
      <div className="form-wrapper">
        <h1 className="logo">
          <span className="logo-accent">&lt;/&gt;</span> CollabEditor
        </h1>
        <h4 className="subtitle">Real-time collaborative code editor</h4>
        
        <div className="input-group">
          <input
            type="text"
            className="input-field"
            placeholder="ROOM ID"
            onChange={(e) => setRoomId(e.target.value)}
            value={roomId}
            onKeyUp={handleInputEnter}
          />
          <input
            type="text"
            className="input-field"
            placeholder="USERNAME"
            onChange={(e) => setUsername(e.target.value)}
            value={username}
            onKeyUp={handleInputEnter}
          />
          <button className="btn join-btn" onClick={joinRoom}>
            Join
          </button>
          
          <span className="create-info">
            If you don't have an invite code then create &nbsp;
            <a onClick={createNewRoom} href="#" className="create-new-btn">
              new room
            </a>
          </span>
        </div>
      </div>
    </div>
  );
};

export default Landing;
