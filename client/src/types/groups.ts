// src/types/groups.ts
// MirrorGroups TypeScript interfaces and types

// ============================================================================
// CORE GROUP TYPES
// ============================================================================

export type GroupType = 'family' | 'friends' | 'professional' | 'therapy' | 'anonymous' | 'open' | 'private';
export type GroupPrivacy = 'public' | 'private' | 'secret';
export type MemberRole = 'owner' | 'creator' | 'admin' | 'moderator' | 'member';
export type MemberStatus = 'active' | 'inactive' | 'banned' | 'pending';
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface Group {
  id: string;
  name: string;
  description: string;
  type: GroupType;
  privacy: GroupPrivacy;
  creatorId: number;
  memberCount: number;
  maxMembers: number;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
  settings?: GroupSettings;
}

export interface GroupSettings {
  allowAnonymousSharing: boolean;
  requireApproval: boolean;
  enableVoting: boolean;
  enableConversationInsights: boolean;
  maxVoteDuration: number;
  insightCheckInterval: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: number;
  username: string;
  displayName?: string;
  avatar?: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string;
  lastActive?: string;
  hasSharedData: boolean;
  sharedDataTypes: string[];
}

export interface ExtendedGroupMember extends GroupMember {
  email?: string;
  bio?: string;
  birthdate?: string;
  phone?: string;
  location?: string;
  timezone?: string;
  sharedData?: SharedDataDetail[];
}

export interface SharedDataDetail {
  dataType: string;
  sharedAt: string;
  dataVersion?: string;
}

export interface JoinRequest {
  id: string;
  groupId: string;
  userId: number;
  username: string;
  message?: string;
  status: JoinRequestStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: number;
}

// ============================================================================
// DATA SHARING TYPES
// ============================================================================

export type ShareableDataType =
  | 'personality'
  | 'cognitive'
  | 'facial'
  | 'voice'
  | 'astrological'
  | 'profile'
  | 'full_profile';

export interface SharedData {
  id: string;
  groupId: string;
  userId: number;
  dataType: ShareableDataType;
  encryptedData: string;
  consentGiven: boolean;
  consentText: string;
  sharedAt: string;
  updatedAt: string;
}

export interface ShareDataRequest {
  dataTypes: ShareableDataType[];
  consentText: string;
}

// ============================================================================
// GROUP INSIGHTS & ANALYSIS TYPES
// ============================================================================

export interface CompatibilityScore {
  userId1: number;
  userId2: number;
  username1: string;
  username2: string;
  overallScore: number;
  personalityScore: number;
  communicationScore: number;
  conflictScore: number;
  energyScore: number;
  calculatedAt: string;
}

export interface CompatibilityMatrix {
  groupId: string;
  scores: CompatibilityScore[];
  statistics: {
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    totalPairs: number;
  };
  calculatedAt: string;
}

export interface CollectivePattern {
  id: string;
  groupId: string;
  patternType: 'strength' | 'weakness' | 'opportunity' | 'threat';
  category: string;
  description: string;
  prevalence: number; // 0-1
  memberCount: number;
  confidence: number;
  detectedAt: string;
}

export interface ConflictRisk {
  id: string;
  groupId: string;
  userId1: number;
  userId2: number;
  username1: string;
  username2: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  riskType: string;
  description: string;
  mitigationStrategies: string[];
  confidence: number;
  detectedAt: string;
}

export interface LLMSynthesis {
  id: string;
  groupId: string;
  title: string;
  overview: string;
  keyInsights: string[];
  recommendations: string[];
  narrative: {
    strengths: string;
    challenges: string;
    opportunities: string;
  };
  qualityScore: number;
  generatedAt: string;
}

export interface GroupInsights {
  groupId: string;
  compatibility: CompatibilityMatrix | null;
  patterns: CollectivePattern[];
  conflicts: ConflictRisk[];
  llmSynthesis: LLMSynthesis | null;
  lastAnalyzed: string | null;
  analysisStatus: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
}

// ============================================================================
// VOTING SYSTEM TYPES
// ============================================================================

