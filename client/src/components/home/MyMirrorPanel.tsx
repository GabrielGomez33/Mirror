// src/components/home/MyMirrorPanel.tsx

interface UserStats {
  reviewsGiven: number;
  reviewsReceived: number;
  groupsJoined: number;
  trustScore: number;
  growthStreak: number;
}

interface MyMirrorPanelProps {
  user: {
    name: string;
    avatar: string;
    memberSince: string;
    bio: string;
    currentGoals: string[];
  };
  stats: UserStats;
}

export function MyMirrorPanel({ user, stats }: MyMirrorPanelProps) {
  return (
    <div className="dashboard-panel mymirror-panel h-full">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="glass-avatar w-16 h-16 flex items-center justify-center text-2xl overflow-hidden">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            '👤'
          )}
        </div>
        <div>
          <h2 className="text-white font-semibold text-xl">{user.name}</h2>
          <p className="text-white/70 text-sm">Member since {user.memberSince}</p>
        </div>
      </div>

      {/* Bio */}
      {user.bio && (
        <div className="mb-6">
          <p className="text-white/80 text-sm leading-relaxed">{user.bio}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="glass-stat-card">
          <div className="stat-number">{stats.reviewsGiven}</div>
          <div className="stat-label">Reviews Given</div>
        </div>
        <div className="glass-stat-card">
          <div className="stat-number">{stats.reviewsReceived}</div>
          <div className="stat-label">Reviews Received</div>
        </div>
        <div className="glass-stat-card">
          <div className="stat-number">{stats.groupsJoined}</div>
          <div className="stat-label">Groups Joined</div>
        </div>
        <div className="glass-stat-card">
          <div className="stat-number">{stats.trustScore}%</div>
          <div className="stat-label">Trust Score</div>
        </div>
      </div>

      {/* Growth Streak */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/90 font-medium">Growth Streak</span>
          <span className="text-white/70 text-sm">{stats.growthStreak} days</span>
        </div>
        <div className="glass-progress-container">
          <div 
            className="glass-progress-bar" 
            style={{ width: `${Math.min((stats.growthStreak / 30) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Current Goals */}
      <div className="mb-6">
        <h3 className="text-white/90 font-medium mb-3">Current Goals</h3>
        <div className="space-y-2">
          {user.currentGoals.map((goal, index) => (
            <div key={index} className="glass-stat-card text-left">
              <p className="text-white/80 text-sm">{goal}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <button className="w-full glass-button text-white py-3 rounded-xl">
          Update Goals
        </button>
        <button className="w-full glass-button text-white py-3 rounded-xl">
          View Analytics
        </button>
      </div>
    </div>
  );
}

// src/components/home/TruthStreamPanel.tsx
interface Review {
  id: string;
  reviewer: string;
  reviewerAvatar: string;
  type: 'strength' | 'opportunity' | 'potential';
  content: string;
  timestamp: string;
  helpful: number;
  category: string;
}

interface TruthStreamPanelProps {
  reviews: Review[];
  onLoadMore: () => void;
  hasMore: boolean;
}

export function TruthStreamPanel({ reviews, onLoadMore, hasMore }: TruthStreamPanelProps) {
  const getTypeEmoji = (type: Review['type']) => {
    switch (type) {
      case 'strength': return '💪';
      case 'opportunity': return '🌱';
      case 'potential': return '✨';
      default: return '💭';
    }
  };

  const getTypeColor = (type: Review['type']) => {
    switch (type) {
      case 'strength': return 'rgba(34, 197, 94, 0.2)';
      case 'opportunity': return 'rgba(251, 191, 36, 0.2)';
      case 'potential': return 'rgba(168, 85, 247, 0.2)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  };

  return (
    <div className="dashboard-panel truthstream-panel h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white font-semibold text-xl">TruthStream</h2>
        <div className="glass-fab w-10 h-10">
          <span className="text-lg">🔍</span>
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
        {reviews.map((review) => (
          <div key={review.id} className="feed-card">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="glass-avatar w-10 h-10 flex items-center justify-center text-sm">
                {review.reviewerAvatar || '👤'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white/90 font-medium text-sm">{review.reviewer}</span>
                  <span 
                    className="px-2 py-1 rounded-full text-xs font-medium"
                    style={{ 
                      backgroundColor: getTypeColor(review.type),
                      color: 'white'
                    }}
                  >
                    {getTypeEmoji(review.type)} {review.type}
                  </span>
                </div>
                <p className="text-white/60 text-xs">{review.timestamp}</p>
              </div>
            </div>

            {/* Content */}
            <div className="mb-4">
              <p className="text-white/85 text-sm leading-relaxed">{review.content}</p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-xs">{review.category}</span>
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-1 text-white/60 hover:text-white/80 transition-colors">
                  <span className="text-sm">👍</span>
                  <span className="text-xs">{review.helpful}</span>
                </button>
                <button className="text-white/60 hover:text-white/80 transition-colors">
                  <span className="text-sm">💬</span>
                </button>
                <button className="text-white/60 hover:text-white/80 transition-colors">
                  <span className="text-sm">🔗</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Load More */}
        {hasMore && (
          <div className="text-center py-4">
            <button 
              onClick={onLoadMore}
              className="glass-button px-6 py-2 text-white"
            >
              Load More Insights
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-4 flex gap-2">
        <button className="flex-1 glass-button text-white py-2 text-sm">
          Request Review
        </button>
        <button className="flex-1 glass-button text-white py-2 text-sm">
          Give Review
        </button>
      </div>
    </div>
  );
}

// src/components/home/MirrorGroupsPanel.tsx
interface Group {
  id: string;
  name: string;
  memberCount: number;
  type: 'open' | 'private' | 'anonymous';
  lastActivity: string;
  description: string;
}

interface MirrorGroupsPanelProps {
  joinedGroups: Group[];
  suggestedGroups: Group[];
  onJoinGroup: (groupId: string) => void;
  onLeaveGroup: (groupId: string) => void;
}

export function MirrorGroupsPanel({ 
  joinedGroups, 
  suggestedGroups, 
  onJoinGroup, 
  onLeaveGroup 
}: MirrorGroupsPanelProps) {
  const getGroupIcon = (type: Group['type']) => {
    switch (type) {
      case 'open': return '🌐';
      case 'private': return '🔒';
      case 'anonymous': return '🎭';
      default: return '👥';
    }
  };

  const getGroupColor = (type: Group['type']) => {
    switch (type) {
      case 'open': return 'rgba(34, 197, 94, 0.2)';
      case 'private': return 'rgba(239, 68, 68, 0.2)';
      case 'anonymous': return 'rgba(142, 68, 173, 0.2)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  };

  return (
    <div className="dashboard-panel mirrorgroups-panel h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white font-semibold text-xl">MirrorGroups</h2>
        <div className="glass-fab w-10 h-10">
          <span className="text-lg">➕</span>
        </div>
      </div>

      {/* My Groups */}
      <div className="mb-8">
        <h3 className="text-white/90 font-medium mb-4">My Groups</h3>
        <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
          {joinedGroups.map((group) => (
            <div key={group.id} className="feed-card">
              <div className="flex items-start gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                  style={{ backgroundColor: getGroupColor(group.type) }}
                >
                  {getGroupIcon(group.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white/90 font-medium text-sm">{group.name}</h4>
                    <button 
                      onClick={() => onLeaveGroup(group.id)}
                      className="text-white/60 hover:text-red-400 transition-colors text-xs"
                    >
                      Leave
                    </button>
                  </div>
                  <p className="text-white/60 text-xs mb-2">{group.memberCount} members</p>
                  <p className="text-white/70 text-xs leading-relaxed">{group.description}</p>
                  <p className="text-white/50 text-xs mt-2">Active {group.lastActivity}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Groups */}
      <div>
        <h3 className="text-white/90 font-medium mb-4">Suggested Groups</h3>
        <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
          {suggestedGroups.map((group) => (
            <div key={group.id} className="feed-card">
              <div className="flex items-start gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                  style={{ backgroundColor: getGroupColor(group.type) }}
                >
                  {getGroupIcon(group.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white/90 font-medium text-sm">{group.name}</h4>
                    <button 
                      onClick={() => onJoinGroup(group.id)}
                      className="glass-button px-3 py-1 text-xs text-white"
                    >
                      Join
                    </button>
                  </div>
                  <p className="text-white/60 text-xs mb-2">{group.memberCount} members</p>
                  <p className="text-white/70 text-xs leading-relaxed">{group.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 space-y-2">
        <button className="w-full glass-button text-white py-3 rounded-xl">
          Create New Group
        </button>
        <button className="w-full glass-button text-white py-3 rounded-xl">
          Join MirrorAnonym Session
        </button>
      </div>
    </div>
  );
}
