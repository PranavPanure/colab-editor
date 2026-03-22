import React, { useRef, useEffect, useState } from 'react';
import { FiTerminal, FiTrash2, FiX, FiCheckSquare } from 'react-icons/fi';
import './TerminalPanel.css';

const TerminalPanel = ({ output, onClear, onClose, onTerminalInput }) => {
  const [inputText, setInputText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  if (output === null) return null;

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <div className="terminal-title">
          <FiTerminal /> <span>OUTPUT</span>
        </div>
        <div className="terminal-actions">
          <button onClick={onClear} title="Clear Output"><FiTrash2 /></button>
          <button onClick={onClose} title="Close Terminal"><FiX /></button>
        </div>
      </div>
      <div className="terminal-body" onClick={() => document.getElementById('term-input')?.focus()}>
        <pre>{output}</pre>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (onTerminalInput) {
            onTerminalInput(inputText + '\n');
            setInputText('');
          }
        }} style={{ display: 'flex', marginTop: '4px' }}>
          <span style={{ color: '#4CAF50', marginRight: '8px', fontWeight: 'bold' }}>&gt;</span>
          <input
            id="term-input"
            autoFocus
            autoComplete="off"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#d4d4d4', outline: 'none', fontFamily: 'inherit', fontSize: 'inherit' }}
            placeholder="Type input here..."
          />
        </form>
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default TerminalPanel;
