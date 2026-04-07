// src/components/chat/MessageList.tsx
// Renders a list of chat messages grouped by date

import { useMemo } from 'react';
import MessageItem from './MessageItem';
import type { ChatMessage, MessageGroup } from '../../types/chat';

interface MessageListProps {
  messages: ChatMessage[];
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function groupMessagesByDate(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentDate = '';

  // Messages are sorted ascending (oldest first) — ready for top-to-bottom display
  const sortedMessages = messages;

  for (const message of sortedMessages) {
    const messageDate = new Date(message.createdAt).toDateString();

    if (messageDate !== currentDate) {
      currentDate = messageDate;
      groups.push({
        date: message.createdAt,
        messages: [message],
      });
    } else {
      groups[groups.length - 1].messages.push(message);
    }
  }

  return groups;
}

export default function MessageList({ messages }: MessageListProps) {
  const messageGroups = useMemo(() => groupMessagesByDate(messages), [messages]);

  if (messages.length === 0) {
    return (
      <div className="chat-empty-state">
        <div className="chat-empty-icon">💬</div>
        <p className="enhanced-glass-body">No messages yet</p>
        <p className="enhanced-glass-subtle text-sm">
          Be the first to start the conversation!
        </p>
      </div>
    );
  }

  return (
    <div className="chat-message-list">
      {messageGroups.map((group) => (
        <div key={group.date} className="chat-message-group">
          {/* Date header */}
          <div className="chat-date-header">
            <div className="chat-date-line" />
            <span className="chat-date-text">
              {formatDateHeader(group.date)}
            </span>
            <div className="chat-date-line" />
          </div>

          {/* Messages in this group */}
          {group.messages.map((message, messageIndex) => {
            const prevMessage = messageIndex > 0 ? group.messages[messageIndex - 1] : null;
            const nextMessage = messageIndex < group.messages.length - 1
              ? group.messages[messageIndex + 1]
              : null;

            // Check if this message is from the same sender as previous
            const isSameSenderAsPrev = prevMessage?.senderUserId === message.senderUserId;
            const isSameSenderAsNext = nextMessage?.senderUserId === message.senderUserId;

            // Check if messages are within 2 minutes of each other
            const isCloseTimeToPrev = prevMessage
              ? (new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime()) < 120000
              : false;
            const isCloseTimeToNext = nextMessage
              ? (new Date(nextMessage.createdAt).getTime() - new Date(message.createdAt).getTime()) < 120000
              : false;

            const isGroupedWithPrev = isSameSenderAsPrev && isCloseTimeToPrev;
            const isGroupedWithNext = isSameSenderAsNext && isCloseTimeToNext;

            return (
              <MessageItem
                key={message.id}
                message={message}
                isGroupedWithPrev={isGroupedWithPrev}
                isGroupedWithNext={isGroupedWithNext}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
