// src/components/chat/PinnedMessagesBar.tsx
// Shows pinned messages in a collapsible bar

import { useState } from 'react';
import type { ChatMessage } from '../../types/chat';

interface PinnedMessagesBarProps {
  messages: ChatMessage[];
  onClose: () => void;
}

export default function PinnedMessagesBar({ messages, onClose }: PinnedMessagesBarProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (messages.length === 0) return null;

  const currentMessage = messages[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : messages.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < messages.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="chat-pinned-bar">
      <div className="chat-pinned-header">
        <span className="chat-pinned-icon">📌</span>
        <span className="chat-pinned-label">
          Pinned ({currentIndex + 1} of {messages.length})
        </span>
      </div>

      <div className="chat-pinned-content">
        <div className="chat-pinned-message">
          <span className="chat-pinned-author">
            {currentMessage.senderUsername}
          </span>
          <p className="chat-pinned-text">
            {currentMessage.content.length > 150
              ? `${currentMessage.content.substring(0, 150)}...`
              : currentMessage.content}
          </p>
          {currentMessage.metadata?.pinNote && (
            <span className="chat-pinned-note">
              Note: {currentMessage.metadata.pinNote}
            </span>
          )}
        </div>
      </div>

      <div className="chat-pinned-actions">
        {messages.length > 1 && (
          <>
            <button onClick={handlePrev} className="chat-pinned-nav" aria-label="Previous">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button onClick={handleNext} className="chat-pinned-nav" aria-label="Next">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </>
        )}
        <button onClick={onClose} className="chat-pinned-close" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
