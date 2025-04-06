// ノードタイプを定義するenum
export enum NodeType {
  Folder = 'folder',
  Context = 'context',
}

export interface ContextNode {
  id: string;
  name: string;
  type: NodeType;
  contextName?: string; // only if type=NodeType.Context
  children?: ContextNode[];
  parent?: ContextNode;
  tags?: string[];
  isExpanded?: boolean;
}

/**
 * Find a node by its ID
 * @param nodes Tree of context nodes to search in
 * @param id ID of the node to find
 * @returns Node if found, otherwise null
 */
export const findNodeById = (nodes: ContextNode[], id: string): ContextNode | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

/**
 * Find the parent folder ID of a node using parent references
 * @param nodes Tree of context nodes to search in
 * @param nodeId ID of the node to find parent for
 * @returns ID of the parent folder or null if not found
 */
export const findParentFolderId = (nodes: ContextNode[], nodeId: string | null): string | null => {
  if (!nodeId) return null;

  // Find the node first
  const findNode = (nodes: ContextNode[]): ContextNode | null => {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return node;
      }
      if (node.children) {
        const found = findNode(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const node = findNode(nodes);
  // Use parent reference if available
  return node?.parent?.id || null;
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
          parent: providerNode,
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
          parent: projectNode,
        };
        projectNode.children?.push(regionNode);
      }

      // クラスターノード（コンテキスト）
      const contextNode: ContextNode = {
        id: `context-${context}`,
        name: name,
        type: NodeType.Context,
        contextName: context,
        parent: regionNode,
      };
      regionNode.children?.push(contextNode);
    } else {
      // その他のコンテキストは直接プロバイダーの下に配置
      const contextNode: ContextNode = {
        id: `context-${context}`,
        name: name,
        type: NodeType.Context,
        contextName: context,
        parent: providerNode,
      };
      providerNode.children?.push(contextNode);
    }
  });

  return tree;
};

// Validate folder name
export const validateFolderName = (
  contextTree: ContextNode[],
  name: string,
  parentId: string | null,
  nodeId?: string
): string | null => {
  // Check for valid format using regex
  if (!name.match(/^[a-zA-Z0-9\-_]+$/)) {
    return 'Folder name can only contain letters, numbers, hyphens and underscores';
  }

  // 親フォルダのノードを検索
  const findParentNode = (nodes: ContextNode[], id: string | null): ContextNode | null => {
    if (id === null) return null;

    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.children) {
        const found = findParentNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const parentNode = parentId ? findParentNode(contextTree, parentId) : null;

  // Check for duplicate folder name at the same level
  const isDuplicate = (nodes: ContextNode[]): boolean => {
    const sameLevel = parentNode ? parentNode.children || [] : contextTree;

    return sameLevel.some(
      n => n.type === NodeType.Folder && n.name === name && (!nodeId || n.id !== nodeId) // Ignore current node when renaming
    );
  };

  if (isDuplicate(contextTree)) {
    return 'A folder with this name already exists at this level';
  }

  return null; // No validation error
};
