import { useState } from 'react';
import ContextsPane from '../kubeContexts/components/ContextsPane';
import ClusterOperationPanelComponent from '../cluster/components/ClusterOperationPanelComponent';
import { ClusterViewState } from '../cluster/components/ClusterInfoPane';
import { createTerminalSession, TerminalSession } from '../cluster/components/TerminalPane';
import ChatPane from '../chat/components/ChatPane';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { invoke } from '@tauri-apps/api/core';
import { debug } from '@tauri-apps/plugin-log';
import './resizable.css';
import { ContextNode, NodeType } from '../lib/contextTree';
import { usePreferences } from '../contexts/PreferencesContext';
import { ClusterOperationPanel, generatePanelId, createCompositeKey } from '../cluster/types/panel';
import { resourceGroups } from '../cluster/components/ResourceKindSidebar';

const createDefaultClusterViewState = (): ClusterViewState => ({
  selectedKind: undefined,
  selectedResourceDetail: undefined,
  isDetailLoading: false,
  showDetailPane: false,
  expandedGroups: new Set(resourceGroups.map(group => group.groupName)),
});

/**
 * Main Layout Component
 * - Left: Context hierarchy list (full height)
 * - Center: Cluster tabs on top, Cluster information and Terminal below
 * - Right: AI chat
 */
