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
  onReloadCluster: (tab: ClusterContextTab) => void;
  onSplitRight: (tab: ClusterContextTab) => void;
  onViewStateChange: (compositeKey: string, state: ClusterViewState) => void;
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
  onReloadCluster,
  onSplitRight,
  onViewStateChange,
}: ClusterOperationPanelComponentProps) {
  const activeTab = panel.tabs.find(tab => tab.clusterContext.id === panel.activeContextId);

  // Get active cluster context
  const activeClusterContext = activeTab?.clusterContext;

  return (
    <div className="cluster-operation-panel" style={{ width: '100%', height: '100%' }}>
      <div className="center-area">
        {/* Cluster tabs */}
        <div className="center-tabs">
          <ClusterTabs
            tabs={panel.tabs}
            activeContextId={panel.activeContextId}
            activePanelId={activePanelId}
            onSelectCluster={onSelectCluster}
            onCloseCluster={onCloseCluster}
            onReloadCluster={onReloadCluster}
            onSplitRight={onSplitRight}
          />
        </div>

        <PanelGroup direction="vertical">
          {/* Cluster information */}
          <Panel defaultSize={50} minSize={20}>
            <div className="cluster-info-pane-container">
              <ClusterInfoPane
                panelId={panel.id}
                selectedClusterContext={activeClusterContext}
                allViewStates={allClusterViewStates}
                onViewStateChange={onViewStateChange}
              />
            </div>
          </Panel>

          <PanelResizeHandle className="resize-handle horizontal" />

          {/* Terminal */}
          <Panel defaultSize={50} minSize={20}>
            <TerminalPane
              panelId={panel.id}
              selectedClusterContext={activeClusterContext}
              allTerminalSessions={allTerminalSessions}
            />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default ClusterOperationPanelComponent;
