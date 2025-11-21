import { useState } from 'react';
import { Button, Input } from '../../main/ui';
import '../styles/contextsPane.css';
import { ContextNode, NodeType } from '../../lib/contextTree';

interface ContextsPaneProps {
  selectedContext: ContextNode | undefined;
  onContextNodeSelect?: (contextNode: ContextNode) => void;
}

// ダミーのGKEコンテキストデータ
const DUMMY_CONTEXTS = [
  'gke_project-alpha_us-central1_cluster-prod',
  'gke_project-alpha_us-central1_cluster-staging',
  'gke_project-alpha_us-west1_cluster-dev',
  'gke_project-beta_asia-northeast1_cluster-prod',
  'gke_project-beta_asia-northeast1_cluster-staging',
  'gke_project-beta_europe-west1_cluster-test',
];

/**
 * GKEコンテキスト名をパースしてツリー構造を構築する
 */
const buildTreeFromContexts = (contexts: string[]): ContextNode[] => {
  const tree: ContextNode[] = [];
  const gkePattern = /^gke_([^_]+)_([^_]+)_(.+)$/;

  // GKE用のマップ
  const gkeProjectsMap: { [key: string]: ContextNode } = {};

  contexts.forEach(context => {
    const gkeMatch = context.match(gkePattern);
    if (!gkeMatch) return;

    const [, project, region, cluster] = gkeMatch;

    // GKEルートノードを取得または作成
    let gkeRoot = tree.find(n => n.name === 'GKE');
    if (!gkeRoot) {
      gkeRoot = {
        id: 'folder-gke',
        name: 'GKE',
        type: NodeType.Folder,
        children: [],
        isExpanded: true,
      };
      tree.push(gkeRoot);
    }

    // プロジェクトノードを取得または作成
    let projectNode = gkeProjectsMap[project];
    if (!projectNode) {
      projectNode = {
        id: `folder-gke-${project}`,
        name: project,
        type: NodeType.Folder,
        children: [],
        isExpanded: true,
        parentId: gkeRoot.id,
      };
      gkeProjectsMap[project] = projectNode;
      gkeRoot.children?.push(projectNode);
    }

    // リージョンノードを取得または作成
    let regionNode = projectNode.children?.find(c => c.name === region);
    if (!regionNode) {
      regionNode = {
        id: `folder-gke-${project}-${region}`,
        name: region,
        type: NodeType.Folder,
        children: [],
        isExpanded: true,
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

  return tree;
};

/**
 * Kubernetes contexts tree view component with static hierarchical structure.
 */
function ContextsPane({ selectedContext, onContextNodeSelect }: ContextsPaneProps) {
  const [contextTree] = useState<ContextNode[]>(() => buildTreeFromContexts(DUMMY_CONTEXTS));
  const [searchText, setSearchText] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(getAllFolderIds(buildTreeFromContexts(DUMMY_CONTEXTS)))
  );

  /**
   * すべてのフォルダIDを取得
   */
  function getAllFolderIds(nodes: ContextNode[]): string[] {
    const ids: string[] = [];
    for (const node of nodes) {
      if (node.type === NodeType.Folder) {
        ids.push(node.id);
        if (node.children) {
          ids.push(...getAllFolderIds(node.children));
        }
      }
    }
    return ids;
  }

  /**
   * フォルダの展開/折りたたみをトグル
   */
  const toggleExpanded = (nodeId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  /**
   * ノードをフィルタリング
   */
  const filterNodes = (nodes: ContextNode[]): ContextNode[] => {
    if (!searchText) return nodes;

    const filterNode = (node: ContextNode): ContextNode | undefined => {
      const nameMatches = node.name.toLowerCase().includes(searchText.toLowerCase());

      if (node.type === NodeType.Folder && node.children) {
        const filteredChildren = node.children.map(filterNode).filter(Boolean) as ContextNode[];
        if (filteredChildren.length > 0 || nameMatches) {
          return { ...node, children: filteredChildren };
        }
        return undefined;
      }

      return nameMatches ? node : undefined;
    };

    return nodes.map(filterNode).filter(Boolean) as ContextNode[];
  };

  /**
   * ツリーノードをレンダリング
   */
  const renderNode = (node: ContextNode, level: number = 0): JSX.Element => {
    const isFolder = node.type === NodeType.Folder;
    const isContext = node.type === NodeType.Context;
    const isSelected = selectedContext && node.id === selectedContext.id;
    const isExpanded = expandedIds.has(node.id);

    return (
      <div key={node.id}>
        <div
          className={`tree-node ${isFolder ? 'folder' : 'context'} ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${level * 24}px` }}
          onClick={() => {
            if (isFolder) {
              toggleExpanded(node.id);
            }
            if (isContext) {
              onContextNodeSelect?.(node);
            }
          }}
        >
          <div className="node-content">
            {isFolder && <span className="folder-icon">{isExpanded ? '▼' : '▶'}</span>}
            {isContext && <span className="context-icon">⚙️</span>}
            <span className="node-name">{node.name}</span>
          </div>
        </div>
        {isFolder && isExpanded && node.children && (
          <div className="node-children">
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const clearSearch = () => {
    setSearchText('');
  };

  return (
    <div className="contexts-pane">
      <div className="contexts-header">
        <div className="k8s-contexts-title">
          <h2>KUBERNETES CONTEXTS</h2>
        </div>

        <div className="contexts-toolbar">
          <Input
            placeholder="Search contexts..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            suffix={
              searchText && (
                <Button size="small" onClick={clearSearch}>
                  ×
                </Button>
              )
            }
          />
        </div>
      </div>

      <div className="context-tree-container">
        {filterNodes(contextTree).map(node => renderNode(node))}
      </div>
    </div>
  );
}

export default ContextsPane;
