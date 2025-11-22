import { ContextNode } from '../../lib/contextTree';
import { useTabContextMenu } from './useTabContextMenu';

interface ClusterTabsProps {
  contextNodes: ContextNode[];
  activeCluster: ContextNode | undefined;
  onSelectCluster: (clusterContext: ContextNode) => void;
  onCloseCluster: (clusterContext: ContextNode) => void;
  onReloadCluster?: (clusterContext: ContextNode) => void;
  onSplitRight?: (clusterContext: ContextNode) => void;
}

/**
 * Component to display cluster tabs at the top
 */
function ClusterTabs({
  contextNodes: clusterContextNodes,
  activeCluster,
  onSelectCluster: onClusterSelect,
  onCloseCluster: onCloseCluster,
  onReloadCluster,
  onSplitRight,
}: ClusterTabsProps) {
  const { handleContextMenu } = useTabContextMenu({
    contextNodes: clusterContextNodes,
    onCloseTab: onCloseCluster,
    onReloadTab: onReloadCluster,
    onSplitRight,
  });

  return (
    <div className="cluster-tabs">
      {clusterContextNodes.map(cluster => (
        <div
          key={cluster.id}
          className={`cluster-tab ${activeCluster?.id === cluster.id ? 'active' : ''}`}
          onClick={() => onClusterSelect(cluster)}
          onContextMenu={e => handleContextMenu(e, cluster)}
        >
          {cluster.name}
          <button
            onClick={e => {
              e.stopPropagation();
              onCloseCluster(cluster);
            }}
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}

export default ClusterTabs;
