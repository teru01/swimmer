import { ContextNode } from '../../lib/contextTree';
import { ClusterContextTab } from '../types/panel';
import { useTabContextMenu } from './useTabContextMenu';

interface ClusterTabsProps {
  tabs: ClusterContextTab[];
  activeContextId: string | undefined;
  onSelectCluster: (clusterContext: ContextNode) => void;
  onCloseCluster: (clusterContext: ContextNode) => void;
  onReloadCluster?: (clusterContext: ContextNode) => void;
  onSplitRight?: (clusterContext: ContextNode) => void;
}

/**
 * Component to display cluster tabs at the top
 */
function ClusterTabs({
  tabs,
  activeContextId,
  onSelectCluster: onClusterSelect,
  onCloseCluster: onCloseCluster,
  onReloadCluster,
  onSplitRight,
}: ClusterTabsProps) {
  const { handleContextMenu } = useTabContextMenu({
    tabs,
    onCloseTab: onCloseCluster,
    onReloadTab: onReloadCluster,
    onSplitRight,
  });

  return (
    <div className="cluster-tabs">
      {tabs.map(tab => {
        // Reconstruct ContextNode for callbacks
        const contextNode: ContextNode = {
          id: `context-${tab.clusterContext.id}`,
          name: tab.clusterContext.clusterName,
          type: 'context' as const,
          clusterContext: tab.clusterContext,
        };

        return (
          <div
            key={tab.clusterContext.id}
            className={`cluster-tab ${activeContextId === tab.clusterContext.id ? 'active' : ''}`}
            onClick={() => onClusterSelect(contextNode)}
            onContextMenu={e => handleContextMenu(e, contextNode)}
          >
            {tab.clusterContext.clusterName}
            <button
              onClick={e => {
                e.stopPropagation();
                onCloseCluster(contextNode);
              }}
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ClusterTabs;
