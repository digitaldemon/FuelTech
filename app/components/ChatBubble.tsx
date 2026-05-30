import Image from 'next/image';
import userAvatar from '../../public/user-avatar.png';
import assistantAvatar from '../../public/assistant-avatar.png';

interface ChatBubbleProps {
  message: { role: 'user' | 'assistant'; content: string; };
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-start ${isUser ? 'justify-end' : 'justify-start'} space-x-4 my-3`}>
      {/* Avatar on the left for assistant */}
      {!isUser && (
        <Image
          src={assistantAvatar}
          alt="Assistant"
          width={80}
          height={80}
          className="rounded-full"
        />
      )}
      {/* Chat bubble */}
      <div
        className={`px-5 py-3 rounded-xl max-w-[70%] whitespace-pre-wrap ${
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
        }`}
      >
        {message.content}
      </div>
      {/* Avatar on the right for user */}
      {isUser && (
        <Image
          src={userAvatar}
          alt="User"
          width={80}
          height={80}
          className="rounded-full"
        />
      )}
    </div>
  );
}
