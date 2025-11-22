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
