import { useCallback, useState } from 'react';
import ClusterTabs from '../cluster/components/ClusterTabs';
import ContextsPane from '../kubeContexts/components/ContextsPane';
import ClusterInfoPane from '../cluster/components/ClusterInfoPane';
import TerminalPane from '../cluster/components/TerminalPane';
import ChatPane from '../chat/components/ChatPane';

/**
 * Main Layout Component
 * - Left: Context hierarchy list (full height)
 * - Center: Cluster tabs on top, Cluster information and Terminal below
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
  const handleContextSelect = useCallback((context: string) => {
    setSelectedContext(context);
    console.info('Selected context:', context);
  }, []);

  return (
    <div className="layout-container">
      <div className="main-content">
        {/* Left pane: Context hierarchy (full height) */}
        <div className="contexts-pane-container">
          <ContextsPane onContextSelect={handleContextSelect} />
        </div>

        {/* Center area: Cluster tabs + info + Terminal */}
        <div className="center-area">
          {/* Cluster tabs */}
          <div className="center-tabs">
            <ClusterTabs
              clusters={clusters}
              activeCluster={selectedCluster}
              onClusterSelect={handleClusterSelect}
            />
          </div>

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