function MainLayout() {
  const { preferences } = usePreferences();

  // include folder
  const [selectedContext, setSelectedContext] = useState<ContextNode | undefined>(undefined);

  // ClusterOperationPanel management (max 10 panels)
  const [panels, setPanels] = useState<ClusterOperationPanel[]>(() => [
    {
      id: generatePanelId(),
      contextNodes: [],
      activeContextId: undefined,
    },
  ]);
  const [activePanelId, setActivePanelId] = useState<string>(panels[0].id);

  // Terminal sessions keyed by composite key (panelId:contextId)
  const [terminalSessions, setTerminalSessions] = useState<Map<string, TerminalSession>>(new Map());

  // Cluster view states keyed by composite key (panelId:contextId)
  const [clusterViewStates, setClusterViewStates] = useState<Map<string, ClusterViewState>>(
    new Map()
  );

  // Context selection handler
  const handleContextNodeSelect = async (contextNode: ContextNode) => {
    setSelectedContext(contextNode);
    if (contextNode.type === NodeType.Context) {
      const currentPanel = panels.find(p => p.id === activePanelId);
      if (!currentPanel) return;

      // Update panel's context nodes and active context
      setPanels(prev =>
        prev.map(panel => {
          if (panel.id === activePanelId) {
            const hasContext = panel.contextNodes.some(item => item.id === contextNode.id);
            return {
              ...panel,
              contextNodes: hasContext ? panel.contextNodes : [...panel.contextNodes, contextNode],
              activeContextId: contextNode.id,
            };
          }
          return panel;
        })
      );

      const compositeKey = createCompositeKey(activePanelId, contextNode.id);

      // Get or create terminal session
      if (!terminalSessions.has(compositeKey)) {
        debug(`MainLayout: Creating new session for ${compositeKey}`);
        try {
          const session = await createTerminalSession(contextNode, compositeKey);
          setTerminalSessions(prev => new Map(prev).set(compositeKey, session));
        } catch (error) {
          console.error('Failed to create terminal session:', error);
        }
      }

      // Get or create cluster view state
      if (!clusterViewStates.has(compositeKey)) {
        debug(`MainLayout: Creating new cluster view state for ${compositeKey}`);
        setClusterViewStates(prev =>
          new Map(prev).set(compositeKey, createDefaultClusterViewState())
        );
      }
    }
  };

  const handleClusterViewStateChange = (compositeKey: string, state: ClusterViewState) => {
    setClusterViewStates(prev => new Map(prev).set(compositeKey, state));
  };

  const handleReloadCluster = async (panelId: string, contextNode: ContextNode) => {
    const compositeKey = createCompositeKey(panelId, contextNode.id);
    debug(`MainLayout: Reloading cluster ${compositeKey}`);

    // Reset cluster view state to default
    setClusterViewStates(prev => new Map(prev).set(compositeKey, createDefaultClusterViewState()));

    // Close and recreate terminal session
    const session = terminalSessions.get(compositeKey);
    if (session) {
      try {
        await invoke('close_terminal_session', { sessionId: session.sessionId });
        session.unlisten();
        session.terminal.dispose();

        // Create new session
        const newSession = await createTerminalSession(contextNode, compositeKey);
        setTerminalSessions(prev => new Map(prev).set(compositeKey, newSession));
      } catch (error) {
        console.error('Failed to reload terminal session:', error);
      }
    }
  };

  const handleContextNodeClose = async (panelId: string, contextNode: ContextNode) => {
    const compositeKey = createCompositeKey(panelId, contextNode.id);

    // Close terminal session
    const session = terminalSessions.get(compositeKey);
    if (session) {
      debug(`MainLayout: Closing terminal session for ${compositeKey}`);
      try {
        await invoke('close_terminal_session', { sessionId: session.sessionId });
        session.unlisten();
        session.terminal.dispose();
        setTerminalSessions(prev => {
          const next = new Map(prev);
          next.delete(compositeKey);
          return next;
        });
      } catch (error) {
        console.error('Failed to close terminal session:', error);
      }
    }

    // Remove cluster view state
    setClusterViewStates(prev => {
      const next = new Map(prev);
      next.delete(compositeKey);
      return next;
    });

    // Update panel's context nodes
    setPanels(prev => {
      return prev
        .map(panel => {
          if (panel.id === panelId) {
            const deleteNodeIdx = panel.contextNodes.findIndex(c => c.id === contextNode.id);
            const newContexts = panel.contextNodes.filter(c => c.id !== contextNode.id);

            let newActiveContextId = panel.activeContextId;
            if (panel.activeContextId === contextNode.id) {
              const nextContext = newContexts[Math.max(0, deleteNodeIdx - 1)];
              newActiveContextId = nextContext?.id;
              if (nextContext) {
                setSelectedContext(nextContext);
              }
            }

            return {
              ...panel,
              contextNodes: newContexts,
              activeContextId: newActiveContextId,
            };
          }
          return panel;
        })
        .filter(panel => panel.contextNodes.length > 0); // Remove empty panels
    });
  };

  const handleSplitRight = async (panelId: string, contextNode: ContextNode) => {
    // Check max panels limit (10)
    if (panels.length >= 10) {
      debug('MainLayout: Cannot split, maximum 10 panels reached');
      return;
    }

    const sourcePanel = panels.find(p => p.id === panelId);
    if (!sourcePanel) return;

    const newPanelId = generatePanelId();

    // Create new panel with the same context
    setPanels(prev => [
      ...prev,
      {
        id: newPanelId,
        contextNodes: [contextNode],
        activeContextId: contextNode.id,
      },
    ]);

    // Copy terminal session state
    const sourceCompositeKey = createCompositeKey(panelId, contextNode.id);
    const newCompositeKey = createCompositeKey(newPanelId, contextNode.id);

    try {
      const newSession = await createTerminalSession(contextNode, newCompositeKey);
      setTerminalSessions(prev => new Map(prev).set(newCompositeKey, newSession));
    } catch (error) {
      console.error('Failed to create terminal session for split panel:', error);
    }

    // Copy cluster view state
    const sourceViewState = clusterViewStates.get(sourceCompositeKey);
    if (sourceViewState) {
      setClusterViewStates(prev =>
        new Map(prev).set(newCompositeKey, {
          ...sourceViewState,
          expandedGroups: new Set(sourceViewState.expandedGroups),
        })
      );
    } else {
      setClusterViewStates(prev =>
        new Map(prev).set(newCompositeKey, createDefaultClusterViewState())
      );
    }

    setActivePanelId(newPanelId);
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

          {/* Center area: ClusterOperationPanels */}
          <Panel defaultSize={60} minSize={30}>
            <div style={{ display: 'flex', height: '100%' }}>
              {panels.map(panel => {
                const panelWidth = `${100 / panels.length}%`;
                return (
                  <ClusterOperationPanelComponent
                    key={panel.id}
                    panel={panel}
                    selectedContext={selectedContext}
                    allTerminalSessions={terminalSessions}
                    allClusterViewStates={clusterViewStates}
                    onSelectCluster={handleContextNodeSelect}
                    onCloseCluster={contextNode => handleContextNodeClose(panel.id, contextNode)}
                    onReloadCluster={contextNode => handleReloadCluster(panel.id, contextNode)}
                    onSplitRight={contextNode => handleSplitRight(panel.id, contextNode)}
                    onViewStateChange={handleClusterViewStateChange}
                    panelWidth={panelWidth}
                  />
                );
              })}
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
