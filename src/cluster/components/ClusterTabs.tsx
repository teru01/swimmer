import { ContextNode } from '../../kubeContexts/lib/contextTree';

interface ClusterTabsProps {
  clusters: ContextNode[];
  activeCluster: ContextNode | null;
  onClusterSelect: (clusterContext: ContextNode) => void;
}

/**
 * Component to display cluster tabs at the top
 */
function ClusterTabs({ clusters, activeCluster, onClusterSelect }: ClusterTabsProps) {
  return (
    <div className="cluster-tabs">
      {clusters.map(cluster => (
        <div
          key={cluster.name}
          className={`cluster-tab ${activeCluster?.id === cluster.id ? 'active' : ''}`}
          onClick={() => onClusterSelect(cluster)}
        >
          {cluster.name}
        </div>
      ))}
    </div>
  );
}

export default ClusterTabs;
