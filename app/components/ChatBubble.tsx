import { UserCircle, Bot } from 'lucide-react';

interface ChatBubbleProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    citations?: string[];
  };
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <div className={`chat-bubble-container${isUser ? ' user' : ''}`}>
      <div className="chat-avatar">
        {isUser ? (
          <UserCircle size={40} color="#22d3ee" />
        ) : (
          <Bot size={40} color="#3b82f6" />
        )}
      </div>
      <div>
        <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>
          {message.content}
        </div>
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="chat-citations">
            {message.citations.length === 1 ? '1 source referenced' : `${message.citations.length} sources referenced`}
          </div>
        )}
      </div>
    </div>
  );
}
