import { useCallback, useState } from 'react';
import ClusterTabs from '../cluster/components/ClusterTabs';
import ContextsPane from '../kubeContexts/components/ContextsPane';
import ClusterInfoPane from '../cluster/components/ClusterInfoPane';
import TerminalPane from '../cluster/components/TerminalPane';
import ChatPane from '../chat/components/ChatPane';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import './resizable.css';
import { ContextNode, NodeType } from '../kubeContexts/lib/contextTree';

/**
 * Main Layout Component
 * - Left: Context hierarchy list (full height)
 * - Center: Cluster tabs on top, Cluster information and Terminal below
 * - Right: AI chat
 */
function MainLayout() {
  // Currently selected cluster and context
  const [selectedClusterContext, setSelectedClusterContext] = useState<ContextNode | null>(null);
  const [selectedContext, setSelectedContext] = useState<ContextNode | null>(null);
  const [openClusterContexts, setOpenClusterContexts] = useState<ContextNode[]>([]);

  // Context selection handler
  const handleContextNodeSelect = useCallback((contextNode: ContextNode) => {
    setSelectedContext(contextNode);
    if (contextNode.type === NodeType.Context) {
      setSelectedClusterContext(contextNode);
    }
    console.info('Selected context:', contextNode);
  }, []);

  return (
    <div className="layout-container">
      <div className="main-content">
        <PanelGroup direction="horizontal">
          {/* Left pane: Context hierarchy (full height) */}
          <Panel defaultSize={15} minSize={10} maxSize={25}>
            <div className="contexts-pane-container">
              <ContextsPane onContextNodeSelect={handleContextNodeSelect} />
            </div>
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* Center area: Cluster tabs + info + Terminal */}
          <Panel defaultSize={60} minSize={30}>
            <div className="center-area">
              {/* Cluster tabs */}
              <div className="center-tabs">
                <ClusterTabs
                  clusters={openClusterContexts}
                  activeCluster={selectedClusterContext}
                  onClusterSelect={handleContextNodeSelect}
                />
              </div>

              <PanelGroup direction="vertical">
                {/* Center top: Cluster information */}
                <Panel defaultSize={50} minSize={20}>
                  <div className="cluster-info-pane-container">
                    <ClusterInfoPane selectedContext={selectedContext} />
                  </div>
                </Panel>

                <PanelResizeHandle className="resize-handle horizontal" />

                {/* Center bottom: Terminal */}
                <Panel defaultSize={50} minSize={20}>
                  <TerminalPane selectedContext={selectedContext} />
                </Panel>
              </PanelGroup>
            </div>
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* Right pane: AI chat */}
          <Panel defaultSize={25} minSize={15}>
            <div className="chat-pane-container">
              <ChatPane selectedContext={selectedContext} />
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default MainLayout;
