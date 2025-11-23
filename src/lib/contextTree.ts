// ノードタイプを定義する
export const NodeType = {
  Folder: 'folder',
  Context: 'context',
} as const;

export type NodeType = (typeof NodeType)[keyof typeof NodeType];

/**
 * ClusterContext represents a Kubernetes cluster context
 * Used in places where tree structure is not needed
 */
export interface ClusterContext {
  id: string; // kubectl context id (raw context name from getKubeContexts)
  provider: 'GKE' | 'AWS' | 'Others'; // Derived from PROVIDERS
  region?: string; // Region (GKE, AWS)
  resourceContainerID?: string; // GCP project id or AWS account id
  clusterName: string; // Cluster name
}

/**
 * ContextNode represents a node in the context tree (used in ContextsPane)
 * Contains optional ClusterContext when type is 'context'
 */
export interface ContextNode {
  id: string;
  name: string;
  type: NodeType;
  clusterContext?: ClusterContext; // only if type=NodeType.Context
  children?: ContextNode[];
  parentId?: string;
  tags?: string[];
  isExpanded?: boolean;
}

export interface ContextProvider {
  name: string;
  pattern: RegExp;
  parse: (context: string) => { provider: string; [key: string]: string } | undefined;
  buildTree: (contexts: string[], rootId: string) => ContextNode;
}

/**
 * Factory function to create a new ClusterContext
 */
export const newClusterContext = (params: {
  id: string;
  provider: 'GKE' | 'AWS' | 'Others';
  clusterName: string;
  region?: string;
  resourceContainerID?: string;
}): ClusterContext => {
  return {
    id: params.id,
    provider: params.provider,
    clusterName: params.clusterName,
    region: params.region,
    resourceContainerID: params.resourceContainerID,
  };
};

/**
 * Factory function to create a root node (provider folder)
 * ID format: folder-{providerName}
 */
export const newRootNode = (providerName: string): ContextNode => {
  const id = `folder-${providerName.toLowerCase()}`;
  return {
    id,
    name: providerName,
    type: NodeType.Folder,
    children: [],
    isExpanded: true,
  };
};

/**
 * Factory function to create a resource container node (project/account folder)
 * ID format: {parentId}-{containerName}
 */
export const newResourceContainerNode = (containerName: string, parentId: string): ContextNode => {
  const id = `${parentId}-${containerName}`;
  return {
    id,
    name: containerName,
    type: NodeType.Folder,
    children: [],
    isExpanded: true,
    parentId,
  };
};

/**
 * Factory function to create a region node
 * ID format: {parentId}-{regionName}
 */
export const newRegionNode = (regionName: string, parentId: string): ContextNode => {
  const id = `${parentId}-${regionName}`;
  return {
    id,
    name: regionName,
    type: NodeType.Folder,
    children: [],
    isExpanded: true,
    parentId,
  };
};

/**
 * Factory function to create a cluster context node
 * ID format: context-{contextId}
 */
export const newClusterContextNode = (
  clusterContext: ClusterContext,
  parentId: string
): ContextNode => {
  const id = `context-${clusterContext.id}`;
  return {
    id,
    name: clusterContext.clusterName,
    type: NodeType.Context,
    clusterContext,
    parentId,
  };
};

/**
 * コンテキストをプロバイダーごとに分類する
 */
export const groupContextsByProvider = (
  contexts: string[],
  providers: ContextProvider[]
): Map<ContextProvider, string[]> => {
  const grouped = new Map<ContextProvider, string[]>();

  // プロバイダーを初期化
  providers.forEach(provider => {
    grouped.set(provider, []);
  });

  // コンテキストを分類
  contexts.forEach(context => {
    for (const provider of providers) {
      if (provider.pattern.test(context)) {
        grouped.get(provider)?.push(context);
        break;
      }
    }
  });

  return grouped;
};

/**
 * 複数のプロバイダーを使用してツリー構造を構築する
 */
export const buildTreeFromContexts = (
  contexts: string[],
  providers: ContextProvider[]
): ContextNode[] => {
  const tree: ContextNode[] = [];
  const grouped = groupContextsByProvider(contexts, providers);

  grouped.forEach((providerContexts, provider) => {
    if (providerContexts.length === 0) return;

    const rootId = `folder-${provider.name.toLowerCase()}`;
    const providerTree = provider.buildTree(providerContexts, rootId);
    tree.push(providerTree);
  });

  return tree;
};
