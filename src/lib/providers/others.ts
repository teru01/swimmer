import {
  ContextNode,
  ContextProvider,
  newClusterContext,
  newRootNode,
  newClusterContextNode,
} from '../contextTree';

/**
 * Others provider
 * Accepts all contexts that don't match other providers like GKE or EKS
 */
export const othersProvider: ContextProvider = {
  name: 'Others',
  // Regex that matches everything (receives contexts not matched by other providers)
  pattern: /.+/,
  resourceContainerLabel: 'Project/Account',

  parse: (context: string) => {
    return {
      provider: 'Others',
      context: context,
    };
  },

  buildTree: (contexts: string[], _rootId: string): ContextNode => {
    const root = newRootNode('Others');

    contexts.forEach(context => {
      const clusterContext = newClusterContext({
        id: context,
        provider: 'Others',
        clusterName: context,
      });
      const contextNode = newClusterContextNode(clusterContext, root.id);
      root.children?.push(contextNode);
    });

    return root;
  },
};
