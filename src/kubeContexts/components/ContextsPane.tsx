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
} from '../lib/contextTree';
import K8sContextModal from './K8sContextModal';
import { mockFs, STORAGE_KEY, saveConfig } from '../lib/fs';
import { ContextConfigSchema } from '../lib/configSchema';

interface ContextsPaneProps {
  onContextSelect?: (contextNode: ContextNode) => void;
}

/**
 * Kubernetes contexts tree view component with hierarchical structure
 */
function ContextsPane({ onContextSelect }: ContextsPaneProps) {
  const [contextTree, setContextTree] = useState<ContextNode[]>([]);
  const [selectedContext, setSelectedContext] = useState<ContextNode | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [isEditing, _setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [showContextModal, setShowContextModal] = useState(false);
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);
  const treeRef = useRef(null);

  // Initialize: Load configuration
  useEffect(() => {
    async function loadContexts() {
      try {
        setLoading(true);

        // 1. Load tree structure from config file
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
          // If config file doesn't exist, load directly from kubeconfig
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

  // Handle context selection
  const handleContextSelect = useCallback(
    (contextNode: ContextNode) => {
      setSelectedContext(contextNode);
      onContextSelect?.(contextNode);

      // Save selection
      saveConfig({
        contextTree,
        lastSelectedContext: contextNode,
        tags: availableTags,
      });
    },
    [contextTree, availableTags, onContextSelect]
  );

  // Handle node rename with validation
  const handleRename = useCallback(
    (nodeId: string, newName: string) => {
      // Get the parent folder of the node being renamed
      const node = findNodeById(contextTree, nodeId);
      if (!node) {
        console.error('Node not found:', nodeId);
        return;
      }

      // Validate the new name
      const validationError = validateNodeName(contextTree, newName, node);
      if (validationError) {
        setError(validationError);
        // Keep the node in ed
        // it mode by forcing a re-edit after a short delay
        setTimeout(() => {
          const treeInstance = treeRef.current as { edit: (id: string) => void } | null;
          if (treeInstance?.edit) {
            treeInstance.edit(nodeId);
          }
        }, 100);
        return;
      }

      // Clear any previous error
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
    },
    [availableTags, contextTree, selectedContext]
  );

  const handleTreeChange = ({
    dragIds,
    dragNodes,
    parentId,
    parentNode,
    index,
  }: {
    dragIds: string[];
    dragNodes: NodeApi<ContextNode>[];
    parentId: string | null;
    parentNode: NodeApi<ContextNode> | null;
    index: number;
  }) => {
    console.info('handleTreeChange', { dragIds, parentId, parentNode, index });
    setContextTree(prev => {
      // Update parent references after drag & drop
      const updateParentReferences = (
        nodes: ContextNode[],
        parent: ContextNode | undefined = undefined
      ): ContextNode[] => {
        return nodes.map(node => {
          const updatedNode = { ...node, parent };
          if (updatedNode.children) {
            updatedNode.children = updateParentReferences(updatedNode.children, updatedNode);
          }
          return updatedNode;
        });
      };

      const updatedTree = updateParentReferences(prev);

      // Save the updated tree data
      saveConfig({
        contextTree: updatedTree,
        lastSelectedContext: selectedContext || undefined,
        tags: availableTags,
      });

      return updatedTree;
    });
  };

  // Show modal for creating a new context
  const handleNewContextClick = () => {
    const parentId = selectedContext?.parentId || null;
    setParentFolderId(parentId);
    setShowContextModal(true);
  };

  // Save a new context
  // const handleSaveContext = (contextInfo: { name: string; server: string; user: string }) => {
  //   const contextName = `ctx-${contextInfo.user}@${new URL(contextInfo.server).hostname}`;

  //   const parentNode = selectedContext?.parentId
  //     ? findNodeById(contextTree, selectedContext.parentId)
  //     : null;
  //   // Create new context node
  //   const newContext: ContextNode = {
  //     id: `context-${crypto.randomUUID()}`,
  //     name: contextInfo.name,
  //     type: NodeType.Context,
  //     contextName: contextName,
  //     tags: contextInfo.namespace ? ['namespace:' + contextInfo.namespace] : undefined,
  //     parentId: parentNode?.id || undefined,
  //   };

  //   setContextTree(prev => {
  //     // If no parent folder, add to root
  //     if (!parentFolderId) {
  //       // Find first "Other" folder or create a new one
  //       const otherFolder = prev.find(node => node.name === 'Other');
  //       if (otherFolder) {
  //         return prev.map(node => {
  //           if (node.id === otherFolder.id) {
  //             newContext.parent = otherFolder;
  //             return {
  //               ...node,
  //               children: [...(node.children || []), newContext],
  //             };
  //           }
  //           return node;
  //         });
  //       }

  //       // Create "Other" folder if it doesn't exist
  //       const newOtherFolder: ContextNode = {
  //         id: `folder-Other-${Date.now()}`,
  //         name: 'Other',
  //         type: NodeType.Folder,
  //         children: [newContext],
  //         isExpanded: true,
  //       };
  //       newContext.parent = newOtherFolder;
  //       return [...prev, newOtherFolder];
  //     }

  //     // Add to parent folder
  //     const addToParent = (nodes: ContextNode[]): ContextNode[] => {
  //       return nodes.map(node => {
  //         if (node.id === parentFolderId) {
  //           newContext.parent = node;
  //           return {
  //             ...node,
  //             children: [...(node.children || []), newContext],
  //             isExpanded: true, // Expand the folder
  //           };
  //         }
  //         if (node.children) {
  //           return {
  //             ...node,
  //             children: addToParent(node.children),
  //           };
  //         }
  //         return node;
  //       });
  //     };

  //     const updatedTree = addToParent(prev);
  //     saveConfig({
  //       contextTree: updatedTree,
  //       lastSelectedContextName: selectedContext?.contextName || undefined,
  //       tags: availableTags,
  //     });
  //     return updatedTree;
  //   });

  //   setShowContextModal(false);
  // };

  // Create a new folder
  const handleNewFolderClick = () => {
    const parentId = selectedContext?.parentId || null;
    const newFolderId = `folder-${crypto.randomUUID()}`;
    const newFolder: ContextNode = {
      id: newFolderId,
      name: 'NewFolder',
      type: NodeType.Folder,
      children: [],
      isExpanded: true,
    };

    setContextTree(prev => {
      // If no parent folder or context is not selected, add to root
      if (!parentId || !selectedContext) {
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
              isExpanded: true, // Expand parent folder
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
      switch (selectedContext.type) {
        case NodeType.Folder:
          updatedTree = addToChildren(prev);
          break;
        case NodeType.Context:
          updatedTree = addToParent(prev);
          break;
        default:
          updatedTree = [...prev, newFolder];
          break;
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
      // Avoid any type and use explicit casting
      type TreeInstance = {
        edit: (id: string) => void;
      };

      const treeInstance = treeRef.current as TreeInstance | null;
      if (treeInstance?.edit) {
        treeInstance.edit(newFolderId);
      }
    }, 100);
  };

  // Add tag to context
  const handleAddTag = (nodeId: string, tag: string) => {
    // Add tag if it doesn't exist
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

  // Remove tag from context
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

  // Custom node renderer
  const NodeRenderer = ({ node, style, dragHandle }: NodeRendererProps<ContextNode>) => {
    const data = node.data;
    const isFolder = data.type === NodeType.Folder;
    const isContext = data.type === NodeType.Context;
    const isSelected = selectedContext && data.id === selectedContext.id;

    // タグの削除処理をハンドリングする関数
    const handleTagClose = (tagToRemove: string) => {
      handleRemoveTag(node.id, tagToRemove);
    };

    return (
      <div
        className={`tree-node ${isFolder ? 'folder' : 'context'} ${isSelected ? 'selected' : ''}`}
        style={style}
        ref={dragHandle}
        onClick={() => {
          handleContextSelect(data);
          if (isFolder) {
            node.toggle();
          }
        }}
      >
        <div className="node-content">
          {isFolder && <span className="folder-icon">{node.isOpen ? '▼' : '▶'}</span>}

          {isContext && <span className="context-icon">⚙️</span>}

          <span className="node-name">
            {node.isEditing ? (
              <Input
                autoFocus
                defaultValue={data.name}
                onBlur={_e => node.reset()}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleRename(node.id, e.currentTarget.value);
                    // Reset will be handled inside handleRename based on validation
                  } else if (e.key === 'Escape') {
                    setError(null); // Clear any errors
                    node.reset();
                  }
                }}
                data-testid="folder-name-input"
                onMouseDown={e => e.stopPropagation()} // 編集時のクリックはバブリングさせない
              />
            ) : (
              data.name
            )}
          </span>

          {/* Tags display */}
          {data.tags &&
            data.tags.map(tag => (
              <Tag
                key={tag}
                className="context-tag"
                closable={isEditing}
                onClose={() => handleTagClose(tag)}
              >
                {tag}
              </Tag>
            ))}
        </div>
      </div>
    );
  };

  // Filtering function
  const filterNodes = useCallback(
    (nodes: ContextNode[]): ContextNode[] => {
      if (!filterTag && !searchText) return nodes;

      const filterNode = (node: ContextNode): ContextNode | null => {
        // Tag filtering
        if (filterTag && node.type === NodeType.Context) {
          if (!node.tags?.includes(filterTag)) {
            return null;
          }
        }

        // Text search filtering
        if (searchText && !node.name.toLowerCase().includes(searchText.toLowerCase())) {
          if (node.type === NodeType.Folder && node.children) {
            // For folders, search child nodes too
            const filteredChildren = node.children.map(filterNode).filter(Boolean) as ContextNode[];

            if (filteredChildren.length === 0) {
              return null;
            }

            return {
              ...node,
              children: filteredChildren,
              isExpanded: true, // Auto-expand during search
            };
          }

          return null;
        }

        // Process child nodes for folders
        if (node.type === NodeType.Folder && node.children) {
          const filteredChildren = node.children.map(filterNode).filter(Boolean) as ContextNode[];

          return {
            ...node,
            children: filteredChildren,
            // Auto-expand folders during search/filter
            isExpanded: !!searchText || !!filterTag || node.isExpanded,
          };
        }

        return node;
      };

      return nodes.map(filterNode).filter(Boolean) as ContextNode[];
    },
    [filterTag, searchText]
  );

  // Clear tag filter
  const clearTagFilter = () => {
    setFilterTag(null);
  };

  // Clear search
  const clearSearch = () => {
    setSearchText('');
  };

  // Reimport from kubeconfig
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

        {/* Tag filters display */}
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
          <Button onClick={handleReimport}>Retry</Button>
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

      {/* New context creation modal */}
      {showContextModal && (
        <K8sContextModal
          parentFolderId={parentFolderId}
          onClose={() => setShowContextModal(false)}
          onSave={() => {
            /* TODO: Implement saving */
          }}
        />
      )}
    </div>
  );
}

export default ContextsPane;
