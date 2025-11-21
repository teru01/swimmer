import { ContextNode, NodeType, ContextProvider } from '../contextTree';

/**
 * EKS (Amazon Elastic Kubernetes Service) プロバイダー
 * コンテキスト形式: arn:aws:eks:<region>:<account>:cluster/<cluster>
 */
export const eksProvider: ContextProvider = {
  name: 'AWS',
  pattern: /^arn:aws:eks:([^:]+):(\d+):cluster\/(.+)$/,

  parse: (context: string) => {
    const match = context.match(eksProvider.pattern);
    if (!match) return undefined;

    return {
      provider: 'AWS',
      region: match[1],
      account: match[2],
      cluster: match[3],
    };
  },

  buildTree: (contexts: string[], rootId: string): ContextNode => {
    const accountsMap: { [account: string]: ContextNode } = {};
    const root: ContextNode = {
      id: rootId,
      name: 'AWS',
      type: NodeType.Folder,
      children: [],
      isExpanded: false,
    };

    contexts.forEach(context => {
      const parsed = eksProvider.parse(context);
      if (!parsed) return;

      const { region, account, cluster } = parsed;

      // アカウントノードを取得または作成
      let accountNode = accountsMap[account];
      if (!accountNode) {
        accountNode = {
          id: `${rootId}-${account}`,
          name: account,
          type: NodeType.Folder,
          children: [],
          isExpanded: false,
          parentId: root.id,
        };
        accountsMap[account] = accountNode;
        root.children?.push(accountNode);
      }

      // リージョンノードを取得または作成
      let regionNode = accountNode.children?.find(c => c.name === region);
      if (!regionNode) {
        regionNode = {
          id: `${rootId}-${account}-${region}`,
          name: region,
          type: NodeType.Folder,
          children: [],
          isExpanded: false,
          parentId: accountNode.id,
        };
        accountNode.children?.push(regionNode);
      }

      // クラスターノード（コンテキスト）を追加
      const contextNode: ContextNode = {
        id: `context-${context}`,
        name: cluster,
        type: NodeType.Context,
        contextName: context,
        parentId: regionNode.id,
      };
      regionNode.children?.push(contextNode);
    });

    return root;
  },
};
