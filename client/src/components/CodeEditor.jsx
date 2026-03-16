import React, { useRef, useState } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import './CodeEditor.css';
import { FiCode, FiSettings, FiDownload } from 'react-icons/fi';

const CodeEditor = ({ code, onChange }) => {
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState('vs-dark');
  const editorRef = useRef(null);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  const handleEditorChange = (value) => {
    onChange(value);
  };

  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collab-code.${language === 'javascript' ? 'js' : language === 'python' ? 'py' : language === 'html' ? 'html' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="editor-container">
      <div className="editor-header">
        <div className="editor-tabs">
          <div className="tab active">
            <FiCode className="tab-icon" />
            <span>main.{language === 'javascript' ? 'js' : language === 'python' ? 'py' : language === 'html' ? 'html' : 'txt'}</span>
          </div>
        </div>
        
        <div className="editor-actions">
          <select 
            className="lang-select" 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="cpp">C++</option>
            <option value="json">JSON</option>
          </select>
          
          <button className="action-btn" title="Download Code" onClick={downloadCode}>
            <FiDownload />
          </button>
          <button className="action-btn" title="Settings">
            <FiSettings />
          </button>
        </div>
      </div>
      
      <div className="editor-wrapper">
        <Editor
          height="100%"
          width="100%"
          language={language}
          theme={theme}
          value={code}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'Fira Code', 'Consolas', monospace",
            wordWrap: 'on',
            lineNumbersMinChars: 3,
            padding: { top: 16 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            formatOnPaste: true,
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;
