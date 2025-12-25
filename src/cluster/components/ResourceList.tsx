import React, { useState, useEffect, useMemo, useRef } from 'react';
import './ClusterInfoPane.css';
import { formatAge } from '../../lib/utils';
import ClusterOverview from './ClusterOverview';
import { commands } from '../../api/commands';
import { listen } from '@tauri-apps/api/event';

export interface KubeResource {
  kind?: string;
  apiVersion?: string;
  metadata: {
    name: string;
    namespace?: string;
    creationTimestamp?: string;
    uid: string;
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
  status?: {
    phase?: string;
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
    containerStatuses?: {
      name: string;
      ready: boolean;
      restartCount: number;
      state?: any;
      image: string;
      imageID: string;
    }[];
    replicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
    updatedReplicas?: number;
    currentReplicas?: number;
    desiredNumberScheduled?: number;
    currentNumberScheduled?: number;
    numberReady?: number;
    numberAvailable?: number;
    updatedNumberScheduled?: number;
    active?: number;
    succeeded?: number;
    failed?: number;
    completionTime?: string;
    loadBalancer?: {
      ingress?: { hostname?: string; ip?: string }[];
    };
    capacity?: { [key: string]: string };
    allocatable?: { [key: string]: string };
    addresses?: { type: string; address: string }[];
    nodeInfo?: {
      kubeletVersion: string;
      containerRuntimeVersion: string;
      osImage: string;
    };
  };
  spec?: {
    replicas?: number;
    nodeName?: string;
    serviceAccountName?: string;
    containers?: {
      name: string;
      image: string;
      ports?: { containerPort: number; protocol?: string }[];
      env?: { name: string; value?: string }[];
      resources?: any;
    }[];
    initContainers?: any[];
    volumes?: any[];
    type?: string;
    clusterIP?: string;
    externalIPs?: string[];
    ports?: {
      name?: string;
      protocol?: string;
      port: number;
      targetPort?: number | string;
      nodePort?: number;
    }[];
    ingressClassName?: string;
    rules?: {
      host?: string;
      http?: {
        paths: { path?: string; pathType?: string; backend: any }[];
      };
    }[];
    tls?: { hosts?: string[]; secretName?: string }[];
    capacity?: { [key: string]: string };
    accessModes?: string[];
    storageClassName?: string;
    persistentVolumeReclaimPolicy?: string;
    volumeMode?: string;
    claimRef?: {
      kind: string;
      namespace: string;
      name: string;
      uid: string;
    };
    volumeName?: string;
    provisioner?: string;
    reclaimPolicy?: string;
    volumeBindingMode?: string;
    schedule?: string;
    suspend?: boolean;
    jobTemplate?: any;
    lastScheduleTime?: string;
    podSelector?: { matchLabels?: { [key: string]: string } };
    selector?: {
      matchLabels?: { [key: string]: string };
      matchExpressions?: any[];
    };
  };
  data?: { [key: string]: string };
  type?: string;
}

// Fetch namespaces from backend
const fetchNamespaces = async (contextId?: string): Promise<string[]> => {
  try {
    const namespaceResources = await commands.listResources(contextId, 'Namespaces', undefined);
    return namespaceResources
      .map((ns: KubeResource) => ns.metadata.name)
      .filter((name: string | undefined): name is string => name !== undefined);
  } catch (err) {
    console.error('Failed to fetch namespaces:', err);
    return [];
  }
};

interface ResourceListProps {
  selectedKind: string | undefined;
  onResourceSelect: (resource: KubeResource) => void;
  contextId?: string;
  isVisible: boolean;
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
  isVisible,
}) => {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [resources, setResources] = useState<KubeResource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const hasLoadedRef = useRef<boolean>(false);
  const watchIdRef = useRef<string | undefined>(undefined);

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
  const isNamespaced = !isClusterScoped(selectedKind);

  // Fetch namespaces only if the kind is namespaced (or maybe always fetch?)
  // Let's fetch always for simplicity, but filter UI later.
  useEffect(() => {
    const loadNamespaces = async () => {
      // Reset selection when kind changes to a cluster-scoped one
      if (!isNamespaced) {
        setSelectedNamespace('all');
      }
      try {
        const fetchedNamespaces = await fetchNamespaces(contextId);
        setNamespaces(fetchedNamespaces);
      } catch (err) {
        console.error('Failed to fetch namespaces:', err);
        setNamespaces([]);
      }
    };
    loadNamespaces();
  }, [selectedKind, contextId]);

  // Fetch resources when selectedKind or context changes (but NOT when selectedNamespace changes)
  useEffect(() => {
    if (!selectedKind || selectedKind === 'Overview') {
      setResources([]);
      hasLoadedRef.current = false;
      return;
    }

    const loadResources = async () => {
      setIsLoading(true);
      setError(undefined);
      try {
        // Always fetch all namespaces to avoid refetching when namespace filter changes
        const fetchedResources = await commands.listResources(contextId, selectedKind, undefined);
        setResources(fetchedResources as KubeResource[]);
        hasLoadedRef.current = true;
        setIsLoading(false);
      } catch (err) {
        console.error(`Failed to fetch ${selectedKind}:`, err);
        setError(`Failed to load ${selectedKind}.`);
        setIsLoading(false);
      }
    };

    const startWatch = async () => {
      try {
        // Always watch all namespaces
        const namespace = undefined;
        console.info(
          '[Watch] Starting watch for',
          selectedKind,
          'namespace:',
          namespace,
          'context:',
          contextId
        );
        const watchId = await commands.startWatchResources(contextId, selectedKind, namespace);
        console.info('[Watch] Watch started with ID:', watchId);
        watchIdRef.current = watchId;

        const unlisten = await listen<{
          event_type: string;
          resource: KubeResource;
        }>(`resource-watch-${watchId}`, event => {
          const { event_type, resource } = event.payload;
          console.info(
            '[Watch Event]',
            event_type,
            resource.metadata?.name,
            resource.metadata?.namespace
          );

          setResources(prevResources => {
            console.info('[Watch] Current resources count:', prevResources.length);
            if (event_type === 'modified') {
              const exists = prevResources.some(
                r =>
                  r.metadata?.name === resource.metadata?.name &&
                  r.metadata?.namespace === resource.metadata?.namespace
              );
              if (!exists) {
                console.info(
                  '[Watch] Adding new resource:',
                  resource.metadata?.name,
                  'namespace:',
                  resource.metadata?.namespace
                );
                const newResources = [...prevResources, resource];
                console.info('[Watch] New resources count:', newResources.length);
                return newResources;
              }
              console.info('[Watch] Updating existing resource:', resource.metadata?.name);
              return prevResources.map(r =>
                r.metadata?.name === resource.metadata?.name &&
                r.metadata?.namespace === resource.metadata?.namespace
                  ? resource
                  : r
              );
            } else if (event_type === 'deleted') {
              console.info('[Watch] Deleting resource:', resource.metadata?.name);
              return prevResources.filter(
                r =>
                  !(
                    r.metadata?.name === resource.metadata?.name &&
                    r.metadata?.namespace === resource.metadata?.namespace
                  )
              );
            }
            return prevResources;
          });
        });

        return unlisten;
      } catch (err) {
        console.error('Failed to start watch:', err);
        return undefined;
      }
    };

    // Only load resources if not already loaded
    if (!hasLoadedRef.current) {
      loadResources();
    }

    const unlistenPromise = startWatch();

    return () => {
      // Cleanup watch
      unlistenPromise.then(unlisten => {
        if (unlisten) {
          unlisten();
        }
      });
      if (watchIdRef.current) {
        commands.stopWatchResources(watchIdRef.current);
        watchIdRef.current = undefined;
      }
    };
  }, [selectedKind, contextId]);

  // Filter and sort resources based on selectedNamespace
  const filteredResources = useMemo(() => {
    console.info(
      '[Filter] Resources count:',
      resources.length,
      'selectedNamespace:',
      selectedNamespace,
      'isNamespaced:',
      isNamespaced
    );
    let result = resources;

    if (isNamespaced && selectedNamespace !== 'all') {
      result = resources.filter(res => res.metadata.namespace === selectedNamespace);
      console.info('[Filter] Filtered resources count:', result.length);
    }

    // Sort by namespace (if namespaced), then by name
    result = [...result].sort((a, b) => {
      if (isNamespaced) {
        const nsA = a.metadata.namespace || '';
        const nsB = b.metadata.namespace || '';
        if (nsA !== nsB) {
          return nsA.localeCompare(nsB);
        }
      }
      const nameA = a.metadata.name || '';
      const nameB = b.metadata.name || '';
      return nameA.localeCompare(nameB);
    });

    return result;
  }, [resources, selectedNamespace, isNamespaced]);

  const getColumns = (kind: string | undefined): string[] => {
    if (!kind) return [];
    const base = ['Name'];
    if (isNamespaced) {
      base.push('Namespace');
    }
    base.push('Age');

    switch (kind) {
      case 'Pods':
        return [...base, 'Status', 'Restarts', 'IP'];
      case 'Deployments':
        return [...base, 'Ready', 'Up-to-date', 'Available'];
      case 'ReplicaSets':
        return [...base, 'Desired', 'Current', 'Ready'];
      case 'StatefulSets':
        return [...base, 'Ready', 'Age'];
      case 'DaemonSets':
        return [...base, 'Desired', 'Current', 'Ready', 'Up-to-date', 'Available'];
      case 'Jobs':
        return [...base, 'Completions', 'Duration'];
      case 'CronJobs':
        return [...base, 'Schedule', 'Suspend', 'Active', 'Last Schedule'];
      case 'Services':
        return [...base, 'Type', 'Cluster-IP', 'External-IP', 'Port(s)'];
      case 'Ingresses':
        return [...base, 'Class', 'Hosts', 'Address', 'Ports'];
      case 'NetworkPolicies':
        return [...base, 'Pod Selector'];
      case 'PersistentVolumes':
        return [
          'Name',
          'Capacity',
          'Access Modes',
          'Reclaim Policy',
          'Status',
          'Claim',
          'StorageClass',
          'Age',
        ];
      case 'PersistentVolumeClaims':
        return [...base, 'Status', 'Volume', 'Capacity', 'Access Modes', 'StorageClass'];
      case 'StorageClasses':
        return ['Name', 'Provisioner', 'Reclaim Policy', 'Volume Binding Mode', 'Age'];
      case 'ConfigMaps':
        return [...base, 'Data'];
      case 'Secrets':
        return [...base, 'Type', 'Data'];
      case 'Nodes':
        return ['Name', 'Status', 'Roles', 'Age', 'Version'];
      case 'Namespaces':
        return ['Name', 'Status', 'Age'];
      case 'Events':
        return [...base, 'Type', 'Reason', 'Object', 'Message'];
      case 'Endpoints':
        return [...base, 'Endpoints', 'Age'];
      case 'HorizontalPodAutoscalers':
        return [...base, 'Targets', 'MinPods', 'MaxPods', 'Replicas', 'Age'];
      case 'LimitRanges':
        return [...base, 'Type', 'Age'];
      case 'ResourceQuotas':
        return [...base, 'Request', 'Limit', 'Age'];
      case 'ServiceAccounts':
        return [...base, 'Secrets'];
      case 'Roles':
      case 'ClusterRoles':
        return ['Name', 'Age'];
      case 'RoleBindings':
      case 'ClusterRoleBindings':
        return ['Name', 'Role', 'Age'];
      case 'CRDs':
        return ['Name', 'Group', 'Version', 'Scope', 'Age'];
      default:
        return base;
    }
  };

  const columns = getColumns(selectedKind);

  const renderCell = (resource: KubeResource, column: string) => {
    switch (column) {
      case 'Name':
        return resource.metadata.name;
      case 'Namespace':
        return resource.metadata.namespace || '-';
      case 'Age':
        return formatAge(resource.metadata.creationTimestamp);
      case 'Status':
        if (resource.kind === 'Node') {
          const readyCondition = resource.status?.conditions?.find((c: any) => c.type === 'Ready');
          return readyCondition?.status === 'True' ? 'Ready' : 'NotReady';
        }
        return resource.status?.phase || '-';
      case 'Restarts': {
        const totalRestarts = resource.status?.containerStatuses?.reduce(
          (sum, container) => sum + (container.restartCount || 0),
          0
        );
        return totalRestarts !== undefined ? totalRestarts : '-';
      }
      case 'IP':
        return resource.status?.podIP || '-';
      case 'Ready':
        if (resource.kind === 'StatefulSet') {
          return `${resource.status?.readyReplicas ?? 0}/${resource.spec?.replicas ?? 0}`;
        }
        return `${resource.status?.readyReplicas ?? 0}/${resource.spec?.replicas ?? 0}`;
      case 'Up-to-date':
        return resource.status?.updatedReplicas ?? '-';
      case 'Available':
        return resource.status?.availableReplicas ?? '-';
      case 'Desired':
        if (resource.kind === 'DaemonSet') {
          return resource.status?.desiredNumberScheduled ?? '-';
        }
        return resource.spec?.replicas ?? '-';
      case 'Current':
        if (resource.kind === 'DaemonSet') {
          return resource.status?.currentNumberScheduled ?? '-';
        }
        return resource.status?.currentReplicas ?? '-';
      case 'Completions':
        return `${resource.status?.succeeded ?? 0}/${resource.spec?.replicas ?? 0}`;
      case 'Duration': {
        if (resource.status?.startTime && resource.status?.completionTime) {
          const start = new Date(resource.status.startTime);
          const end = new Date(resource.status.completionTime);
          const durationMs = end.getTime() - start.getTime();
          const seconds = Math.floor(durationMs / 1000);
          return `${seconds}s`;
        }
        return resource.status?.startTime ? formatAge(resource.status.startTime) : '-';
      }
      case 'Schedule':
        return resource.spec?.schedule || '-';
      case 'Suspend':
        return resource.spec?.suspend ? 'True' : 'False';
      case 'Active':
        return resource.status?.active ?? 0;
      case 'Last Schedule':
        return resource.spec?.lastScheduleTime ? formatAge(resource.spec.lastScheduleTime) : '-';
      case 'Type':
        if (resource.kind === 'Service') {
          return resource.spec?.type || 'ClusterIP';
        }
        return resource.type || '-';
      case 'Cluster-IP':
        return resource.spec?.clusterIP || '-';
      case 'External-IP':
        if (resource.spec?.externalIPs && resource.spec.externalIPs.length > 0) {
          return resource.spec.externalIPs.join(',');
        }
        if (
          resource.status?.loadBalancer?.ingress &&
          resource.status.loadBalancer.ingress.length > 0
        ) {
          const ingress = resource.status.loadBalancer.ingress[0];
          return ingress.ip || ingress.hostname || '-';
        }
        return '<none>';
      case 'Port(s)':
        if (resource.spec?.ports && resource.spec.ports.length > 0) {
          return resource.spec.ports
            .map(p => {
              const protocol = p.protocol || 'TCP';
              if (p.nodePort) {
                return `${p.port}:${p.nodePort}/${protocol}`;
              }
              return `${p.port}/${protocol}`;
            })
            .join(',');
        }
        return '-';
      case 'Class':
        return resource.spec?.ingressClassName || '<none>';
      case 'Hosts':
        if (resource.spec?.rules && resource.spec.rules.length > 0) {
          const hosts = resource.spec.rules.map(r => r.host || '*').join(',');
          return hosts || '*';
        }
        return '*';
      case 'Address':
        if (
          resource.status?.loadBalancer?.ingress &&
          resource.status.loadBalancer.ingress.length > 0
        ) {
          return resource.status.loadBalancer.ingress
            .map(i => i.ip || i.hostname)
            .filter(Boolean)
            .join(',');
        }
        return '-';
      case 'Ports':
        if (resource.spec?.tls && resource.spec.tls.length > 0) {
          return '80, 443';
        }
        return '80';
      case 'Pod Selector':
        if (resource.spec?.podSelector?.matchLabels) {
          return Object.entries(resource.spec.podSelector.matchLabels)
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        }
        return '-';
      case 'Capacity':
        if (resource.spec?.capacity?.storage) {
          return resource.spec.capacity.storage;
        }
        if (resource.status?.capacity?.storage) {
          return resource.status.capacity.storage;
        }
        return '-';
      case 'Access Modes':
        if (resource.spec?.accessModes && resource.spec.accessModes.length > 0) {
          return resource.spec.accessModes.join(',');
        }
        return '-';
      case 'Reclaim Policy':
        return resource.spec?.persistentVolumeReclaimPolicy || resource.spec?.reclaimPolicy || '-';
      case 'Claim':
        if (resource.spec?.claimRef) {
          return `${resource.spec.claimRef.namespace}/${resource.spec.claimRef.name}`;
        }
        return '-';
      case 'StorageClass':
        return resource.spec?.storageClassName || '-';
      case 'Volume':
        return resource.spec?.volumeName || '-';
      case 'Provisioner':
        return resource.spec?.provisioner || '-';
      case 'Volume Binding Mode':
        return resource.spec?.volumeBindingMode || '-';
      case 'Data': {
        const dataCount = resource.data ? Object.keys(resource.data).length : 0;
        return dataCount;
      }
      case 'Roles': {
        const labels = resource.metadata.labels || {};
        const roles = [];
        if (
          labels['node-role.kubernetes.io/master'] ||
          labels['node-role.kubernetes.io/control-plane']
        ) {
          roles.push('control-plane');
        }
        if (
          Object.keys(labels).some(
            k =>
              k.startsWith('node-role.kubernetes.io/') &&
              k !== 'node-role.kubernetes.io/master' &&
              k !== 'node-role.kubernetes.io/control-plane'
          )
        ) {
          const roleKeys = Object.keys(labels).filter(
            k =>
              k.startsWith('node-role.kubernetes.io/') &&
              k !== 'node-role.kubernetes.io/master' &&
              k !== 'node-role.kubernetes.io/control-plane'
          );
          roleKeys.forEach(k => {
            const role = k.replace('node-role.kubernetes.io/', '');
            if (role) roles.push(role);
          });
        }
        return roles.length > 0 ? roles.join(',') : '<none>';
      }
      case 'Version':
        return resource.status?.nodeInfo?.kubeletVersion || '-';
      case 'Reason':
        return (resource as any).reason || '-';
      case 'Object':
        if ((resource as any).involvedObject) {
          const obj = (resource as any).involvedObject;
          return `${obj.kind}/${obj.name}`;
        }
        return '-';
      case 'Message':
        return (resource as any).message || '-';
      case 'Secrets': {
        const secrets = (resource as any).secrets || [];
        return secrets.length;
      }
      case 'Role':
        if ((resource as any).roleRef) {
          const roleRef = (resource as any).roleRef;
          return `${roleRef.kind}/${roleRef.name}`;
        }
        return '-';
      case 'Group':
        if ((resource as any).spec?.group) {
          return (resource as any).spec.group;
        }
        return '-';
      case 'Scope':
        if ((resource as any).spec?.scope) {
          return (resource as any).spec.scope;
        }
        return '-';
      case 'Endpoints': {
        const subsets = (resource as any).subsets || [];
        if (subsets.length === 0) return '<none>';
        const addresses = subsets.flatMap((s: any) => s.addresses || []);
        const ports = subsets.flatMap((s: any) => s.ports || []);
        if (addresses.length === 0) return '<none>';
        const portStr = ports.length > 0 ? `:${ports[0].port}` : '';
        return `${addresses.length} addresses${portStr}`;
      }
      case 'Targets': {
        const targetRef = (resource as any).spec?.scaleTargetRef;
        if (targetRef) {
          return `${targetRef.kind}/${targetRef.name}`;
        }
        return '-';
      }
      case 'MinPods':
        return (resource as any).spec?.minReplicas || '-';
      case 'MaxPods':
        return (resource as any).spec?.maxReplicas || '-';
      case 'Replicas': {
        const current = (resource as any).status?.currentReplicas;
        const desired = (resource as any).status?.desiredReplicas;
        if (current !== undefined && desired !== undefined) {
          return `${current}/${desired}`;
        }
        return '-';
      }
      case 'Request': {
        const hard = (resource as any).status?.hard || {};
        const used = (resource as any).status?.used || {};
        const cpu = used['requests.cpu'] || hard['requests.cpu'] || '-';
        const memory = used['requests.memory'] || hard['requests.memory'] || '-';
        return `cpu: ${cpu}, memory: ${memory}`;
      }
      case 'Limit': {
        const hard = (resource as any).status?.hard || {};
        const used = (resource as any).status?.used || {};
        const cpu = used['limits.cpu'] || hard['limits.cpu'] || '-';
        const memory = used['limits.memory'] || hard['limits.memory'] || '-';
        return `cpu: ${cpu}, memory: ${memory}`;
      }
      default:
        return '-';
    }
  };

  if (selectedKind === 'Overview') {
    return <ClusterOverview contextId={contextId || 'dummy-context-id'} isVisible={isVisible} />;
  }

  if (!isVisible) {
    return null;
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
