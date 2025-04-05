import { useState, useEffect, useRef, useCallback } from 'react';
import { Tree, NodeRendererProps } from 'react-arborist';
import { commands } from '../api';
// import { fs } from '@tauri-apps/api/fs';
import * as yaml from 'yaml';
import { Button, Input, Tag, Dropdown, Menu } from './ui';
import '../styles/contexts-tree.css';

// コンテキストノードのデータ型
interface ContextNode {
  id: string;
  name: string;
  type: 'folder' | 'context';
  path?: string;  // type='context'の場合のkubeconfigコンテキスト名
  children?: ContextNode[];
  tags?: string[];
  isExpanded?: boolean;
}

interface ContextsPaneProps {
  onContextSelect?: (context: string) => void;
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
  const treeRef = useRef(null);
  
  // 設定用のローカルストレージキー
  const STORAGE_KEY = 'swimmer.contextTree';

  // モック用のファイルシステム操作
  const mockFs = {
    // ファイル読み込み（ローカルストレージから）
    readTextFile: async (path: string): Promise<string> => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) throw new Error('Configuration not found');
      return stored;
    },
    
    // ファイル書き込み（ローカルストレージへ）
    writeTextFile: async (path: string, content: string): Promise<void> => {
      localStorage.setItem(STORAGE_KEY, content);
    },
    
    // ディレクトリ作成（モックなので何もしない）
    createDir: async (path: string, options?: { recursive: boolean }): Promise<void> => {
      // 実際には何もしない
      return;
    }
  };

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
        } catch (err) {
          // 設定ファイルがない場合は、kubeconfigから直接読み込む
          console.log('Config not found, importing from kubeconfig');
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
  }, [onContextSelect]);
  
  // 設定を保存する
  const saveConfig = async (config: { contextTree: ContextNode[], lastSelectedContext?: string, tags: string[] }) => {
    try {
      const configYaml = yaml.stringify(config);
      await mockFs.writeTextFile(STORAGE_KEY, configYaml);
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Failed to save configuration');
    }
  };
  
  // コンテキスト名をパースして階層構造を構築する
  const organizeContextsToTree = (contexts: string[]): ContextNode[] => {
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
          isExpanded: true
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
            isExpanded: true
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
            isExpanded: true
          };
          projectNode.children?.push(regionNode);
        }
        
        // クラスターノード（コンテキスト）
        regionNode.children?.push({
          id: `context-${context}`,
          name: name,
          type: 'context',
          path: context
        });
      } else {
        // その他のコンテキストは直接プロバイダーの下に配置
        providerNode.children?.push({
          id: `context-${context}`,
          name: name,
          type: 'context',
          path: context
        });
      }
    });
    
    return tree;
  };
  
  // コンテキスト選択時の処理
  const handleContextSelect = useCallback((contextPath: string) => {
    setSelectedContextId(contextPath);
    onContextSelect?.(contextPath);
    
    // 選択を保存
    saveConfig({ 
      contextTree, 
      lastSelectedContext: contextPath,
      tags: availableTags
    });
  }, [contextTree, availableTags, onContextSelect]);
  
  // ノード編集時の処理
  const handleRename = useCallback((nodeId: string, newName: string) => {
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
  }, [availableTags]);
  
  // ツリー構造変更時の処理（ドラッグ&ドロップ後）
  const handleTreeChange = useCallback(() => {
    // この関数はドラッグ&ドロップ操作後にreact-arboristライブラリから呼ばれます
    // ここではローカルの状態更新だけ行い、ストレージへの保存も行います
    setContextTree(prev => {
      // 更新後のツリーデータを保存
      saveConfig({ 
        contextTree: prev, 
        lastSelectedContext: selectedContextId || undefined,
        tags: availableTags
      });
      
      return prev;
    });
  }, [selectedContextId, availableTags]);
  
  // 新しいフォルダの作成
  const handleCreateFolder = () => {
    if (!treeRef.current) return;
    
    const newFolderId = `folder-new-${Date.now()}`;
    const newFolder: ContextNode = {
      id: newFolderId,
      name: 'New Folder',
      type: 'folder',
      children: [],
      isExpanded: true
    };
    
    setContextTree(prev => {
      const newTree = [...prev, newFolder];
      saveConfig({ contextTree: newTree, tags: availableTags });
      return newTree;
    });
    
    // 作成後に編集モードを開始
    setTimeout(() => {
      const treeInstance = treeRef.current as any;
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
        tags: availableTags.includes(tag) ? availableTags : [...availableTags, tag] 
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
              tags: node.tags.filter(tag => tag !== tagToRemove) 
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
            <span 
              className="folder-icon"
              onClick={() => node.toggle()}
            >
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
                onBlur={e => node.reset()}
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
          {data.tags && data.tags.map(tag => (
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
                      onKeyDown={(e) => {
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
              <Button size="small" onClick={() => {
                // フォルダに新しいサブフォルダを追加
                const newChild: ContextNode = {
                  id: `folder-new-${Date.now()}`,
                  name: 'New Folder',
                  type: 'folder',
                  children: [],
                  isExpanded: true
                };
                
                // ツリー更新のため独自に処理
                setContextTree(prev => {
                  const addChildToFolder = (nodes: ContextNode[]): ContextNode[] => {
                    return nodes.map(n => {
                      if (n.id === node.id) {
                        return {
                          ...n,
                          children: [...(n.children || []), newChild]
                        };
                      }
                      if (n.children) {
                        return {
                          ...n,
                          children: addChildToFolder(n.children)
                        };
                      }
                      return n;
                    });
                  };
                  
                  const updatedTree = addChildToFolder(prev);
                  saveConfig({ contextTree: updatedTree, tags: availableTags });
                  return updatedTree;
                });
              }}>
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
                      return nodes.filter(n => n.id !== node.id)
                        .map(n => {
                          if (n.children) {
                            return {
                              ...n,
                              children: removeNode(n.children)
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
  const filterNodes = useCallback((nodes: ContextNode[]): ContextNode[] => {
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
          const filteredChildren = node.children
            .map(filterNode)
            .filter(Boolean) as ContextNode[];
          
          if (filteredChildren.length === 0) {
            return null;
          }
          
          return {
            ...node,
            children: filteredChildren,
            isExpanded: true // 検索時は自動展開
          };
        }
        
        return null;
      }
      
      // フォルダの場合は子ノードも処理
      if (node.type === 'folder' && node.children) {
        const filteredChildren = node.children
          .map(filterNode)
          .filter(Boolean) as ContextNode[];
        
        return {
          ...node,
          children: filteredChildren,
          // 検索/フィルタ時はフォルダを自動展開
          isExpanded: !!searchText || !!filterTag || node.isExpanded
        };
      }
      
      return node;
    };
    
    return nodes.map(filterNode).filter(Boolean) as ContextNode[];
  }, [filterTag, searchText]);
  
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
        tags: availableTags
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
        
        <div className="contexts-toolbar">
          <Input
            placeholder="Search contexts..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            prefix={<span>🔍</span>}
            suffix={searchText && <Button size="small" onClick={clearSearch}>×</Button>}
          />
          
          <Dropdown
            overlay={
              <div>
                <Menu.Item onClick={() => setIsEditing(!isEditing)}>
                  {isEditing ? 'Done Editing' : 'Edit Tree'}
                </Menu.Item>
                <Menu.Item onClick={handleCreateFolder}>
                  New Folder
                </Menu.Item>
                <Menu.Item onClick={handleReimport}>
                  Reimport from Kubeconfig
                </Menu.Item>
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
    </div>
  );
}

export default ContextsPane; 
