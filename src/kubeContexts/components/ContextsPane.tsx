import { useState, useEffect, useRef, useCallback } from 'react';
import { Tree, NodeRendererProps, NodeApi } from 'react-arborist';
import { commands } from '../../api';
import * as yaml from 'yaml';
import { Button, Input, Tag, Dropdown, Menu } from '../../main/ui';
import '../styles/contextsPane.css';
import {
  ContextNode,
  organizeContextsToTree,
  validateNodeName,
  NodeType,
  findNodeById,
  findNodeIndex,
} from '../../lib/contextTree';
import K8sContextModal from './K8sContextModal';
import { mockFs, STORAGE_KEY, saveConfig } from '../../lib/fs';
import { ContextConfigSchema } from '../../lib/configSchema';

interface ContextsPaneProps {
  onContextNodeSelect?: (contextNode: ContextNode) => void;
}

/**
 * Kubernetes contexts tree view component with hierarchical structure.
 * Displays Kubernetes contexts organized in a tree, allows selection,
 * renaming, adding tags, and drag-and-drop reordering.
 */
function ContextsPane({ onContextNodeSelect: onContextSelect }: ContextsPaneProps) {
  const [contextTree, setContextTree] = useState<ContextNode[]>([]);
  const [selectedContext, setSelectedContext] = useState<ContextNode | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [showContextModal, setShowContextModal] = useState(false);
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [focusedNodeName, setFocusedNodeName] = useState('');

  const treeRef = useRef(null);

  // Initialize: Load configuration
  useEffect(() => {
    /**
     * Loads Kubernetes contexts from configuration or kubeconfig.
     * Attempts to read from a config file first, falls back to importing
     * directly from the kubeconfig if the file doesn't exist.
     */
    async function loadContexts() {
      try {
        setLoading(true);

        let contextTreeData: ContextNode[] = [];
        let lastSelectedContext: ContextNode | undefined;
        let tags: string[] = [];

        try {
          const configYaml = await mockFs.readTextFile(STORAGE_KEY);
          const config = yaml.parse(configYaml);

          const parsedConfig = ContextConfigSchema.parse(config);
          contextTreeData = parsedConfig.contextTree || [];
          lastSelectedContext = parsedConfig.lastSelectedContext;
          tags = parsedConfig.availableTags || [];
          setAvailableTags(tags);
        } catch {
          console.info('Config not found, importing from kubeconfig');
          const kubeContexts = await commands.getKubeContexts();
          contextTreeData = organizeContextsToTree(kubeContexts);
          await saveConfig({ contextTree: contextTreeData, tags: [] });
        }

        setContextTree(contextTreeData);

        if (lastSelectedContext) {
          const contextNode = findNodeById(contextTreeData, lastSelectedContext.id);
          if (contextNode) {
            setSelectedContext(contextNode);
            onContextSelect?.(contextNode);
          }
        }

        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error loading contexts:', err);
        setError(typeof err === 'string' ? err : 'Failed to load Kubernetes contexts');
        setLoading(false);
      }
    }

    loadContexts();
  }, [onContextSelect]);

  // ドラッグ操作の検知
  useEffect(() => {
    /**
     * Detects the start of a drag operation.
     */
    const handleDragStart = () => {
      setIsDragging(true);
    };

    /**
     * Detects the end of a drag operation.
     */
    const handleDragEnd = () => {
      setIsDragging(false);
    };

    // グローバルイベントリスナーの登録
    document.addEventListener('mousedown', e => {
      if ((e.target as HTMLElement).closest('.drag-handle')) {
        handleDragStart();
      }
    });

    document.addEventListener('mouseup', handleDragEnd);

    // クリーンアップ
    return () => {
      document.removeEventListener('mousedown', handleDragStart);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, []);

  /**
   * Handles the selection of a context node.
   * Updates the selected context state and saves the selection.
   * @param contextNode The context node that was selected.
   */
  const handleContextSelect = useCallback(
    (contextNode: ContextNode) => {
      setSelectedContext(contextNode);
      onContextSelect?.(contextNode);
      setContextTree(prev => {
        const updateExpanded = (nodes: ContextNode[]): ContextNode[] => {
          return nodes.map(node => {
            if (node.id === contextNode.id) {
              const treeInstance = treeRef.current as {
                get: (id: string) => NodeApi | null;
              } | null;
              const nodeApiInsatnce = treeInstance?.get(node.id);
              return { ...node, isExpanded: !nodeApiInsatnce?.isOpen };
            }
            if (node.children) {
              return { ...node, children: updateExpanded(node.children) };
            }
            return node;
          });
        };
        saveConfig({
          contextTree,
          lastSelectedContext: contextNode,
          tags: availableTags,
        });
        return updateExpanded(prev);
      });
    },
    [contextTree, availableTags, onContextSelect]
  );

  /**
   * Handles renaming a node with validation.
   * Ensures the new name is valid and unique at its level.
   * If validation fails, sets an error and keeps the node in edit mode.
   * @param nodeId The ID of the node being renamed.
   * @param newName The new name for the node.
   */
  const handleRename = useCallback(
    (nodeId: string, newName: string): string | undefined => {
      const node = findNodeById(contextTree, nodeId);
      if (!node) {
        console.error('Node not found:', nodeId);
        return;
      }

      setError(null);

      setContextTree(prev => {
        const updateNodeName = (nodes: ContextNode[]): ContextNode[] => {
          return nodes.map(node => {
            if (node.id === nodeId) {
              return { ...node, name: newName };
            }
            if (node.children) {
              return { ...node, children: updateNodeName(node.children) };
            }
            return node;
          });
        };

        const updatedTree = updateNodeName(prev);
        saveConfig({
          contextTree: updatedTree,
          lastSelectedContext: selectedContext || undefined,
          tags: availableTags,
        });
        return updatedTree;
      });

      return newName;
    },
    [availableTags, contextTree, selectedContext]
  );

  /**
   * Handles changes to the tree structure after drag and drop operations.
   * Updates the tree state and saves the new structure.
   * @param params Information about the move operation.
   */
  const handleTreeChange = ({
    dragIds,
    parentId,
    index,
  }: {
    dragIds: string[];
    dragNodes: NodeApi<ContextNode>[];
    parentId: string | null;
    parentNode: NodeApi<ContextNode> | null;
    index: number;
  }) => {
    console.info('handleTreeChange', { dragIds, parentId, index });
    const dragId = dragIds[0]; // temporally only single node can be dragged

    setIsDragging(false);

    setContextTree(prev => {
      const findAndRemove = (nodes: ContextNode[]): [ContextNode[], ContextNode[]] => {
        const remaining: ContextNode[] = [];
        const removed: ContextNode[] = [];

        for (const node of nodes) {
          if (dragIds.includes(node.id)) {
            removed.push({ ...node, parentId: parentId || undefined });
            continue;
          }

          if (node.children) {
            const [newChildren, removedChildren] = findAndRemove(node.children);
            node.children = newChildren;
            removed.push(...removedChildren);
          }

          remaining.push({ ...node });
        }

        return [remaining, removed];
      };

      const prevNode = findNodeById(prev, dragId);
      let insertIndex = index;
      console.info('dbg', prevNode?.parentId, parentId);
      if (prevNode?.parentId == parentId) {
        const prevIndex = findNodeIndex(prev, dragId);
        console.info('previndex', prevIndex);
        if (prevIndex != null && index > prevIndex) {
          insertIndex = index - 1;
        }
      }

      const insertIntoParent = (
        nodes: ContextNode[],
        dragNodeContexts: ContextNode[]
      ): ContextNode[] => {
        if (!parentId) {
          const newRoots = [...nodes];
          newRoots.splice(insertIndex, 0, ...dragNodeContexts);
          return newRoots;
        }
        return nodes.map(n => {
          if (n.id === parentId) {
            const newChildren = [...(n.children || [])];
            newChildren.splice(insertIndex, 0, ...dragNodeContexts);
            return {
              ...n,
              children: newChildren,
              isExpanded: true,
            };
          }
          if (n.children) {
            return {
              ...n,
              children: insertIntoParent(n.children, dragNodeContexts),
            };
          }
          return n;
        });
      };

      const [withoutDragged, dragNodeContexts] = findAndRemove(prev);
      const newTree = insertIntoParent(withoutDragged, dragNodeContexts);

      const dragContextNode = findNodeById(prev, dragIds[0]);
      setSelectedContext(dragContextNode);

      saveConfig({
        contextTree: newTree,
        lastSelectedContext: dragContextNode || undefined,
        tags: availableTags,
      });

      return newTree;
    });
  };

  /**
   * Shows the modal for creating a new context.
   */
  const handleNewContextClick = () => {
    const parentId = selectedContext?.parentId || null;
    setParentFolderId(parentId);
    setShowContextModal(true);
  };

  /**
   * Handles saving a new context created via the modal.
   * @param contextInfo Information about the new context.
   */
  const handleSaveContext = (contextInfo: { name: string; server: string; user: string }) => {
    console.info('unimplemented: save context', contextInfo);
    // TODO: Implement actual saving logic, including creating the context node
    // and adding it to the contextTree.
    setShowContextModal(false);
  };

  /**
   * Handles the creation of a new folder.
   * Adds a new folder node to the tree, either at the root or under the selected parent.
   */
  const handleNewFolderClick = () => {
    const parentId = selectedContext?.parentId || null;
    const newFolderId = `folder-${crypto.randomUUID()}`;
    const newFolder: ContextNode = {
      id: newFolderId,
      name: '',
      type: NodeType.Folder,
      children: [],
      isExpanded: true,
    };

    setContextTree(prev => {
      if (!selectedContext || (!parentId && !selectedContext?.isExpanded)) {
        const newTree = [...prev, newFolder];
        saveConfig({
          contextTree: newTree,
          lastSelectedContext: selectedContext || undefined,
          tags: availableTags,
        });
        return newTree;
      }

      let updatedTree: ContextNode[] = [];
      const addToParent = (nodes: ContextNode[]): ContextNode[] => {
        return nodes.map(n => {
          if (n.id === parentId) {
            newFolder.parentId = n.id;
            return {
              ...n,
              children: [...(n.children || []), newFolder],
              isExpanded: true,
            };
          }
          if (n.children) {
            return {
              ...n,
              children: addToParent(n.children),
            };
          }
          return n;
        });
      };
      const addToChildren = (nodes: ContextNode[]): ContextNode[] => {
        return nodes.map(n => {
          if (n.id === selectedContext.id) {
            newFolder.parentId = n.id;
            return { ...n, children: [...(n.children || []), newFolder] };
          }
          if (n.children) {
            return { ...n, children: addToChildren(n.children) };
          }
          return n;
        });
      };
      if (selectedContext.type === NodeType.Folder && selectedContext?.isExpanded) {
        updatedTree = addToChildren(prev);
      } else {
        updatedTree = addToParent(prev);
      }
      saveConfig({
        contextTree: updatedTree,
        lastSelectedContext: selectedContext || undefined,
        tags: availableTags,
      });
      return updatedTree;
    });

    // Start edit mode after creation
    setTimeout(() => {
      type TreeInstance = {
        edit: (id: string) => void;
      };
      const treeInstance = treeRef.current as TreeInstance | null;
      if (treeInstance?.edit) {
        treeInstance.edit(newFolderId);
      }
    }, 10);
  };

  /**
   * Adds a tag to a specified node.
   * If the tag is new, it's also added to the list of available tags.
   * @param nodeId The ID of the node to add the tag to.
   * @param tag The tag string to add.
   */
  const handleAddTag = (nodeId: string, tag: string) => {
    if (!availableTags.includes(tag)) {
      setAvailableTags(prev => {
        const newTags = [...prev, tag];
        return newTags;
      });
    }

    setContextTree(prev => {
      const updateNodeTags = (nodes: ContextNode[]): ContextNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId) {
            const tags = node.tags || [];
            if (!tags.includes(tag)) {
              return { ...node, tags: [...tags, tag] };
            }
            return node;
          }
          if (node.children) {
            return { ...node, children: updateNodeTags(node.children) };
          }
          return node;
        });
      };

      const updatedTree = updateNodeTags(prev);
      saveConfig({
        contextTree: updatedTree,
        lastSelectedContext: selectedContext || undefined,
        tags: availableTags.includes(tag) ? availableTags : [...availableTags, tag],
      });
      return updatedTree;
    });
  };

  /**
   * Removes a tag from a specified node.
   * @param nodeId The ID of the node to remove the tag from.
   * @param tagToRemove The tag string to remove.
   */
  const handleRemoveTag = (nodeId: string, tagToRemove: string) => {
    setContextTree(prev => {
      const updateNodeTags = (nodes: ContextNode[]): ContextNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId && node.tags) {
            return {
              ...node,
              tags: node.tags.filter(tag => tag !== tagToRemove),
            };
          }
          if (node.children) {
            return { ...node, children: updateNodeTags(node.children) };
          }
          return node;
        });
      };

      const updatedTree = updateNodeTags(prev);
      saveConfig({
        contextTree: updatedTree,
        lastSelectedContext: selectedContext || undefined,
        tags: availableTags,
      });
      return updatedTree;
    });
  };

  const handleRemoveFolder = (nodeId: string) => {
    setContextTree(prev => {
      const removeNode = (nodes: ContextNode[], nodeId: string) => {
        const remaining: ContextNode[] = [];
        nodes.forEach(node => {
          if (node.id != nodeId) {
            node.children = removeNode(node.children || [], nodeId);
            remaining.push(node);
          }
        });
        return remaining;
      };

      const updatedTree = removeNode(prev, nodeId);
      saveConfig({
        contextTree: updatedTree,
        lastSelectedContext: selectedContext || undefined,
        tags: availableTags,
      });
      return updatedTree;
    });
  };

  /**
   * Custom renderer for each node in the tree.
   * Handles display of folder/context icons, name, tags, and drag handle.
   * Also handles node selection and toggling folders open/closed.
   * @param props Props provided by react-arborist for node rendering.
   * @returns The rendered node element.
   */
  const NodeRenderer = ({ node, style, dragHandle }: NodeRendererProps<ContextNode>) => {
    const data = node.data;
    const isFolder = data.type === NodeType.Folder;
    const isContext = data.type === NodeType.Context;
    const isSelected = selectedContext && data.id === selectedContext.id;

    /**
     * Handles the removal of a tag from the current node.
     * @param tagToRemove The tag string to remove.
     */
    const handleTagClose = (tagToRemove: string) => {
      handleRemoveTag(node.id, tagToRemove);
    };

    /**
     * Automatically opens a folder node when hovered over during a drag operation.
     */
    const handleMouseEnter = () => {
      if (isFolder && !node.isOpen && isDragging) {
        node.toggle();
      }
    };

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>, node: ContextNode) => {
      const input = e.target.value;
      setFocusedNodeName(input);
      const validationError = validateNodeName(contextTree, input, node);
      if (validationError) {
        setError(validationError);
        // Keep the node in edit mode by forcing a re-edit after a short delay
        setTimeout(() => {
          const treeInstance = treeRef.current as { edit: (id: string) => void } | null;
          if (treeInstance?.edit) {
            treeInstance.edit(node.id);
          }
        }, 10);
      } else {
        setError(null);
      }
    };

    const resetNode = (node: NodeApi<ContextNode>) => {
      node.reset();
      setFocusedNodeName('');
    };

    return (
      <div
        className={`tree-node ${isFolder ? 'folder' : 'context'} ${isSelected ? 'selected' : ''}`}
        style={style}
        ref={dragHandle}
        onClick={() => {
          if (isFolder) {
            node.toggle();
          }
          setTimeout(() => {
            handleContextSelect(data);
          }, 10);
        }}
        onMouseEnter={handleMouseEnter}
      >
        <div className="node-content">
          {isFolder && <span className="folder-icon">{node.isOpen ? '▼' : '▶'}</span>}
          {isContext && <span className="context-icon">⚙️</span>}
          <span className="node-name">
            {node.isEditing ? (
              <Input
                value={focusedNodeName}
                autoFocus
                onBlur={e => {
                  if (error) {
                    handleRemoveFolder(node.id);
                    setError(null);
                    resetNode(node);
                    return;
                  }
                  const newName = handleRename(node.id, e.target.value.trim());
                  if (newName) {
                    resetNode(node);
                  } else {
                    handleRemoveFolder(node.id);
                    setError(null);
                    resetNode(node);
                  }
                }}
                onChange={e => {
                  const n = findNodeById(contextTree, node.id);
                  if (!n) {
                    return;
                  }
                  handleOnChange(e, n);
                }}
                onKeyDown={e => {
                  switch (e.key) {
                    case 'Enter': {
                      if (error) {
                        return;
                      }
                      const newName = handleRename(node.id, focusedNodeName);
                      if (newName) {
                        resetNode(node);
                      }
                      break;
                    }
                    case 'Escape': {
                      handleRemoveFolder(node.id);
                      setError(null);
                      resetNode(node);
                      break;
                    }
                  }
                }}
                data-testid="folder-name-input"
                onMouseDown={e => e.stopPropagation()} // Prevent node selection when clicking input
              />
            ) : (
              data.name
            )}
          </span>
          {data.tags &&
            data.tags.map(tag => (
              <Tag
                key={tag}
                className="context-tag"
                closable={isEditing} // Only allow closing tags in edit mode (if re-enabled)
                onClose={() => handleTagClose(tag)}
              >
                {tag}
              </Tag>
            ))}
        </div>
        {/* Drag handle appears on hover */}
        <div className="node-actions">
          <div className="drag-handle" ref={dragHandle} onMouseDown={e => e.stopPropagation()}>
            <span className="drag-icon">⋮⋮</span>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Filters the tree nodes based on the current search text and selected tag filter.
   * @param nodes The array of nodes to filter.
   * @returns A filtered array of nodes.
   */
  const filterNodes = useCallback(
    (nodes: ContextNode[]): ContextNode[] => {
      if (!filterTag && !searchText) return nodes;

      const filterNode = (node: ContextNode): ContextNode | null => {
        // Tag filtering (only applies to context nodes)
        if (filterTag && node.type === NodeType.Context) {
          if (!node.tags?.includes(filterTag)) {
            return null;
          }
        }

        // Text search filtering
        const nameMatches = node.name.toLowerCase().includes(searchText.toLowerCase());
        if (searchText && !nameMatches) {
          if (node.type === NodeType.Folder && node.children) {
            const filteredChildren = node.children.map(filterNode).filter(Boolean) as ContextNode[];
            if (filteredChildren.length > 0) {
              // Keep folder if any children match
              return { ...node, children: filteredChildren, isExpanded: true };
            }
            return null; // Discard folder if no children match
          }
          return null; // Discard context node if name doesn't match
        }

        // If a folder matches or has children that match, process its children
        if (node.type === NodeType.Folder && node.children) {
          const filteredChildren = node.children.map(filterNode).filter(Boolean) as ContextNode[];
          return {
            ...node,
            children: filteredChildren,
            isExpanded: !!searchText || !!filterTag || node.isExpanded, // Auto-expand during search/filter
          };
        }

        return node; // Return node if it matches or is a context node not filtered by tag
      };

      return nodes.map(filterNode).filter(Boolean) as ContextNode[];
    },
    [filterTag, searchText]
  );

  /**
   * Clears the currently active tag filter.
   */
  const clearTagFilter = () => {
    setFilterTag(null);
  };

  /**
   * Clears the current search text.
   */
  const clearSearch = () => {
    setSearchText('');
  };

  /**
   * Handles re-importing contexts directly from the kubeconfig,
   * overwriting the current tree structure.
   */
  const handleReimport = async () => {
    try {
      setLoading(true);
      const kubeContexts = await commands.getKubeContexts();
      const newTree = organizeContextsToTree(kubeContexts);
      setContextTree(newTree);
      await saveConfig({
        contextTree: newTree,
        lastSelectedContext: selectedContext || undefined,
        tags: availableTags,
      });
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error reimporting contexts:', err);
      setError(typeof err === 'string' ? err : 'Failed to reimport Kubernetes contexts');
      setLoading(false);
    }
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

        <div className="context-actions">
          <Button className="icon-button" onClick={handleNewContextClick} title="New Context">
            <span className="context-icon">⚙️</span>
          </Button>
          <Button className="icon-button" onClick={handleNewFolderClick} title="New Folder">
            <span className="folder-icon">📁</span>
          </Button>
        </div>

        {availableTags.length > 0 && (
          <div className="tag-filters">
            {availableTags.map(tag => (
              <Tag
                key={tag}
                className={`filter-tag ${filterTag === tag ? 'active' : ''}`}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              >
                {tag}
              </Tag>
            ))}

            {filterTag && (
              <Button size="small" onClick={clearTagFilter}>
                Clear Filter
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading contexts...</div>
      ) : (
        <div className="context-tree-container">
          <Tree<ContextNode>
            ref={treeRef}
            data={filterNodes(contextTree)}
            openByDefault={false}
            width="100%"
            height={500}
            indent={24}
            rowHeight={32}
            paddingTop={10}
            paddingBottom={10}
            selectionFollowsFocus={true}
            onMove={handleTreeChange}
          >
            {NodeRenderer}
          </Tree>
        </div>
      )}

      {showContextModal && (
        <K8sContextModal
          parentFolderId={parentFolderId}
          onClose={() => setShowContextModal(false)}
          onSave={handleSaveContext}
        />
      )}
    </div>
  );
}

export default ContextsPane;
