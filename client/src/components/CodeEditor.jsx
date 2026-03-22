import React, { useRef, useState, useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import './CodeEditor.css';
import { FiCode, FiSettings, FiDownload, FiPlay } from 'react-icons/fi';

const CodeEditor = ({ code, onChange, onCursorChange, onRunCode, remoteCursors = {}, users = [], canEdit = true, language = 'javascript', onLanguageChange, isAdmin = false }) => {
  const [theme, setTheme] = useState('vs-dark');
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);
  const monaco = useMonaco();

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition((e) => {
      if (onCursorChange && canEdit) {
        onCursorChange({
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        });
      }
    });

    // Handle initial value properly
    if (editor.getValue() !== code) {
      editor.setValue(code);
    }
  };

  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    
    // Check if code update is actually different to avoid looping
    if (editor.getValue() !== code) {
      const position = editor.getPosition();
      
      // Update the code without completely losing the user's cursor
      editor.executeEdits('remote-update', [{
        range: editor.getModel().getFullModelRange(),
        text: code,
        forceMoveMarkers: true,
      }]);
      
      // Attempt to restore the local cursor position safely
      if (position) {
        editor.setPosition(position);
      }
    }
  }, [code]);

  useEffect(() => {
    if (!editorRef.current || !monaco) return;

    const newDecorations = Object.entries(remoteCursors).map(([socketId, cursor]) => {
      const user = users.find(u => u.id === socketId);
      if (!user) return null;

      let styleEl = document.getElementById(`cursor-style-${socketId}`);
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = `cursor-style-${socketId}`;
        styleEl.innerHTML = `
          .remote-cursor-${socketId} {
            border-left: 2px solid ${user.color};
            margin-left: -1px;
            position: absolute;
            z-index: 9;
            pointer-events: none;
            min-height: 18px;
          }
          .remote-cursor-${socketId}::after {
            content: '${user.username}';
            position: absolute;
            top: -20px;
            left: 0;
            background-color: ${user.color};
            color: #fff;
            padding: 2px 4px;
            font-size: 10px;
            border-radius: 4px;
            white-space: nowrap;
            pointer-events: none;
          }
        `;
        document.head.appendChild(styleEl);
      }

      return {
        range: new monaco.Range(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column),
        options: {
          className: `remote-cursor-${socketId}`,
        }
      };
    }).filter(Boolean);

    if (editorRef.current.createDecorationsCollection) {
      if (!decorationsRef.current.set) {
        decorationsRef.current = editorRef.current.createDecorationsCollection(newDecorations);
      } else {
        decorationsRef.current.set(newDecorations);
      }
    } else {
      decorationsRef.current = editorRef.current.deltaDecorations(Array.isArray(decorationsRef.current) ? decorationsRef.current : [], newDecorations);
    }
  }, [remoteCursors, users, monaco]);

  const handleEditorChange = (value) => {
    if (canEdit) onChange(value);
  };

  return (
    <div className="editor-container" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="editor-wrapper" style={{ flex: 1 }}>
        <Editor
          height="100%"
          width="100%"
          language={language}
          theme={theme}
          defaultValue={code}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            readOnly: !canEdit,
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
