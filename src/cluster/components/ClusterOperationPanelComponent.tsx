import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import ClusterTabs from './ClusterTabs';
import ClusterInfoPane, { ClusterViewState } from './ClusterInfoPane';
import TerminalPane, { TerminalSession } from './TerminalPane';
import { ClusterOperationPanel, ClusterContextTab } from '../types/panel';

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
}: ClusterOperationPanelComponentProps) {
  const activeTab = panel.tabs.find(tab => tab.clusterContext.id === panel.activeContextId);

  const handlePanelClick = () => {
    if (activePanelId !== panel.id && onPanelClick) {
      onPanelClick(panel.id);
    }
  };

  return (
    <div
      className="cluster-operation-panel"
      style={{ width: '100%', height: '100%' }}
      onClick={handlePanelClick}
    >
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
                onViewStateChange={onViewStateChange}
              />
            </div>
          </Panel>

          <PanelResizeHandle className="resize-handle horizontal" />

          {/* Terminal */}
          <Panel defaultSize={30} minSize={10}>
            <TerminalPane activeTabId={activeTab?.id} allTerminalSessions={allTerminalSessions} />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default ClusterOperationPanelComponent;
