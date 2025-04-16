import { useState } from 'react';
import { ContextNode } from '../../lib/contextTree';
type Message = {
  id: number;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
};

interface ChatPaneProps {
  selectedContext: ContextNode | null;
}

/**
 * Right Pane: AI chat interface component
 */
function ChatPane({ selectedContext }: ChatPaneProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: 'Hello! Ask me anything about your Kubernetes cluster.',
      sender: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputText.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: messages.length + 1,
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setInputText('');

    // Mock assistant response (in production would call AI API)
    setTimeout(() => {
      const botMessage: Message = {
        id: messages.length + 2,
        text: `Regarding "${inputText}". I'm looking up information related to ${selectedContext?.name || 'the current context'}...\n\nThis is a mock response. In production, an AI model would provide a real answer here.`,
        sender: 'assistant',
        timestamp: new Date(),
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
            <div className="message-timestamp">{message.timestamp.toLocaleTimeString()}</div>
          </div>
        ))}
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Ask a question about your K8s cluster..."
          className="chat-input"
          rows={3}
        />
        <button type="submit" className="send-button">
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatPane;
