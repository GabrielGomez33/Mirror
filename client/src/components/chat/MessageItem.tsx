// src/components/chat/MessageItem.tsx
// Individual chat message component

import { useState, useCallback, useMemo } from 'react';
import { useChat } from '../../context/ChatContext';
import ReactionPicker from './ReactionPicker';
import type { ChatMessage } from '../../types/chat';

interface MessageItemProps {
  message: ChatMessage;
  isGroupedWithPrev?: boolean;
  isGroupedWithNext?: boolean;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function MessageItem({
  message,
  isGroupedWithPrev = false,
  isGroupedWithNext = false,
}: MessageItemProps) {
  const {
    currentUserId,
    selectedMessageId,
    addReaction,
    removeReaction,
    setReplyingTo,
    selectMessage,
    editMessage,
    deleteMessage,
  } = useChat();

  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isOwnMessage = message.senderUserId === currentUserId;
  const isSelected = selectedMessageId === message.id;
  const isPending = message.status === 'sending';
  const isFailed = message.status === 'failed';
  const isDeleted = message.isDeleted;

  // Handle reaction click
  const handleReaction = useCallback((emoji: string) => {
    const existingReaction = message.reactions?.find(
      (r) => r.emoji === emoji && r.hasReacted
    );

    if (existingReaction) {
      removeReaction(message.id, emoji);
    } else {
      addReaction(message.id, emoji);
    }
    setShowReactionPicker(false);
  }, [message.id, message.reactions, addReaction, removeReaction]);

  // Handle reply
  const handleReply = useCallback(() => {
    setReplyingTo(message);
    setShowActions(false);
  }, [message, setReplyingTo]);

  // Handle edit
  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditContent(message.content);
    setShowActions(false);
  }, [message.content]);

  // Save edit
  const handleSaveEdit = useCallback(async () => {
    if (editContent.trim() && editContent !== message.content) {
      await editMessage(message.id, editContent.trim());
    }
    setIsEditing(false);
  }, [editContent, message.id, message.content, editMessage]);

  // Cancel edit
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(message.content);
  }, [message.content]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (window.confirm('Delete this message?')) {
      await deleteMessage(message.id);
    }
    setShowActions(false);
  }, [message.id, deleteMessage]);

  // Handle message click
  const handleMessageClick = useCallback(() => {
    selectMessage(isSelected ? null : message.id);
  }, [message.id, isSelected, selectMessage]);

  // Render reply preview
  const renderReplyPreview = useMemo(() => {
    if (!message.metadata?.replyPreview) return null;

    const { senderUsername, content } = message.metadata.replyPreview;
    return (
      <div className="chat-reply-preview-inline">
        <div className="chat-reply-bar" />
        <div className="chat-reply-content">
          <span className="chat-reply-author">{senderUsername}</span>
          <span className="chat-reply-text">{content}</span>
        </div>
      </div>
    );
  }, [message.metadata?.replyPreview]);

  // Render reactions
  const renderReactions = useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) return null;

    return (
      <div className="chat-reactions">
        {message.reactions.map((reaction) => (
          <button
            key={reaction.emoji}
            className={`chat-reaction ${reaction.hasReacted ? 'chat-reaction-active' : ''}`}
            onClick={() => handleReaction(reaction.emoji)}
          >
            <span>{reaction.emoji}</span>
            <span className="chat-reaction-count">{reaction.count}</span>
          </button>
        ))}
      </div>
    );
  }, [message.reactions, handleReaction]);

  // Render message status
  const renderStatus = useMemo(() => {
    if (isPending) {
      return <span className="chat-message-status sending">Sending...</span>;
    }
    if (isFailed) {
      return <span className="chat-message-status failed">Failed to send</span>;
    }
    if (message.isEdited) {
      return <span className="chat-message-status edited">edited</span>;
    }
    return null;
  }, [isPending, isFailed, message.isEdited]);

  if (isDeleted) {
    return (
      <div className={`chat-message chat-message-deleted ${isOwnMessage ? 'chat-message-own' : ''}`}>
        <div className="chat-message-content">
          <em className="text-white/50">This message was deleted</em>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`chat-message ${isOwnMessage ? 'chat-message-own' : ''} ${isSelected ? 'chat-message-selected' : ''} ${isGroupedWithPrev ? 'chat-message-grouped-prev' : ''} ${isGroupedWithNext ? 'chat-message-grouped-next' : ''} ${isPending ? 'chat-message-pending' : ''} ${isFailed ? 'chat-message-failed' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactionPicker(false);
      }}
      onClick={handleMessageClick}
    >
      {/* Avatar - only show if not grouped */}
      {!isGroupedWithPrev && !isOwnMessage && (
        <div className="chat-avatar">
          <div className="chat-avatar-circle">
            {message.senderUsername?.[0]?.toUpperCase() || '?'}
          </div>
        </div>
      )}

      {/* Message bubble */}
      <div className="chat-bubble-wrapper">
        {/* Sender name - only show if not grouped */}
        {!isGroupedWithPrev && !isOwnMessage && (
          <span className="chat-sender-name">{message.senderUsername}</span>
        )}

        {/* Reply preview */}
        {renderReplyPreview}

        {/* Message bubble */}
        <div className={`chat-bubble ${isOwnMessage ? 'chat-bubble-own' : ''}`}>
          {isEditing ? (
            <div className="chat-edit-form">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="chat-edit-input"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                  if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
              />
              <div className="chat-edit-actions">
                <button onClick={handleCancelEdit} className="chat-edit-cancel">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} className="chat-edit-save">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p className="chat-message-text">{message.content}</p>
          )}

          {/* Time and status */}
          <div className="chat-message-meta">
            <span className="chat-message-time">{formatTime(message.createdAt)}</span>
            {renderStatus}
          </div>
        </div>

        {/* Reactions */}
        {renderReactions}
      </div>

      {/* Action buttons */}
      {showActions && !isEditing && !isPending && !isFailed && (
        <div className={`chat-message-actions ${isOwnMessage ? 'chat-message-actions-own' : ''}`}>
          <button
            className="chat-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowReactionPicker(!showReactionPicker);
            }}
            title="Add reaction"
          >
            😊
          </button>
          <button
            className="chat-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleReply();
            }}
            title="Reply"
          >
            ↩️
          </button>
          {isOwnMessage && (
            <>
              <button
                className="chat-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit();
                }}
                title="Edit"
              >
                ✏️
              </button>
              <button
                className="chat-action-btn chat-action-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                title="Delete"
              >
                🗑️
              </button>
            </>
          )}
        </div>
      )}

      {/* Reaction picker */}
      {showReactionPicker && (
        <ReactionPicker
          onSelect={handleReaction}
          onClose={() => setShowReactionPicker(false)}
        />
      )}
    </div>
  );
}
