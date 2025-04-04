import { useState, useRef, useEffect } from 'react';

interface TerminalPaneProps {
  selectedContext: string | null;
}

/**
 * ターミナルパネルコンポーネント
 */
function TerminalPane({ selectedContext }: TerminalPaneProps) {
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    'ターミナルセッションが開始されました',
    'ここでコマンドを実行できます...',
  ]);
  const [inputCommand, setInputCommand] = useState('');
  const terminalContentRef = useRef<HTMLDivElement>(null);

  // ターミナル出力が更新されたら最下部にスクロール
  useEffect(() => {
    if (terminalContentRef.current) {
      terminalContentRef.current.scrollTop = terminalContentRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // コマンド送信処理（ダミー実装）
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim()) return;

    // 実行したコマンドを出力に追加
    const newOutput = [...terminalOutput, `$ ${inputCommand}`];
    
    // 選択されたコンテキストに応じたダミー応答
    if (selectedContext) {
      if (inputCommand.includes('kubectl')) {
        newOutput.push(`実行コンテキスト: ${selectedContext}`);
        
        if (inputCommand.includes('get pods')) {
          newOutput.push('NAME                     READY   STATUS    RESTARTS   AGE');
          newOutput.push('app-deployment-1-xyzabc   1/1     Running   0          3d2h');
          newOutput.push('app-deployment-2-abcdef   1/1     Running   0          2d5h');
        } else if (inputCommand.includes('get nodes')) {
          newOutput.push('NAME          STATUS   ROLES    AGE     VERSION');
          newOutput.push('node-1        Ready    master   90d     v1.25.0');
          newOutput.push('node-2        Ready    <none>   90d     v1.25.0');
        } else {
          newOutput.push('コマンドは正常に実行されました');
        }
      } else {
        newOutput.push('> コマンドが実行されました');
      }
    } else {
      newOutput.push('エラー: Kubernetesコンテキストが選択されていません');
    }
    
    setTerminalOutput(newOutput);
    setInputCommand('');
  };

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <span>ターミナル</span>
        <span>
          {selectedContext ? `コンテキスト: ${selectedContext}` : 'コンテキスト未選択'}
        </span>
      </div>
      <div className="terminal-content" ref={terminalContentRef}>
        {terminalOutput.map((line, index) => (
          <div key={index} className="terminal-line">
            {line}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="terminal-input-form">
        <div className="terminal-input-wrapper">
          <span className="terminal-prompt">$ </span>
          <input
            type="text"
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            className="terminal-input"
            placeholder="コマンドを入力..."
          />
        </div>
      </form>
    </div>
  );
}

export default TerminalPane; 
