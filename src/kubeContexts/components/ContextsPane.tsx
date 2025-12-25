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
  Tag,
} from '../../lib/tag';
import { loadFavorites, toggleFavorite } from '../../lib/favorite';
import { Menu } from '../../components/ui/Menu';
import gkeIcon from '../../assets/icons/gke.png';
import eksIcon from '../../assets/icons/eks.png';

interface ContextsPaneProps {
  selectedContext: ContextNode | undefined;
  onContextNodeSelect?: (contextNode: ContextNode) => void;
  onNavigateToPreferences?: (section?: PreferencesSection) => void;
}

// 使用するプロバイダーのリスト（Othersは最後に配置）
const PROVIDERS = [gkeProvider, eksProvider, othersProvider];

/**
 * Get icon for context based on provider
 */
const getContextIcon = (provider?: string): string | undefined => {
  switch (provider) {
    case 'GKE':
      return gkeIcon;
    case 'EKS':
      return eksIcon;
    default:
      return undefined;
  }
};

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
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<Tag[]>(loadTags());
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites());
  const [favoritesHeight, setFavoritesHeight] = useState<number>(() => {
    const saved = localStorage.getItem('swimmer_favorites_height');
    return saved ? parseInt(saved, 10) : 200;
  });
  const [isResizing, setIsResizing] = useState(false);

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
    setTags(loadTags());
    setFavorites(loadFavorites());
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
   * textとtagの両方にマッチするcontextを表示
   * textにマッチ: folderがtextにマッチ || context nameがマッチ
   * tag: 全てのタグにマッチ
   */
  const filterNodes = (nodes: ContextNode[]): ContextNode[] => {
    const hasSearchText = searchText.trim().length > 0;
    const hasSelectedTags = selectedTagIds.size > 0;

    if (!hasSearchText && !hasSelectedTags) return nodes;

    const filterNode = (node: ContextNode, parentNameMatch: boolean): ContextNode | undefined => {
      const nameMatches =
        !hasSearchText || node.name.toLowerCase().includes(searchText.toLowerCase());

      if (node.type === NodeType.Folder && node.children) {
        const filteredChildren = node.children
          .map(node => filterNode(node, parentNameMatch || nameMatches))
          .filter(Boolean) as ContextNode[];
        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
        return undefined;
      }

      if (node.type === NodeType.Context && node.clusterContext) {
        const contextTags = getContextTags(node.clusterContext.id);
        const isMatchAllTags =
          !hasSelectedTags ||
          Array.from(selectedTagIds).every(tagId => contextTags.includes(tagId));
        if ((nameMatches || parentNameMatch) && isMatchAllTags) return node;
        return undefined;
      }

      return nameMatches ? node : undefined;
    };

    return nodes.map(node => filterNode(node, false)).filter(Boolean) as ContextNode[];
  };

  const handleFavoriteClick = (contextId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(contextId);
    setFavorites(loadFavorites());
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const contextsHeader = document.querySelector('.contexts-header');
      if (!contextsHeader) return;

      const headerRect = contextsHeader.getBoundingClientRect();
      const contextsPane = document.querySelector('.contexts-pane');
      if (!contextsPane) return;

      const paneRect = contextsPane.getBoundingClientRect();
      const y = e.clientY - headerRect.bottom;
      const minHeight = 50;
      const maxHeight = paneRect.height - headerRect.height - 100;

      const newHeight = Math.max(minHeight, Math.min(maxHeight, y));
      setFavoritesHeight(newHeight);
      localStorage.setItem('swimmer_favorites_height', newHeight.toString());
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

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

  const handleTagFilterClick = (tagId: string) => {
    setSelectedTagIds(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  /**
   * ツリーノードをレンダリング
   */
  const renderNode = (
    node: ContextNode,
    level: number = 0,
    showContextInfo = false
  ): JSX.Element => {
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
            {isContext && (
              <>
                {getContextIcon(node.clusterContext?.provider) ? (
                  <img
                    src={getContextIcon(node.clusterContext?.provider)}
                    alt={node.clusterContext?.provider}
                    className="context-icon"
                  />
                ) : (
                  <span className="context-icon">⚙️</span>
                )}
              </>
            )}
            <span className="node-name">{node.name}</span>
            {isContext && node.clusterContext && showContextInfo && (
              <span className="node-context-info">
                {[
                  node.clusterContext.provider,
                  node.clusterContext.resourceContainerID,
                  node.clusterContext.region,
                ]
                  .filter(Boolean)
                  .join('/')}
              </span>
            )}
          </div>
          {isContext && (
            <div className="node-actions">
              <button
                className={`favorite-button ${favorites.has(node.clusterContext?.id || '') ? 'favorited' : ''}`}
                onClick={e => handleFavoriteClick(node.clusterContext?.id || '', e)}
                aria-label="Toggle favorite"
                title="Toggle favorite"
              >
                ★
              </button>
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
            {node.children.map(child => renderNode(child, level + 1, showContextInfo))}
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
        {tags.length > 0 && (
          <div className="tags-filter-wrapper">
            <span className="tags-filter-label">Filter by tag</span>
            <div className="tags-filter-container">
              {tags.map(tag => {
                const isSelected = selectedTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`tag-filter-button ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleTagFilterClick(tag.id)}
                    style={{
                      borderColor: isSelected ? tag.color : 'var(--border-color)',
                      backgroundColor: isSelected ? tag.color : 'transparent',
                      color: isSelected ? '#ffffff' : '#000000',
                    }}
                  >
                    <span
                      className="tag-filter-dot"
                      style={{ backgroundColor: isSelected ? '#ffffff' : tag.color }}
                    />
                    <span className="tag-filter-name">{tag.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="favorites-section" style={{ height: `${favoritesHeight}px` }}>
        <div className="favorites-header">
          <span className="favorites-label">Favorites</span>
        </div>
        <div className="favorites-list">
          {contextTree
            .flatMap(node => {
              const collectContexts = (n: ContextNode): ContextNode[] => {
                if (n.type === NodeType.Context && n.clusterContext) {
                  return favorites.has(n.clusterContext.id) ? [n] : [];
                }
                if (n.type === NodeType.Folder && n.children) {
                  return n.children.flatMap(collectContexts);
                }
                return [];
              };
              return collectContexts(node);
            })
            .map(node => renderNode(node, 0, true))}
        </div>
      </div>

      <div
        className="resizer"
        onMouseDown={handleResizeStart}
        style={{ cursor: isResizing ? 'row-resize' : 'ns-resize' }}
      />

      <div className="context-tree-section">
        <div className="context-tree-header">
          <span className="context-tree-label">Clusters</span>
        </div>
        <div className="context-tree-container">
          {filterNodes(contextTree).map(node => renderNode(node))}
        </div>
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
