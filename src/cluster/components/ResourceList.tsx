import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  selectedResourceUid?: string;
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
}) => {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [namespaceInput, setNamespaceInput] = useState<string>('');
  const [showNamespaceSuggestions, setShowNamespaceSuggestions] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [resources, setResources] = useState<KubeResource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const resourceCacheRef = useRef<Map<string, KubeResource[]>>(new Map());
  const watchIdRef = useRef<string | undefined>(undefined);
  const namespaceInputRef = useRef<HTMLInputElement>(null);
  const selectedKindRef = useRef(selectedKind);
  selectedKindRef.current = selectedKind;

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

  const clearNamespaceInput = useCallback(() => {
    setNamespaceInput('');
    setSelectedNamespace('all');
    setHighlightedIndex(-1);
    namespaceInputRef.current?.focus();
  }, []);

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

    const loadResources = async () => {
      // Only show loading spinner if there's no cached data
      if (!hasCached) {
        setIsLoading(true);
      }
      setError(undefined);
      try {
        const fetchedResources = (await commands.listResources(
          contextId,
          selectedKind,
          undefined
        )) as KubeResource[];
        resourceCacheRef.current.set(selectedKind, fetchedResources);
        if (!cancelled) {
          setResources(fetchedResources);
          setIsLoading(false);
        }
      } catch (err) {
        console.error(`Failed to fetch ${selectedKind}:`, err);
        if (!cancelled) {
          if (!hasCached) {
            setError(`Failed to load ${selectedKind}.`);
          }
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
  }, [selectedKind, contextId, updateResources]);

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
        let statusText: string;
        if (resource.kind === 'Node') {
          const readyCondition = resource.status?.conditions?.find((c: any) => c.type === 'Ready');
          statusText = readyCondition?.status === 'True' ? 'Ready' : 'NotReady';
        } else {
          statusText = resource.status?.phase || '-';
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
              <div className="namespace-input-wrapper">
                <input
                  ref={namespaceInputRef}
                  type="text"
                  value={namespaceInput}
                  onChange={e => {
                    setNamespaceInput(e.target.value);
                    setShowNamespaceSuggestions(true);
                  }}
                  onFocus={() => setShowNamespaceSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowNamespaceSuggestions(false);
                      setHighlightedIndex(-1);
                    }, 200);
                  }}
                  onKeyDown={handleNamespaceKeyDown}
                  placeholder="Filter namespaces..."
                  className={`namespace-input ${namespaceInput ? 'has-value' : ''}`}
                  disabled={isLoading}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {namespaceInput && (
                  <button
                    className="namespace-clear-button"
                    onClick={clearNamespaceInput}
                    type="button"
                    tabIndex={-1}
                  >
                    &times;
                  </button>
                )}
                {showNamespaceSuggestions && filteredNamespaces.length > 0 && (
                  <div className="namespace-suggestions" ref={suggestionsRef}>
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
                    onClick={() => onResourceSelect(resource)}
                    className={resource.metadata.uid === selectedResourceUid ? 'selected-row' : ''}
                  >
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
