import { useState, useEffect } from 'react';
import { Button, Input } from '../../main/ui';
import '../styles/contextsPane.css';
import { ContextNode, NodeType, buildTreeFromContexts } from '../../lib/contextTree';
import { gkeProvider } from '../../lib/providers/gke';
import { eksProvider } from '../../lib/providers/eks';
import { othersProvider } from '../../lib/providers/others';
import { commands } from '../../api';

interface ContextsPaneProps {
  selectedContext: ContextNode | undefined;
  onContextNodeSelect?: (contextNode: ContextNode) => void;
}

// 使用するプロバイダーのリスト（Othersは最後に配置）
const PROVIDERS = [gkeProvider, eksProvider, othersProvider];

/**
 * Kubernetes contexts tree view component with static hierarchical structure.
 */
function ContextsPane({ selectedContext, onContextNodeSelect }: ContextsPaneProps) {
  const [contextTree, setContextTree] = useState<ContextNode[]>([]);
  const [searchText, setSearchText] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContexts() {
      try {
        setLoading(true);
        const contexts = await commands.getKubeContexts();
        const tree = buildTreeFromContexts(contexts, PROVIDERS);
        setContextTree(tree);
        setExpandedIds(new Set(getAllOpenFolderIds(tree)));
      } catch (error) {
        console.error('Failed to load contexts:', error);
      } finally {
        setLoading(false);
      }
    }
    loadContexts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function getAllOpenFolderIds(nodes: ContextNode[]): string[] {
    const ids: string[] = [];
    for (const node of nodes) {
      if (node.type === NodeType.Folder && node.isExpanded) {
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

  if (loading) {
    return (
      <div className="contexts-pane">
        <div className="loading">Loading contexts...</div>
      </div>
    );
  }

  return (
    <div className="contexts-pane">
      <div className="contexts-header">
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
