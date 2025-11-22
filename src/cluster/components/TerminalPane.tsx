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
  allTerminalSessions: Map<string, TerminalSession>;
}

export interface TerminalSession {
  terminal: Terminal;
  sessionId: string;
  unlisten: () => void;
  fitAddon: FitAddon;
  contextId: string;
  mounted: boolean;
}

/**
 * Terminal pane component with real terminal functionality
 */
function TerminalPane({
  selectedContext,
  terminalSession,
  allTerminalSessions,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mount all terminal sessions and keep them in DOM
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    allTerminalSessions.forEach((session, contextId) => {
      if (!session.mounted) {
        debug(`TerminalPane: Mounting terminal for contextId=${contextId}`);

        const terminalDiv = document.createElement('div');
        terminalDiv.className = 'terminal-instance';
        terminalDiv.setAttribute('data-context-id', contextId);
        terminalDiv.style.width = '100%';
        terminalDiv.style.height = '100%';
        terminalDiv.style.display = 'none'; // Initially hidden

        container.appendChild(terminalDiv);
        session.terminal.open(terminalDiv);
        session.fitAddon.fit();
        session.mounted = true;
      }
    });
  }, [allTerminalSessions]);

  // Show/hide terminals based on active session
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const allTerminalDivs = container.querySelectorAll('.terminal-instance');

    allTerminalDivs.forEach(div => {
      const htmlDiv = div as HTMLDivElement;
      const contextId = htmlDiv.getAttribute('data-context-id');

      if (contextId === selectedContext?.id) {
        htmlDiv.style.display = 'block';
        // Fit terminal when it becomes visible
        const session = allTerminalSessions.get(contextId);
        if (session) {
          session.fitAddon.fit();
        }
      } else {
        htmlDiv.style.display = 'none';
      }
    });
  }, [selectedContext, allTerminalSessions]);

  // Handle terminal pane resize
  useEffect(() => {
    if (!containerRef.current || !terminalSession) return;

    const resizeObserver = new ResizeObserver(() => {
      if (terminalSession?.fitAddon) {
        terminalSession.fitAddon.fit();
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [terminalSession]);

  return (
    <div className="terminal-pane">
      <div className="terminal-header">
        <span>Terminal</span>
        <span>{selectedContext ? `Context: ${selectedContext.name}` : 'No context selected'}</span>
      </div>
      <div className="terminal-container" ref={containerRef} />
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
    contextId: selectedContext.id,
    mounted: false,
  };
};

export default TerminalPane;
