// src/components/chat/MessageInput.tsx
// Message input component with typing indicators

import { useState, useRef, useCallback, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { CHAT_CONFIG } from '../../types/chat';

interface MessageInputProps {
  onSend: (content: string, options?: { parentMessageId?: string }) => Promise<void>;
  isDisabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({
  onSend,
  isDisabled = false,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const { startTyping, stopTyping, isSending } = useChat();
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [content]);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    startTyping();

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, CHAT_CONFIG.TYPING_TIMEOUT_MS);
  }, [startTyping, stopTyping]);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
      setContent(value);
      if (value.trim()) {
        handleTyping();
      }
    }
  }, [handleTyping]);

  // Handle send
  const handleSend = useCallback(async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isDisabled || isSending) return;

    // Stop typing indicator
    stopTyping();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Clear input
    setContent('');

    // Send message
    await onSend(trimmedContent);

    // Focus input
    textareaRef.current?.focus();
  }, [content, isDisabled, isSending, onSend, stopTyping]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Handle blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    stopTyping();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [stopTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const charCount = content.length;
  const isNearLimit = charCount > CHAT_CONFIG.MAX_MESSAGE_LENGTH * 0.9;
  const isAtLimit = charCount >= CHAT_CONFIG.MAX_MESSAGE_LENGTH;

  return (
    <div className={`chat-input-container ${isFocused ? 'chat-input-focused' : ''}`}>
      <div className="chat-input-wrapper">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={isDisabled}
          className="chat-input-textarea"
          rows={1}
          aria-label="Message input"
        />

        {/* Actions */}
        <div className="chat-input-actions">
          {/* Character count (show when near limit) */}
          {isNearLimit && (
            <span className={`chat-char-count ${isAtLimit ? 'chat-char-limit' : ''}`}>
              {charCount}/{CHAT_CONFIG.MAX_MESSAGE_LENGTH}
            </span>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!content.trim() || isDisabled || isSending}
            className="chat-send-btn"
            aria-label="Send message"
          >
            {isSending ? (
              <div className="chat-send-spinner" />
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Hint text */}
      <div className="chat-input-hint">
        <span>Press Enter to send, Shift+Enter for new line</span>
      </div>
    </div>
  );
}
