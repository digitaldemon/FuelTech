'use client';

import { UserCircle, Bot, FileDown, ExternalLink } from 'lucide-react';
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
  };
  figures?: string[];
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
    default: return source;
  }
}

function pdfUrl(doc: SourceDoc): string {
  // Route through the server-side proxy for sources that need session auth.
  // Web / PEI pages are plain HTTPS — link directly.
  if (doc.source === 'web' || doc.source === 'pei') return doc.url;
  return `/api/pdf?url=${encodeURIComponent(doc.url)}&source=${encodeURIComponent(doc.source)}`;
}

export default function ChatBubble({ message, figures }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isThinking = !isUser && message.streaming && message.content === '';
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [docsExpanded, setDocsExpanded] = useState(false);

  const docs = message.docs ?? [];

  return (
    <>
      <div className={`chat-bubble-container${isUser ? ' user' : ''}`}>
        <div className="chat-avatar">
          {isUser ? (
            <UserCircle size={40} color="#22d3ee" />
          ) : (
            <Bot size={40} color="#3b82f6" />
          )}
        </div>
        <div>
          <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}${isThinking ? ' thinking' : ''}`}>
            {isThinking ? 'Thinking…' : isUser ? message.content : (
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
              <button
                className="chat-sources-toggle"
                onClick={() => setDocsExpanded((v) => !v)}
              >
                <FileDown size={14} />
                {docs.length === 1 ? '1 source document' : `${docs.length} source documents`}
                <span className="chat-sources-chevron">{docsExpanded ? '▲' : '▼'}</span>
              </button>

              {docsExpanded && (
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
                        {doc.title.length > 80 ? doc.title.slice(0, 77) + '…' : doc.title}
                        <ExternalLink size={12} className="chat-source-ext" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
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
