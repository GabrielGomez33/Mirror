// src/components/mirrorgroups/GroupChat.tsx
// Mobile-first group chat component

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGroups } from '../../context/GroupContext';
import { getToken, getUserInfo } from '../../utils/token';
import { getCachedMessages, setCachedMessages } from '../../services/chatCache';

interface ChatMessage {
  id: string;
  userId: number;
  username: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
}

interface GroupChatProps {
  groupId: string;
}

export default function GroupChat({ groupId }: GroupChatProps) {
  const { currentMembers } = useGroups();

  // Initialize with cached messages if available for instant display
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const cached = getCachedMessages(groupId);
    if (cached) {
      // Get current user ID for isOwn flag
      const currentUserId = getUserInfo()?.userId ?? 0;

      return cached.map((msg) => ({
        ...msg,
        isOwn: msg.userId === currentUserId,
        timestamp: msg.createdAt,
      }));
    }
    return [];
  });
  const [newMessage, setNewMessage] = useState('');
  // If we have cached messages, don't show loading state
  const [isLoading, setIsLoading] = useState(() => !getCachedMessages(groupId));
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get current user ID from token.ts for consistency
  const currentUserId = getUserInfo()?.userId ?? 0;

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Track if we had cached data on mount (to avoid showing loading spinner unnecessarily)
  const hadCachedDataRef = useRef(!!getCachedMessages(groupId));

  // Fetch chat history
  useEffect(() => {
    let isMounted = true;
    const hadCachedData = hadCachedDataRef.current;

    const fetchMessages = async (isInitialFetch = false) => {
      // Only show loading on initial fetch if no cached data was available
      if (isInitialFetch && !hadCachedData) {
        setIsLoading(true);
      }

      try {
        const token = getToken();
        if (!token) {
          console.error('No auth token available');
          if (isMounted) setIsLoading(false);
          return;
        }

        const response = await fetch(`/mirror/api/groups/${groupId}/chat/messages`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok && isMounted) {
          const data = await response.json();
          const rawMessages = data.messages || [];

          // Update cache with fresh messages
          setCachedMessages(groupId, rawMessages);

          const formattedMessages = rawMessages.map((msg: {
            id: string;
            userId: number;
            username: string;
            content: string;
            createdAt: string;
          }) => ({
            ...msg,
            isOwn: msg.userId === currentUserId,
            timestamp: msg.createdAt,
          }));
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error('Failed to fetch chat messages:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    // Initial fetch
    fetchMessages(true);

    // Poll for new messages every 5 seconds
    const interval = setInterval(() => fetchMessages(false), 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [groupId, currentUserId]);

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    // Optimistically add message
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      userId: currentUserId,
      username: 'You',
      content: messageContent,
      timestamp: new Date().toISOString(),
      isOwn: true,
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const token = getToken();
      if (!token) {
        console.error('No auth token available');
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
        setIsSending(false);
        return;
      }
      const response = await fetch(`/mirror/api/groups/${groupId}/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: messageContent, contentType: 'text' }),
      });

      if (!response.ok) {
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
        console.error('Failed to send message');
      }
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Get user color based on ID
  const getUserColor = (userId: number) => {
    const colors = [
      'from-pink-400 to-rose-400',
      'from-purple-400 to-violet-400',
      'from-blue-400 to-cyan-400',
      'from-green-400 to-emerald-400',
      'from-yellow-400 to-orange-400',
      'from-red-400 to-pink-400',
    ];
    return colors[userId % colors.length];
  };

  return (
    <div className="flex flex-col h-full max-h-[70vh] min-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💬</span>
          <div>
            <h3 className="enhanced-glass-heading text-base" style={{ color: '#784552' }}>
              Group Chat
            </h3>
            <p className="enhanced-glass-subtle text-xs" style={{ color: '#6a1f33' }}>
              {currentMembers.length} members
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/20">
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <span className="text-4xl mb-2 block animate-pulse">💭</span>
              <p className="enhanced-glass-subtle text-sm" style={{ color: '#7e4151' }}>
                Loading messages...
              </p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <span className="text-4xl mb-4 block">🌟</span>
              <p className="enhanced-glass-body text-sm mb-2" style={{ color: '#7e4151' }}>
                No messages yet
              </p>
              <p className="enhanced-glass-subtle text-xs" style={{ color: '#6a1f33' }}>
                Start the conversation!
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] sm:max-w-[70%] ${
                  message.isOwn ? 'order-2' : 'order-1'
                }`}
              >
                {!message.isOwn && (
                  <div className="flex items-center gap-2 mb-1 ml-1">
                    <div
                      className={`w-6 h-6 rounded-full bg-gradient-to-r ${getUserColor(
                        message.userId
                      )} flex items-center justify-center text-xs text-white font-medium`}
                    >
                      {message.username[0]?.toUpperCase() || '?'}
                    </div>
                    <span
                      className="enhanced-glass-subtle text-xs"
                      style={{ color: '#6a1f33' }}
                    >
                      {message.username}
                    </span>
                  </div>
                )}
                <div
                  className={`px-4 py-2 rounded-2xl ${
                    message.isOwn
                      ? 'bg-gradient-to-r from-pink-400/30 to-purple-400/30 rounded-br-md'
                      : 'bg-white/10 rounded-bl-md'
                  }`}
                >
                  <p
                    className="enhanced-glass-body text-sm whitespace-pre-wrap break-words"
                    style={{ color: '#7e4151' }}
                  >
                    {message.content}
                  </p>
                </div>
                <p
                  className={`text-xs mt-1 ${message.isOwn ? 'text-right mr-1' : 'ml-1'}`}
                  style={{ color: '#6a1f33', opacity: 0.7 }}
                >
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-pink-400/50 resize-none overflow-hidden"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex-shrink-0"
          >
            {isSending ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span className="text-white text-lg">↑</span>
            )}
          </button>
        </div>
        <p className="enhanced-glass-subtle text-xs mt-2 text-center" style={{ color: '#6a1f33' }}>
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
