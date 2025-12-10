// src/components/chat/ChatHeader.tsx
// Chat header with group info, connection status, and controls

interface ChatHeaderProps {
  groupName: string;
  memberCount: number;
  isConnected: boolean;
  onClose?: () => void;
  onTogglePinned?: () => void;
  pinnedCount?: number;
}

export default function ChatHeader({
  groupName,
  memberCount,
  isConnected,
  onClose,
  onTogglePinned,
  pinnedCount = 0,
}: ChatHeaderProps) {
  return (
    <div className="chat-header">
      <div className="chat-header-info">
        <h3 className="chat-header-title">{groupName}</h3>
        <div className="chat-header-status">
          <span className={`chat-status-dot ${isConnected ? 'chat-status-online' : 'chat-status-offline'}`} />
          <span className="chat-header-members">
            {memberCount} {memberCount === 1 ? 'member' : 'members'} online
          </span>
        </div>
      </div>

      <div className="chat-header-actions">
        {/* Pinned messages button */}
        {pinnedCount > 0 && (
          <button
            onClick={onTogglePinned}
            className="chat-header-btn"
            title={`${pinnedCount} pinned message${pinnedCount === 1 ? '' : 's'}`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2v8m0 0l4-4m-4 4l-4-4m4 12v6" />
              <path d="M5 12h14" />
            </svg>
            <span className="chat-header-badge">{pinnedCount}</span>
          </button>
        )}

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="chat-header-btn chat-header-close"
            title="Close chat"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
