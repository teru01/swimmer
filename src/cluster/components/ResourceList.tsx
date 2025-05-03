import React, { useState, useEffect, useMemo } from 'react';
import './ClusterInfoPane.css';
import { formatAge } from '../../lib/utils'; // Import the utility

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

// --- Dummy Data & Fetch Functions (Replace with actual API calls) ---
export interface KubeResource {
  metadata: {
    name: string;
    namespace?: string; // Namespaced resources have this
    creationTimestamp?: string;
    uid: string; // Use UID for keys
  };
  // Add other relevant fields based on resource kind, e.g., status, replicas
  status?: { phase?: string; readyReplicas?: number }; // Example for Pods/Deployments
  spec?: { replicas?: number }; // Example spec
}

const dummyNamespaces = ['default', 'kube-system', 'production', 'development'];

// Simulates fetching namespaces
const fetchNamespaces = async (): Promise<string[]> => {
  console.log('Fetching namespaces...');
  await new Promise(resolve => setTimeout(resolve, 200)); // Simulate delay
  return dummyNamespaces;
};

// Simulates fetching resources for a given kind
const fetchResources = async (kind: string | null): Promise<KubeResource[]> => {
  console.log(`Fetching resources for kind: ${kind}`);
  if (!kind) return [];
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay

  // Generate more diverse dummy data including namespace and creation time
  const baseTime = new Date();
  const resources: KubeResource[] = [];
  const count = 15; // Generate more items

  for (let i = 0; i < count; i++) {
    const ns = dummyNamespaces[i % dummyNamespaces.length];
    const minutesAgo = Math.floor(Math.random() * 60 * 24 * 3); // Up to 3 days ago
    const creationTime = new Date(baseTime.getTime() - minutesAgo * 60000);
    const nameSuffix = Math.random().toString(36).substring(2, 8);

    const resource: KubeResource = {
      metadata: {
        name: `${kind.toLowerCase().replace(/\s+/g, '-')}-${nameSuffix}`,
        namespace: [
          'Nodes',
          'Namespaces',
          'PersistentVolumes',
          'StorageClasses',
          'ClusterRoles',
          'ClusterRoleBindings',
        ].includes(kind)
          ? undefined
          : ns, // Assign ns if namespaced
        creationTimestamp: creationTime.toISOString(),
        uid: `${kind}-${i}-${nameSuffix}`, // Simple unique ID
      },
    };

    // Add kind-specific dummy data
    if (kind === 'Pods') {
      resource.status = { phase: Math.random() > 0.2 ? 'Running' : 'Pending' };
    } else if (kind === 'Deployments') {
      const replicas = Math.floor(Math.random() * 5) + 1;
      resource.status = { readyReplicas: Math.floor(Math.random() * replicas) };
      resource.spec = { replicas: replicas }; // Add spec for table display
    }

    resources.push(resource);
  }
  return resources;
};
// --- End of Dummy Data & Fetch Functions ---

interface ResourceListProps {
  selectedKind: string | null;
  onResourceSelect: (resource: KubeResource) => void; // Pass the whole resource object
}

/**
 * Pane component to display list of resources for the selected kind.
 * @param selectedKind Currently selected resource kind.
 * @param onResourceSelect Callback function when a resource is selected.
 */
const ResourceList: React.FC<ResourceListProps> = ({ selectedKind, onResourceSelect }) => {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all'); // 'all' represents All Namespaces
  const [resources, setResources] = useState<KubeResource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch namespaces (runs once or when context changes - adjust dependencies if context prop added)
  useEffect(() => {
    const loadNamespaces = async () => {
      try {
        const fetchedNamespaces = await fetchNamespaces();
        setNamespaces(fetchedNamespaces);
      } catch (err) {
        console.error('Failed to fetch namespaces:', err);
        // Handle error appropriately
      }
    };
    loadNamespaces();
  }, []); // Add context dependency if needed

  // Fetch resources when selectedKind changes
  useEffect(() => {
    if (!selectedKind) {
      setResources([]);
      return;
    }

    const loadResources = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedResources = await fetchResources(selectedKind);
        setResources(fetchedResources);
      } catch (err) {
        console.error(`Failed to fetch ${selectedKind}:`, err);
        setError(`Failed to load ${selectedKind}.`);
      } finally {
        setIsLoading(false);
      }
    };

    loadResources();
  }, [selectedKind]);

  // Filter resources based on selectedNamespace
  const filteredResources = useMemo(() => {
    if (selectedNamespace === 'all') {
      return resources;
    }
    return resources.filter(res => res.metadata.namespace === selectedNamespace);
  }, [resources, selectedNamespace]);

  // Determine columns based on selectedKind
  const getColumns = (kind: string | null): string[] => {
    if (!kind) return [];
    const base = ['Name', 'Age'];
    // Add Namespace column if the resource kind is namespaced
    if (
      ![
        'Nodes',
        'Namespaces',
        'PersistentVolumes',
        'StorageClasses',
        'ClusterRoles',
        'ClusterRoleBindings',
      ].includes(kind)
    ) {
      base.splice(1, 0, 'Namespace'); // Insert Namespace after Name
    }
    // Add kind-specific columns
    if (kind === 'Pods') return [...base, 'Status'];
    if (kind === 'Deployments' || kind === 'ReplicaSets' || kind === 'StatefulSets')
      return [...base, 'Ready', 'Replicas'];
    if (kind === 'Services') return [...base, 'Type', 'ClusterIP']; // Example
    if (kind === 'PersistentVolumeClaims')
      return [...base, 'Status', 'Volume', 'Capacity', 'Access Modes']; // Example
    // ... add more kind-specific columns
    return base;
  };

  const columns = getColumns(selectedKind);

  const renderCell = (resource: KubeResource, column: string) => {
    switch (column) {
      case 'Name':
        return resource.metadata.name;
      case 'Namespace':
        return resource.metadata.namespace || '-'; // Display '-' if not namespaced (shouldn't happen if column logic is correct)
      case 'Age':
        return formatAge(resource.metadata.creationTimestamp);
      case 'Status': // Example for Pods
        return resource.status?.phase || '-';
      case 'Ready': // Example for Deployments etc.
        return `${resource.status?.readyReplicas ?? 0}/${resource.spec?.replicas ?? 0}`; // Assuming spec exists
      case 'Replicas': // Example for Deployments etc.
        return resource.spec?.replicas ?? '-'; // Assuming spec exists
      // Add more cases for other columns (Type, ClusterIP, Volume, Capacity etc.)
      default:
        return '-';
    }
  };

  return (
    <div className="resource-list-pane">
      <div className="resource-list-controls">
        {/* Namespace Dropdown */}
        <select
          value={selectedNamespace}
          onChange={e => setSelectedNamespace(e.target.value)}
          className="namespace-select"
          disabled={isLoading} // Disable while loading
        >
          <option value="all">All Namespaces</option>
          {namespaces.map(ns => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
        </select>
        {/* Optional: Add other controls like search/filter input here */}
      </div>

      {isLoading && <p>Loading...</p>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && selectedKind && (
        <div className="resource-table-container">
          <table className="resource-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredResources.length > 0 ? (
                filteredResources.map(resource => (
                  <tr key={resource.metadata.uid} onClick={() => onResourceSelect(resource)}>
                    {columns.map(col => (
                      <td key={col}>{renderCell(resource, col)}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="no-resources-message">
                    No resources found
                    {selectedNamespace !== 'all' ? ` in namespace "${selectedNamespace}"` : ''}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!isLoading && !error && !selectedKind && <p>Select a resource kind from the sidebar.</p>}
    </div>
  );
};

export default ResourceList;
