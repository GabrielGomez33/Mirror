// src/pages/Dashboard.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/enhanced-glass.css';
import ZenPondScene from '../components/three/ZenPondScene';
import MagicalSphereNavigation from '../components/home/MagicalSphereNavigation';
import { TruthStreamPanel, MirrorGroupsPanel } from '../components/home/EnhancedDashboardPanels';
import { MyMirrorPanel } from '../components/home/MyMirrorPanel';
import { MyJournalPanel } from '../components/home/MyJournalPanel';
import { useGroups } from '../context/GroupContext';
import CreateGroupModal from '../components/mirrorgroups/CreateGroupModal';

const mockReviews = [
  {
    id: '1',
    reviewer: 'Alex Chen',
    reviewerAvatar: '👨‍💻',
    type: 'strength' as const,
    content: 'Your ability to listen actively in our group discussions is remarkable. You always make sure everyone feels heard before sharing your own thoughts.',
    timestamp: '2 hours ago',
    helpful: 8,
    category: 'Communication'
  },
  {
    id: '2',
    reviewer: 'Maria Rodriguez',
    reviewerAvatar: '👩‍🎨',
    type: 'opportunity' as const,
    content: 'I noticed you tend to undersell your achievements when sharing wins with the group. Your accomplishments deserve more celebration!',
    timestamp: '5 hours ago',
    helpful: 12,
    category: 'Self-Confidence'
  },
  {
    id: '3',
    reviewer: 'Jordan Kim',
    reviewerAvatar: '🧑‍🔬',
    type: 'potential' as const,
    content: 'Your natural empathy combined with your analytical thinking could make you an excellent mentor. Have you considered leading a growth circle?',
    timestamp: '1 day ago',
    helpful: 15,
    category: 'Leadership'
  },
  {
    id: '4',
    reviewer: 'Anonymous',
    reviewerAvatar: '🎭',
    type: 'opportunity' as const,
    content: 'From our MirrorAnonym session: You have incredible insights but sometimes wait too long to share them. The group would benefit from hearing your thoughts sooner.',
    timestamp: '2 days ago',
    helpful: 9,
    category: 'Group Participation'
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState('myjournal'); // Default to journal
  const [reviews, setReviews] = useState(mockReviews);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);

  // MirrorGroups state from context
  const {
    myGroups,
    suggestedGroups,
    showCreateModal,
    setShowCreateModal,
    joinGroup,
    leaveGroup,
    fetchMyGroups,
    fetchSuggestedGroups,
  } = useGroups();

  // Fetch groups on mount
  useEffect(() => {
    fetchMyGroups();
    fetchSuggestedGroups();
  }, [fetchMyGroups, fetchSuggestedGroups]);

  const handleLoadMore = () => {
    setTimeout(() => {
      const newReviews = [
        {
          id: Math.random().toString(),
          reviewer: 'Chris Taylor',
          reviewerAvatar: '👩‍💼',
          type: 'strength' as const,
          content: 'Your follow-through on commitments is exceptional. When you say you\'ll do something, it gets done.',
          timestamp: '3 days ago',
          helpful: 6,
          category: 'Reliability'
        }
      ];
      setReviews(prev => [...prev, ...newReviews]);
      if (reviews.length > 8) {
        setHasMoreReviews(false);
      }
    }, 1000);
  };

  const handleJoinGroup = useCallback(async (groupId: string) => {
    await joinGroup(groupId);
  }, [joinGroup]);

  const handleLeaveGroup = useCallback(async (groupId: string) => {
    await leaveGroup(groupId);
  }, [leaveGroup]);

  const handleCreateGroup = useCallback(() => {
    setShowCreateModal(true);
  }, [setShowCreateModal]);

  const handleGroupCreated = useCallback((_groupId: string) => {
    // Navigate to the full MirrorGroups page to view the new group
    navigate('/groups');
  }, [navigate]);

  // Transform groups data for the panel component
  const transformedMyGroups = myGroups.map(group => ({
    id: group.id,
    name: group.name,
    memberCount: group.memberCount,
    type: group.privacy === 'public' ? 'open' as const : group.type === 'anonymous' ? 'anonymous' as const : 'private' as const,
    lastActivity: formatRelativeTime(group.lastActivity),
    description: group.description,
  }));

  const transformedSuggestedGroups = suggestedGroups.map(group => ({
    id: group.id,
    name: group.name,
    memberCount: group.memberCount,
    type: group.privacy === 'public' ? 'open' as const : group.type === 'anonymous' ? 'anonymous' as const : 'private' as const,
    lastActivity: formatRelativeTime(group.lastActivity),
    description: group.description,
  }));

  const renderActivePanel = () => {
    switch (activePanel) {
      case 'mymirror':
        return (
          <div className="w-full max-w-lg mx-auto">
            <MyMirrorPanel />
          </div>
        );
      case 'myjournal':
        return (
          <div className="w-full max-w-4xl mx-auto">
            <MyJournalPanel />
          </div>
        );
      case 'truthstream':
        return (
          <div className="w-full max-w-3xl mx-auto">
            <TruthStreamPanel reviews={reviews} onLoadMore={handleLoadMore} hasMore={hasMoreReviews} />
          </div>
        );
      case 'mirrorgroups':
        return (
          <div className="w-full max-w-lg mx-auto">
            <MirrorGroupsPanel
              joinedGroups={transformedMyGroups}
              suggestedGroups={transformedSuggestedGroups}
              onJoinGroup={handleJoinGroup}
              onLeaveGroup={handleLeaveGroup}
              onCreateGroup={handleCreateGroup}
              onViewAllGroups={() => navigate('/groups')}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50" />
      
      <div className="absolute inset-0 z-0">
        <ZenPondScene />
      </div>
      
      <div className="relative z-10 min-h-screen">

        <div className="flex justify-center px-4 pb-32">
          {renderActivePanel()}
        </div>
      </div>

      <MagicalSphereNavigation activePanel={activePanel} onPanelChange={setActivePanel} />

      <div className="fixed top-6 right-6 z-50">
        <div className="w-14 h-14 rounded-full bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-lg border border-white/20 flex items-center justify-center cursor-pointer hover:scale-110 transition-all duration-300 shadow-lg">
          <span className="text-xl">⚙️</span>
        </div>
      </div>

      {activePanel === 'truthstream' && reviews.length > 0 && (
        <div className="fixed top-6 left-6 z-50">
          <div className="glass-base rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full animate-pulse" />
              <span className="enhanced-glass-text text-sm font-medium">
                {reviews.length} new insights
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}
