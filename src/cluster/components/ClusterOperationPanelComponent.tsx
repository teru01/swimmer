import { useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import ClusterTabs from './ClusterTabs';
import ClusterInfoPane, { ClusterViewState } from './ClusterInfoPane';
import TerminalPane, { TerminalSession } from './TerminalPane';
import { ClusterOperationPanel, ClusterContextTab } from '../types/panel';
import { KubeResource } from './ResourceList';

interface ClusterOperationPanelComponentProps {
  panel: ClusterOperationPanel;
  activePanelId: string;
  allTerminalSessions: Map<string, TerminalSession>;
  allClusterViewStates: Map<string, ClusterViewState>;
  onSelectCluster: (tab: ClusterContextTab) => void;
  onCloseCluster: (tab: ClusterContextTab) => void;
  onCloseOtherTabs?: (tab: ClusterContextTab) => void;
  onReloadCluster: (tab: ClusterContextTab) => void;
  onSplitRight: (tab: ClusterContextTab) => void;
  onViewStateChange: (tabId: string, state: ClusterViewState) => void;
  onPanelClick?: (panelId: string) => void;
  onNavigateToResourceInNewPanel?: (pod: KubeResource, contextId: string) => void;
}

/**
 * Collect terminal sessions that belong to this panel's tabs.
 * Each split pane must own its own xterm instances so FitAddon measures
 * that pane's width instead of a sibling pane's.
 */
function collectPanelTerminalSessions(
  tabs: ClusterContextTab[],
  allTerminalSessions: Map<string, TerminalSession>
): Map<string, TerminalSession> {
  const sessions = new Map<string, TerminalSession>();
  for (const tab of tabs) {
    const session = allTerminalSessions.get(tab.id);
    if (session) {
      sessions.set(tab.id, session);
    }
  }
  return sessions;
}

/**
 * ClusterOperationPanel component containing tabs, resource sidebar, details, and terminal
 */
function ClusterOperationPanelComponent({
  panel,
  activePanelId,
  allTerminalSessions,
  allClusterViewStates,
  onSelectCluster,
  onCloseCluster,
  onCloseOtherTabs,
  onReloadCluster,
  onSplitRight,
  onViewStateChange,
  onPanelClick,
  onNavigateToResourceInNewPanel,
}: ClusterOperationPanelComponentProps) {
  const activeTab = panel.tabs.find(tab => tab.clusterContext.id === panel.activeContextId);

  const tabContextMap = new Map<string, string>();
  panel.tabs.forEach(tab => {
    tabContextMap.set(tab.id, tab.clusterContext.id);
  });

  const panelTerminalSessions = useMemo(
    () => collectPanelTerminalSessions(panel.tabs, allTerminalSessions),
    [panel.tabs, allTerminalSessions]
  );

  const handlePanelClick = () => {
    if (activePanelId !== panel.id && onPanelClick) {
      onPanelClick(panel.id);
    }
  };

  return (
    <div className="cluster-operation-panel" onClick={handlePanelClick}>
      <div className="center-area">
        {/* Cluster tabs */}
        <div className="center-tabs">
          <ClusterTabs
            tabs={panel.tabs}
            activeContextId={panel.activeContextId}
            activePanelId={activePanelId}
            onSelectCluster={onSelectCluster}
            onCloseCluster={onCloseCluster}
            onCloseOtherTabs={onCloseOtherTabs}
            onReloadCluster={onReloadCluster}
            onSplitRight={onSplitRight}
          />
        </div>

        <PanelGroup direction="vertical">
          {/* Cluster information */}
          <Panel defaultSize={70} minSize={20}>
            <div className="cluster-info-pane-container">
              <ClusterInfoPane
                activeTabId={activeTab?.id}
                activeContextId={activeTab?.clusterContext.id}
                allViewStates={allClusterViewStates}
                tabContextMap={tabContextMap}
                onViewStateChange={onViewStateChange}
                onNavigateToResourceInNewPanel={onNavigateToResourceInNewPanel}
                isActivePanel={activePanelId === panel.id}
              />
            </div>
          </Panel>

          <PanelResizeHandle className="resize-handle horizontal" />

          {/* Terminal */}
          <Panel defaultSize={30} minSize={10}>
            <TerminalPane activeTabId={activeTab?.id} allTerminalSessions={panelTerminalSessions} />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default ClusterOperationPanelComponent;
