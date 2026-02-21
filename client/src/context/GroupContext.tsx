// src/context/GroupContext.tsx
// MirrorGroups State Management Context

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useAuth } from './AuthContext';
import {
  getMyGroups,
  getSuggestedGroups,
  getGroupDetails,
  joinGroup as joinGroupApi,
  leaveGroup as leaveGroupApi,
  createGroup as createGroupApi,
  deleteGroup as deleteGroupApi,
  getInsights,
  getActiveVotes,
  getVoteHistory,
  triggerAnalysis as triggerAnalysisApi,
  proposeVote as proposeVoteApi,
  castVote as castVoteApi,
  shareData as shareDataApi,
  getGroupsErrorMessage,
} from '../services/groupsApi';
import {
  connectWebSocket,
  disconnectWebSocket,
  isWebSocketConnected,
  subscribeToGroup,
  unsubscribeFromGroup,
  onWebSocketConnect,
  onWebSocketDisconnect,
  onWebSocketEvent,
} from '../services/groupsWebSocket';
import type {
  Group,
  GroupsState,
  GroupsAction,
  Vote,
  ConversationInsight,
  CreateGroupFormData,
  ShareDataRequest,
  ProposeVoteRequest,
  CastVoteRequest,
  WSVoteProposed,
  WSVoteCompleted,
  WSConversationInsight,
  WSMemberJoined,
  WSMemberLeft,
  WSAnalysisUpdate,
} from '../types/groups';

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: GroupsState = {
  myGroups: [],
  suggestedGroups: [],
  searchResults: [],
  currentGroup: null,
  currentMembers: [],
  currentInsights: null,
  activeVotes: [],
  voteHistory: [],
  activeSessions: [],
  currentSession: null,
  sessionInsights: [],
  isLoading: false,
  isLoadingInsights: false,
  isLoadingVotes: false,
  error: null,
  isConnected: false,
  selectedGroupId: null,
  showCreateModal: false,
  showInviteModal: false,
};

// ============================================================================
// REDUCER
// ============================================================================

