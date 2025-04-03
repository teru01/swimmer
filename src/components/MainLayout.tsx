import { useState } from 'react';
import ContextsPane from './ContextsPane';
import ClusterInfoPane from './ClusterInfoPane';
import ChatPane from './ChatPane';

/**
 * 3ペインレイアウトを構成するメインレイアウトコンポーネント
 */
function MainLayout() {
  const [selectedContext, setSelectedContext] = useState<string | null>(null);

  // 子コンポーネントから選択されたコンテキストを受け取るハンドラー
  const handleContextSelect = (context: string) => {
    setSelectedContext(context);
  };

  return (
    <div className="main-layout">
      <div className="contexts-pane-container">
        <ContextsPane onContextSelect={handleContextSelect} />
      </div>
      <div className="cluster-info-pane-container">
        <ClusterInfoPane selectedContext={selectedContext} />
      </div>
      <div className="chat-pane-container">
        <ChatPane selectedContext={selectedContext} />
      </div>
    </div>
  );
}

export default MainLayout; 
