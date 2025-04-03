import { useState } from 'react';

type Message = {
  id: number;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
};

/**
 * 右ペイン：AIチャットインターフェースを表示するコンポーネント
 */
function ChatPane({ selectedContext }: { selectedContext: string | null }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: 'こんにちは！Kubernetesクラスタについて質問があればお答えします。',
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputText.trim()) return;
    
    // ユーザーメッセージを追加
    const userMessage: Message = {
      id: messages.length + 1,
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages([...messages, userMessage]);
    setInputText('');
    
    // ダミーのアシスタント応答（実際にはAI APIを呼び出す）
    setTimeout(() => {
      const botMessage: Message = {
        id: messages.length + 2,
        text: `"${inputText}" についての情報ですね。${selectedContext || '現在のコンテキスト'}に関連する情報を調べています...\n\nこれはダミー応答です。実際にはここでAIモデルからのレスポンスが表示されます。`,
        sender: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMessage]);
    }, 1000);
  };

  return (
    <div className="chat-pane">
      <h2>AI Chat Assistant</h2>
      
      <div className="chat-messages">
        {messages.map(message => (
          <div 
            key={message.id}
            className={`message ${message.sender === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            <div className="message-content">
              {message.text.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
      
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <textarea 
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="K8sクラスタについて質問してください..."
          className="chat-input"
          rows={3}
        />
        <button type="submit" className="send-button">送信</button>
      </form>
    </div>
  );
}

export default ChatPane; 
