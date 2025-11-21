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
