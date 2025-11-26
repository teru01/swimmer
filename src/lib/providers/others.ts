import {
  ContextNode,
  ContextProvider,
  newClusterContext,
  newRootNode,
  newClusterContextNode,
} from '../contextTree';

/**
 * Others プロバイダー
 * GKEやEKSなど、他のプロバイダーにマッチしないコンテキストをすべて受け入れる
 */
export const othersProvider: ContextProvider = {
  name: 'Others',
  // すべてにマッチする正規表現（実際には他のプロバイダーでマッチしなかったものを受け取る）
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
