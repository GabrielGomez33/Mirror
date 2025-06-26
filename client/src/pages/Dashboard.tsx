// src/pages/Dashboard.tsx

import { useState } from 'react';
import SakuraForestScene from '../components/three/SakuraForestScene';
import RetractableNavBar from '../components/home/RetractableNavBar';
import { MyMirrorPanel, TruthStreamPanel, MirrorGroupsPanel } from '../components/home/MyMirrorPanel';

// Mock data - replace with real API calls
const mockUser = {
  name: 'Sarah Johnson',
  avatar: '', // Empty for now, will show emoji fallback
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

  // Simulate loading more reviews
  const handleLoadMore = () => {
    // In real app, this would make an API call
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
      
      // Simulate running out of content
      if (reviews.length > 8) {
        setHasMoreReviews(false);
      }
    }, 1000);
  };

  const handleJoinGroup = (groupId: string) => {
    console.log('Joining group:', groupId);
    // In real app, make API call to join group
  };

  const handleLeaveGroup = (groupId: string) => {
    console.log('Leaving group:', groupId);
    // In real app, make API call to leave group
  };

  const renderActivePanel = () => {
    switch (activePanel) {
      case 'mymirror':
        return (
          <div className="w-full max-w-md mx-auto lg:max-w-lg">
            <MyMirrorPanel user={mockUser} stats={mockStats} />
          </div>
        );
      
      case 'truthstream':
        return (
          <div className="w-full max-w-2xl mx-auto">
            <TruthStreamPanel 
              reviews={reviews} 
              onLoadMore={handleLoadMore}
              hasMore={hasMoreReviews}
            />
          </div>
        );
      
      case 'mirrorgroups':
        return (
          <div className="w-full max-w-md mx-auto lg:max-w-lg">
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
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-rose-100 via-pink-50 to-orange-100" />
      
      {/* Three.js Sakura Forest Background */}
      <div className="absolute inset-0 z-0">
        <SakuraForestScene />
      </div>
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen">
        {/* Content Area */}
        <div className="px-4 py-8 pb-32 lg:px-8">
          {/* Welcome Header - Only show on first visit or occasionally */}
          <div className="text-center mb-8 lg:mb-12">
            <h1 className="text-3xl lg:text-4xl font-light text-white/90 mb-2">
              Welcome back, {mockUser.name.split(' ')[0]}
            </h1>
            <p className="text-white/70 text-lg">
              Your reflection journey continues
            </p>
          </div>

          {/* Panel Content */}
          <div className="flex justify-center">
            {renderActivePanel()}
          </div>
        </div>
      </div>

      {/* Floating Navigation */}
      <RetractableNavBar 
        activePanel={activePanel} 
        onPanelChange={setActivePanel} 
      />

      {/* Floating Action Button for Quick Actions */}
      <div className="fixed top-6 right-6 z-50">
        <div className="glass-fab">
          <span className="text-xl">⚙️</span>
        </div>
      </div>

      {/* Notification Badge (if any) */}
      {activePanel === 'truthstream' && reviews.length > 0 && (
        <div className="fixed top-6 left-6 z-50">
          <div className="glass-stat-card px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
              <span className="text-white/90 text-sm font-medium">
                {reviews.length} insights
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
