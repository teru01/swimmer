import { useState, useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ContextNode } from '../../lib/contextTree';
import { usePreferences } from '../../contexts/PreferencesContext';

interface TerminalPaneProps {
  selectedContext: ContextNode | undefined;
}

/**
 * Terminal pane component with real terminal functionality
 */
function TerminalPane({ selectedContext }: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddon = useRef<FitAddon | undefined>(undefined);
  const { preferences } = usePreferences();

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

    let currentSessionId: string | undefined = undefined;
    let unlistenFn: (() => void) | undefined = undefined;

    // Handle terminal input
    const inputDisposable = term.onData(data => {
      if (currentSessionId) {
        invoke('write_to_terminal', { sessionId: currentSessionId, data }).catch(console.error);
      }
    });

    // Setup output listener
    const setupListener = async (sessionId: string) => {
      const unlisten = await listen<{ session_id: string; data: string }>(
        'terminal-output',
        event => {
          const { session_id, data } = event.payload;
          if (session_id === sessionId) {
            term.write(data);
          }
        }
      );
      return unlisten;
    };

    // Create terminal session
    invoke('create_terminal_session', { shellPath: preferences.terminal.shellPath })
      .then(async id => {
        currentSessionId = id as string;
        term.writeln(`Context: ${selectedContext?.name || 'No context selected'}`);

        // Setup listener after session is created
        unlistenFn = await setupListener(currentSessionId);
      })
      .catch((error: unknown) => {
        console.error('Failed to create terminal session:', error);
        term.writeln('Failed to create terminal session');
        term.writeln(String(error));
      });

    return () => {
      inputDisposable.dispose();
      term.dispose();
      if (unlistenFn) {
        unlistenFn();
      }
      if (currentSessionId) {
        invoke('close_terminal_session', { sessionId: currentSessionId }).catch(console.error);
      }
    };
  }, [selectedContext, preferences.terminal.shellPath]);

  // Handle terminal pane resize
  useEffect(() => {
    if (!terminalRef.current || !fitAddon.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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
