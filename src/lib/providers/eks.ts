import {
  ContextNode,
  ContextProvider,
  newClusterContext,
  newRootNode,
  newResourceContainerNode,
  newRegionNode,
  newClusterContextNode,
} from '../contextTree';

/**
 * EKS (Amazon Elastic Kubernetes Service) プロバイダー
 * コンテキスト形式: arn:aws:eks:<region>:<account>:cluster/<cluster>
 */
export const eksProvider: ContextProvider = {
  name: 'AWS',
  pattern: /^arn:aws:eks:([^:]+):(\d+):cluster\/(.+)$/,
  resourceContainerLabel: 'Account ID',

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

  buildTree: (contexts: string[], _rootId: string): ContextNode => {
    const accountsMap: { [account: string]: ContextNode } = {};
    const root = newRootNode('AWS');

    contexts.forEach(context => {
      const parsed = eksProvider.parse(context);
      if (!parsed) return;

      const { region, account, cluster } = parsed;

      // アカウントノードを取得または作成
      let accountNode = accountsMap[account];
      if (!accountNode) {
        accountNode = newResourceContainerNode(account, root.id);
        accountsMap[account] = accountNode;
        root.children?.push(accountNode);
      }

      // リージョンノードを取得または作成
      let regionNode = accountNode.children?.find(c => c.name === region);
      if (!regionNode) {
        regionNode = newRegionNode(region, accountNode.id);
        accountNode.children?.push(regionNode);
      }

      // クラスターノード（コンテキスト）を追加
      const clusterContext = newClusterContext({
        id: context,
        provider: 'AWS',
        region: region,
        resourceContainerID: account,
        clusterName: cluster,
      });
      const contextNode = newClusterContextNode(clusterContext, regionNode.id);
      regionNode.children?.push(contextNode);
    });

    return root;
  },
};
