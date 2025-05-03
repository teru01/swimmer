import React, { useState } from 'react';
import { ContextNode } from '../../lib/contextTree';
import ResourceKindSidebar from './ResourceKindSidebar';
import ResourceList, { KubeResource } from './ResourceList';
import ResourceDetailPane from './ResourceDetailPane';
import './ClusterInfoPane.css';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface ClusterInfoPaneProps {
  selectedContext: ContextNode | null;
}

/**
 * Center Pane: Component to display cluster information with sidebar, list, and detail views.
 */
function ClusterInfoPane({ selectedContext }: ClusterInfoPaneProps) {
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [selectedResourceName, setSelectedResourceName] = useState<string | null>(null);
  const [showDetailPane, setShowDetailPane] = useState<boolean>(false);

  const handleKindSelect = (kind: string) => {
    setSelectedKind(kind);
    setSelectedResourceName(null);
    setShowDetailPane(false);
  };

  const handleResourceSelect = (resource: KubeResource) => {
    setSelectedResourceName(resource.metadata.name);
    setShowDetailPane(true);
  };

  const handleCloseDetailPane = () => {
    setShowDetailPane(false);
    setSelectedResourceName(null);
  };

  const handleDetailPaneResize = (size: number) => {
    if (size < 5 && showDetailPane) {
      handleCloseDetailPane();
    }
  };

  return (
    <div className="cluster-info-pane-container">
      {selectedContext ? (
        <PanelGroup direction="horizontal">
          <Panel defaultSize={20} minSize={15} maxSize={40} id="sidebar">
            <ResourceKindSidebar selectedKind={selectedKind} onKindSelect={handleKindSelect} />
          </Panel>
          <PanelResizeHandle className="resize-handle-vertical" />
          <Panel minSize={30} id="main-area">
            <PanelGroup direction="vertical">
              <Panel defaultSize={showDetailPane ? 70 : 100} minSize={20} id="list">
                <ResourceList selectedKind={selectedKind} onResourceSelect={handleResourceSelect} />
              </Panel>
              {showDetailPane && (
                <>
                  <PanelResizeHandle className="resize-handle-horizontal" />
                  <Panel
                    defaultSize={30}
                    minSize={5}
                    maxSize={80}
                    id="detail"
                    collapsible={true}
                    onCollapse={handleCloseDetailPane}
                    onResize={handleDetailPaneResize}
                  >
                    <ResourceDetailPane
                      selectedResource={selectedResourceName}
                      onClose={handleCloseDetailPane}
                    />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
        </PanelGroup>
      ) : (
        <p className="no-context">Select a context to view cluster information</p>
      )}
    </div>
  );
}

export default ClusterInfoPane;
