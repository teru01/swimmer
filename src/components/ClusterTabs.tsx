import { useState } from 'react';

interface ClusterTabsProps {
  clusters: string[];
  activeCluster: string | null;
  onClusterSelect: (cluster: string) => void;
}

/**
 * Component to display cluster tabs at the top
 */
function ClusterTabs({ clusters, activeCluster, onClusterSelect }: ClusterTabsProps) {
  return (
    <div className="cluster-tabs">
      {clusters.map(cluster => (
        <div
          key={cluster}
          className={`cluster-tab ${activeCluster === cluster ? 'active' : ''}`}
          onClick={() => onClusterSelect(cluster)}
        >
          {cluster}
        </div>
      ))}
    </div>
  );
}

export default ClusterTabs; 
