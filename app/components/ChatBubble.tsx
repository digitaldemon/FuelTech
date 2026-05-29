import Image from 'next/image';

interface ChatBubbleProps {
  message: { role: 'user' | 'assistant'; content: string };
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} space-x-2`}>
      {isUser && (
        <div className="flex-shrink-0">
          <Image src="/user-avatar.png" alt="User" width={24} height={24} className="rounded-full" />
        </div>
      )}
      {!isUser && (
        <div className="flex-shrink-0">
          <Image
            src="/ChatGPT%20Image%20May%2029,%202026,%2012_04%2037%20PM.png"
            alt="Assistant"
            width={24}
            height={24}
            className="rounded-full"
          />
        </div>
      )}
      <div
        className={`px-4 py-2 rounded-lg max-w-xs whitespace-pre-wrap ${
          isUser ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-200 text-gray-900 rounded-bl-none'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
