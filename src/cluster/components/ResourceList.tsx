import React, { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import './ClusterInfoPane.css';
import { formatAge } from '../../lib/utils';
import ClusterOverview from './ClusterOverview';
import { commands } from '../../api/commands';
import { listen } from '@tauri-apps/api/event';
import { usePreferences } from '../../contexts/PreferencesContext';

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
    initContainerStatuses?: {
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
  selectedResourceUid?: string;
  isActivePanel?: boolean;
  isDetailPaneOpen?: boolean;
  refreshKey?: number;
  onRefresh?: () => void;
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
  selectedResourceUid,
  isActivePanel,
  isDetailPaneOpen,
  refreshKey,
  onRefresh,
}) => {
  const { preferences } = usePreferences();
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [namespaceInput, setNamespaceInput] = useState<string>('');
  const [showNamespaceSuggestions, setShowNamespaceSuggestions] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [resources, setResources] = useState<KubeResource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [fetchError, setFetchError] = useState<string | undefined>(undefined);
  const resourceCacheRef = useRef<Map<string, KubeResource[]>>(new Map());
  const watchIdRef = useRef<string | undefined>(undefined);
  const [nameFilter, setNameFilter] = useState<string>('');
  const namespaceInputRef = useRef<HTMLInputElement>(null);
  const nameFilterInputRef = useRef<HTMLInputElement>(null);
  const [checkedUids, setCheckedUids] = useState<Set<string>>(new Set());
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [actionModal, setActionModal] = useState<
    | {
        action: 'delete' | 'rolloutRestart';
        resources: KubeResource[];
        capturedContext: string | undefined;
      }
    | undefined
  >(undefined);
  const [actionProgress, setActionProgress] = useState<
    | {
        completed: number;
        total: number;
        errors: string[];
      }
    | undefined
  >(undefined);
  const actionDropdownRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);
  const pendingScrollUidRef = useRef<string | undefined>(undefined);

  const selectedKindRef = useRef(selectedKind);
  selectedKindRef.current = selectedKind;

  const isClusterScoped = (kind: string | undefined): boolean => {
    if (!kind) return true;
    if (kind.startsWith('cr:')) {
      return kind.endsWith('/Cluster');
    }
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

  const getKindDisplayName = (kind: string): string => {
    if (kind.startsWith('cr:')) {
      const parts = kind.slice(3).split('/');
      return parts[2] || kind;
    }
    return kind;
  };

  const isNamespaced = !isClusterScoped(selectedKind);

  useEffect(() => {
    if (!isActivePanel || !isVisible || isDetailPaneOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'f') {
        e.preventDefault();
        nameFilterInputRef.current?.focus();
        nameFilterInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActivePanel, isVisible, isDetailPaneOpen]);

  // Clear resource cache when context changes
  useEffect(() => {
    resourceCacheRef.current.clear();
  }, [contextId]);

  useEffect(() => {
    const loadNamespaces = async () => {
      // Reset selection when kind changes to a cluster-scoped one
      if (!isNamespaced) {
        setSelectedNamespace('all');
      }
      setNameFilter('');
      setCheckedUids(new Set());
      setShowActionDropdown(false);
      setActionModal(undefined);
      setActionProgress(undefined);
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

  // Filter namespaces based on input
  const filteredNamespaces = useMemo(() => {
    if (!namespaceInput.trim()) {
      return namespaces;
    }
    return namespaces.filter(ns => ns.toLowerCase().includes(namespaceInput.toLowerCase()));
  }, [namespaces, namespaceInput]);

  const totalSuggestions = filteredNamespaces.length + 1; // +1 for "All Namespaces"

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [namespaceInput]);

  const handleNamespaceKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showNamespaceSuggestions) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          setShowNamespaceSuggestions(true);
          setHighlightedIndex(0);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => (prev + 1) % totalSuggestions);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => (prev - 1 + totalSuggestions) % totalSuggestions);
          break;
        case 'Enter': {
          e.preventDefault();
          if (highlightedIndex < 0) break;
          if (highlightedIndex === 0) {
            setSelectedNamespace('all');
            setNamespaceInput('');
          } else {
            const ns = filteredNamespaces[highlightedIndex - 1];
            setSelectedNamespace(ns);
            setNamespaceInput(ns);
          }
          setShowNamespaceSuggestions(false);
          setHighlightedIndex(-1);
          break;
        }
        case 'Escape':
          setShowNamespaceSuggestions(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [showNamespaceSuggestions, totalSuggestions, highlightedIndex, filteredNamespaces]
  );

  useEffect(() => {
    if (highlightedIndex >= 0 && suggestionsRef.current) {
      const items = suggestionsRef.current.querySelectorAll('.namespace-suggestion-item');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const updateResources = useCallback(
    (kind: string, updater: (prev: KubeResource[]) => KubeResource[]) => {
      const cached = resourceCacheRef.current.get(kind) ?? [];
      const newResources = updater(cached);
      resourceCacheRef.current.set(kind, newResources);
      if (selectedKindRef.current === kind) {
        setResources(newResources);
      }
    },
    []
  );

  // Fetch resources when selectedKind or context changes (but NOT when selectedNamespace changes)
  useEffect(() => {
    if (!selectedKind || selectedKind === 'Overview') {
      setResources([]);
      setFetchError(undefined);
      return;
    }

    // Restore from cache immediately if available
    const cached = resourceCacheRef.current.get(selectedKind);
    if (cached) {
      setResources(cached);
    } else {
      setResources([]);
    }

    const hasCached = !!cached;
    let cancelled = false;

    const FETCH_TIMEOUT_MS = preferences.general.resourceFetchTimeoutSec * 1000;

    const loadResources = async () => {
      // Only show loading spinner if there's no cached data
      if (!hasCached) {
        setIsLoading(true);
      }
      setError(undefined);
      setFetchError(undefined);
      try {
        const fetchedResources = (await Promise.race([
          commands.listResources(contextId, selectedKind, undefined),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), FETCH_TIMEOUT_MS)
          ),
        ])) as KubeResource[];
        resourceCacheRef.current.set(selectedKind, fetchedResources);
        if (!cancelled) {
          setResources(fetchedResources);
          setIsLoading(false);
        }
      } catch (err) {
        console.error(`Failed to fetch ${selectedKind}:`, err);
        if (!cancelled) {
          const message =
            err instanceof Error && err.message === 'Request timed out'
              ? `Fetch timed out`
              : `Failed to load`;
          if (!hasCached) {
            setError(`Failed to load ${selectedKind}.`);
          }
          setFetchError(message);
          setIsLoading(false);
        }
      }
    };

    const startWatch = async () => {
      try {
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

        // Capture selectedKind for use in the event handler closure
        const watchKind = selectedKind;

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

          updateResources(watchKind, prevResources => {
            if (event_type === 'modified') {
              const exists = prevResources.some(r => r.metadata?.uid === resource.metadata?.uid);
              if (!exists) {
                return [...prevResources, resource];
              }
              return prevResources.map(r =>
                r.metadata?.uid === resource.metadata?.uid ? resource : r
              );
            } else if (event_type === 'deleted') {
              return prevResources.filter(r => r.metadata?.uid !== resource.metadata?.uid);
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

    loadResources();
    const unlistenPromise = startWatch();

    return () => {
      cancelled = true;
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
  }, [selectedKind, contextId, updateResources, refreshKey]);

  // Filter and sort resources based on selectedNamespace and nameFilter
  const filteredResources = useMemo(() => {
    let result = resources;

    if (isNamespaced && selectedNamespace !== 'all') {
      result = result.filter(res => res.metadata.namespace === selectedNamespace);
    }

    if (nameFilter.trim()) {
      const lower = nameFilter.toLowerCase();
      result = result.filter(res => (res.metadata.name || '').toLowerCase().includes(lower));
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
  }, [resources, selectedNamespace, isNamespaced, nameFilter]);

  useEffect(() => {
    if (selectedResourceUid) {
      pendingScrollUidRef.current = selectedResourceUid;
    }
  }, [selectedResourceUid]);

  useEffect(() => {
    if (pendingScrollUidRef.current && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      pendingScrollUidRef.current = undefined;
    }
  }, [filteredResources, selectedResourceUid]);

  const toggleCheck = useCallback((uid: string) => {
    setCheckedUids(prev => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const allUids = filteredResources.map(r => r.metadata.uid);
    setCheckedUids(prev => {
      const allSelected = allUids.every(uid => prev.has(uid));
      if (allSelected) {
        return new Set();
      }
      return new Set(allUids);
    });
  }, [filteredResources]);

  const isAllSelected =
    filteredResources.length > 0 && filteredResources.every(r => checkedUids.has(r.metadata.uid));

  const getSingularKind = (kind: string): string => {
    if (kind.startsWith('cr:')) {
      const parts = kind.slice(3).split('/');
      return parts[2] || kind;
    }
    const mapping: Record<string, string> = {
      Pods: 'Pod',
      Deployments: 'Deployment',
      Services: 'Service',
      Nodes: 'Node',
      Namespaces: 'Namespace',
      ReplicaSets: 'ReplicaSet',
      StatefulSets: 'StatefulSet',
      DaemonSets: 'DaemonSet',
      Jobs: 'Job',
      CronJobs: 'CronJob',
      ConfigMaps: 'ConfigMap',
      Secrets: 'Secret',
      Ingresses: 'Ingress',
      NetworkPolicies: 'NetworkPolicy',
      PersistentVolumes: 'PersistentVolume',
      PersistentVolumeClaims: 'PersistentVolumeClaim',
      StorageClasses: 'StorageClass',
      Roles: 'Role',
      ClusterRoles: 'ClusterRole',
      RoleBindings: 'RoleBinding',
      ClusterRoleBindings: 'ClusterRoleBinding',
      ServiceAccounts: 'ServiceAccount',
      Endpoints: 'Endpoints',
      Events: 'Event',
      HorizontalPodAutoscalers: 'HorizontalPodAutoscaler',
      LimitRanges: 'LimitRange',
      ResourceQuotas: 'ResourceQuota',
      CRDs: 'CustomResourceDefinition',
    };
    return mapping[kind] || kind;
  };

  const openActionModal = useCallback(
    (action: 'delete' | 'rolloutRestart') => {
      const selectedResources = filteredResources.filter(r => checkedUids.has(r.metadata.uid));
      if (selectedResources.length === 0) return;
      setActionModal({
        action,
        resources: selectedResources,
        capturedContext: contextId,
      });
      setActionProgress(undefined);
      setShowActionDropdown(false);
    },
    [filteredResources, checkedUids, contextId]
  );

  const executeAction = useCallback(async () => {
    if (!actionModal) return;
    const { action, resources, capturedContext } = actionModal;
    const progress = { completed: 0, total: resources.length, errors: [] as string[] };
    setActionProgress({ ...progress });

    for (const resource of resources) {
      try {
        if (action === 'delete') {
          const singularKind = selectedKind ? getSingularKind(selectedKind) : '';
          await commands.deleteResource(
            capturedContext,
            singularKind,
            resource.metadata.name,
            resource.metadata.namespace
          );
        } else if (action === 'rolloutRestart') {
          if (!resource.metadata.namespace) continue;
          await commands.rolloutRestartDeployment(
            capturedContext,
            resource.metadata.name,
            resource.metadata.namespace
          );
        }
        progress.completed++;
      } catch (err) {
        progress.completed++;
        progress.errors.push(
          `${resource.metadata.name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      setActionProgress({ ...progress });
    }

    setCheckedUids(new Set());
  }, [actionModal, selectedKind]);

  useEffect(() => {
    if (!showActionDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target as Node)) {
        setShowActionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActionDropdown]);

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

  const getStatusCategory = (status: string): string => {
    const s = status.toLowerCase();
    const successStatuses = [
      'running',
      'ready',
      'active',
      'bound',
      'available',
      'succeeded',
      'complete',
      'completed',
      'healthy',
    ];
    const warningStatuses = [
      'pending',
      'waiting',
      'containerCreating',
      'containercreating',
      'terminating',
      'unknown',
    ];
    const errorStatuses = [
      'failed',
      'error',
      'crashloopbackoff',
      'imagepullbackoff',
      'errimagepull',
      'notready',
      'evicted',
      'oomkilled',
      'backoff',
      'invalid',
    ];
    if (successStatuses.includes(s)) return 'success';
    if (warningStatuses.includes(s)) return 'warning';
    if (errorStatuses.includes(s)) return 'error';
    return 'default';
  };

  const renderCell = (resource: KubeResource, column: string) => {
    switch (column) {
      case 'Name':
        return resource.metadata.name;
      case 'Namespace':
        return resource.metadata.namespace || '-';
      case 'Age':
        return formatAge(resource.metadata.creationTimestamp);
      case 'Status': {
        if (resource.kind === 'Node') {
          const readyCondition = resource.status?.conditions?.find((c: any) => c.type === 'Ready');
          const statusText = readyCondition?.status === 'True' ? 'Ready' : 'NotReady';
          return (
            <span className={`status-text status-${getStatusCategory(statusText)}`}>
              {statusText}
            </span>
          );
        }
        const statusText = resource.status?.phase || '-';
        const containers = resource.status?.containerStatuses;
        if (containers && containers.length > 0) {
          const readyCount = containers.filter(c => c.ready).length;
          return (
            <div className="pod-status-cell">
              <span className={`status-text status-${getStatusCategory(statusText)}`}>
                {statusText}
              </span>
              <div
                className="container-ready-blocks"
                title={`${readyCount}/${containers.length} ready`}
              >
                {containers.map(c => (
                  <span
                    key={c.name}
                    className={`container-block ${c.ready ? 'ready' : 'not-ready'}`}
                    title={`${c.name}: ${c.ready ? 'Ready' : 'Not Ready'}`}
                  />
                ))}
              </div>
            </div>
          );
        }
        return (
          <span className={`status-text status-${getStatusCategory(statusText)}`}>
            {statusText}
          </span>
        );
      }
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
    return (
      <div className="resource-list-pane">
        <div className="resource-list-controls">
          <div className="controls-left">
            <div className="resource-kind-indicator">
              <span className="kind-label">Overview</span>
              {onRefresh && (
                <button className="refresh-button" onClick={onRefresh} title="Refresh">
                  ↻
                </button>
              )}
            </div>
          </div>
        </div>
        <ClusterOverview
          contextId={contextId || 'dummy-context-id'}
          isVisible={isVisible}
          refreshKey={refreshKey}
        />
      </div>
    );
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
              <span className="kind-label">{getKindDisplayName(selectedKind)}</span>
              <span className="resource-count">
                {filteredResources.length} {filteredResources.length === 1 ? 'item' : 'items'}
              </span>
              {fetchError && <span className="fetch-error-badge">{fetchError}</span>}
              {onRefresh && (
                <button className="refresh-button" onClick={onRefresh} title="Refresh">
                  ↻
                </button>
              )}
            </div>
          )}
          {checkedUids.size > 0 && (
            <div className="selection-action-bar">
              <span className="selection-count">
                {checkedUids.size} {checkedUids.size === 1 ? 'item' : 'items'} selected
              </span>
              <div className="action-dropdown" ref={actionDropdownRef}>
                <button
                  className="action-dropdown-trigger"
                  onClick={() => setShowActionDropdown(prev => !prev)}
                >
                  Actions ▼
                </button>
                {showActionDropdown && (
                  <div className="action-dropdown-menu">
                    <div
                      className="action-dropdown-item action-dropdown-item-danger"
                      onClick={() => openActionModal('delete')}
                    >
                      Delete
                    </div>
                    {selectedKind === 'Deployments' && (
                      <div
                        className="action-dropdown-item"
                        onClick={() => openActionModal('rolloutRestart')}
                      >
                        Rollout Restart
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="controls-right">
          <div className="name-filter-container">
            <div className="namespace-input-wrapper">
              <input
                ref={nameFilterInputRef}
                type="text"
                value={nameFilter}
                onChange={e => setNameFilter(e.target.value)}
                placeholder="Filter by name... [Ctrl+F]"
                className={`namespace-input ${nameFilter ? 'has-value' : ''}`}
                disabled={isLoading}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {nameFilter && (
                <button
                  className="namespace-clear-button"
                  onClick={() => setNameFilter('')}
                  type="button"
                  tabIndex={-1}
                >
                  &times;
                </button>
              )}
            </div>
          </div>
          {isNamespaced && (
            <div className="namespace-filter-container">
              <div className="namespace-input-wrapper">
                <div
                  className="namespace-dropdown-trigger"
                  onClick={() => {
                    setShowNamespaceSuggestions(prev => !prev);
                    setTimeout(() => namespaceInputRef.current?.focus(), 0);
                  }}
                >
                  <span className="namespace-dropdown-value">
                    {selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace}
                  </span>
                  <svg
                    className={`namespace-dropdown-arrow ${showNamespaceSuggestions ? 'open' : ''}`}
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427z" />
                  </svg>
                </div>
                {showNamespaceSuggestions && (
                  <div className="namespace-suggestions" ref={suggestionsRef}>
                    <div className="namespace-suggestions-search">
                      <input
                        ref={namespaceInputRef}
                        type="text"
                        value={namespaceInput}
                        onChange={e => setNamespaceInput(e.target.value)}
                        onBlur={() => {
                          setTimeout(() => {
                            setShowNamespaceSuggestions(false);
                            setHighlightedIndex(-1);
                          }, 200);
                        }}
                        onKeyDown={handleNamespaceKeyDown}
                        placeholder="Filter..."
                        className="namespace-search-input"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                      />
                    </div>
                    <div className="namespace-suggestions-list">
                      <div
                        className={`namespace-suggestion-item ${selectedNamespace === 'all' ? 'selected' : ''} ${highlightedIndex === 0 ? 'highlighted' : ''}`}
                        onClick={() => {
                          setSelectedNamespace('all');
                          setNamespaceInput('');
                          setShowNamespaceSuggestions(false);
                          setHighlightedIndex(-1);
                        }}
                      >
                        All Namespaces
                      </div>
                      {filteredNamespaces.map((ns, i) => (
                        <div
                          key={ns}
                          className={`namespace-suggestion-item ${selectedNamespace === ns ? 'selected' : ''} ${highlightedIndex === i + 1 ? 'highlighted' : ''}`}
                          onClick={() => {
                            setSelectedNamespace(ns);
                            setNamespaceInput(ns);
                            setShowNamespaceSuggestions(false);
                            setHighlightedIndex(-1);
                          }}
                        >
                          {ns}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
                <th className="checkbox-cell">
                  <input
                    type="checkbox"
                    className="header-checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                {columns.map(col => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredResources.length > 0 ? (
                filteredResources.map(resource => (
                  <tr
                    key={resource.metadata.uid}
                    ref={resource.metadata.uid === selectedResourceUid ? selectedRowRef : undefined}
                    onClick={() => onResourceSelect(resource)}
                    className={resource.metadata.uid === selectedResourceUid ? 'selected-row' : ''}
                  >
                    <td className="checkbox-cell">
                      <input
                        type="checkbox"
                        className={`row-checkbox ${checkedUids.has(resource.metadata.uid) ? 'checked' : ''}`}
                        checked={checkedUids.has(resource.metadata.uid)}
                        onChange={() => toggleCheck(resource.metadata.uid)}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                    {columns.map(col => (
                      <td
                        key={col}
                        className={col === 'Name' || col === 'Namespace' ? 'name-cell' : ''}
                      >
                        {col === 'Name' || col === 'Namespace' ? (
                          <div className="name-cell-content">
                            <span>{renderCell(resource, col)}</span>
                            <button
                              className="copy-icon"
                              onClick={e => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(
                                  col === 'Name'
                                    ? resource.metadata.name
                                    : resource.metadata.namespace || ''
                                );
                              }}
                              title="Copy to clipboard"
                            >
                              <svg
                                className="copy-icon-img"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          renderCell(resource, col)
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className="no-resources-message">
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

      {actionModal && (
        <div
          className="action-modal-overlay"
          onClick={() => !actionProgress && setActionModal(undefined)}
        >
          <div className="action-modal" onClick={e => e.stopPropagation()}>
            <div className="action-modal-header">
              <h3>
                {actionModal.action === 'delete'
                  ? 'Delete Resources'
                  : 'Rollout Restart Deployments'}
              </h3>
              {!actionProgress && (
                <button className="action-modal-close" onClick={() => setActionModal(undefined)}>
                  &times;
                </button>
              )}
            </div>
            <div className="action-modal-context">
              Context: <strong>{actionModal.capturedContext || 'default'}</strong>
            </div>
            <div className="action-modal-resources">
              <table className="action-modal-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Namespace</th>
                  </tr>
                </thead>
                <tbody>
                  {actionModal.resources.map(r => (
                    <tr key={r.metadata.uid}>
                      <td>{r.metadata.name}</td>
                      <td>{r.metadata.namespace || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {actionProgress && (
              <div className="action-modal-progress">
                <div className="action-progress-bar">
                  <div
                    className="action-progress-fill"
                    style={{
                      width: `${(actionProgress.completed / actionProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <span className="action-progress-text">
                  {actionProgress.completed}/{actionProgress.total}
                </span>
                {actionProgress.completed === actionProgress.total && (
                  <div className="action-progress-result">
                    {actionProgress.errors.length === 0 ? (
                      <span className="action-result-success">
                        All {actionProgress.total} resources processed successfully.
                      </span>
                    ) : (
                      <Fragment>
                        <span className="action-result-partial">
                          {actionProgress.total - actionProgress.errors.length} succeeded,{' '}
                          {actionProgress.errors.length} failed.
                        </span>
                        <ul className="action-error-list">
                          {actionProgress.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </Fragment>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="action-modal-footer">
              {!actionProgress ? (
                <Fragment>
                  <button
                    className="action-modal-btn action-modal-btn-cancel"
                    onClick={() => setActionModal(undefined)}
                  >
                    Cancel
                  </button>
                  <button
                    className={`action-modal-btn ${actionModal.action === 'delete' ? 'action-modal-btn-danger' : 'action-modal-btn-primary'}`}
                    onClick={executeAction}
                  >
                    {actionModal.action === 'delete' ? 'Delete' : 'Restart'}
                  </button>
                </Fragment>
              ) : actionProgress.completed === actionProgress.total ? (
                <button
                  className="action-modal-btn action-modal-btn-primary"
                  onClick={() => {
                    setActionModal(undefined);
                    setActionProgress(undefined);
                  }}
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceList;
