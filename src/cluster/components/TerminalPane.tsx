import { useState, useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ContextNode } from '../../lib/contextTree';

interface TerminalPaneProps {
  selectedContext: ContextNode | null;
}

/**
 * Terminal pane component with real terminal functionality
 */
function TerminalPane({ selectedContext }: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      rows: 24,
      cols: 80,
    });

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();

    term.loadAddon(fit);
    term.loadAddon(webLinks);

    term.open(terminalRef.current);
    fit.fit();

    fitAddon.current = fit;
    setTerminal(term);

    // Handle terminal input
    term.onData(data => {
      if (sessionId) {
        invoke('write_to_terminal', { sessionId, data }).catch(console.error);
      }
    });

    // Create terminal session
    invoke('create_terminal_session')
      .then(id => {
        const sessionId = id as string;
        setSessionId(sessionId);
        term.writeln('Terminal session started');
        term.writeln(`Context: ${selectedContext?.name || 'No context selected'}`);
        term.write('$ ');
      })
      .catch((error: any) => {
        console.error('Failed to create terminal session:', error);
        term.writeln('Failed to create terminal session');
        // Fallback to mock terminal
        initMockTerminal(term);
      });

    return () => {
      term.dispose();
      if (sessionId) {
        invoke('close_terminal_session', { sessionId }).catch(console.error);
      }
    };
  }, []);

  // Listen for terminal output
  useEffect(() => {
    if (!terminal || !sessionId) return;

    const unlisten = listen('terminal-output', (event: any) => {
      const { session_id, data } = event.payload;
      if (session_id === sessionId) {
        terminal.write(data);
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [terminal, sessionId]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mock terminal for fallback
  const initMockTerminal = (term: Terminal) => {
    let currentLine = '';

    term.onData(data => {
      if (data === '\r') {
        // Enter pressed
        term.write('\r\n');
        handleMockCommand(term, currentLine.trim());
        currentLine = '';
        term.write('$ ');
      } else if (data === '\u007F') {
        // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          term.write('\b \b');
        }
      } else if (data >= ' ') {
        // Printable character
        currentLine += data;
        term.write(data);
      }
    });
  };

  const handleMockCommand = (term: Terminal, command: string) => {
    if (!command) return;

    if (command.includes('kubectl')) {
      term.writeln(`Context: ${selectedContext?.name || 'No context selected'}`);

      if (command.includes('get pods')) {
        term.writeln('NAME                     READY   STATUS    RESTARTS   AGE');
        term.writeln('app-deployment-1-xyzabc   1/1     Running   0          3d2h');
        term.writeln('app-deployment-2-abcdef   1/1     Running   0          2d5h');
      } else if (command.includes('get nodes')) {
        term.writeln('NAME          STATUS   ROLES    AGE     VERSION');
        term.writeln('node-1        Ready    master   90d     v1.25.0');
        term.writeln('node-2        Ready    <none>   90d     v1.25.0');
      } else {
        term.writeln('Command executed successfully');
      }
    } else if (command === 'clear') {
      term.clear();
    } else if (command === 'help') {
      term.writeln('Available commands:');
      term.writeln('  kubectl get pods    - List pods');
      term.writeln('  kubectl get nodes   - List nodes');
      term.writeln('  clear              - Clear terminal');
      term.writeln('  help               - Show this help');
    } else {
      term.writeln(`Command not found: ${command}`);
    }
  };

  return (
    <div className="terminal-pane">
      <div className="terminal-header">
        <span>Terminal</span>
        <span>{selectedContext ? `Context: ${selectedContext.name}` : 'No context selected'}</span>
      </div>
      <div className="terminal-container" ref={terminalRef} />
    </div>
  );
}

export default TerminalPane;
