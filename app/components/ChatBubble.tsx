// Use icons from lucide-react instead of static images for avatars. This keeps the bundle size small and avoids
// reliance on generative images that may be inconsistent. The UserCircle icon represents a technician,
// and the Bot icon represents the AI assistant.
import { UserCircle, Bot } from 'lucide-react';

interface ChatBubbleProps {
  message: { role: 'user' | 'assistant'; content: string };
}

/**
 * A single chat message. Aligns to the right for user messages and to the left
 * for assistant messages. Avatars are shown on the appropriate side and
 * coloured bubbles distinguish between user and assistant.
 */
export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <div className={`chat-bubble-container${isUser ? ' user' : ''}`}> 
      {/* Avatar */}
      <div className="chat-avatar">
        {isUser ? (
          <UserCircle size={40} color="#22d3ee" />
        ) : (
          <Bot size={40} color="#3b82f6" />
        )}
      </div>
      {/* Message bubble */}
      <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>{message.content}</div>
    </div>
  );
}