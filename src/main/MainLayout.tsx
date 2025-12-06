import { useState, useRef, Fragment } from 'react';
import { PreferencesSection } from '../preferences/PreferencesPage';
import ContextsPane from '../kubeContexts/components/ContextsPane';
import ClusterOperationPanelComponent from '../cluster/components/ClusterOperationPanelComponent';
import { ClusterViewState } from '../cluster/components/ClusterInfoPane';
import { createTerminalSession, TerminalSession } from '../cluster/components/TerminalPane';
import ChatPane from '../chat/components/ChatPane';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { invoke } from '@tauri-apps/api/core';
import { debug } from '@tauri-apps/plugin-log';
import './resizable.css';
import { ContextNode, NodeType, newClusterContextNode } from '../lib/contextTree';
import { usePreferences } from '../contexts/PreferencesContext';
import {
  ClusterOperationPanel,
  ClusterContextTab,
  createDefaultPanel,
} from '../cluster/types/panel';
import { resourceGroups } from '../cluster/components/ResourceKindSidebar';
import {
  handleContextNodeSelect as handleContextNodeSelectLogic,
  handleContextNodeClose as handleContextNodeCloseLogic,
  handleSplitRight as handleSplitRightLogic,
} from './panelLogic';

const createDefaultClusterViewState = (): ClusterViewState => ({
  selectedKind: 'Overview',
  selectedResourceDetail: undefined,
  isDetailLoading: false,
  showDetailPane: false,
  expandedGroups: new Set(resourceGroups.map(group => group.groupName)),
});

interface MainLayoutProps {
  onNavigateToPreferences?: (section?: PreferencesSection) => void;
}

/**
 * Main Layout Component
 * - Left: Context hierarchy list (full height)
 * - Center: Cluster tabs on top, Cluster information and Terminal below
 * - Right: AI chat
 */
