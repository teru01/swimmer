// ノードタイプを定義する
export const NodeType = {
  Folder: 'folder',
  Context: 'context',
} as const;

export type NodeType = (typeof NodeType)[keyof typeof NodeType];

export interface ContextNode {
  id: string;
  name: string;
  type: NodeType;
  contextName?: string; // only if type=NodeType.Context
  children?: ContextNode[];
  parentId?: string;
  tags?: string[];
  isExpanded?: boolean;
}

/**
 * Find a node by its ID
 * @param nodes Tree of context nodes to search in
 * @param id ID of the node to find
 * @returns Node if found, otherwise undefined
 */
export const findNodeById = (nodes: ContextNode[], id: string): ContextNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
};

export const findNodeIndex = (nodes: ContextNode[], id: string): number | undefined => {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.id === id) {
      return i;
    }
    if (node.children) {
      const found = findNodeIndex(node.children, id);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
};

// コンテキスト名をパースして階層構造を構築する
export const organizeContextsToTree = (contexts: string[]): ContextNode[] => {
  const tree: ContextNode[] = [];
  const providersMap: { [key: string]: ContextNode } = {};

  // プロバイダー検知パターン
  const gkePattern = /^gke_([^_]+)_([^_]+)_(.+)$/;
  const eksPattern = /^arn:aws:eks:([^:]+):(\d+):cluster\/(.+)$/;

  contexts.forEach(context => {
    let provider = 'Other';
    let project = '';
    let region = '';
    let name = context;

    // GKEコンテキスト検知
    const gkeMatch = context.match(gkePattern);
    if (gkeMatch) {
      provider = 'GKE';
      project = gkeMatch[1];
      region = gkeMatch[2];
      name = gkeMatch[3];
    }

    // EKSコンテキスト検知
    const eksMatch = context.match(eksPattern);
    if (eksMatch) {
      provider = 'AWS';
      region = eksMatch[1];
      project = eksMatch[2];
      name = eksMatch[3];
    }

    // プロバイダーノードを取得または作成
    if (!providersMap[provider]) {
      const providerNode: ContextNode = {
        id: `folder-${provider}`,
        name: provider,
        type: NodeType.Folder,
        children: [],
        isExpanded: true,
      };
      providersMap[provider] = providerNode;
      tree.push(providerNode);
    }

    const providerNode = providersMap[provider];

    // GKEとEKSはプロジェクト→リージョン→クラスターで階層化
    if (provider === 'GKE' || provider === 'AWS') {
      // プロジェクトノード
      let projectNode = providerNode.children?.find(c => c.name === project);
      if (!projectNode) {
        projectNode = {
          id: `folder-${provider}-${project}`,
          name: project,
          type: NodeType.Folder,
          children: [],
          isExpanded: true,
          parentId: providerNode.id,
        };
        providerNode.children?.push(projectNode);
      }

      // リージョンノード
      let regionNode = projectNode.children?.find(c => c.name === region);
      if (!regionNode) {
        regionNode = {
          id: `folder-${provider}-${project}-${region}`,
          name: region,
          type: NodeType.Folder,
          children: [],
          isExpanded: true,
          parentId: projectNode.id,
        };
        projectNode.children?.push(regionNode);
      }

      // クラスターノード（コンテキスト）
      const contextNode: ContextNode = {
        id: `context-${context}`,
        name: name,
        type: NodeType.Context,
        contextName: context,
        parentId: regionNode?.id,
      };
      regionNode?.children?.push(contextNode);
    } else {
      // その他のコンテキストは直接プロバイダーの下に配置
      const contextNode: ContextNode = {
        id: `context-${context}`,
        name: name,
        type: NodeType.Context,
        contextName: context,
        parentId: providerNode.id,
      };
      providerNode.children?.push(contextNode);
    }
  });

  return tree;
};

export const validateNodeName = (
  contextTree: ContextNode[],
  name: string,
  node: ContextNode
): string | undefined => {
  if (!name.match(/^[a-zA-Z0-9\-_]+$/)) {
    return 'Folder name can only contain letters, numbers, hyphens and underscores';
  }
  const siblings = getSiblings(contextTree, node);

  // Check for duplicate folder name at the same level
  const isDuplicate = (siblings: ContextNode[]): boolean => {
    return siblings.some(n => n.id !== node.id && n.type === node.type && n.name === name);
  };

  if (isDuplicate(siblings)) {
    return 'Name must be unique at this level';
  }

  return undefined;
};

export const getSiblings = (contextTree: ContextNode[], node: ContextNode): ContextNode[] => {
  return node.parentId ? findNodeById(contextTree, node.parentId)?.children || [] : contextTree;
};
