import React, { useState, useEffect, useMemo } from 'react';
import './ClusterInfoPane.css';
import { formatAge } from '../../lib/utils';
import ClusterOverview from './ClusterOverview';
import { commands } from '../../api/commands';

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
      kind: kind.endsWith('s') ? kind.slice(0, -1) : kind,
      apiVersion: 'v1',
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
          : ns,
        creationTimestamp: creationTime.toISOString(),
        uid: `${kind}-${i}-${nameSuffix}`,
      },
    };

    if (kind === 'Pods') {
      resource.status = {
        phase: Math.random() > 0.2 ? 'Running' : 'Pending',
        podIP: `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        startTime: creationTime.toISOString(),
        containerStatuses: [
          {
            name: 'app',
            ready: Math.random() > 0.1,
            restartCount: Math.floor(Math.random() * 3),
            state: { running: { startedAt: creationTime.toISOString() } },
            image: 'nginx:latest',
            imageID: 'docker-pullable://nginx@sha256:abc123',
          },
        ],
        conditions: [
          { type: 'PodScheduled', status: 'True', lastTransitionTime: creationTime.toISOString() },
          { type: 'Initialized', status: 'True', lastTransitionTime: creationTime.toISOString() },
          { type: 'Ready', status: 'True', lastTransitionTime: creationTime.toISOString() },
          {
            type: 'ContainersReady',
            status: 'True',
            lastTransitionTime: creationTime.toISOString(),
          },
        ],
      };
      resource.spec = {
        nodeName: `node-${Math.floor(Math.random() * 3) + 1}`,
        serviceAccountName: 'default',
        containers: [
          {
            name: 'app',
            image: 'nginx:latest',
            ports: [{ containerPort: 80, protocol: 'TCP' }],
            resources: {
              limits: { cpu: '500m', memory: '512Mi' },
              requests: { cpu: '250m', memory: '256Mi' },
            },
          },
        ],
        volumes: [{ name: 'default-token', secret: { secretName: 'default-token-xyz' } }],
      };
    } else if (kind === 'Deployments') {
      const replicas = Math.floor(Math.random() * 5) + 1;
      resource.status = {
        replicas: replicas,
        readyReplicas: Math.floor(Math.random() * replicas),
        availableReplicas: Math.floor(Math.random() * replicas),
        updatedReplicas: Math.floor(Math.random() * replicas),
        conditions: [
          {
            type: 'Available',
            status: 'True',
            lastTransitionTime: creationTime.toISOString(),
            reason: 'MinimumReplicasAvailable',
            message: 'Deployment has minimum availability.',
          },
          {
            type: 'Progressing',
            status: 'True',
            lastTransitionTime: creationTime.toISOString(),
            reason: 'NewReplicaSetAvailable',
            message: 'ReplicaSet has successfully progressed.',
          },
        ],
      };
      resource.spec = {
        replicas: replicas,
        selector: { matchLabels: { app: resource.metadata.name } },
      };
    } else if (kind === 'Services') {
      resource.spec = {
        type: ['ClusterIP', 'NodePort', 'LoadBalancer'][Math.floor(Math.random() * 3)],
        clusterIP: `10.96.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        ports: [{ port: 80, targetPort: 8080, protocol: 'TCP', name: 'http' }],
        selector: { matchLabels: { app: resource.metadata.name } },
      };
    } else if (kind === 'Nodes') {
      resource.status = {
        addresses: [
          { type: 'InternalIP', address: `10.0.0.${i + 1}` },
          { type: 'Hostname', address: `node-${i + 1}` },
        ],
        capacity: {
          cpu: '4',
          memory: '16Gi',
          pods: '110',
        },
        allocatable: {
          cpu: '3800m',
          memory: '15Gi',
          pods: '110',
        },
        conditions: [
          {
            type: 'Ready',
            status: 'True',
            lastTransitionTime: creationTime.toISOString(),
            reason: 'KubeletReady',
            message: 'kubelet is posting ready status',
          },
          {
            type: 'MemoryPressure',
            status: 'False',
            lastTransitionTime: creationTime.toISOString(),
          },
          { type: 'DiskPressure', status: 'False', lastTransitionTime: creationTime.toISOString() },
        ],
        nodeInfo: {
          kubeletVersion: 'v1.28.0',
          containerRuntimeVersion: 'containerd://1.7.0',
          osImage: 'Ubuntu 22.04.3 LTS',
        },
      };
      resource.metadata.labels = {
        'kubernetes.io/hostname': `node-${i + 1}`,
        'node-role.kubernetes.io/worker': '',
      };
    } else if (kind === 'ReplicaSets') {
      const replicas = Math.floor(Math.random() * 5) + 1;
      resource.status = {
        replicas: replicas,
        readyReplicas: Math.floor(Math.random() * replicas),
        availableReplicas: Math.floor(Math.random() * replicas),
      };
      resource.spec = {
        replicas: replicas,
        selector: { matchLabels: { app: resource.metadata.name } },
      };
      resource.metadata.ownerReferences = [
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: `deployment-${nameSuffix}`,
          uid: `deployment-${nameSuffix}`,
          controller: true,
        },
      ];
    } else if (kind === 'StatefulSets') {
      const replicas = Math.floor(Math.random() * 5) + 1;
      resource.status = {
        replicas: replicas,
        readyReplicas: Math.floor(Math.random() * replicas),
        currentReplicas: Math.floor(Math.random() * replicas),
        updatedReplicas: Math.floor(Math.random() * replicas),
      };
      resource.spec = {
        replicas: replicas,
        selector: { matchLabels: { app: resource.metadata.name } },
      };
    } else if (kind === 'DaemonSets') {
      const desired = Math.floor(Math.random() * 5) + 3;
      resource.status = {
        desiredNumberScheduled: desired,
        currentNumberScheduled: desired,
        numberReady: Math.floor(Math.random() * desired),
        numberAvailable: Math.floor(Math.random() * desired),
        updatedNumberScheduled: Math.floor(Math.random() * desired),
      };
      resource.spec = {
        selector: { matchLabels: { app: resource.metadata.name } },
      };
    } else if (kind === 'Ingresses') {
      resource.spec = {
        ingressClassName: ['nginx', 'traefik', undefined][Math.floor(Math.random() * 3)],
        rules: [
          {
            host: `${resource.metadata.name}.example.com`,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: 'web-service',
                      port: { number: 80 },
                    },
                  },
                },
              ],
            },
          },
        ],
        tls:
          Math.random() > 0.5
            ? [
                {
                  hosts: [`${resource.metadata.name}.example.com`],
                  secretName: `${resource.metadata.name}-tls`,
                },
              ]
            : undefined,
      };
      resource.status = {
        loadBalancer: {
          ingress: [{ ip: `203.0.113.${Math.floor(Math.random() * 255)}` }],
        },
      };
    } else if (kind === 'ConfigMaps') {
      resource.data = {
        'config.yaml': 'apiVersion: v1\nkind: Config\nname: example',
        'database.url': 'postgresql://localhost:5432/db',
        'app.name': 'My Application',
      };
    } else if (kind === 'Secrets') {
      resource.type = ['Opaque', 'kubernetes.io/tls', 'kubernetes.io/dockerconfigjson'][
        Math.floor(Math.random() * 3)
      ];
      resource.data = {
        username: 'YWRtaW4=',
        password: 'cGFzc3dvcmQxMjM=',
        token: 'ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5',
      };
    } else if (kind === 'Namespaces') {
      resource.status = {
        phase: 'Active',
      };
      resource.metadata.labels = {
        'kubernetes.io/metadata.name': resource.metadata.name,
      };
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
        const namespace =
          isNamespaced && selectedNamespace !== 'all' ? selectedNamespace : undefined;
        const fetchedResources = await commands.listResources(contextId, selectedKind, namespace);
        setResources(fetchedResources as KubeResource[]);
      } catch (err) {
        console.error(`Failed to fetch ${selectedKind}:`, err);
        setError(`Failed to load ${selectedKind}.`);
      } finally {
        setIsLoading(false);
      }
    };

    loadResources();
  }, [selectedKind, selectedNamespace, isNamespaced, contextId]);

  // Filter resources based on selectedNamespace
  const filteredResources = useMemo(() => {
    if (!isNamespaced || selectedNamespace === 'all') {
      return resources;
    }
    return resources.filter(res => res.metadata.namespace === selectedNamespace);
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