function MainLayout({ onNavigateToPreferences }: MainLayoutProps) {
  const { preferences } = usePreferences();

  // include folder
  const [selectedContext, setSelectedContext] = useState<ContextNode | undefined>(undefined);

  // ClusterOperationPanel management (max 10 panels)
  const [panels, setPanels] = useState<ClusterOperationPanel[]>(() => [createDefaultPanel()]);
  const [activePanelId, setActivePanelId] = useState<string>(panels[0].id);

  // Terminal sessions keyed by tab id
  const [terminalSessions, setTerminalSessions] = useState<Map<string, TerminalSession>>(new Map());

  // Cluster view states keyed by tab id
  const [clusterViewStates, setClusterViewStates] = useState<Map<string, ClusterViewState>>(
    new Map()
  );

  // Tab activation history (stored for future use)
  const tabHistoryRef = useRef<string[]>([]);

  // Add tab to history
  const addToTabHistory = (tabId: string) => {
    tabHistoryRef.current.push(tabId);
    const maxSize = preferences.tabHistory.maxSize;

    // Keep only the last maxSize entries
    if (tabHistoryRef.current.length > maxSize) {
      tabHistoryRef.current = tabHistoryRef.current.slice(tabHistoryRef.current.length - maxSize);
    }

    debug(
      `MainLayout: Tab history updated. Added: ${tabId}, History length: ${tabHistoryRef.current.length}/${maxSize}`
    );
  };

  // Context selection handler
  const handleContextNodeSelect = async (contextNode: ContextNode) => {
    const newState = handleContextNodeSelectLogic(
      { panels, activePanelId, selectedContext },
      contextNode
    );

    setSelectedContext(newState.selectedContext);
    setActivePanelId(newState.activePanelId);
    setPanels(newState.panels);

    // Add to tab history if a new tab was created or existing tab was activated
    if (contextNode.type === NodeType.Context && contextNode.clusterContext) {
      const contextId = contextNode.clusterContext.id;
      const activePanel = newState.panels.find(p => p.id === newState.activePanelId);
      const activeTab = activePanel?.tabs.find(t => t.clusterContext.id === contextId);
      if (activeTab) {
        addToTabHistory(activeTab.id);
      }
    }

    // Handle side effects (terminal session, cluster view state)
    if (contextNode.type === NodeType.Context && contextNode.clusterContext) {
      const contextId = contextNode.clusterContext.id;
      const activePanel = newState.panels.find(p => p.id === newState.activePanelId);
      const activeTab = activePanel?.tabs.find(t => t.clusterContext.id === contextId);

      if (activeTab) {
        // Get or create terminal session
        if (!terminalSessions.has(activeTab.id)) {
          debug(`MainLayout: Creating new session for tab ${activeTab.id}`);
          try {
            const session = await createTerminalSession(contextNode.clusterContext, activeTab.id);
            setTerminalSessions(prev => new Map(prev).set(activeTab.id, session));
          } catch (error) {
            console.error('Failed to create terminal session:', error);
          }
        }

        // Get or create cluster view state
        if (!clusterViewStates.has(activeTab.id)) {
          debug(`MainLayout: Creating new cluster view state for tab ${activeTab.id}`);
          setClusterViewStates(prev =>
            new Map(prev).set(activeTab.id, createDefaultClusterViewState())
          );
        }
      }
    }
  };

  // Context selection handler from ClusterTabs
  const handleContextSelectOnTab = (tab: ClusterContextTab) => {
    setSelectedContext(newClusterContextNode(tab.clusterContext, undefined));
    setActivePanelId(tab.panelId);

    // Add to tab history
    addToTabHistory(tab.id);

    // Update panel's active context
    setPanels(prev =>
      prev.map(panel => {
        if (panel.id === tab.panelId) {
          return {
            ...panel,
            activeContextId: tab.clusterContext.id,
          };
        }
        return panel;
      })
    );
  };

  const handleClusterViewStateChange = (tabId: string, state: ClusterViewState) => {
    setClusterViewStates(prev => new Map(prev).set(tabId, state));
  };

  const handleReloadCluster = async (tab: ClusterContextTab) => {
    debug(`MainLayout: Reloading cluster tab ${tab.id}`);

    // Reset cluster view state to default
    setClusterViewStates(prev => new Map(prev).set(tab.id, createDefaultClusterViewState()));

    // Close and recreate terminal session
    const session = terminalSessions.get(tab.id);
    if (session) {
      try {
        await invoke('close_terminal_session', { sessionId: session.sessionId });
        session.unlisten();
        session.terminal.dispose();

        // Create new session
        const newSession = await createTerminalSession(tab.clusterContext, tab.id);
        setTerminalSessions(prev => new Map(prev).set(tab.id, newSession));
      } catch (error) {
        console.error('Failed to reload terminal session:', error);
      }
    }
  };

  const handleContextNodeClose = async (tab: ClusterContextTab) => {
    // Close terminal session
    const session = terminalSessions.get(tab.id);
    if (session) {
      debug(`MainLayout: Closing terminal session for tab ${tab.id}`);
      try {
        await invoke('close_terminal_session', { sessionId: session.sessionId });
        session.unlisten();
        session.terminal.dispose();
        setTerminalSessions(prev => {
          const next = new Map(prev);
          next.delete(tab.id);
          return next;
        });
      } catch (error) {
        console.error('Failed to close terminal session:', error);
      }
    }

    // Remove cluster view state
    setClusterViewStates(prev => {
      const next = new Map(prev);
      next.delete(tab.id);
      return next;
    });

    // Apply logic
    const result = handleContextNodeCloseLogic(
      { panels, activePanelId, selectedContext },
      tab,
      tabHistoryRef.current
    );

    // Update state
    setSelectedContext(result.state.selectedContext);
    setActivePanelId(result.state.activePanelId);
    setPanels(result.state.panels);
    tabHistoryRef.current = result.newTabHistory;
  };

  const handleCloseOtherTabs = async (tab: ClusterContextTab) => {
    const tabsToClose = panels
      .flatMap(panel => panel.tabs)
      .filter(t => t.id !== tab.id && t.panelId === tab.panelId);

    // Close all terminal sessions and view states
    for (const t of tabsToClose) {
      const session = terminalSessions.get(t.id);
      if (session) {
        try {
          await invoke('close_terminal_session', { sessionId: session.sessionId });
          session.unlisten();
          session.terminal.dispose();
        } catch (error) {
          console.error('Failed to close terminal session:', error);
        }
      }
    }

    // Update all state at once
    setTerminalSessions(prev => {
      const next = new Map(prev);
      tabsToClose.forEach(t => next.delete(t.id));
      return next;
    });

    setClusterViewStates(prev => {
      const next = new Map(prev);
      tabsToClose.forEach(t => next.delete(t.id));
      return next;
    });

    // Apply close logic for all tabs
    let currentState = { panels, activePanelId, selectedContext };
    let currentHistory = tabHistoryRef.current;

    for (const t of tabsToClose) {
      const result = handleContextNodeCloseLogic(currentState, t, currentHistory);
      currentState = result.state;
      currentHistory = result.newTabHistory;
    }

    // Update state
    setSelectedContext(currentState.selectedContext);
    setActivePanelId(currentState.activePanelId);
    setPanels(currentState.panels);
    tabHistoryRef.current = currentHistory;
  };

  const handleSplitRight = async (tab: ClusterContextTab) => {
    const result = handleSplitRightLogic({ panels, activePanelId, selectedContext }, tab);

    if (!result) {
      debug('MainLayout: Cannot split, maximum 10 panels reached or panel not found');
      return;
    }

    debug(`MainLayout: Splitting panel. New panel ID: ${result.newPanelId}`);

    // Create terminal session for new tab
    debug(`MainLayout: Creating terminal session for new tab ${result.newTab.id}`);
    try {
      const newSession = await createTerminalSession(tab.clusterContext, result.newTab.id);
      setTerminalSessions(prev => new Map(prev).set(result.newTab.id, newSession));
      debug(`MainLayout: Terminal session created successfully for tab ${result.newTab.id}`);
    } catch (error) {
      console.error('Failed to create terminal session for split panel:', error);
    }

    // Copy cluster view state from source tab
    const sourceViewState = clusterViewStates.get(tab.id);
    if (sourceViewState) {
      setClusterViewStates(prev =>
        new Map(prev).set(result.newTab.id, {
          ...sourceViewState,
          expandedGroups: new Set(sourceViewState.expandedGroups),
        })
      );
    } else {
      setClusterViewStates(prev =>
        new Map(prev).set(result.newTab.id, createDefaultClusterViewState())
      );
    }

    // Update state
    setPanels(result.state.panels);
    setActivePanelId(result.state.activePanelId);

    // Add to tab history
    addToTabHistory(result.newTab.id);
  };

  const handlePanelClick = (panelId: string) => {
    setActivePanelId(panelId);
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
                onNavigateToPreferences={onNavigateToPreferences}
              />
            </div>
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* Center area: ClusterOperationPanels */}
          <Panel defaultSize={60} minSize={30}>
            <PanelGroup direction="horizontal">
              {panels.map((panel, index) => (
                <Fragment key={panel.id}>
                  <Panel defaultSize={100 / panels.length} minSize={10}>
                    <ClusterOperationPanelComponent
                      panel={panel}
                      activePanelId={activePanelId}
                      allTerminalSessions={terminalSessions}
                      allClusterViewStates={clusterViewStates}
                      onSelectCluster={handleContextSelectOnTab}
                      onCloseCluster={handleContextNodeClose}
                      onCloseOtherTabs={handleCloseOtherTabs}
                      onReloadCluster={handleReloadCluster}
                      onSplitRight={handleSplitRight}
                      onViewStateChange={handleClusterViewStateChange}
                      onPanelClick={handlePanelClick}
                    />
                  </Panel>
                  {index < panels.length - 1 && (
                    <PanelResizeHandle className="resize-handle-vertical" />
                  )}
                </Fragment>
              ))}
            </PanelGroup>
          </Panel>

          {preferences.ui.showAiChatPane && (
            <>
              <PanelResizeHandle className="resize-handle" />

              {/* Right pane: AI chat */}
              <Panel defaultSize={25} minSize={15}>
                <div className="chat-pane-container">
                  <ChatPane selectedClusterContext={selectedContext?.clusterContext} />
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
