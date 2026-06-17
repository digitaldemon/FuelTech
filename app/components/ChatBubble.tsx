'use client';

import { User, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface SourceDoc {
  url: string;
  title: string;
  source: string;
}

interface ChatBubbleProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    citations?: string[];
    docs?: SourceDoc[];
    streaming?: boolean;
    imagePreview?: string;
  };
  figures?: string[];
  username?: string;
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'gilbarco': return 'Gilbarco';
    case 'gilbarco-extranet': return 'Tech Bulletin';
    case 'veeder-root': return 'Veeder-Root';
    case 'franklin': return 'Franklin Fueling';
    case 'dover': return 'Dover Fueling';
    case 'pei': return 'PEI';
    case 'web': return 'Web';
    case 'manual': return 'Manual';
    default: return source.charAt(0).toUpperCase() + source.slice(1);
  }
}

function pdfUrl(doc: SourceDoc): string {
  // Route through the server-side proxy for sources that need session auth.
  // Web, PEI, and manually-uploaded (Vercel Blob) docs are plain HTTPS — link directly.
  if (doc.source === 'web' || doc.source === 'pei' || doc.source === 'manual') return doc.url;
  return `/api/pdf?url=${encodeURIComponent(doc.url)}&source=${encodeURIComponent(doc.source)}`;
}

export default function ChatBubble({ message, figures, username }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isThinking = !isUser && message.streaming && message.content === '';
  const [lightbox, setLightbox] = useState<string | null>(null);

  const docs = message.docs ?? [];

  return (
    <>
      <div className={`chat-bubble-container${isUser ? ' user' : ''}`}>
        {isUser ? (
          <div className="chat-avatar-wrap">
            <div className="chat-avatar user-avatar">
              <User size={16} strokeWidth={2.5} />
            </div>
            {username && <span className="chat-avatar-name">{username}</span>}
          </div>
        ) : (
          <div className="chat-avatar-wrap">
            <div className="chat-avatar bot-avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="Atlas" />
            </div>
            <span className="chat-avatar-name">Atlas</span>
          </div>
        )}
        <div>
          <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}${isThinking ? ' thinking' : ''}`}>
            {message.imagePreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={message.imagePreview} alt="Attached photo" className="chat-bubble-image" />
            )}
            {isThinking ? (
              <span className="chat-thinking-dots">
                <span /><span /><span />
              </span>
            ) : isUser ? (message.content || null) : (
              <div className="chat-md"><ReactMarkdown>{message.content}</ReactMarkdown></div>
            )}
          </div>

          {!isUser && figures && figures.length > 0 && (
            <div className="chat-figures">
              <p className="chat-figures-label">Figures from documentation</p>
              <div className="chat-figures-strip">
                {figures.map((url, i) => (
                  <button key={i} className="chat-figure-thumb" onClick={() => setLightbox(url)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Figure ${i + 1}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isUser && docs.length > 0 && (
            <div className="chat-sources">
              <ul className="chat-sources-list">
                {docs.map((doc, i) => (
                  <li key={i} className="chat-source-item">
                    <span className={`chat-source-badge source-${doc.source}`}>
                      {sourceLabel(doc.source)}
                    </span>
                    <a
                      href={pdfUrl(doc)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="chat-source-link"
                      title={doc.title}
                    >
                      {doc.title.length > 72 ? doc.title.slice(0, 69) + '…' : doc.title}
                      <ExternalLink size={11} className="chat-source-ext" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="chat-lightbox" onClick={() => setLightbox(null)}>
          <div className="chat-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="Figure" />
            <button className="chat-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}
