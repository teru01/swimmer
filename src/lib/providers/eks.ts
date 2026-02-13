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
 * EKS (Amazon Elastic Kubernetes Service) provider
 * Context format: arn:aws:eks:<region>:<account>:cluster/<cluster>
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

      // Get or create account node
      let accountNode = accountsMap[account];
      if (!accountNode) {
        accountNode = newResourceContainerNode(account, root.id);
        accountsMap[account] = accountNode;
        root.children?.push(accountNode);
      }

      // Get or create region node
      let regionNode = accountNode.children?.find(c => c.name === region);
      if (!regionNode) {
        regionNode = newRegionNode(region, accountNode.id);
        accountNode.children?.push(regionNode);
      }

      // Add cluster node (context)
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
