import { ContextNode, NodeType, ContextProvider } from '../contextTree';

/**
 * GKE (Google Kubernetes Engine) プロバイダー
 * コンテキスト形式: gke_<project>_<region>_<cluster>
 */
export const gkeProvider: ContextProvider = {
  name: 'GKE',
  pattern: /^gke_([^_]+)_([^_]+)_(.+)$/,

  parse: (context: string) => {
    const match = context.match(gkeProvider.pattern);
    if (!match) return undefined;

    return {
      provider: 'GKE',
      project: match[1],
      region: match[2],
      cluster: match[3],
    };
  },

  buildTree: (contexts: string[], rootId: string): ContextNode => {
    const projectsMap: { [project: string]: ContextNode } = {};
    const root: ContextNode = {
      id: rootId,
      name: 'GKE',
      type: NodeType.Folder,
      children: [],
      isExpanded: false,
    };

    contexts.forEach(context => {
      const parsed = gkeProvider.parse(context);
      if (!parsed) return;

      const { project, region, cluster } = parsed;

      // プロジェクトノードを取得または作成
      let projectNode = projectsMap[project];
      if (!projectNode) {
        projectNode = {
          id: `${rootId}-${project}`,
          name: project,
          type: NodeType.Folder,
          children: [],
          isExpanded: false,
          parentId: root.id,
        };
        projectsMap[project] = projectNode;
        root.children?.push(projectNode);
      }

      // リージョンノードを取得または作成
      let regionNode = projectNode.children?.find(c => c.name === region);
      if (!regionNode) {
        regionNode = {
          id: `${rootId}-${project}-${region}`,
          name: region,
          type: NodeType.Folder,
          children: [],
          isExpanded: false,
          parentId: projectNode.id,
        };
        projectNode.children?.push(regionNode);
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
