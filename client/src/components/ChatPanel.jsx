import React, { useState, useRef, useEffect } from 'react';
import { FiSend } from 'react-icons/fi';
import './ChatPanel.css';

const ChatPanel = ({ chat, onSendMessage }) => {
  const [msgInput, setMsgInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat]);

  const handleSend = (e) => {
    e.preventDefault();
    if (msgInput.trim()) {
      onSendMessage(msgInput.trim());
      setMsgInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3 className="chat-title"># dev-chat</h3>
      </div>
      
      <div className="chat-messages">
        {chat.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.isSystem ? 'system-msg' : ''}`}>
            {!msg.isSystem ? (
              <>
                <div className="msg-avatar">
                  {msg.user.charAt(0).toUpperCase()}
                </div>
                <div className="msg-content">
                  <div className="msg-header">
                    <span className="msg-author">{msg.user}</span>
                    <span className="msg-time">{new Date(msg.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="msg-text">{msg.text}</div>
                </div>
              </>
            ) : (
              <div className="sys-text">{msg.text}</div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <form className="chat-form" onSubmit={handleSend}>
          <textarea
            className="chat-input"
            value={msgInput}
            onChange={(e) => setMsgInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Message #dev-chat"
            rows={1}
          />
          <button type="submit" className="send-btn" disabled={!msgInput.trim()}>
            <FiSend />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
