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
 * GKE (Google Kubernetes Engine) provider
 * Context format: gke_<project>_<region>_<cluster>
 */
export const gkeProvider: ContextProvider = {
  name: 'GKE',
  pattern: /^gke_([^_]+)_([^_]+)_(.+)$/,
  resourceContainerLabel: 'Project',

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

  buildTree: (contexts: string[], _rootId: string): ContextNode => {
    const projectsMap: { [project: string]: ContextNode } = {};
    const root = newRootNode('GKE');

    contexts.forEach(context => {
      const parsed = gkeProvider.parse(context);
      if (!parsed) return;

      const { project, region, cluster } = parsed;

      // Get or create project node
      let projectNode = projectsMap[project];
      if (!projectNode) {
        projectNode = newResourceContainerNode(project, root.id);
        projectsMap[project] = projectNode;
        root.children?.push(projectNode);
      }

      // Get or create region node
      let regionNode = projectNode.children?.find(c => c.name === region);
      if (!regionNode) {
        regionNode = newRegionNode(region, projectNode.id);
        projectNode.children?.push(regionNode);
      }

      // Add cluster node (context)
      const clusterContext = newClusterContext({
        id: context,
        provider: 'GKE',
        region: region,
        resourceContainerID: project,
        clusterName: cluster,
      });
      const contextNode = newClusterContextNode(clusterContext, regionNode.id);
      regionNode.children?.push(contextNode);
    });

    return root;
  },
};
