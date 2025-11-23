import { useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { debug } from '@tauri-apps/plugin-log';
import { ClusterContext } from '../../lib/contextTree';
import { loadPreferences } from '../../lib/fs';
import { createCompositeKey } from '../types/panel';

interface TerminalPaneProps {
  panelId: string;
  selectedClusterContext: ClusterContext | undefined;
  allTerminalSessions: Map<string, TerminalSession>;
}

interface TerminalInstanceProps {
  session: TerminalSession;
  isVisible: boolean;
  onResize?: () => void;
}

export interface TerminalSession {
  terminal: Terminal;
  sessionId: string;
  unlisten: () => void;
  fitAddon: FitAddon;
  compositeKey: string;
  mounted: boolean;
}

/**
 * Individual terminal instance component
 */
function TerminalInstance({ session, isVisible }: TerminalInstanceProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Mount terminal when component mounts
  useEffect(() => {
    if (!terminalRef.current || session.mounted) return;

    debug(`TerminalInstance: Mounting terminal for ${session.compositeKey}`);
    session.terminal.open(terminalRef.current);
    session.fitAddon.fit();
    session.mounted = true;
  }, [session]);

  // Fit terminal when visibility changes
  useEffect(() => {
    if (isVisible && session.mounted) {
      session.fitAddon.fit();
    }
  }, [isVisible, session]);

  return (
    <div
      ref={terminalRef}
      style={{
        width: '100%',
        height: '100%',
        display: isVisible ? 'block' : 'none',
      }}
    />
  );
}

/**
 * Terminal pane component with real terminal functionality
 */
function TerminalPane({ panelId, selectedClusterContext, allTerminalSessions }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle terminal pane resize
  useEffect(() => {
    if (!containerRef.current || !selectedClusterContext) return;

    const compositeKey = createCompositeKey(panelId, selectedClusterContext.id);
    const resizeObserver = new ResizeObserver(() => {
      // Fit the currently visible terminal
      const visibleSession = allTerminalSessions.get(compositeKey);
      if (visibleSession) {
        visibleSession.fitAddon.fit();
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [panelId, selectedClusterContext, allTerminalSessions]);

  return (
    <div className="terminal-pane">
      <div className="terminal-header">
        <span>Terminal</span>
        <span>
          {selectedClusterContext
            ? `Context: ${selectedClusterContext.clusterName}`
            : 'No context selected'}
        </span>
      </div>
      <div className="terminal-container" ref={containerRef}>
        {selectedClusterContext &&
          Array.from(allTerminalSessions.entries())
            .filter(([compositeKey]) => {
              const currentCompositeKey = createCompositeKey(panelId, selectedClusterContext.id);
              return compositeKey === currentCompositeKey;
            })
            .map(([compositeKey, session]) => (
              <TerminalInstance key={compositeKey} session={session} isVisible={true} />
            ))}
      </div>
    </div>
  );
}

export const createTerminalSession = async (
  clusterContext: ClusterContext,
  compositeKey: string
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

  debug(`createTerminalSession: Creating session for ${clusterContext.id}`);

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

  term.writeln(`Context: ${clusterContext.id}`);

  return {
    terminal: term,
    sessionId,
    unlisten,
    fitAddon: fit,
    compositeKey,
    mounted: false,
  };
};

export default TerminalPane;
