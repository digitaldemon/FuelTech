import Image from 'next/image';
import userAvatar from '../../public/user-avatar.png';
import assistantAvatar from '../../public/assistant-avatar.png';

interface ChatBubbleProps {
  message: { role: 'user' | 'assistant'; content: string };
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <div className={'flex items-start ' + (isUser ? 'justify-end' : 'justify-start') + ' space-x-4 my-3'}>
      {!isUser && (
        <Image
          src={assistantAvatar}
          alt="Assistant"
          width={120}
          height={120}
          className="rounded-full"
        />
      )}
      <div
        className={
          'px-5 py-3 rounded-xl max-w-[70%] whitespace-pre-wrap ' +
          (isUser ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800')
        }
      >
        {message.content}
      </div>
      {isUser && (
        <Image
          src={userAvatar}
          alt="User"
          width={120}
          height={120}
          className="rounded-full"
        />
      )}
    </div>
  );
}
