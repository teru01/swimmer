import { ContextNode, NodeType, ContextProvider, ClusterContext } from '../contextTree';

/**
 * Others プロバイダー
 * GKEやEKSなど、他のプロバイダーにマッチしないコンテキストをすべて受け入れる
 */
export const othersProvider: ContextProvider = {
  name: 'Others',
  // すべてにマッチする正規表現（実際には他のプロバイダーでマッチしなかったものを受け取る）
  pattern: /.+/,

  parse: (context: string) => {
    return {
      provider: 'Others',
      context: context,
    };
  },

  buildTree: (contexts: string[], rootId: string): ContextNode => {
    const root: ContextNode = {
      id: rootId,
      name: 'Others',
      type: NodeType.Folder,
      children: [],
      isExpanded: true,
    };

    contexts.forEach(context => {
      const clusterContext: ClusterContext = {
        id: context,
        provider: 'Others',
        clusterName: context,
      };
      const contextNode: ContextNode = {
        id: `context-${context}`,
        name: context,
        type: NodeType.Context,
        clusterContext,
        parentId: root.id,
      };
      root.children?.push(contextNode);
    });

    return root;
  },
};
