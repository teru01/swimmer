import { useState } from 'react';
import ClusterTabs from './ClusterTabs';
import ContextsPane from './ContextsPane';
import ClusterInfoPane from './ClusterInfoPane';
import TerminalPane from './TerminalPane';
import ChatPane from './ChatPane';

/**
 * Main Layout Component
 * - Top: Cluster selection tabs
 * - Left: Context hierarchy list
 * - Center (split): Cluster information + Terminal
 * - Right: AI chat
 */
function MainLayout() {
  // Currently selected cluster and context
  const [selectedCluster, setSelectedCluster] = useState<string | null>('cluster-0');
  const [selectedContext, setSelectedContext] = useState<string | null>(null);

  // Mock cluster list
  const clusters = ['cluster-0', 'cluster-1', 'cluster-2', 'cluster-3'];

  // Cluster selection handler
  const handleClusterSelect = (cluster: string) => {
    setSelectedCluster(cluster);
    // In a real app, we would update the context list based on the selected cluster
  };

  // Context selection handler
  const handleContextSelect = (context: string) => {
    setSelectedContext(context);
  };

  return (
    <div className="main-layout">
      {/* Cluster tabs */}
      <ClusterTabs
        clusters={clusters}
        activeCluster={selectedCluster}
        onClusterSelect={handleClusterSelect}
      />
      
      <div className="content-area">
        {/* Left pane: Context hierarchy */}
        <div className="contexts-pane-container">
          <ContextsPane onContextSelect={handleContextSelect} />
        </div>
        
        {/* Center area: Cluster info + Terminal */}
        <div className="center-area">
          {/* Center top: Cluster information */}
          <div className="cluster-info-pane-container">
            <ClusterInfoPane selectedContext={selectedContext} />
          </div>
          
          {/* Center bottom: Terminal */}
          <TerminalPane selectedContext={selectedContext} />
        </div>
        
        {/* Right pane: AI chat */}
        <div className="chat-pane-container">
          <ChatPane selectedContext={selectedContext} />
        </div>
      </div>
    </div>
  );
}

export default MainLayout; 
