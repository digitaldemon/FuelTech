import { UserCircle, Bot } from 'lucide-react';

interface ChatBubbleProps {
  message: { role: 'user' | 'assistant'; content: string };
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const wrapperClass = 'chat-bubble-container' + (isUser ? ' user' : '');
  const bubbleClass = 'chat-bubble ' + (isUser ? 'user' : 'assistant');

  return (
    <div className={wrapperClass}>
      <div className="chat-avatar">
        {isUser ? (
          <UserCircle size={40} color="#22d3ee" />
        ) : (
          <Bot size={40} color="#3b82f6" />
        )}
      </div>
      <div className={bubbleClass}>{message.content}</div>
    </div>
  );
}
