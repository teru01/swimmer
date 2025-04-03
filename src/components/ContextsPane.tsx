import { useState, useEffect } from 'react';
import { commands } from '../api';

interface ContextsPaneProps {
  onContextSelect?: (context: string) => void;
}

/**
 * 左ペイン：Kubernetes コンテキスト一覧を表示するコンポーネント
 */
function ContextsPane({ onContextSelect }: ContextsPaneProps) {
  const [contexts, setContexts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  
  useEffect(() => {
    async function loadContexts() {
      try {
        const result = await commands.getKubeContexts();
        setContexts(result);
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

  const handleContextClick = (context: string) => {
    setSelectedContext(context);
    onContextSelect?.(context);
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

      {contexts.length > 0 ? (
        <ul className="contexts-list">
          {contexts.map((context) => (
            <li 
              key={context} 
              className={`context-item ${selectedContext === context ? 'selected' : ''}`}
              onClick={() => handleContextClick(context)}
            >
              {context}
            </li>
          ))}
        </ul>
      ) : (
        !error && <p>Loading contexts...</p>
      )}
    </div>
  );
}

export default ContextsPane; 
