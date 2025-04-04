import { useState } from 'react';
import ClusterTabs from './ClusterTabs';
import ContextsPane from './ContextsPane';
import ClusterInfoPane from './ClusterInfoPane';
import TerminalPane from './TerminalPane';
import ChatPane from './ChatPane';

/**
 * メインレイアウトコンポーネント
 * - 上部: クラスタ選択タブ
 * - 左: コンテキスト階層一覧
 * - 中央上下分割: クラスタ情報 + ターミナル
 * - 右: AIチャット
 */
function MainLayout() {
  // 現在選択中のクラスタとコンテキスト
  const [selectedCluster, setSelectedCluster] = useState<string | null>('cluster-0');
  const [selectedContext, setSelectedContext] = useState<string | null>(null);

  // ダミーのクラスタ一覧
  const clusters = ['cluster-0', 'cluster-1', 'cluster-2', 'cluster-3'];

  // クラスタ選択ハンドラー
  const handleClusterSelect = (cluster: string) => {
    setSelectedCluster(cluster);
    // 実際のアプリでは、ここでクラスタに対応するコンテキスト一覧を更新
  };

  // コンテキスト選択ハンドラー
  const handleContextSelect = (context: string) => {
    setSelectedContext(context);
  };

  return (
    <div className="main-layout">
      {/* クラスタタブ */}
      <ClusterTabs
        clusters={clusters}
        activeCluster={selectedCluster}
        onClusterSelect={handleClusterSelect}
      />
      
      <div className="content-area">
        {/* 左ペイン: コンテキスト階層 */}
        <div className="contexts-pane-container">
          <ContextsPane onContextSelect={handleContextSelect} />
        </div>
        
        {/* 中央エリア: クラスタ情報 + ターミナル */}
        <div className="center-area">
          {/* 中央上部: クラスタ情報 */}
          <div className="cluster-info-pane-container">
            <ClusterInfoPane selectedContext={selectedContext} />
          </div>
          
          {/* 中央下部: ターミナル */}
          <TerminalPane selectedContext={selectedContext} />
        </div>
        
        {/* 右ペイン: AIチャット */}
        <div className="chat-pane-container">
          <ChatPane selectedContext={selectedContext} />
        </div>
      </div>
    </div>
  );
}

export default MainLayout; 
