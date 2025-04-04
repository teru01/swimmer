import { useState, useEffect } from 'react';
import { commands } from '../api';

interface ContextsPaneProps {
  onContextSelect?: (context: string) => void;
}

// コンテキストの階層構造を表現する型
interface ContextGroup {
  name: string;
  contexts: {
    name: string;
    children?: { name: string }[];
  }[];
}

/**
 * 左ペイン：Kubernetes コンテキスト一覧を階層構造で表示するコンポーネント
 */
function ContextsPane({ onContextSelect }: ContextsPaneProps) {
  const [contexts, setContexts] = useState<string[]>([]);
  const [contextGroups, setContextGroups] = useState<ContextGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  
  // コンテキスト一覧を取得してグループ化
  useEffect(() => {
    async function loadContexts() {
      try {
        const result = await commands.getKubeContexts();
        setContexts(result);
        
        // コンテキスト名を解析して階層構造に変換（ダミー実装）
        // 実際の実装では kubeconfig から適切に情報を取得する
        const groups: ContextGroup[] = [
          {
            name: 'qa',
            contexts: [
              { 
                name: 'jp',
                children: [
                  { name: 'gke-qa-jp-1' },
                  { name: 'gke-qa-jp-2' }
                ]
              },
              { name: 'us' }
            ]
          },
          {
            name: 'stg',
            contexts: [
              { name: 'stg-cluster-1' },
              { name: 'stg-cluster-2' }
            ]
          },
          {
            name: 'prd',
            contexts: [
              { name: 'prd-cluster-1' },
              { name: 'prd-cluster-2' }
            ]
          }
        ];
        
        setContextGroups(groups);
        setExpandedGroups(['qa']); // 初期状態では qa グループを展開
        
        if (result.length > 0 && !selectedContext) {
          setSelectedContext(result[0]);
          onContextSelect?.(result[0]);
        }
        
        setError(null);
      } catch (err) {
        console.error("Error fetching kube contexts:", err);
        setError(typeof err === 'string' ? err : "An unknown error occurred.");
      }
    }
    loadContexts();
  }, [onContextSelect, selectedContext]);

  // コンテキストグループの展開/折りたたみトグル
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      if (prev.includes(groupName)) {
        return prev.filter(g => g !== groupName);
      } else {
        return [...prev, groupName];
      }
    });
  };

  // コンテキスト選択ハンドラー
  const handleContextSelect = (contextPath: string) => {
    setSelectedContext(contextPath);
    onContextSelect?.(contextPath);
  };

  return (
    <div className="contexts-pane">
      <h2>Kubernetes Contexts</h2>
      
      {error && (
        <div className="error">
          <p>Error loading contexts:</p>
          <pre>{error}</pre>
        </div>
      )}

      {contextGroups.length > 0 ? (
        <div className="context-groups">
          {contextGroups.map(group => (
            <div key={group.name} className="context-group">
              <div 
                className="context-group-header" 
                onClick={() => toggleGroup(group.name)}
              >
                {group.name}
              </div>
              
              {expandedGroups.includes(group.name) && (
                <div className="context-group-items">
                  {group.contexts.map(context => (
                    <div key={context.name}>
                      <div 
                        className={`context-item ${selectedContext === `${group.name}-${context.name}` ? 'selected' : ''}`}
                        onClick={() => handleContextSelect(`${group.name}-${context.name}`)}
                      >
                        {context.name}
                      </div>
                      
                      {context.children && context.children.map(child => (
                        <div 
                          key={child.name}
                          className={`context-item nested ${selectedContext === child.name ? 'selected' : ''}`}
                          onClick={() => handleContextSelect(child.name)}
                        >
                          {child.name}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        !error && <p>Loading contexts...</p>
      )}
    </div>
  );
}

export default ContextsPane; 
