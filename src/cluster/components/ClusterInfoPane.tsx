import React, { useState } from 'react';
import { ContextNode } from '../../lib/contextTree';
import ResourceKindSidebar from './ResourceKindSidebar';
import ResourceList from './ResourceList';
import ResourceDetailPane from './ResourceDetailPane';
import './ClusterInfoPane.css';
// import './ClusterInfoPane.css'; // Assuming you create a CSS file for layout

interface ClusterInfoPaneProps {
  selectedContext: ContextNode | null;
}

/**
 * Center Pane: Component to display cluster information with sidebar, list, and detail views.
 */
function ClusterInfoPane({ selectedContext }: ClusterInfoPaneProps) {
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [showDetailPane, setShowDetailPane] = useState<boolean>(false);

  const handleKindSelect = (kind: string) => {
    setSelectedKind(kind);
    setSelectedResource(null); // Reset resource selection when kind changes
    setShowDetailPane(false); // Close detail pane when kind changes
  };

  const handleResourceSelect = (resource: string) => {
    setSelectedResource(resource);
    setShowDetailPane(true); // Show detail pane when resource is selected
  };

  const handleCloseDetailPane = () => {
    setShowDetailPane(false);
    setSelectedResource(null); // Optionally reset resource selection on close
  };

  return (
    <div className="cluster-info-pane-layout">
      {selectedContext ? (
        <>
          <ResourceKindSidebar selectedKind={selectedKind} onKindSelect={handleKindSelect} />
          <div className="main-content-area">
            {/* Container for list and detail */}
            <ResourceList selectedKind={selectedKind} onResourceSelect={handleResourceSelect} />
            {showDetailPane && (
              <ResourceDetailPane
                selectedResource={selectedResource}
                onClose={handleCloseDetailPane}
              />
            )}
          </div>
        </>
      ) : (
        <p className="no-context">Select a context to view cluster information</p>
      )}
    </div>
  );
}

export default ClusterInfoPane;