export type VoteType = 'yes_no' | 'multiple_choice' | 'rating';
export type VoteStatus = 'active' | 'completed' | 'cancelled';

export interface VoteResult {
  option: string;
  count: number;
  percentage: number;
}

export interface Vote {
  id: string;
  groupId: string;
  proposerId: number;
  proposerUsername: string;
  topic: string;
  argument?: string;
  voteType: VoteType;
  options?: string[];
  status: VoteStatus;
  durationSeconds: number;
  createdAt: string;
  completedAt?: string;
  expiresAt: string;
  results?: VoteResult[];
  participationRate?: number;
}

export interface VoteResponse {
  id: string;
  voteId: string;
  userId: number;
  username: string;
  response: string;
  respondedAt: string;
}

export interface VoteResults {
  voteId: string;
  topic: string;
  voteType: VoteType;
  status: VoteStatus;
  results: Array<{
    option: string;
    count: number;
    percentage: number;
  }>;
  totalVotes: number;
  participationRate: number;
  completedAt: string;
}

export interface ProposeVoteRequest {
  topic: string;
  argument?: string;
  voteType: VoteType;
  options?: string[];
  durationSeconds?: number;
}

export interface CastVoteRequest {
  response: string;
}

// ============================================================================
// CONVERSATION INSIGHTS TYPES
// ============================================================================

export interface TranscriptSegment {
  id: string;
  sessionId: string;
  speakerId: number;
  speakerUsername: string;
  text: string;
  timestamp: string;
}

export interface ConversationInsight {
  id: string;
  groupId: string;
  sessionId: string;
  insightType: 'periodic' | 'post_session';
  observations: string[];
  recommendations: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  confidence: number;
  generatedAt: string;
}

export interface SessionInsightsSummary {
  sessionId: string;
  groupId: string;
  insights: ConversationInsight[];
  transcriptStats: {
    totalSegments: number;
    uniqueSpeakers: number;
    duration: number;
  };
}

// ============================================================================
// SESSION TYPES
// ============================================================================

export type SessionStatus = 'scheduled' | 'active' | 'completed';

export interface GroupSession {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  status: SessionStatus;
  startTime: string;
  endTime?: string;
  participantCount: number;
  maxParticipants: number;
  createdBy: number;
  createdAt: string;
}

