// src/components/home/EnhancedDashboardPanels.tsx

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
    <div className="enhanced-glass-panel enhanced-panel-mymirror h-full">
      <div className="enhanced-glass-card">
        {/* Welcome Header with requested styling */}
        <div className="welcome-header mb-6">
          <h1 className="welcome-title" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
            Welcome back, {user.name}
          </h1>
          <p className="welcome-subtitle" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
            Your reflection journey continues
          </p>
        </div>

        <div className="flex items-center gap-6 mb-6">
          <div className="enhanced-avatar-container">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-3xl">👤</span>
            )}
          </div>
          <div className="flex-1">
            <h2 className="enhanced-glass-heading text-2xl mb-2" style={{ color: '#784552' }}>{user.name}</h2>
            <p className="enhanced-glass-subtle text-sm" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
              Member since {user.memberSince}
            </p>
          </div>
        </div>

        {user.bio && (
          <div className="enhanced-glass-card">
            <p className="enhanced-glass-body leading-relaxed" style={{ color: '#7e4151' }}>{user.bio}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="enhanced-stat-container">
          <div className="enhanced-stat-number">{stats.reviewsGiven}</div>
          <div className="enhanced-stat-label">Reviews Given</div>
        </div>
        <div className="enhanced-stat-container">
          <div className="enhanced-stat-number">{stats.reviewsReceived}</div>
          <div className="enhanced-stat-label">Reviews Received</div>
        </div>
        <div className="enhanced-stat-container">
          <div className="enhanced-stat-number">{stats.groupsJoined}</div>
          <div className="enhanced-stat-label">Groups Joined</div>
        </div>
        <div className="enhanced-stat-container">
          <div className="enhanced-stat-number">{stats.trustScore}%</div>
          <div className="enhanced-stat-label">Trust Score</div>
        </div>
      </div>

      <div className="enhanced-glass-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="enhanced-glass-heading text-lg" style={{ color: '#784552' }}>Growth Streak</h3>
          <span className="enhanced-glass-body text-sm" style={{ color: '#7e4151' }}>{stats.growthStreak} days</span>
        </div>
        <div className="relative h-3 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
          <div 
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${Math.min((stats.growthStreak / 30) * 100, 100)}%`,
              background: 'linear-gradient(90deg, #ff69b4, #ff1493, #da70d6)',
              boxShadow: '0 0 20px rgba(255, 105, 180, 0.5)'
            }}
          />
        </div>
      </div>

      <div className="enhanced-glass-card mb-6">
        <h3 className="enhanced-glass-heading text-lg mb-4" style={{ color: '#784552' }}>Current Goals</h3>
        <div className="space-y-3">
          {user.currentGoals.map((goal, index) => (
            <div key={index} className="enhanced-glass-card">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 mt-2 flex-shrink-0" />
                <p className="enhanced-glass-body text-sm leading-relaxed" style={{ color: '#7e4151' }}>{goal}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <button className="w-full enhanced-action-button">
          <span className="enhanced-glass-text font-medium" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
            Update Goals
          </span>
        </button>
        <button className="w-full enhanced-action-button">
          <span className="enhanced-glass-text font-medium" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
            View Analytics
          </span>
        </button>
      </div>
    </div>
  );
}

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

  const getTypeGradient = (type: Review['type']) => {
    switch (type) {
      case 'strength': return 'from-emerald-400/20 to-green-400/20';
      case 'opportunity': return 'from-amber-400/20 to-yellow-400/20';
      case 'potential': return 'from-violet-400/20 to-purple-400/20';
      default: return 'from-white/10 to-white/5';
    }
  };

  return (
    <div className="enhanced-glass-panel enhanced-panel-truthstream h-full">
      <div className="enhanced-glass-card mb-6">
        <div className="flex items-center justify-between">
          <h2 className="enhanced-glass-heading text-2xl" style={{ color: '#784552' }}>TruthStream</h2>
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
            <span className="text-xl">🔍</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {reviews.map((review) => (
          <div key={review.id} className="enhanced-glass-card">
            <div className="flex items-center gap-4 mb-4">
              <div className="enhanced-avatar-container w-12 h-12">
                <span className="text-lg">{review.reviewerAvatar || '👨‍💻'}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="enhanced-glass-heading text-sm font-medium" style={{ color: '#784552' }}>
                    {review.reviewer}
                  </span>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getTypeGradient(review.type)} backdrop-blur-sm flex items-center gap-1`}>
                    <span style={{ textShadow: '0px 1px 3px #7e4151' }}>{getTypeEmoji(review.type)}</span>
                    <span className="enhanced-glass-text capitalize" style={{ color: '#6a1f33' }}>{review.type}</span>
                  </div>
                </div>
                <p className="enhanced-glass-subtle text-xs" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
                  {review.timestamp}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="enhanced-glass-body leading-relaxed" style={{ color: '#7e4151' }}>{review.content}</p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <span className="enhanced-glass-subtle text-xs uppercase tracking-wide" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
                {review.category}
              </span>
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 enhanced-glass-subtle hover:text-white transition-colors">
                  <span className="text-sm">👍</span>
                  <span className="text-xs font-medium" style={{ color: '#784552' }}>{review.helpful}</span>
                </button>
                <button className="enhanced-glass-subtle hover:text-white transition-colors">
                  <span className="text-sm">💬</span>
                </button>
                <button className="enhanced-glass-subtle hover:text-white transition-colors">
                  <span className="text-sm">🔗</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        {hasMore && (
          <div className="text-center py-6">
            <button onClick={onLoadMore} className="enhanced-action-button px-8 py-3">
              <span className="enhanced-glass-text font-medium" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
                Load More Insights
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-6">
        <button className="enhanced-action-button py-3">
          <span className="enhanced-glass-text font-medium" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
            Request Insight
          </span>
        </button>
        <button className="enhanced-action-button py-3">
          <span className="enhanced-glass-text font-medium" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
            Share Insight
          </span>
        </button>
      </div>
    </div>
  );
}

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

export function MirrorGroupsPanel({ joinedGroups, suggestedGroups, onJoinGroup, onLeaveGroup }: MirrorGroupsPanelProps) {
  const getGroupIcon = (type: Group['type']) => {
    switch (type) {
      case 'open': return '🌐';
      case 'private': return '🔒';
      case 'anonymous': return '🎭';
      default: return '👥';
    }
  };

  const getGroupGradient = (type: Group['type']) => {
    switch (type) {
      case 'open': return 'from-emerald-400/20 to-green-400/20';
      case 'private': return 'from-red-400/20 to-pink-400/20';
      case 'anonymous': return 'from-purple-400/20 to-violet-400/20';
      default: return 'from-white/10 to-white/5';
    }
  };

  return (
    <div className="enhanced-glass-panel enhanced-panel-mirrorgroups h-full">
      <div className="enhanced-glass-card mb-6">
        <div className="flex items-center justify-between">
          <h2 className="enhanced-glass-heading text-2xl" style={{ color: '#784552' }}>MirrorGroups</h2>
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-400/20 to-violet-400/20 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
            <span className="text-xl">➕</span>
          </div>
        </div>
      </div>

      <div className="enhanced-glass-card mb-6">
        <h3 className="enhanced-glass-heading text-lg mb-4" style={{ color: '#784552' }}>My Groups</h3>
        <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {joinedGroups.map((group) => (
            <div key={group.id} className="enhanced-glass-card">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${getGroupGradient(group.type)} backdrop-blur-sm flex items-center justify-center flex-shrink-0`}>
                  <span className="text-xl">{getGroupIcon(group.type)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="enhanced-glass-heading text-sm font-medium truncate" style={{ color: '#784552' }}>
                      {group.name}
                    </h4>
                    <button onClick={() => onLeaveGroup(group.id)} className="text-red-400 hover:text-red-300 transition-colors text-xs font-medium ml-2 flex-shrink-0">
                      Leave
                    </button>
                  </div>
                  <p className="enhanced-glass-subtle text-xs mb-2" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
                    {group.memberCount} members
                  </p>
                  <p className="enhanced-glass-body text-xs leading-relaxed mb-2" style={{ color: '#7e4151' }}>
                    {group.description}
                  </p>
                  <p className="enhanced-glass-subtle text-xs" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
                    Active {group.lastActivity}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="enhanced-glass-card mb-6">
        <h3 className="enhanced-glass-heading text-lg mb-4" style={{ color: '#784552' }}>Suggested Groups</h3>
        <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {suggestedGroups.map((group) => (
            <div key={group.id} className="enhanced-glass-card">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${getGroupGradient(group.type)} backdrop-blur-sm flex items-center justify-center flex-shrink-0`}>
                  <span className="text-xl">{getGroupIcon(group.type)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="enhanced-glass-heading text-sm font-medium truncate" style={{ color: '#784552' }}>
                      {group.name}
                    </h4>
                    <button onClick={() => onJoinGroup(group.id)} className="enhanced-action-button px-3 py-1 text-xs ml-2 flex-shrink-0">
                      <span className="enhanced-glass-text font-medium" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
                        Join
                      </span>
                    </button>
                  </div>
                  <p className="enhanced-glass-subtle text-xs mb-2" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
                    {group.memberCount} members
                  </p>
                  <p className="enhanced-glass-body text-xs leading-relaxed" style={{ color: '#7e4151' }}>
                    {group.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <button className="w-full enhanced-action-button py-3">
          <span className="enhanced-glass-text font-medium" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
            Create New Group
          </span>
        </button>
        <button className="w-full enhanced-action-button py-3">
          <span className="enhanced-glass-text font-medium" style={{ color: '#6a1f33', textShadow: '0px 1px 3px #7e4151' }}>
            Join Anonymous Session
          </span>
        </button>
      </div>
    </div>
  );
}
