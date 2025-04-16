import { ContextNode } from '../../lib/contextTree';

interface ClusterTabsProps {
  contextNodes: ContextNode[];
  activeCluster: ContextNode | null;
  onSelectCluster: (clusterContext: ContextNode) => void;
  onCloseCluster: (clusterContext: ContextNode) => void;
}

/**
 * Component to display cluster tabs at the top
 */
function ClusterTabs({
  contextNodes: clusterContextNodes,
  activeCluster,
  onSelectCluster: onClusterSelect,
  onCloseCluster: onCloseCluster,
}: ClusterTabsProps) {
  return (
    <div className="cluster-tabs">
      {clusterContextNodes.map(cluster => (
        <div
          key={cluster.id}
          className={`cluster-tab ${activeCluster?.id === cluster.id ? 'active' : ''}`}
          onClick={() => onClusterSelect(cluster)}
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
