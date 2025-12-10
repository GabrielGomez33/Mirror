// src/components/chat/ReplyPreview.tsx
// Shows the message being replied to

import type { ChatMessage } from '../../types/chat';

interface ReplyPreviewProps {
  message: ChatMessage;
  onCancel: () => void;
}

export default function ReplyPreview({ message, onCancel }: ReplyPreviewProps) {
  return (
    <div className="chat-reply-banner">
      <div className="chat-reply-content">
        <div className="chat-reply-bar" />
        <div className="chat-reply-info">
          <span className="chat-reply-label">
            Replying to <strong>{message.senderUsername}</strong>
          </span>
          <p className="chat-reply-preview">
            {message.content.length > 100
              ? `${message.content.substring(0, 100)}...`
              : message.content}
          </p>
        </div>
      </div>
      <button
        onClick={onCancel}
        className="chat-reply-cancel"
        aria-label="Cancel reply"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
