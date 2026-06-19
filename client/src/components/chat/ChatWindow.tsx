// src/components/chat/ChatWindow.tsx
// Main chat window component with message list and input

import { useEffect, useRef, useCallback, useState } from 'react';
import { useChat } from '../../context/ChatContext';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ChatHeader from './ChatHeader';
import TypingIndicator from './TypingIndicator';
import ReplyPreview from './ReplyPreview';
import PinnedMessagesBar from './PinnedMessagesBar';
import '../../styles/chat-glass.css';

interface ChatWindowProps {
  groupId: string;
  groupName?: string;
  onClose?: () => void;
}

export default function ChatWindow({ groupId, groupName, onClose }: ChatWindowProps) {
  const {
    messages,
    pinnedMessages,
    typingUsers,
    isLoading,
    isLoadingOlder,
    hasMoreOlder,
    error,
    replyingTo,
    isConnected,
    onlineMembers,
    allMessages,
    currentUserId,
    dinaProcessing,
    dinaProcessingQuery,
    openGroupChat,
    closeGroupChat,
    loadOlderMessages,
    sendMessage,
    setReplyingTo,
    markAsRead,
    clearError,
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Store callbacks in refs to avoid dependency issues
  const openGroupChatRef = useRef(openGroupChat);
  const closeGroupChatRef = useRef(closeGroupChat);

  useEffect(() => {
    openGroupChatRef.current = openGroupChat;
    closeGroupChatRef.current = closeGroupChat;
  }, [openGroupChat, closeGroupChat]);

  // Initialize chat for this group - only re-run when groupId changes
  // NOTE: We intentionally do NOT close the chat on unmount because:
  // - Switching tabs within GroupDetailView should preserve messages
  // - Only leaving the group entirely should close the chat
  useEffect(() => {
    console.log('[ChatWindow] Mounting/updating for groupId:', groupId);
    console.time('[ChatWindow] openGroupChat');
    openGroupChatRef.current(groupId);
    console.timeEnd('[ChatWindow] openGroupChat');

    // Don't cleanup on unmount - let messages persist when switching tabs
    // closeGroupChat should only be called when leaving GroupDetailView
  }, [groupId]);

  // Scroll to bottom on initial load and new messages
  const isInitialLoad = useRef(true);
  useEffect(() => {
    if (!messagesEndRef.current) return;

    if (isInitialLoad.current && allMessages.length > 0) {
      isInitialLoad.current = false;

      // Enterprise approach: observe DOM mutations until rendering settles,
      // then scroll. Handles any message count — no fixed timeout.
      const container = messagesContainerRef.current;
      if (!container) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
        return;
      }

      let settleTimer: ReturnType<typeof setTimeout>;
      const observer = new MutationObserver(() => {
        // Every time the DOM changes, reset the settle timer.
        // When mutations stop for 150ms, the layout is stable — scroll.
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          observer.disconnect();
          messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
        }, 150);
      });

      observer.observe(container, { childList: true, subtree: true, characterData: true });

      // Fallback: if no mutations happen within 2s, scroll anyway
      const fallback = setTimeout(() => {
        observer.disconnect();
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 2000);

      // Cleanup
      return () => {
        observer.disconnect();
        clearTimeout(settleTimer);
        clearTimeout(fallback);
      };
    }

    // Subsequent messages: smooth scroll if user is at bottom
    if (isAtBottom && allMessages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allMessages.length, isAtBottom]);

  // Mark messages as read when scrolling
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;

    // Check if at bottom
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);

    // Load older messages when scrolling near top
    if (scrollTop < 100 && hasMoreOlder && !isLoadingOlder) {
      loadOlderMessages();
    }

    // Mark visible messages as read
    if (atBottom && allMessages.length > 0) {
      const newestMessage = allMessages[allMessages.length - 1];
      if (newestMessage && newestMessage.senderUserId !== currentUserId) {
        markAsRead(newestMessage.id);
      }
    }
  }, [hasMoreOlder, isLoadingOlder, loadOlderMessages, allMessages, currentUserId, markAsRead]);

  // Handle send message
  const handleSendMessage = useCallback(async (
    content: string,
    options?: { parentMessageId?: string }
  ) => {
    await sendMessage(content, {
      parentMessageId: options?.parentMessageId || replyingTo?.id,
      metadata: replyingTo ? {
        replyPreview: {
          messageId: replyingTo.id,
          senderUsername: replyingTo.senderUsername || 'Unknown',
          content: replyingTo.content.substring(0, 100),
        },
      } : undefined,
    });
  }, [sendMessage, replyingTo]);

  // Cancel reply
  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, [setReplyingTo]);

  // Scroll to bottom button handler
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  if (isLoading && messages.length === 0) {
    return (
      <div className="chat-window-container">
        <div className="chat-loading">
          <div className="chat-loading-spinner" />
          <span className="enhanced-glass-text">Loading messages...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window-container">
      {/* Header */}
      <ChatHeader
        groupName={groupName || 'Group Chat'}
        memberCount={onlineMembers.length}
        isConnected={isConnected}
        onClose={onClose}
        onTogglePinned={() => setShowPinned(!showPinned)}
        pinnedCount={pinnedMessages.length}
      />

      {/* Connection status */}
      {!isConnected && (
        <div className="chat-connection-warning">
          <span className="text-amber-400">Reconnecting...</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="chat-error-banner">
          <span>{error}</span>
          <button onClick={clearError} className="chat-error-dismiss">
            &times;
          </button>
        </div>
      )}

      {/* Pinned messages bar */}
      {showPinned && pinnedMessages.length > 0 && (
        <PinnedMessagesBar
          messages={pinnedMessages}
          onClose={() => setShowPinned(false)}
        />
      )}

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="chat-messages-container"
        onScroll={handleScroll}
      >
        {/* Loading older indicator */}
        {isLoadingOlder && (
          <div className="chat-loading-older">
            <div className="chat-loading-spinner-small" />
            <span>Loading older messages...</span>
          </div>
        )}

        {/* No more messages indicator */}
        {!hasMoreOlder && messages.length > 0 && (
          <div className="chat-no-more-messages">
            <span>Beginning of conversation</span>
          </div>
        )}

        {/* Message list */}
        <MessageList messages={allMessages} />

        {/* Dina AI processing indicator */}
        {dinaProcessing && (
          <div className="dina-processing-indicator">
            <div className="dina-processing-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="dina-processing-icon">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <div className="dina-processing-content">
              <div className="dina-processing-label">Dina is thinking</div>
              <div className="dina-processing-dots">
                <span className="dina-dot" />
                <span className="dina-dot" />
                <span className="dina-dot" />
              </div>
              {dinaProcessingQuery && (
                <div className="dina-processing-query">
                  Analyzing: &ldquo;{dinaProcessingQuery.substring(0, 60)}{dinaProcessingQuery.length > 60 ? '...' : ''}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <TypingIndicator users={typingUsers} />
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="chat-scroll-bottom-btn"
          aria-label="Scroll to bottom"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Reply preview */}
      {replyingTo && (
        <ReplyPreview
          message={replyingTo}
          onCancel={handleCancelReply}
        />
      )}

      {/* Message input */}
      <MessageInput
        onSend={handleSendMessage}
        isDisabled={!isConnected}
        placeholder={replyingTo ? `Reply to ${replyingTo.senderUsername}...` : 'Type a message...'}
      />
    </div>
  );
}
