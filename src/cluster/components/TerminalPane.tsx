import { useRef, useEffect, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { debug } from '@tauri-apps/plugin-log';
import { ClusterContext } from '../../lib/contextTree';
import { loadPreferences } from '../../lib/fs';
import { getContextTags, getTagById } from '../../lib/tag';

interface TerminalPaneProps {
  activeTabId: string | undefined;
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
  tabId: string;
  mounted: boolean;
  clusterContext: ClusterContext;
}

/**
 * Individual terminal instance component
 */
function TerminalInstance({ session, isVisible }: TerminalInstanceProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Mount terminal when it becomes visible for the first time
  useEffect(() => {
    if (!terminalRef.current || session.mounted || !isVisible) return;

    debug(`TerminalInstance: Mounting terminal for tab ${session.tabId}`);
    session.terminal.open(terminalRef.current);
    session.fitAddon.fit();
    session.mounted = true;
  }, [session, isVisible]);

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
function TerminalPane({ activeTabId, allTerminalSessions }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextColor, setContextColor] = useState<string | undefined>(undefined);

  // Handle terminal pane resize
  useEffect(() => {
    if (!containerRef.current || !activeTabId) return;

    const resizeObserver = new ResizeObserver(() => {
      // Fit the currently visible terminal
      const visibleSession = allTerminalSessions.get(activeTabId);
      if (visibleSession) {
        visibleSession.fitAddon.fit();
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeTabId, allTerminalSessions]);

  useEffect(() => {
    const activeSession = activeTabId ? allTerminalSessions.get(activeTabId) : undefined;
    if (activeSession) {
      const tagIds = getContextTags(activeSession.clusterContext.id);
      if (tagIds.length > 0) {
        const firstTag = getTagById(tagIds[0]);
        setContextColor(firstTag?.color);
      } else {
        setContextColor(undefined);
      }
    } else {
      setContextColor(undefined);
    }
  }, [activeTabId, allTerminalSessions]);

  const activeSession = activeTabId ? allTerminalSessions.get(activeTabId) : undefined;

  return (
    <div className="terminal-pane">
      <div className="terminal-header">
        <span style={{ color: contextColor }}>
          {activeSession ? `Context: ${activeSession.clusterContext.id}` : 'No context selected'}
        </span>
      </div>
      <div className="terminal-container" ref={containerRef}>
        {Array.from(allTerminalSessions.entries()).map(([tabId, session]) => {
          const isVisible = tabId === activeTabId;
          return <TerminalInstance key={tabId} session={session} isVisible={isVisible} />;
        })}
      </div>
    </div>
  );
}

export const createTerminalSession = async (
  clusterContext: ClusterContext,
  tabId: string
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
    contextName: clusterContext.id,
  })) as string;

  // Handle terminal input
  term.onData(data => {
    invoke('write_to_terminal', { sessionId, data }).catch(console.error);
  });

  // Handle paste (Ctrl+V / Cmd+V)
  term.attachCustomKeyEventHandler(e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && e.type === 'keydown') {
      navigator.clipboard
        .readText()
        .then(text => {
          term.paste(text);
        })
        .catch(console.error);
      return false;
    }
    return true;
  });

  // Setup output listener
  const unlisten = await listen<{ session_id: string; data: string }>('terminal-output', event => {
    const { session_id, data } = event.payload;
    if (session_id === sessionId) {
      term.write(data);
    }
  });

  return {
    terminal: term,
    sessionId,
    unlisten,
    fitAddon: fit,
    tabId,
    mounted: false,
    clusterContext,
  };
};

export default TerminalPane;
