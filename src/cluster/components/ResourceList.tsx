import React from 'react';
import './ClusterInfoPane.css';

// Dummy resource data (replace with actual data fetching)
const dummyResources: { [key: string]: string[] } = {
  Nodes: ['node-1', 'node-2', 'node-3'],
  Pods: ['pod-a-123', 'pod-b-456', 'pod-c-789'],
  Deployments: ['app-deployment', 'db-deployment'],
  ConfigMaps: ['config-1', 'config-2'],
  Secrets: ['secret-db-pass', 'secret-api-key'],
  Services: ['service-frontend', 'service-backend'],
  'Custom Resources': ['crd-instance-1', 'crd-instance-2'],
};

interface ResourceListProps {
  selectedKind: string | null;
  onResourceSelect: (resource: string) => void;
}

/**
 * Pane component to display list of resources for the selected kind.
 * @param selectedKind Currently selected resource kind.
 * @param onResourceSelect Callback function when a resource is selected.
 */
const ResourceList: React.FC<ResourceListProps> = ({ selectedKind, onResourceSelect }) => {
  const resources = selectedKind ? dummyResources[selectedKind] || [] : [];

  return (
    <div className="resource-list-pane">
      {selectedKind ? (
        <>
          <h4>{selectedKind}</h4>
          {resources.length > 0 ? (
            <ul>
              {resources.map(resource => (
                <li key={resource} onClick={() => onResourceSelect(resource)}>
                  {resource}
                </li>
              ))}
            </ul>
          ) : (
            <p>No resources found for {selectedKind}.</p>
          )}
        </>
      ) : (
        <p>Select a resource kind from the sidebar.</p>
      )}
    </div>
  );
};

export default ResourceList;
