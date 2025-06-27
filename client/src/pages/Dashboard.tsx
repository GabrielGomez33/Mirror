// src/pages/Dashboard.tsx
import { useState } from 'react';
import '../styles/enhanced-glass.css';
import ZenPondScene from '../components/three/ZenPondScene';
import MagicalSphereNavigation from '../components/home/MagicalSphereNavigation';
import { MyMirrorPanel, TruthStreamPanel, MirrorGroupsPanel } from '../components/home/EnhancedDashboardPanels';

const mockUser = {
  name: 'Sarah Johnson',
  avatar: '',
  memberSince: 'March 2024',
  bio: 'Growth-focused individual seeking authentic connections and honest feedback. Passionate about personal development and helping others see their potential.',
  currentGoals: [
    'Improve communication skills in professional settings',
    'Build confidence in public speaking',
    'Develop better listening habits'
  ]
};

const mockStats = {
  reviewsGiven: 24,
  reviewsReceived: 18,
  groupsJoined: 3,
  trustScore: 92,
  growthStreak: 12
};

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

const mockJoinedGroups = [
  {
    id: '1',
    name: 'Career Growth Circle',
    memberCount: 8,
    type: 'private' as const,
    lastActivity: '3 hours ago',
    description: 'Professional development focused group for mid-career individuals seeking advancement.'
  },
  {
    id: '2',
    name: 'Communication Masters',
    memberCount: 12,
    type: 'open' as const,
    lastActivity: '1 day ago',
    description: 'Improving interpersonal and presentation skills through practice and feedback.'
  },
  {
    id: '3',
    name: 'Weekly Reflection',
    memberCount: 6,
    type: 'anonymous' as const,
    lastActivity: '2 days ago',
    description: 'Anonymous sharing and reflection on personal challenges and growth.'
  }
];

const mockSuggestedGroups = [
  {
    id: '4',
    name: 'Public Speaking Confidence',
    memberCount: 15,
    type: 'open' as const,
    lastActivity: '4 hours ago',
    description: 'Overcome speaking anxiety through supportive practice and honest feedback.'
  },
  {
    id: '5',
    name: 'Leadership Development',
    memberCount: 10,
    type: 'private' as const,
    lastActivity: '6 hours ago',
    description: 'For emerging leaders looking to develop authentic leadership styles.'
  },
  {
    id: '6',
    name: 'Mindful Listeners',
    memberCount: 8,
    type: 'open' as const,
    lastActivity: '1 day ago',
    description: 'Focus on developing deep listening skills and empathetic communication.'
  }
];

export default function Dashboard() {
  const [activePanel, setActivePanel] = useState('truthstream');
  const [reviews, setReviews] = useState(mockReviews);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);

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

  const handleJoinGroup = (groupId: string) => {
    console.log('Joining group:', groupId);
  };

  const handleLeaveGroup = (groupId: string) => {
    console.log('Leaving group:', groupId);
  };

  const renderActivePanel = () => {
    switch (activePanel) {
      case 'mymirror':
        return (
          <div className="w-full max-w-lg mx-auto">
            <MyMirrorPanel user={mockUser} stats={mockStats} />
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
              joinedGroups={mockJoinedGroups}
              suggestedGroups={mockSuggestedGroups}
              onJoinGroup={handleJoinGroup}
              onLeaveGroup={handleLeaveGroup}
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
        <div className="text-center pt-8 pb-4 px-4">
          <div className="glass-base rounded-2xl p-6 max-w-2xl mx-auto">
            <h1 className="enhanced-glass-heading text-3xl lg:text-4xl mb-2">
              Welcome back, {mockUser.name.split(' ')[0]}
            </h1>
            <p className="enhanced-glass-body text-lg">
              Your reflection journey continues
            </p>
          </div>
        </div>

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
    </div>
  );
}
