// src/components/chat/TypingIndicator.tsx
// Shows who is currently typing

import type { TypingIndicator as TypingIndicatorType } from '../../types/chat';

interface TypingIndicatorProps {
  users: TypingIndicatorType[];
}

function formatTypingText(users: TypingIndicatorType[]): string {
  if (users.length === 0) return '';

  const names = users.map((u) => u.username);

  if (names.length === 1) {
    return `${names[0]} is typing`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing`;
  }

  if (names.length === 3) {
    return `${names[0]}, ${names[1]}, and ${names[2]} are typing`;
  }

  return `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing`;
}

export default function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  return (
    <div className="chat-typing-indicator">
      <div className="chat-typing-dots">
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
      </div>
      <span className="chat-typing-text">
        {formatTypingText(users)}
      </span>
    </div>
  );
}
