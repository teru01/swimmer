import { useState, useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { debug } from '@tauri-apps/plugin-log';
import { ContextNode } from '../../lib/contextTree';
import { usePreferences } from '../../contexts/PreferencesContext';
import { loadPreferences } from '../../lib/fs';

interface TerminalPaneProps {
  selectedContext: ContextNode | undefined;
  terminalSession: TerminalSession | undefined;
}

export interface TerminalSession {
  terminal: Terminal;
  sessionId: string;
  unlisten: () => void;
  fitAddon: FitAddon;
}

/**
 * Terminal pane component with real terminal functionality
 */
function TerminalPane({ selectedContext, terminalSession }: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddon = useRef<FitAddon | undefined>(undefined);
  const contextKey = selectedContext?.name || 'default';

  // Restore terminal session when it changes
  useEffect(() => {
    if (!terminalRef.current || !terminalSession) return;

    debug(`TerminalPane: Mounting terminal for contextKey=${contextKey}`);

    const { terminal, fitAddon: fit } = terminalSession;
    terminal.open(terminalRef.current);
    fit.fit();
    fitAddon.current = fit;

    return () => {
      debug(`TerminalPane: Unmounting terminal for contextKey=${contextKey}`);
      // Don't dispose, just detach
    };
  }, [terminalSession, contextKey]);

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

export const createTerminalSession = async (
  selectedContext: ContextNode
): Promise<TerminalSession> => {
  const preferences = await loadPreferences();

  // Create new terminal instance
  const term = new Terminal({
    theme: preferences.terminal.theme,
    fontSize: preferences.terminal.fontSize,
    fontFamily: preferences.terminal.fontFamily,
    cursorBlink: true,
    rows: 24,
    cols: 80,
  });

  const fit = new FitAddon();
  const webLinks = new WebLinksAddon();

  term.loadAddon(fit);
  term.loadAddon(webLinks);

  debug(`createTerminalSession: Creating session for ${selectedContext.name}`);

  // Create terminal session on backend
  const sessionId = (await invoke('create_terminal_session', {
    shellPath: preferences.terminal.shellPath,
  })) as string;

  // Handle terminal input
  term.onData(data => {
    invoke('write_to_terminal', { sessionId, data }).catch(console.error);
  });

  // Setup output listener
  const unlisten = await listen<{ session_id: string; data: string }>('terminal-output', event => {
    const { session_id, data } = event.payload;
    if (session_id === sessionId) {
      term.write(data);
    }
  });

  term.writeln(`Context: ${selectedContext.name}`);

  return {
    terminal: term,
    sessionId,
    unlisten,
    fitAddon: fit,
  };
};

export default TerminalPane;
