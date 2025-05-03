import React from 'react';
import './ClusterInfoPane.css';

interface ResourceDetailPaneProps {
  selectedResource: string | null;
  onClose: () => void;
}

// Dummy detail data (replace with actual data fetching)
const dummyDetails: { [key: string]: any } = {
  'node-1': { name: 'node-1', status: 'Ready', cpu: '4', memory: '16Gi' },
  'pod-a-123': { name: 'pod-a-123', status: 'Running', restarts: 0, node: 'node-1' },
  'app-deployment': { name: 'app-deployment', replicas: 3, available: 3 },
  // Add more dummy data as needed
};

/**
 * Pane component to display details of the selected resource.
 * @param selectedResource Currently selected resource name.
 * @param onClose Callback function when the pane is closed.
 */
const ResourceDetailPane: React.FC<ResourceDetailPaneProps> = ({ selectedResource, onClose }) => {
  const details = selectedResource ? dummyDetails[selectedResource] : null;

  if (!selectedResource) {
    return null; // Don't render if no resource is selected
  }

  return (
    <div className="resource-detail-pane">
      <button onClick={onClose} className="close-button">
        Close
      </button>
      <h4>Resource Details: {selectedResource}</h4>
      {details ? (
        <pre>{JSON.stringify(details, null, 2)}</pre> // Display dummy data as JSON
      ) : (
        <p>Details not available for {selectedResource}.</p>
      )}
    </div>
  );
};

export default ResourceDetailPane;
