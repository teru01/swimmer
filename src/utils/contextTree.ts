// コンテキストノードのデータ型
export interface ContextNode {
  id: string;
  name: string;
  type: 'folder' | 'context';
  path?: string; // type='context'の場合のkubeconfigコンテキスト名
  children?: ContextNode[];
  tags?: string[];
  isExpanded?: boolean;
}

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
        type: 'folder',
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
          type: 'folder',
          children: [],
          isExpanded: true,
        };
        providerNode.children?.push(projectNode);
      }

      // リージョンノード
      let regionNode = projectNode.children?.find(c => c.name === region);
      if (!regionNode) {
        regionNode = {
          id: `folder-${provider}-${project}-${region}`,
          name: region,
          type: 'folder',
          children: [],
          isExpanded: true,
        };
        projectNode.children?.push(regionNode);
      }

      // クラスターノード（コンテキスト）
      regionNode.children?.push({
        id: `context-${context}`,
        name: name,
        type: 'context',
        path: context,
      });
    } else {
      // その他のコンテキストは直接プロバイダーの下に配置
      providerNode.children?.push({
        id: `context-${context}`,
        name: name,
        type: 'context',
        path: context,
      });
    }
  });

  return tree;
};
