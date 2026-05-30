import Image from 'next/image';
import userAvatar from '../../public/user-avatar.png';
import assistantAvatar from '../../public/assistant-avatar.png';

interface ChatBubbleProps {
  message: { role: 'user' | 'assistant'; content: string };
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start ${isUser ? 'justify-end' : 'justify-start'} space-x-3 my-2`}>
      {/* Avatar on the left for assistant */}
      {!isUser && (
        <Image
          src={assistantAvatar}
          alt="Assistant"
          width={32}
          height={32}
          className="rounded-full"
        />
      )}

      {/* Chat bubble */}
      <div
        className={`px-4 py-2 rounded-lg max-w-[70%] whitespace-pre-wrap ${
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
        }`}
      >
        {message.content}
      </div>

      {/* Avatar on the right for user */}
      {isUser && (
        <Image
          src={userAvatar}
          alt="User"
          width={32}
          height={32}
          className="rounded-full"
        />
      )}
    </div>
  );
}
