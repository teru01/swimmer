import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Tree, NodeRendererProps } from 'react-arborist';
import { commands } from '../../api';
// import { fs } from '@tauri-apps/api/fs';
import * as yaml from 'yaml';
import { Button, Input, Tag, Dropdown, Menu } from '../../main/ui';
import '../styles/contextsPane.css';
import { ContextNode, organizeContextsToTree } from '../contextTree';

interface ContextsPaneProps {
  onContextSelect?: (context: string) => void;
}

// K8sコンテキスト作成用のモーダルコンポーネント
interface K8sContextModalProps {
  parentFolderId: string | null;
  onClose: () => void;
  onSave: (context: { name: string; server: string; user: string; namespace?: string }) => void;
}

function K8sContextModal({
  parentFolderId: _parentFolderId,
  onClose,
  onSave,
}: K8sContextModalProps) {
  const [name, setName] = useState('');
  const [server, setServer] = useState('');
  const [user, setUser] = useState('');
  const [namespace, setNamespace] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      server,
      user,
      namespace: namespace || undefined,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>新しいKubernetesコンテキスト</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">コンテキスト名</label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="my-context"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="server">APIサーバーURL</label>
            <Input
              id="server"
              value={server}
              onChange={e => setServer(e.target.value)}
              placeholder="https://kubernetes.example.com"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="user">ユーザー名</label>
            <Input
              id="user"
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="kubernetes-admin"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="namespace">名前空間 (オプション)</label>
            <Input
              id="namespace"
              value={namespace}
              onChange={e => setNamespace(e.target.value)}
              placeholder="default"
            />
          </div>
          <div className="modal-actions">
            <Button type="button" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" className="primary-button">
              保存
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Kubernetes contexts tree view component with hierarchical structure
 */
function ContextsPane({ onContextSelect }: ContextsPaneProps) {
  const [contextTree, setContextTree] = useState<ContextNode[]>([]);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [showContextModal, setShowContextModal] = useState(false);
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);
  const treeRef = useRef(null);

  // 設定用のローカルストレージキー
  const STORAGE_KEY = 'swimmer.contextTree';

  // モック用のファイルシステム操作
  const mockFs = useMemo(
    () => ({
      // ファイル読み込み（ローカルストレージから）
      readTextFile: async (_path: string): Promise<string> => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) throw new Error('Configuration not found');
        return stored;
      },

      // ファイル書き込み（ローカルストレージへ）
      writeTextFile: async (_path: string, content: string): Promise<void> => {
        localStorage.setItem(STORAGE_KEY, content);
      },

      // ディレクトリ作成（モックなので何もしない）
      createDir: async (_path: string, _options?: { recursive: boolean }): Promise<void> => {
        // 実際には何もしない
        return;
      },
    }),
    []
  );

  // 設定を保存する
  const saveConfig = useCallback(
    async (config: {
      contextTree: ContextNode[];
      lastSelectedContext?: string;
      tags: string[];
    }) => {
      try {
        const configYaml = yaml.stringify(config);
        await mockFs.writeTextFile(STORAGE_KEY, configYaml);
      } catch (err) {
        console.error('Error saving config:', err);
        setError('Failed to save configuration');
      }
    },
    [mockFs]
  );

  // 初期化: 設定を読み込む
  useEffect(() => {
    async function loadContexts() {
      try {
        setLoading(true);

        // 1. 設定ファイルからツリー構造を読み込む
        let contextTreeData: ContextNode[] = [];
        let lastSelectedContext: string | null = null;
        let tags: string[] = [];

        try {
          const configYaml = await mockFs.readTextFile(STORAGE_KEY);
          const config = yaml.parse(configYaml);
          contextTreeData = config.contextTree || [];
          lastSelectedContext = config.lastSelectedContext;
          tags = config.tags || [];
          setAvailableTags(tags);
        } catch {
          // 設定ファイルがない場合は、kubeconfigから直接読み込む
          console.info('Config not found, importing from kubeconfig');
          const kubeContexts = await commands.getKubeContexts();
          contextTreeData = organizeContextsToTree(kubeContexts);
          await saveConfig({ contextTree: contextTreeData, tags: [] });
        }

        setContextTree(contextTreeData);

        if (lastSelectedContext) {
          setSelectedContextId(lastSelectedContext);
          onContextSelect?.(lastSelectedContext);
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
  }, [mockFs, onContextSelect, saveConfig]);

  // 選択されているコンテキストが属するフォルダIDを見つける
  const findParentFolderId = useCallback(
    (nodeId: string | null): string | null => {
      if (!nodeId) return null;

      const findParent = (nodes: ContextNode[], targetId: string): string | null => {
        for (const node of nodes) {
          if (node.children) {
            // このノードの子供に対象があるか
            const isChildOfCurrentNode = node.children.some(child => child.id === targetId);
            if (isChildOfCurrentNode) {
              return node.id;
            }
            // 再帰的に子ノードを探索
            const parent = findParent(node.children, targetId);
            if (parent) {
              return parent;
            }
          }
        }
        return null;
      };

      return findParent(contextTree, nodeId);
    },
    [contextTree]
  );

  // コンテキスト選択時の処理
  const handleContextSelect = useCallback(
    (contextPath: string) => {
      setSelectedContextId(contextPath);
      onContextSelect?.(contextPath);

      // 選択を保存
      saveConfig({
        contextTree,
        lastSelectedContext: contextPath,
        tags: availableTags,
      });
    },
    [contextTree, availableTags, onContextSelect, saveConfig]
  );

  // ノード編集時の処理
  const handleRename = useCallback(
    (nodeId: string, newName: string) => {
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
        saveConfig({ contextTree: updatedTree, tags: availableTags });
        return updatedTree;
      });
    },
    [availableTags, saveConfig]
  );

  // ツリー構造変更時の処理（ドラッグ&ドロップ後）
  const handleTreeChange = useCallback(() => {
    // この関数はドラッグ&ドロップ操作後にreact-arboristライブラリから呼ばれます
    // ここではローカルの状態更新だけ行い、ストレージへの保存も行います
    setContextTree(prev => {
      // 更新後のツリーデータを保存
      saveConfig({
        contextTree: prev,
        lastSelectedContext: selectedContextId || undefined,
        tags: availableTags,
      });

      return prev;
    });
  }, [selectedContextId, availableTags, saveConfig]);

  // 新しいコンテキストを作成するモーダルを表示
  const handleNewContextClick = () => {
    const parentId = selectedContextId ? findParentFolderId(selectedContextId) : null;

    setParentFolderId(parentId);
    setShowContextModal(true);
  };

  // 新しいコンテキストを保存
  const handleSaveContext = (contextInfo: {
    name: string;
    server: string;
    user: string;
    namespace?: string;
  }) => {
    // コンテキストパスを生成 (実際のkubeconfigでは複雑だが、シンプルにする)
    const contextPath = `ctx-${contextInfo.user}@${new URL(contextInfo.server).hostname}`;

    // 新しいコンテキストノード
    const newContext: ContextNode = {
      id: `context-${contextPath}`,
      name: contextInfo.name,
      type: 'context',
      path: contextPath,
      tags: contextInfo.namespace ? ['namespace:' + contextInfo.namespace] : undefined,
    };

    setContextTree(prev => {
      // 親フォルダがない場合はルートに追加
      if (!parentFolderId) {
        // 検索して最初に見つかるOtherフォルダに追加するか、新しいOtherフォルダを作成
        const otherFolder = prev.find(node => node.name === 'Other');
        if (otherFolder) {
          return prev.map(node => {
            if (node.id === otherFolder.id) {
              return {
                ...node,
                children: [...(node.children || []), newContext],
              };
            }
            return node;
          });
        }

        // Otherフォルダがなければ作成
        const newOtherFolder: ContextNode = {
          id: `folder-Other-${Date.now()}`,
          name: 'Other',
          type: 'folder',
          children: [newContext],
          isExpanded: true,
        };
        return [...prev, newOtherFolder];
      }

      // 親フォルダに追加
      const addToParent = (nodes: ContextNode[]): ContextNode[] => {
        return nodes.map(node => {
          if (node.id === parentFolderId) {
            return {
              ...node,
              children: [...(node.children || []), newContext],
              isExpanded: true, // フォルダを展開
            };
          }
          if (node.children) {
            return {
              ...node,
              children: addToParent(node.children),
            };
          }
          return node;
        });
      };

      const updatedTree = addToParent(prev);
      saveConfig({ contextTree: updatedTree, tags: availableTags });
      return updatedTree;
    });

    setShowContextModal(false);
  };

  // 新しいフォルダの作成
  const handleNewFolderClick = () => {
    const parentId = selectedContextId ? findParentFolderId(selectedContextId) : null;

    const newFolderId = `folder-new-${Date.now()}`;
    const newFolder: ContextNode = {
      id: newFolderId,
      name: 'New Folder',
      type: 'folder',
      children: [],
      isExpanded: true,
    };

    setContextTree(prev => {
      // 親フォルダがない場合はルートに追加
      if (!parentId) {
        const newTree = [...prev, newFolder];
        saveConfig({ contextTree: newTree, tags: availableTags });
        return newTree;
      }

      // 親フォルダに追加
      const addToParent = (nodes: ContextNode[]): ContextNode[] => {
        return nodes.map(n => {
          if (n.id === parentId) {
            return {
              ...n,
              children: [...(n.children || []), newFolder],
              isExpanded: true, // 親フォルダを展開
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

      const updatedTree = addToParent(prev);
      saveConfig({ contextTree: updatedTree, tags: availableTags });
      return updatedTree;
    });

    // 作成後に編集モードを開始
    setTimeout(() => {
      // any型を避け、明示的なキャストを行う
      type TreeInstance = {
        edit: (id: string) => void;
      };

      const treeInstance = treeRef.current as TreeInstance | null;
      if (treeInstance?.edit) {
        treeInstance.edit(newFolderId);
      }
    }, 100);
  };

  // コンテキストにタグを追加
  const handleAddTag = (nodeId: string, tag: string) => {
    // タグが存在しなければ追加
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
        tags: availableTags.includes(tag) ? availableTags : [...availableTags, tag],
      });
      return updatedTree;
    });
  };

  // コンテキストからタグを削除
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
      saveConfig({ contextTree: updatedTree, tags: availableTags });
      return updatedTree;
    });
  };

  // カスタムノードレンダラー
  const NodeRenderer = ({ node, style, dragHandle }: NodeRendererProps<ContextNode>) => {
    const data = node.data;
    const isFolder = data.type === 'folder';
    const isContext = data.type === 'context';
    const isSelected = isContext && data.path === selectedContextId;

    return (
      <div
        className={`tree-node ${isFolder ? 'folder' : 'context'} ${isSelected ? 'selected' : ''}`}
        style={style}
        ref={dragHandle}
      >
        <div className="node-content">
          {isFolder && (
            <span className="folder-icon" onClick={() => node.toggle()}>
              {node.isOpen ? '▼' : '▶'}
            </span>
          )}

          {isContext && <span className="context-icon">⚙️</span>}

          <span
            className="node-name"
            onClick={() => {
              if (isContext && data.path) {
                handleContextSelect(data.path);
              } else if (isFolder) {
                node.toggle();
              }
            }}
          >
            {node.isEditing ? (
              <Input
                autoFocus
                defaultValue={data.name}
                onBlur={_e => node.reset()}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleRename(node.id, e.currentTarget.value);
                    node.reset();
                  } else if (e.key === 'Escape') {
                    node.reset();
                  }
                }}
              />
            ) : (
              data.name
            )}
          </span>

          {/* タグ表示 */}
          {data.tags &&
            data.tags.map(tag => (
              <Tag
                key={tag}
                className="context-tag"
                closable={isEditing}
                onClose={() => handleRemoveTag(node.id, tag)}
              >
                {tag}
              </Tag>
            ))}
        </div>

        {/* 編集モード時のアクション */}
        {isEditing && (
          <div className="node-actions">
            <Button size="small" onClick={() => node.edit()}>
              Rename
            </Button>

            <Dropdown
              overlay={
                <div>
                  {availableTags.map(tag => (
                    <Menu.Item key={tag} onClick={() => handleAddTag(node.id, tag)}>
                      {tag}
                    </Menu.Item>
                  ))}
                  <Menu.Divider />
                  <div>
                    <Input
                      placeholder="New tag..."
                      size="small"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const value = e.currentTarget.value.trim();
                          if (value) handleAddTag(node.id, value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              }
            >
              <Button size="small">Add Tag</Button>
            </Dropdown>

            {isFolder && (
              <Button
                size="small"
                onClick={() => {
                  // フォルダに新しいサブフォルダを追加
                  const newChild: ContextNode = {
                    id: `folder-new-${Date.now()}`,
                    name: 'New Folder',
                    type: 'folder',
                    children: [],
                    isExpanded: true,
                  };

                  // ツリー更新のため独自に処理
                  setContextTree(prev => {
                    const addChildToFolder = (nodes: ContextNode[]): ContextNode[] => {
                      return nodes.map(n => {
                        if (n.id === node.id) {
                          return {
                            ...n,
                            children: [...(n.children || []), newChild],
                          };
                        }
                        if (n.children) {
                          return {
                            ...n,
                            children: addChildToFolder(n.children),
                          };
                        }
                        return n;
                      });
                    };

                    const updatedTree = addChildToFolder(prev);
                    saveConfig({ contextTree: updatedTree, tags: availableTags });
                    return updatedTree;
                  });
                }}
              >
                Add Folder
              </Button>
            )}

            <Button
              size="small"
              danger
              onClick={() => {
                if (window.confirm(`Delete ${data.name}?`)) {
                  // ツリー更新のため独自に処理
                  setContextTree(prev => {
                    const removeNode = (nodes: ContextNode[]): ContextNode[] => {
                      return nodes
                        .filter(n => n.id !== node.id)
                        .map(n => {
                          if (n.children) {
                            return {
                              ...n,
                              children: removeNode(n.children),
                            };
                          }
                          return n;
                        });
                    };

                    const updatedTree = removeNode(prev);
                    saveConfig({ contextTree: updatedTree, tags: availableTags });
                    return updatedTree;
                  });
                }
              }}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    );
  };

  // フィルタリング関数
  const filterNodes = useCallback(
    (nodes: ContextNode[]): ContextNode[] => {
      if (!filterTag && !searchText) return nodes;

      const filterNode = (node: ContextNode): ContextNode | null => {
        // タグフィルタリング
        if (filterTag && node.type === 'context') {
          if (!node.tags?.includes(filterTag)) {
            return null;
          }
        }

        // テキスト検索フィルタリング
        if (searchText && !node.name.toLowerCase().includes(searchText.toLowerCase())) {
          if (node.type === 'folder' && node.children) {
            // フォルダの場合は子ノードも検索
            const filteredChildren = node.children.map(filterNode).filter(Boolean) as ContextNode[];

            if (filteredChildren.length === 0) {
              return null;
            }

            return {
              ...node,
              children: filteredChildren,
              isExpanded: true, // 検索時は自動展開
            };
          }

          return null;
        }

        // フォルダの場合は子ノードも処理
        if (node.type === 'folder' && node.children) {
          const filteredChildren = node.children.map(filterNode).filter(Boolean) as ContextNode[];

          return {
            ...node,
            children: filteredChildren,
            // 検索/フィルタ時はフォルダを自動展開
            isExpanded: !!searchText || !!filterTag || node.isExpanded,
          };
        }

        return node;
      };

      return nodes.map(filterNode).filter(Boolean) as ContextNode[];
    },
    [filterTag, searchText]
  );

  // タグフィルタの解除
  const clearTagFilter = () => {
    setFilterTag(null);
  };

  // 検索のクリア
  const clearSearch = () => {
    setSearchText('');
  };

  // kubeconfigから再インポート
  const handleReimport = async () => {
    try {
      setLoading(true);
      const kubeContexts = await commands.getKubeContexts();
      const newTree = organizeContextsToTree(kubeContexts);
      setContextTree(newTree);
      await saveConfig({
        contextTree: newTree,
        lastSelectedContext: selectedContextId || undefined,
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
        <h2>Kubernetes Contexts</h2>

        <div className="context-actions">
          <Button
            className="icon-button"
            onClick={handleNewContextClick}
            title="新しいコンテキスト"
          >
            <span className="context-icon">⚙️</span> 追加
          </Button>
          <Button className="icon-button" onClick={handleNewFolderClick} title="新しいフォルダ">
            <span className="folder-icon">📁</span> 追加
          </Button>
        </div>

        <div className="contexts-toolbar">
          <Input
            placeholder="Search contexts..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            prefix={<span>🔍</span>}
            suffix={
              searchText && (
                <Button size="small" onClick={clearSearch}>
                  ×
                </Button>
              )
            }
          />

          <Dropdown
            overlay={
              <div>
                <Menu.Item onClick={() => setIsEditing(!isEditing)}>
                  {isEditing ? 'Done Editing' : 'Edit Tree'}
                </Menu.Item>
                <Menu.Item onClick={handleNewFolderClick}>New Folder</Menu.Item>
                <Menu.Item onClick={handleReimport}>Reimport from Kubeconfig</Menu.Item>
              </div>
            }
          >
            <Button>Actions</Button>
          </Dropdown>
        </div>

        {/* タグフィルタ表示 */}
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
            disableDrag={!isEditing}
            disableDrop={!isEditing}
            disableEdit={!isEditing}
            onMove={handleTreeChange}
          >
            {NodeRenderer}
          </Tree>
        </div>
      )}

      {/* 新しいコンテキスト作成モーダル */}
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