function groupsReducer(state: GroupsState, action: GroupsAction): GroupsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'SET_MY_GROUPS':
      return { ...state, myGroups: action.payload };

    case 'SET_SUGGESTED_GROUPS':
      return { ...state, suggestedGroups: action.payload };

    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload };

    case 'SET_CURRENT_GROUP':
      return { ...state, currentGroup: action.payload };

    case 'SET_CURRENT_MEMBERS':
      return { ...state, currentMembers: action.payload };

    case 'SET_CURRENT_INSIGHTS':
      return { ...state, currentInsights: action.payload };

    case 'SET_LOADING_INSIGHTS':
      return { ...state, isLoadingInsights: action.payload };

    case 'ADD_GROUP':
      return {
        ...state,
        myGroups: [action.payload, ...state.myGroups],
      };

    case 'UPDATE_GROUP': {
      const updateInList = (list: Group[]) =>
        list.map((g) => (g.id === action.payload.id ? action.payload : g));
      return {
        ...state,
        myGroups: updateInList(state.myGroups),
        suggestedGroups: updateInList(state.suggestedGroups),
        currentGroup:
          state.currentGroup?.id === action.payload.id ? action.payload : state.currentGroup,
      };
    }

    case 'REMOVE_GROUP':
      return {
        ...state,
        myGroups: state.myGroups.filter((g) => g.id !== action.payload),
        currentGroup: state.currentGroup?.id === action.payload ? null : state.currentGroup,
        currentMembers: state.currentGroup?.id === action.payload ? [] : state.currentMembers,
      };

    case 'ADD_MEMBER':
      if (state.currentGroup?.id === action.payload.groupId) {
        return {
          ...state,
          currentMembers: [...state.currentMembers, action.payload],
          currentGroup: state.currentGroup
            ? {
                ...state.currentGroup,
                memberCount: state.currentGroup.memberCount + 1,
              }
            : null,
        };
      }
      return state;

    case 'UPDATE_MEMBER':
      return {
        ...state,
        currentMembers: state.currentMembers.map((m) =>
          m.id === action.payload.id ? action.payload : m
        ),
      };

    case 'REMOVE_MEMBER': {
      if (state.currentGroup?.id === action.payload.groupId) {
        return {
          ...state,
          currentMembers: state.currentMembers.filter((m) => m.userId !== action.payload.userId),
          currentGroup: state.currentGroup
            ? {
                ...state.currentGroup,
                memberCount: Math.max(0, state.currentGroup.memberCount - 1),
              }
            : null,
        };
      }
      return state;
    }

    case 'SET_ACTIVE_VOTES':
      return { ...state, activeVotes: action.payload };

    case 'ADD_VOTE':
      return {
        ...state,
        activeVotes: [action.payload, ...state.activeVotes],
      };

    case 'UPDATE_VOTE':
      return {
        ...state,
        activeVotes: state.activeVotes.map((v) =>
          v.id === action.payload.id ? action.payload : v
        ),
        voteHistory: state.voteHistory.map((v) =>
          v.id === action.payload.id ? action.payload : v
        ),
      };

    case 'COMPLETE_VOTE': {
      const completedVote = state.activeVotes.find((v) => v.id === action.payload.voteId);
      if (!completedVote) return state;

      const updatedVote: Vote = {
        ...completedVote,
        status: 'completed',
        completedAt: new Date().toISOString(),
        results: action.payload.results,
        participationRate: action.payload.participationRate,
      };

      return {
        ...state,
        activeVotes: state.activeVotes.filter((v) => v.id !== action.payload.voteId),
        voteHistory: [updatedVote, ...state.voteHistory],
      };
    }

    case 'SET_VOTE_HISTORY':
      return { ...state, voteHistory: action.payload };

    case 'SET_LOADING_VOTES':
      return { ...state, isLoadingVotes: action.payload };

    case 'SET_ACTIVE_SESSIONS':
      return { ...state, activeSessions: action.payload };

    case 'SET_CURRENT_SESSION':
      return { ...state, currentSession: action.payload };

    case 'ADD_SESSION_INSIGHT':
      return {
        ...state,
        sessionInsights: [action.payload, ...state.sessionInsights],
      };

    case 'SET_SESSION_INSIGHTS':
      return { ...state, sessionInsights: action.payload };

    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };

    case 'SET_SELECTED_GROUP_ID':
      return { ...state, selectedGroupId: action.payload };

    case 'SET_SHOW_CREATE_MODAL':
      return { ...state, showCreateModal: action.payload };

    case 'SET_SHOW_INVITE_MODAL':
      return { ...state, showInviteModal: action.payload };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface GroupContextType extends GroupsState {
  // Data fetching
  fetchMyGroups: () => Promise<void>;
  fetchSuggestedGroups: () => Promise<void>;
  fetchGroupDetails: (groupId: string) => Promise<void>;
  fetchInsights: (groupId: string) => Promise<void>;
  fetchActiveVotes: (groupId: string) => Promise<void>;
  fetchVoteHistory: (groupId: string) => Promise<void>;

  // Group actions
  createGroup: (data: CreateGroupFormData) => Promise<string | null>;
  joinGroup: (groupId: string, joinCode?: string) => Promise<boolean>;
  leaveGroup: (groupId: string) => Promise<boolean>;
  deleteGroup: (groupId: string) => Promise<boolean>;
  selectGroup: (groupId: string | null) => void;

  // Data sharing
  shareData: (groupId: string, request: ShareDataRequest) => Promise<boolean>;

  // Analysis
  triggerAnalysis: (groupId: string, userContext?: string) => Promise<boolean>;

  // Voting
  proposeVote: (groupId: string, request: ProposeVoteRequest) => Promise<boolean>;
  castVote: (groupId: string, voteId: string, request: CastVoteRequest) => Promise<boolean>;

  // WebSocket
  connectToGroups: () => void;
  disconnectFromGroups: () => void;

  // UI State
  setShowCreateModal: (show: boolean) => void;
  setShowInviteModal: (show: boolean) => void;
  clearError: () => void;

  // Refresh
  refreshAll: () => Promise<void>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const GroupContext = createContext<GroupContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface GroupProviderProps {
  children: React.ReactNode;
}

export const GroupProvider: React.FC<GroupProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(groupsReducer, initialState);
  const { isAuthenticated } = useAuth();
  const wsConnectedRef = useRef(false);
  const cleanupRef = useRef<Array<() => void>>([]);

  // ==================== DATA FETCHING ====================

  const fetchMyGroups = useCallback(async () => {
    if (!isAuthenticated) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await getMyGroups();
      dispatch({ type: 'SET_MY_GROUPS', payload: response.groups });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: getGroupsErrorMessage(error) });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [isAuthenticated]);

  const fetchSuggestedGroups = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await getSuggestedGroups();
      dispatch({ type: 'SET_SUGGESTED_GROUPS', payload: response.groups });
    } catch (error) {
      console.error('Failed to fetch suggested groups:', error);
    }
  }, [isAuthenticated]);

  const fetchGroupDetails = useCallback(
    async (groupId: string) => {
      if (!isAuthenticated) return;

      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const details = await getGroupDetails(groupId);
        dispatch({ type: 'SET_CURRENT_GROUP', payload: details.group });
        dispatch({ type: 'SET_CURRENT_MEMBERS', payload: details.members });

        // Subscribe to WebSocket updates for this group
        if (wsConnectedRef.current) {
          subscribeToGroup(groupId);
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: getGroupsErrorMessage(error) });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [isAuthenticated]
  );

  const fetchInsights = useCallback(
    async (groupId: string) => {
      if (!isAuthenticated) return;

      dispatch({ type: 'SET_LOADING_INSIGHTS', payload: true });
      try {
        const insights = await getInsights(groupId);
        dispatch({ type: 'SET_CURRENT_INSIGHTS', payload: insights });
      } catch (error) {
        console.error('Failed to fetch insights:', error);
      } finally {
        dispatch({ type: 'SET_LOADING_INSIGHTS', payload: false });
      }
    },
    [isAuthenticated]
  );

  const fetchActiveVotes = useCallback(
    async (groupId: string) => {
      if (!isAuthenticated) return;

      dispatch({ type: 'SET_LOADING_VOTES', payload: true });
      try {
        const votes = await getActiveVotes(groupId);
        dispatch({ type: 'SET_ACTIVE_VOTES', payload: votes });
      } catch (error) {
        console.error('Failed to fetch active votes:', error);
      } finally {
        dispatch({ type: 'SET_LOADING_VOTES', payload: false });
      }
    },
    [isAuthenticated]
  );

  const fetchVoteHistory = useCallback(
    async (groupId: string) => {
      if (!isAuthenticated) return;

      try {
        const response = await getVoteHistory(groupId, 50);
        // Filter to only completed votes and set as vote history
        const completedVotes = (response.votes || []).filter(
          (v: Vote) => v.status === 'completed'
        );
        dispatch({ type: 'SET_VOTE_HISTORY', payload: completedVotes });
      } catch (error) {
        console.error('Failed to fetch vote history:', error);
      }
    },
    [isAuthenticated]
  );

  // ==================== GROUP ACTIONS ====================

  const createGroup = useCallback(
    async (data: CreateGroupFormData): Promise<string | null> => {
      if (!isAuthenticated) return null;

      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const response = await createGroupApi(data);
        if (response.data?.groupId) {
          await fetchMyGroups();
          return response.data.groupId;
        }
        return null;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: getGroupsErrorMessage(error) });
        return null;
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [isAuthenticated, fetchMyGroups]
  );

  const joinGroup = useCallback(
    async (groupId: string, joinCode?: string): Promise<boolean> => {
      if (!isAuthenticated) return false;

      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        await joinGroupApi(groupId, joinCode);
        await fetchMyGroups();

        // Remove from suggested
        dispatch({
          type: 'SET_SUGGESTED_GROUPS',
          payload: state.suggestedGroups.filter((g) => g.id !== groupId),
        });

        return true;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: getGroupsErrorMessage(error) });
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [isAuthenticated, fetchMyGroups, state.suggestedGroups]
  );

  const leaveGroup = useCallback(
    async (groupId: string): Promise<boolean> => {
      if (!isAuthenticated) return false;

      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        await leaveGroupApi(groupId);
        dispatch({ type: 'REMOVE_GROUP', payload: groupId });

        // Unsubscribe from WebSocket
        if (wsConnectedRef.current) {
          unsubscribeFromGroup(groupId);
        }

        // Refresh groups list to ensure consistency
        await fetchMyGroups();

        return true;
      } catch (error) {
        console.error('Failed to leave group:', error);
        dispatch({ type: 'SET_ERROR', payload: getGroupsErrorMessage(error) });
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [isAuthenticated, fetchMyGroups]
  );

  const deleteGroup = useCallback(
    async (groupId: string): Promise<boolean> => {
      if (!isAuthenticated) return false;

      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        await deleteGroupApi(groupId);
        dispatch({ type: 'REMOVE_GROUP', payload: groupId });

        // Unsubscribe from WebSocket
        if (wsConnectedRef.current) {
          unsubscribeFromGroup(groupId);
        }

        // Clear current group if we just deleted it
        if (state.currentGroup?.id === groupId) {
          dispatch({ type: 'SET_CURRENT_GROUP', payload: null });
          dispatch({ type: 'SET_CURRENT_MEMBERS', payload: [] });
        }

        return true;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: getGroupsErrorMessage(error) });
        return false;
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [isAuthenticated, state.currentGroup?.id]
  );

  const selectGroup = useCallback(
    (groupId: string | null) => {
      dispatch({ type: 'SET_SELECTED_GROUP_ID', payload: groupId });

      if (groupId) {
        fetchGroupDetails(groupId);
        fetchInsights(groupId);
        fetchActiveVotes(groupId);
        fetchVoteHistory(groupId);
      } else {
        dispatch({ type: 'SET_CURRENT_GROUP', payload: null });
        dispatch({ type: 'SET_CURRENT_MEMBERS', payload: [] });
        dispatch({ type: 'SET_CURRENT_INSIGHTS', payload: null });
        dispatch({ type: 'SET_ACTIVE_VOTES', payload: [] });
        dispatch({ type: 'SET_VOTE_HISTORY', payload: [] });
      }
    },
    [fetchGroupDetails, fetchInsights, fetchActiveVotes, fetchVoteHistory]
  );

  // ==================== DATA SHARING ====================

  const shareData = useCallback(
    async (groupId: string, request: ShareDataRequest): Promise<boolean> => {
      if (!isAuthenticated) return false;

      try {
        await shareDataApi(groupId, request);
        // Refresh insights after sharing
        await fetchInsights(groupId);
        return true;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: getGroupsErrorMessage(error) });
        return false;
      }
    },
    [isAuthenticated, fetchInsights]
  );

  // ==================== ANALYSIS ====================

  const triggerAnalysis = useCallback(
    async (groupId: string, userContext?: string): Promise<boolean> => {
      if (!isAuthenticated) return false;

      dispatch({ type: 'SET_LOADING_INSIGHTS', payload: true });
      try {
        await triggerAnalysisApi(groupId, userContext);
        // Keep isLoadingInsights=true — it will be set to false when
        // the WebSocket 'analysis:completed' event fires and fetchInsights
        // completes, or after a safety timeout.
        setTimeout(() => {
          dispatch({ type: 'SET_LOADING_INSIGHTS', payload: false });
        }, 120000); // 2-minute safety timeout
        return true;
      } catch (error) {
        dispatch({ type: 'SET_LOADING_INSIGHTS', payload: false });
        dispatch({ type: 'SET_ERROR', payload: getGroupsErrorMessage(error) });
        return false;
      }
    },
    [isAuthenticated]
  );

  // ==================== VOTING ====================

  const proposeVote = useCallback(
    async (groupId: string, request: ProposeVoteRequest): Promise<boolean> => {
      if (!isAuthenticated) return false;

      try {
        const response = await proposeVoteApi(groupId, request);
        if (response.data) {
          dispatch({ type: 'ADD_VOTE', payload: response.data });
        }
        // Refetch votes to ensure state is accurate
        await fetchActiveVotes(groupId);
        return true;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: getGroupsErrorMessage(error) });
        return false;
      }
    },
    [isAuthenticated, fetchActiveVotes]
  );

  const castVote = useCallback(
    async (groupId: string, voteId: string, request: CastVoteRequest): Promise<boolean> => {
      if (!isAuthenticated) return false;

      try {
        await castVoteApi(groupId, voteId, request);
        // Refetch votes to reflect updated vote counts
        await fetchActiveVotes(groupId);
        return true;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: getGroupsErrorMessage(error) });
        return false;
      }
    },
    [isAuthenticated, fetchActiveVotes]
  );

  // ==================== WEBSOCKET ====================

  const connectToGroups = useCallback(() => {
    if (!isAuthenticated || wsConnectedRef.current) return;

    connectWebSocket();
    wsConnectedRef.current = true;
  }, [isAuthenticated]);

  const disconnectFromGroups = useCallback(() => {
    if (!wsConnectedRef.current) return;

    disconnectWebSocket();
    wsConnectedRef.current = false;
    dispatch({ type: 'SET_CONNECTED', payload: false });
  }, []);

  // ==================== UI STATE ====================

  const setShowCreateModal = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_CREATE_MODAL', payload: show });
  }, []);

  const setShowInviteModal = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_INVITE_MODAL', payload: show });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // ==================== REFRESH ====================

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchMyGroups(), fetchSuggestedGroups()]);

    if (state.selectedGroupId) {
      await Promise.all([
        fetchGroupDetails(state.selectedGroupId),
        fetchInsights(state.selectedGroupId),
        fetchActiveVotes(state.selectedGroupId),
        fetchVoteHistory(state.selectedGroupId),
      ]);
    }
  }, [
    fetchMyGroups,
    fetchSuggestedGroups,
    fetchGroupDetails,
    fetchInsights,
    fetchActiveVotes,
    fetchVoteHistory,
    state.selectedGroupId,
  ]);

  // ==================== EFFECTS ====================

  // Initialize on auth change
  useEffect(() => {
    if (isAuthenticated) {
      fetchMyGroups();
      fetchSuggestedGroups();
    } else {
      dispatch({ type: 'RESET_STATE' });
      disconnectFromGroups();
    }
  }, [isAuthenticated, fetchMyGroups, fetchSuggestedGroups, disconnectFromGroups]);

  // Setup WebSocket event handlers
  useEffect(() => {
    if (!isAuthenticated) return;

    // Connection handlers
    const unsubConnect = onWebSocketConnect(() => {
      dispatch({ type: 'SET_CONNECTED', payload: true });

      // Subscribe to all joined groups
      state.myGroups.forEach((group) => {
        subscribeToGroup(group.id);
      });
    });
    cleanupRef.current.push(unsubConnect);

    const unsubDisconnect = onWebSocketDisconnect(() => {
      dispatch({ type: 'SET_CONNECTED', payload: false });
    });
    cleanupRef.current.push(unsubDisconnect);

    // Member events - colon format (member:joined)
    const unsubMemberJoined = onWebSocketEvent(
      'member:joined',
      (data: unknown) => {
        const typedData = data as WSMemberJoined;
        dispatch({ type: 'ADD_MEMBER', payload: typedData.member });
        // Refresh the group list to show updated member count
        fetchMyGroups();
      }
    );
    cleanupRef.current.push(unsubMemberJoined);

    const unsubMemberLeft = onWebSocketEvent(
      'member:left',
      (data: unknown) => {
        const typedData = data as WSMemberLeft;
        dispatch({
          type: 'REMOVE_MEMBER',
          payload: { groupId: typedData.groupId, userId: typedData.userId },
        });
        // Refresh the group list to show updated member count
        fetchMyGroups();
      }
    );
    cleanupRef.current.push(unsubMemberLeft);

    // Member events - underscore format (member_joined) - backend notification format
    const unsubMemberJoinedUnderscore = onWebSocketEvent(
      'member_joined',
      (data: unknown) => {
        const typedData = data as WSMemberJoined;
        if (typedData.member) {
          dispatch({ type: 'ADD_MEMBER', payload: typedData.member });
        }
        // Refresh the group list to show updated member count
        fetchMyGroups();
      }
    );
    cleanupRef.current.push(unsubMemberJoinedUnderscore);

    const unsubMemberLeftUnderscore = onWebSocketEvent(
      'member_left',
      (data: unknown) => {
        const typedData = data as WSMemberLeft;
        if (typedData.groupId && typedData.userId) {
          dispatch({
            type: 'REMOVE_MEMBER',
            payload: { groupId: typedData.groupId, userId: typedData.userId },
          });
        }
        // Refresh the group list to show updated member count
        fetchMyGroups();
      }
    );
    cleanupRef.current.push(unsubMemberLeftUnderscore);

    // Vote events - refetch to ensure data is accurate
    const unsubVoteProposed = onWebSocketEvent(
      'vote:proposed',
      (data: unknown) => {
        const typedData = data as WSVoteProposed;
        console.log('[GroupContext] Vote proposed:', typedData);
        // Refetch active votes to get the new vote
        if (state.currentGroup?.id) {
          fetchActiveVotes(state.currentGroup.id);
        }
      }
    );
    cleanupRef.current.push(unsubVoteProposed);

    const unsubVoteCast = onWebSocketEvent('vote:cast', (_data: unknown) => {
      console.log('[GroupContext] Vote cast received');
      // Refetch active votes to get updated counts
      if (state.currentGroup?.id) {
        fetchActiveVotes(state.currentGroup.id);
      }
    });
    cleanupRef.current.push(unsubVoteCast);

    const unsubVoteCompleted = onWebSocketEvent(
      'vote:completed',
      (data: unknown) => {
        const typedData = data as WSVoteCompleted;
        console.log('[GroupContext] Vote completed:', typedData);
        // Refetch both active votes and history
        if (state.currentGroup?.id) {
          fetchActiveVotes(state.currentGroup.id);
          fetchVoteHistory(state.currentGroup.id);
        }
      }
    );
    cleanupRef.current.push(unsubVoteCompleted);

    // Conversation insights
    const unsubConversationInsight = onWebSocketEvent(
      'conversation:insight',
      (data: unknown) => {
        const typedData = data as WSConversationInsight;
        const insight: ConversationInsight = {
          id: `insight-${Date.now()}`,
          groupId: state.currentGroup?.id || '',
          sessionId: typedData.sessionId,
          insightType: typedData.insightType,
          observations: typedData.observations,
          recommendations: typedData.recommendations,
          confidence: typedData.confidence,
          generatedAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_SESSION_INSIGHT', payload: insight });
      }
    );
    cleanupRef.current.push(unsubConversationInsight);

    // Analysis events
    const unsubAnalysisCompleted = onWebSocketEvent(
      'analysis:completed',
      (data: unknown) => {
        const typedData = data as WSAnalysisUpdate;
        if (typedData.status === 'completed' && typedData.groupId === state.currentGroup?.id) {
          fetchInsights(typedData.groupId);
        }
      }
    );
    cleanupRef.current.push(unsubAnalysisCompleted);

    // Cleanup
    return () => {
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];
    };
  }, [isAuthenticated, state.myGroups, state.currentGroup?.id, state.activeVotes, fetchInsights, fetchMyGroups]);

  // Auto-connect WebSocket
  useEffect(() => {
    if (isAuthenticated && !isWebSocketConnected()) {
      connectToGroups();
    }
  }, [isAuthenticated, connectToGroups]);

  // ==================== CONTEXT VALUE ====================

  const contextValue: GroupContextType = {
    ...state,
    fetchMyGroups,
    fetchSuggestedGroups,
    fetchGroupDetails,
    fetchInsights,
    fetchActiveVotes,
    fetchVoteHistory,
    createGroup,
    joinGroup,
    leaveGroup,
    deleteGroup,
    selectGroup,
    shareData,
    triggerAnalysis,
    proposeVote,
    castVote,
    connectToGroups,
    disconnectFromGroups,
    setShowCreateModal,
    setShowInviteModal,
    clearError,
    refreshAll,
  };

  return <GroupContext.Provider value={contextValue}>{children}</GroupContext.Provider>;
};

// ============================================================================
// HOOK
// ============================================================================

export const useGroups = (): GroupContextType => {
  const context = useContext(GroupContext);
  if (!context) {
    throw new Error('useGroups must be used within a GroupProvider');
  }
  return context;
};

export default GroupContext;
