import { useState, useEffect } from 'react';
import { PreferencesSection } from '../../preferences/PreferencesPage';
import { Input } from '../../main/ui';
import '../styles/contextsPane.css';
import { ContextNode, NodeType, buildTreeFromContexts } from '../../lib/contextTree';
import { gkeProvider } from '../../lib/providers/gke';
import { eksProvider } from '../../lib/providers/eks';
import { othersProvider } from '../../lib/providers/others';
import { commands } from '../../api';
import {
  loadTags,
  getContextTags,
  attachTagToContext,
  detachTagFromContext,
  MAX_TAGS_PER_CONTEXT,
} from '../../lib/tag';
import { Menu } from '../../components/ui/Menu';

interface ContextsPaneProps {
  selectedContext: ContextNode | undefined;
  onContextNodeSelect?: (contextNode: ContextNode) => void;
  onNavigateToPreferences?: (section?: PreferencesSection) => void;
}

// 使用するプロバイダーのリスト（Othersは最後に配置）
const PROVIDERS = [gkeProvider, eksProvider, othersProvider];

/**
 * Kubernetes contexts tree view component with static hierarchical structure.
 */
interface ContextMenuState {
  node: ContextNode;
  x: number;
  y: number;
}

function ContextsPane({
  selectedContext,
  onContextNodeSelect,
  onNavigateToPreferences,
}: ContextsPaneProps) {
  const [contextTree, setContextTree] = useState<ContextNode[]>([]);
  const [searchText, setSearchText] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | undefined>(undefined);
  const [attachedTags, setAttachedTags] = useState<string[]>([]);

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

  useEffect(() => {
    if (contextMenu?.node.clusterContext) {
      setAttachedTags(getContextTags(contextMenu.node.clusterContext.id));
    }
  }, [contextMenu]);

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

  const handleContextMenu = (node: ContextNode, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!node.clusterContext) return;

    setContextMenu({
      node,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleToggleTag = (tagId: string) => {
    if (!contextMenu?.node.clusterContext) return;

    const contextId = contextMenu.node.clusterContext.id;
    const isAttached = attachedTags.includes(tagId);

    if (isAttached) {
      detachTagFromContext(contextId, tagId);
      setAttachedTags(prev => prev.filter(id => id !== tagId));
    } else {
      if (attachedTags.length >= MAX_TAGS_PER_CONTEXT) {
        alert(`Maximum ${MAX_TAGS_PER_CONTEXT} tags per context`);
        return;
      }
      attachTagToContext(contextId, tagId);
      setAttachedTags(prev => [...prev, tagId]);
    }
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
          onContextMenu={isContext ? e => handleContextMenu(node, e) : undefined}
        >
          <div className="node-content">
            {isFolder && <span className="folder-icon">{isExpanded ? '▼' : '▶'}</span>}
            {isContext && <span className="context-icon">⚙️</span>}
            <span className="node-name">{node.name}</span>
          </div>
          {isContext && (
            <div className="node-actions">
              <button
                className="menu-button"
                onClick={e => handleContextMenu(node, e)}
                aria-label="Menu"
              >
                ⋮
              </button>
            </div>
          )}
        </div>
        {isFolder && isExpanded && node.children && (
          <div className="node-children">
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
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
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>
      </div>

      <div className="context-tree-container">
        {filterNodes(contextTree).map(node => renderNode(node))}
      </div>

      {contextMenu && (
        <Menu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              id: 'attach-tags',
              label: 'Attach Tags',
              children: [
                ...(loadTags().length === 0
                  ? [
                      {
                        id: 'no-tags',
                        label: 'No tags available',
                        onClick: () => {},
                        disabled: true,
                      },
                    ]
                  : loadTags().map(tag => ({
                      id: tag.id,
                      label: tag.name,
                      onClick: () => handleToggleTag(tag.id),
                      checked: attachedTags.includes(tag.id),
                    }))),
                {
                  id: 'separator-in-submenu',
                  type: 'separator' as const,
                },
                {
                  id: 'add-tags',
                  label: 'Add Tags',
                  onClick: () => {
                    onNavigateToPreferences?.('tags');
                  },
                },
              ],
            },
          ]}
          onClose={() => setContextMenu(undefined)}
        />
      )}
    </div>
  );
}

export default ContextsPane;
