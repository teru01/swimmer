import React, { useState, useEffect, useMemo } from 'react';
import './ClusterInfoPane.css';
import { formatAge } from '../../lib/utils'; // Import the utility
import ClusterOverview from './ClusterOverview';

// --- Dummy Data & Fetch Functions (Replace with actual API calls) ---
export interface KubeResource {
  metadata: {
    name: string;
    namespace?: string; // Namespaced resources have this
    creationTimestamp?: string;
    uid: string; // Use UID for keys
    labels?: { [key: string]: string };
    annotations?: { [key: string]: string };
    ownerReferences?: {
      apiVersion: string;
      kind: string;
      name: string;
      uid: string;
      controller?: boolean;
      blockOwnerDeletion?: boolean;
    }[];
  };
  // Add other relevant fields based on resource kind, e.g., status, replicas
  status?: {
    phase?: string;
    readyReplicas?: number;
    podIP?: string;
    startTime?: string;
    conditions?: {
      type: string;
      status: string;
      lastProbeTime?: string | undefined;
      lastTransitionTime?: string;
      reason?: string;
      message?: string;
    }[];
  };
  spec?: {
    replicas?: number;
    nodeName?: string;
    serviceAccountName?: string;
    containers?: any[];
    initContainers?: any[];
    volumes?: any[];
  };
}

const dummyNamespaces = ['default', 'kube-system', 'production', 'development'];

// Simulates fetching namespaces
const fetchNamespaces = async (): Promise<string[]> => {
  console.log('Fetching namespaces...');
  await new Promise(resolve => setTimeout(resolve, 200)); // Simulate delay
  return dummyNamespaces;
};

// Simulates fetching resources for a given kind
const fetchResources = async (kind: string | undefined): Promise<KubeResource[]> => {
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
  selectedKind: string | undefined;
  onResourceSelect: (resource: KubeResource) => void; // Pass the whole resource object
  contextId?: string;
}

/**
 * Pane component to display list of resources for the selected kind.
 * @param selectedKind Currently selected resource kind.
 * @param onResourceSelect Callback function when a resource is selected.
 * @param contextId Kubernetes context ID.
 */
const ResourceList: React.FC<ResourceListProps> = ({
  selectedKind,
  onResourceSelect,
  contextId,
}) => {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all'); // 'all' represents All Namespaces
  const [resources, setResources] = useState<KubeResource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Helper function to check if a resource kind is cluster-scoped (not namespaced)
  const isClusterScoped = (kind: string | undefined): boolean => {
    if (!kind) return true; // Assume cluster-scoped if no kind selected
    return [
      'Nodes',
      'Namespaces',
      'PersistentVolumes',
      'StorageClasses',
      'ClusterRoles',
      'ClusterRoleBindings',
      'CRDs',
    ].includes(kind);
  };

  // Determine if the current kind is namespaced
  const isNamespaced = useMemo(() => !isClusterScoped(selectedKind), [selectedKind]);

  // Fetch namespaces only if the kind is namespaced (or maybe always fetch?)
  // Let's fetch always for simplicity, but filter UI later.
  useEffect(() => {
    const loadNamespaces = async () => {
      // Reset selection when kind changes to a cluster-scoped one
      if (!isNamespaced) {
        setSelectedNamespace('all');
      }
      try {
        const fetchedNamespaces = await fetchNamespaces();
        setNamespaces(fetchedNamespaces);
      } catch (err) {
        console.error('Failed to fetch namespaces:', err);
        // Handle error appropriately
      }
    };
    loadNamespaces();
  }, [isNamespaced]);

  // Fetch resources when selectedKind changes
  useEffect(() => {
    if (!selectedKind) {
      setResources([]);
      return;
    }

    const loadResources = async () => {
      setIsLoading(true);
      setError(undefined);
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
    if (!isNamespaced || selectedNamespace === 'all') {
      return resources;
    }
    return resources.filter(res => res.metadata.namespace === selectedNamespace);
  }, [resources, selectedNamespace, isNamespaced]);

  // Determine columns based on selectedKind
  const getColumns = (kind: string | undefined): string[] => {
    if (!kind) return [];
    const base = ['Name', 'Age'];
    // Add Namespace column only if the resource kind is namespaced
    if (isNamespaced) {
      base.splice(1, 0, 'Namespace');
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

  if (selectedKind === 'Overview') {
    return <ClusterOverview contextId={contextId || 'dummy-context-id'} />;
  }

  return (
    <div className="resource-list-pane">
      <div className="resource-list-controls">
        <div className="controls-left">
          {selectedKind && (
            <div className="resource-kind-indicator">
              <span className="kind-label">{selectedKind}</span>
              <span className="resource-count">
                {filteredResources.length} {filteredResources.length === 1 ? 'item' : 'items'}
              </span>
            </div>
          )}
        </div>
        <div className="controls-right">
          {isNamespaced && (
            <div className="namespace-filter-container">
              <span className="namespace-label">Namespace:</span>
              <select
                value={selectedNamespace}
                onChange={e => setSelectedNamespace(e.target.value)}
                className="namespace-select"
                disabled={isLoading}
              >
                <option value="all">All Namespaces</option>
                {namespaces.map(ns => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>Loading {selectedKind}...</span>
        </div>
      )}

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

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
                    <div className="empty-state">
                      <span className="empty-icon">📭</span>
                      <div>
                        <div className="empty-title">No resources found</div>
                        <div className="empty-subtitle">
                          {isNamespaced && selectedNamespace !== 'all'
                            ? `No ${selectedKind} found in namespace "${selectedNamespace}"`
                            : `No ${selectedKind} found in this cluster`}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && !selectedKind && (
        <div className="no-selection-state">
          <span className="no-selection-icon">👈</span>
          <div>
            <div className="no-selection-title">Select a resource type</div>
            <div className="no-selection-subtitle">
              Choose a resource kind from the sidebar to view its resources
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceList;
