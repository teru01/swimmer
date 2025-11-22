import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import ClusterTabs from './ClusterTabs';
import ClusterInfoPane, { ClusterViewState } from './ClusterInfoPane';
import TerminalPane, { TerminalSession } from './TerminalPane';
import { ContextNode } from '../../lib/contextTree';
import { ClusterOperationPanel } from '../types/panel';

interface ClusterOperationPanelComponentProps {
  panel: ClusterOperationPanel;
  selectedContext: ContextNode | undefined;
  allTerminalSessions: Map<string, TerminalSession>;
  allClusterViewStates: Map<string, ClusterViewState>;
  onSelectCluster: (contextNode: ContextNode) => void;
  onCloseCluster: (contextNode: ContextNode) => void;
  onReloadCluster: (contextNode: ContextNode) => void;
  onSplitRight: (contextNode: ContextNode) => void;
  onViewStateChange: (compositeKey: string, state: ClusterViewState) => void;
  panelWidth: string;
}

/**
 * ClusterOperationPanel component containing tabs, resource sidebar, details, and terminal
 */
function ClusterOperationPanelComponent({
  panel,
  selectedContext,
  allTerminalSessions,
  allClusterViewStates,
  onSelectCluster,
  onCloseCluster,
  onReloadCluster,
  onSplitRight,
  onViewStateChange,
  panelWidth,
}: ClusterOperationPanelComponentProps) {
  const activeCluster = panel.contextNodes.find(node => node.id === panel.activeContextId);
  const activeContextForThisPanel = activeCluster;

  return (
    <div className="cluster-operation-panel" style={{ width: panelWidth }}>
      <div className="center-area">
        {/* Cluster tabs */}
        <div className="center-tabs">
          <ClusterTabs
            contextNodes={panel.contextNodes}
            activeCluster={activeCluster}
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
                selectedContext={activeContextForThisPanel}
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
              selectedContext={activeContextForThisPanel}
              allTerminalSessions={allTerminalSessions}
            />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default ClusterOperationPanelComponent;
