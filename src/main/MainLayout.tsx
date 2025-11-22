import { useState } from 'react';
import ClusterTabs from '../cluster/components/ClusterTabs';
import ContextsPane from '../kubeContexts/components/ContextsPane';
import ClusterInfoPane, { ClusterViewState } from '../cluster/components/ClusterInfoPane';
import TerminalPane, {
  createTerminalSession,
  TerminalSession,
} from '../cluster/components/TerminalPane';
import ChatPane from '../chat/components/ChatPane';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { invoke } from '@tauri-apps/api/core';
import { debug } from '@tauri-apps/plugin-log';
import './resizable.css';
import { ContextNode, NodeType } from '../lib/contextTree';
import { usePreferences } from '../contexts/PreferencesContext';

const createDefaultClusterViewState = (): ClusterViewState => ({
  selectedKind: undefined,
  selectedResourceDetail: undefined,
  isDetailLoading: false,
  showDetailPane: false,
  expandedGroups: new Set(['Overview', 'Cluster', 'Workloads']),
});

/**
 * Main Layout Component
 * - Left: Context hierarchy list (full height)
 * - Center: Cluster tabs on top, Cluster information and Terminal below
 * - Right: AI chat
 */
function MainLayout() {
  const { preferences } = usePreferences();

  // Currently selected cluster and context
  const [selectedClusterContext, setSelectedClusterContext] = useState<ContextNode | undefined>(
    undefined
  );
  // include folder
  const [selectedContext, setSelectedContext] = useState<ContextNode | undefined>(undefined);
  const [openClusterContexts, setOpenClusterContexts] = useState<ContextNode[]>([]);
  const [terminalSessions, setTerminalSessions] = useState<Map<string, TerminalSession>>(new Map());
  const [clusterViewStates, setClusterViewStates] = useState<Map<string, ClusterViewState>>(
    new Map()
  );

  // Context selection handler
  const handleContextNodeSelect = async (contextNode: ContextNode) => {
    setSelectedContext(contextNode);
    if (contextNode.type === NodeType.Context) {
      setSelectedClusterContext(contextNode);
      setOpenClusterContexts(prev =>
        prev.some(item => item.id === contextNode.id) ? prev : [...prev, contextNode]
      );

      // Get or create terminal session
      if (!terminalSessions.has(contextNode.id)) {
        debug(`MainLayout: Creating new session for ${contextNode.id}`);
        try {
          const session = await createTerminalSession(contextNode);
          setTerminalSessions(prev => new Map(prev).set(contextNode.id, session));
        } catch (error) {
          console.error('Failed to create terminal session:', error);
        }
      }

      // Get or create cluster view state
      if (!clusterViewStates.has(contextNode.id)) {
        debug(`MainLayout: Creating new cluster view state for ${contextNode.id}`);
        setClusterViewStates(prev =>
          new Map(prev).set(contextNode.id, createDefaultClusterViewState())
        );
      }
    }
  };

  const handleClusterViewStateChange = (state: ClusterViewState) => {
    if (selectedClusterContext) {
      setClusterViewStates(prev => new Map(prev).set(selectedClusterContext.id, state));
    }
  };

  const handleContextNodeClose = async (contextNode: ContextNode) => {
    // Close terminal session
    const session = terminalSessions.get(contextNode.id);
    if (session) {
      debug(`MainLayout: Closing terminal session for ${contextNode.id}`);
      try {
        // Close backend session
        await invoke('close_terminal_session', { sessionId: session.sessionId });
        // Cleanup frontend
        session.unlisten();
        session.terminal.dispose();
        setTerminalSessions(prev => {
          const next = new Map(prev);
          next.delete(contextNode.id);
          return next;
        });
      } catch (error) {
        console.error('Failed to close terminal session:', error);
      }
    }

    // Remove cluster view state
    setClusterViewStates(prev => {
      const next = new Map(prev);
      next.delete(contextNode.id);
      return next;
    });

    setOpenClusterContexts(prev => {
      const deleteNodeIdx = prev.findIndex(c => c.id === contextNode.id);
      const newContexts = prev.filter(c => c.id !== contextNode.id);

      if (selectedClusterContext?.id === contextNode.id) {
        const next = newContexts[Math.max(0, deleteNodeIdx - 1)];
        setSelectedClusterContext(next);
        setSelectedContext(next);
      }
      return newContexts;
    });
  };

  return (
    <div className="layout-container">
      <div className="main-content">
        <PanelGroup direction="horizontal">
          {/* Left pane: Context hierarchy (full height) */}
          <Panel defaultSize={15} minSize={10} maxSize={25}>
            <div className="contexts-pane-container">
              <ContextsPane
                selectedContext={selectedContext}
                onContextNodeSelect={handleContextNodeSelect}
              />
            </div>
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* Center area: Cluster tabs + info + Terminal */}
          <Panel defaultSize={60} minSize={30}>
            <div className="center-area">
              {/* Cluster tabs */}
              <div className="center-tabs">
                <ClusterTabs
                  contextNodes={openClusterContexts}
                  activeCluster={selectedClusterContext}
                  onSelectCluster={handleContextNodeSelect}
                  onCloseCluster={handleContextNodeClose}
                />
              </div>

              <PanelGroup direction="vertical">
                {/* Center top: Cluster information */}
                <Panel defaultSize={50} minSize={20}>
                  <div className="cluster-info-pane-container">
                    <ClusterInfoPane
                      selectedContext={selectedContext}
                      viewState={
                        clusterViewStates.get(selectedClusterContext?.id || '') ||
                        createDefaultClusterViewState()
                      }
                      onViewStateChange={handleClusterViewStateChange}
                    />
                  </div>
                </Panel>

                <PanelResizeHandle className="resize-handle horizontal" />

                {/* Center bottom: Terminal */}
                <Panel defaultSize={50} minSize={20}>
                  <TerminalPane
                    selectedContext={selectedContext}
                    allTerminalSessions={terminalSessions}
                  />
                </Panel>
              </PanelGroup>
            </div>
          </Panel>

          {preferences.ui.showAiChatPane && (
            <>
              <PanelResizeHandle className="resize-handle" />

              {/* Right pane: AI chat */}
              <Panel defaultSize={25} minSize={15}>
                <div className="chat-pane-container">
                  <ChatPane selectedContext={selectedContext} />
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}

export default MainLayout;