export interface SessionParticipant {
  id: string;
  sessionId: string;
  userId: number;
  username: string;
  joinedAt: string;
  leftAt?: string;
  isActive: boolean;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface GroupListResponse {
  groups: Group[];
  total: number;
}

export interface GroupDetailResponse {
  group: Group;
  members: GroupMember[];
  userRole: MemberRole | null;
  isMember: boolean;
}

export interface GroupInsightsResponse {
  insights: GroupInsights;
}

export interface VoteHistoryResponse {
  votes: Vote[];
  total: number;
}

// ============================================================================
// WEBSOCKET EVENT TYPES
// ============================================================================

export type WSEventType =
  | 'connection:established'
  | 'connection:error'
  | 'member:joined'
  | 'member:left'
  | 'member:updated'
  | 'data:shared'
  | 'insights:updated'
  | 'analysis:started'
  | 'analysis:completed'
  | 'vote:proposed'
  | 'vote:cast'
  | 'vote:completed'
  | 'conversation:insight'
  | 'conversation:summary'
  | 'session:started'
  | 'session:ended'
  | 'notification:received';

export interface WSMessage<T = unknown> {
  type: WSEventType;
  payload: T;
  timestamp: string;
  groupId?: string;
}

export interface WSVoteProposed {
  voteId: string;
  proposer: string;
  topic: string;
  argument?: string;
  options: string[];
  expiresAt: string;
  voteType: VoteType;
}

export interface WSVoteCast {
  voteId: string;
  totalVotes: number;
  remainingSeconds: number;
}

export interface WSVoteCompleted {
  voteId: string;
  results: Array<{ option: string; count: number; percentage: number }>;
  participationRate: number;
}

export interface WSConversationInsight {
  sessionId: string;
  insightType: 'periodic' | 'post_session';
  observations: string[];
  recommendations: string[];
  confidence: number;
}

export interface WSMemberJoined {
  groupId: string;
  member: GroupMember;
}

export interface WSMemberLeft {
  groupId: string;
  userId: number;
  username: string;
}

export interface WSAnalysisUpdate {
  groupId: string;
  status: 'started' | 'completed' | 'failed';
  progress?: number;
  message?: string;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface GroupsState {
  // Lists
  myGroups: Group[];
  suggestedGroups: Group[];
  searchResults: Group[];

  // Current group context
  currentGroup: Group | null;
  currentMembers: GroupMember[];
  currentInsights: GroupInsights | null;

  // Voting
  activeVotes: Vote[];
  voteHistory: Vote[];

  // Sessions
  activeSessions: GroupSession[];
  currentSession: GroupSession | null;
  sessionInsights: ConversationInsight[];

  // Loading states
  isLoading: boolean;
  isLoadingInsights: boolean;
  isLoadingVotes: boolean;

  // Errors
  error: string | null;

  // WebSocket
  isConnected: boolean;

  // UI state
  selectedGroupId: string | null;
  showCreateModal: boolean;
  showInviteModal: boolean;
}

export type GroupsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_MY_GROUPS'; payload: Group[] }
  | { type: 'SET_SUGGESTED_GROUPS'; payload: Group[] }
  | { type: 'SET_SEARCH_RESULTS'; payload: Group[] }
  | { type: 'SET_CURRENT_GROUP'; payload: Group | null }
  | { type: 'SET_CURRENT_MEMBERS'; payload: GroupMember[] }
  | { type: 'SET_CURRENT_INSIGHTS'; payload: GroupInsights | null }
  | { type: 'SET_LOADING_INSIGHTS'; payload: boolean }
  | { type: 'ADD_GROUP'; payload: Group }
  | { type: 'UPDATE_GROUP'; payload: Group }
  | { type: 'REMOVE_GROUP'; payload: string }
  | { type: 'ADD_MEMBER'; payload: GroupMember }
  | { type: 'UPDATE_MEMBER'; payload: GroupMember }
  | { type: 'REMOVE_MEMBER'; payload: { groupId: string; userId: number } }
  | { type: 'SET_ACTIVE_VOTES'; payload: Vote[] }
  | { type: 'ADD_VOTE'; payload: Vote }
  | { type: 'UPDATE_VOTE'; payload: Vote }
  | { type: 'COMPLETE_VOTE'; payload: { voteId: string; results: VoteResult[]; participationRate: number } }
  | { type: 'SET_VOTE_HISTORY'; payload: Vote[] }
  | { type: 'SET_LOADING_VOTES'; payload: boolean }
  | { type: 'SET_ACTIVE_SESSIONS'; payload: GroupSession[] }
  | { type: 'SET_CURRENT_SESSION'; payload: GroupSession | null }
  | { type: 'ADD_SESSION_INSIGHT'; payload: ConversationInsight }
  | { type: 'SET_SESSION_INSIGHTS'; payload: ConversationInsight[] }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_SELECTED_GROUP_ID'; payload: string | null }
  | { type: 'SET_SHOW_CREATE_MODAL'; payload: boolean }
  | { type: 'SET_SHOW_INVITE_MODAL'; payload: boolean }
  | { type: 'RESET_STATE' };

// ============================================================================
// FORM TYPES
// ============================================================================

export interface CreateGroupFormData {
  name: string;
  description: string;
  type: GroupType;
  privacy: GroupPrivacy;
  maxMembers: number;
  settings: Partial<GroupSettings>;
}

export interface InviteMemberFormData {
  email?: string;
  username?: string;
  message?: string;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export type NotificationType =
  | 'group_invite'
  | 'join_request'
  | 'join_approved'
  | 'join_rejected'
  | 'member_joined'
  | 'member_left'
  | 'data_shared'
  | 'insights_ready'
  | 'vote_proposed'
  | 'vote_completed'
  | 'conversation_insight'
  | 'conversation_summary';

export interface GroupNotification {
  id: string;
  userId: number;
  groupId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}
