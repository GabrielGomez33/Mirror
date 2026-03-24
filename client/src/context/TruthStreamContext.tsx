// src/context/TruthStreamContext.tsx
// State management for TruthStream feature

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  getMyTruthProfile,
  getReviewQueue,
  getReceivedReviews,
  getGivenReviews,
  getTruthStats,
  getTruthAnalysis,
  getTruthMilestones,
  createTruthProfile,
  updateTruthProfile,
  submitReview as submitReviewApi,
  getQuestionnaire as getQuestionnaireApi,
  generateTruthAnalysis,
  startQueueItem as startQueueItemApi,
  markReviewHelpful as markReviewHelpfulApi,
  unmarkReviewHelpful as unmarkReviewHelpfulApi,
  respondToReview as respondToReviewApi,
  getReviewResponses as getReviewResponsesApi,
  flagReview as flagReviewApi,
  clearTruthStreamCache,
  getTruthStreamErrorMessage,
} from '../services/truthStreamApi';
import { onWebSocketEvent } from '../services/groupsWebSocket';
import type {
  TruthStreamProfile,
  ReviewQueueBatch,
  AnonymousReview,
  TruthStreamReview,
  TruthStreamStats,
  TruthMirrorReport,
  Milestone,
  CreateTruthProfileRequest,
  UpdateTruthProfileRequest,
  PaginatedTruthStreamResponse,
  QuestionnaireData,
  ReviewResponse,
} from '../types/truthstream';

// ============================================================================
// TYPES
// ============================================================================

export type TruthStreamView = 'overview' | 'profile-setup' | 'queue' | 'review' | 'analysis' | 'received' | 'given';

interface TruthStreamState {
  // Core data
  profile: TruthStreamProfile | null;
  queue: ReviewQueueBatch | null;
  receivedReviews: AnonymousReview[];
  givenReviews: TruthStreamReview[];
  stats: TruthStreamStats | null;
  analysis: TruthMirrorReport | null;
  milestones: Milestone[];

  // Pagination
  receivedTotal: number;
  receivedHasMore: boolean;
  givenTotal: number;
  givenHasMore: boolean;

  // UI state
  currentView: TruthStreamView;
  activeQueueItemId: string | null;
  focusReviewId: string | null;  // Auto-open dialogue for this review (from notification deep-link)
  isLoading: boolean;
  isLoadingMore: boolean;
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
}

type TruthStreamAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_MORE'; payload: boolean }
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUCCESS'; payload: string | null }
  | { type: 'SET_VIEW'; payload: TruthStreamView }
  | { type: 'SET_PROFILE'; payload: TruthStreamProfile | null }
  | { type: 'SET_QUEUE'; payload: ReviewQueueBatch | null }
  | { type: 'SET_RECEIVED_REVIEWS'; payload: { items: AnonymousReview[]; total: number; hasMore: boolean; append: boolean } }
  | { type: 'SET_GIVEN_REVIEWS'; payload: { items: TruthStreamReview[]; total: number; hasMore: boolean; append: boolean } }
  | { type: 'SET_STATS'; payload: TruthStreamStats | null }
  | { type: 'SET_ANALYSIS'; payload: TruthMirrorReport | null }
  | { type: 'SET_MILESTONES'; payload: Milestone[] }
  | { type: 'SET_ACTIVE_QUEUE_ITEM'; payload: string | null }
  | { type: 'SET_FOCUS_REVIEW'; payload: string | null }
  | { type: 'UPDATE_REVIEW_HELPFUL'; payload: { reviewId: string; helpfulCount: number; isHelpful: boolean } }
  | { type: 'RESET' };

// ============================================================================
// REDUCER
// ============================================================================

const initialState: TruthStreamState = {
  profile: null,
  queue: null,
  receivedReviews: [],
  givenReviews: [],
  stats: null,
  analysis: null,
  milestones: [],
  receivedTotal: 0,
  receivedHasMore: false,
  givenTotal: 0,
  givenHasMore: false,
  currentView: 'overview',
  activeQueueItemId: null,
  focusReviewId: null,
  isLoading: false,
  isLoadingMore: false,
  isSubmitting: false,
  error: null,
  successMessage: null,
};

function truthStreamReducer(state: TruthStreamState, action: TruthStreamAction): TruthStreamState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_LOADING_MORE':
      return { ...state, isLoadingMore: action.payload };
    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, successMessage: action.payload ? null : state.successMessage };
    case 'SET_SUCCESS':
      return { ...state, successMessage: action.payload, error: action.payload ? null : state.error };
    case 'SET_VIEW':
      return { ...state, currentView: action.payload, error: null, successMessage: null };
    case 'SET_PROFILE':
      return { ...state, profile: action.payload };
    case 'SET_QUEUE':
      return { ...state, queue: action.payload };
    case 'SET_RECEIVED_REVIEWS': {
      const newItems = action.payload.items;
      if (action.payload.append) {
        // Deduplicate by ID to prevent double-loading race conditions
        const existingIds = new Set(state.receivedReviews.map((r) => r.id));
        const deduped = newItems.filter((r) => !existingIds.has(r.id));
        return {
          ...state,
          receivedReviews: [...state.receivedReviews, ...deduped],
          receivedTotal: action.payload.total,
          receivedHasMore: action.payload.hasMore,
        };
      }
      return {
        ...state,
        receivedReviews: newItems,
        receivedTotal: action.payload.total,
        receivedHasMore: action.payload.hasMore,
      };
    }
    case 'SET_GIVEN_REVIEWS': {
      const newItems = action.payload.items;
      if (action.payload.append) {
        const existingIds = new Set(state.givenReviews.map((r) => r.id));
        const deduped = newItems.filter((r) => !existingIds.has(r.id));
        return {
          ...state,
          givenReviews: [...state.givenReviews, ...deduped],
          givenTotal: action.payload.total,
          givenHasMore: action.payload.hasMore,
        };
      }
      return {
        ...state,
        givenReviews: newItems,
        givenTotal: action.payload.total,
        givenHasMore: action.payload.hasMore,
      };
    }
    case 'SET_STATS':
      return { ...state, stats: action.payload };
    case 'SET_ANALYSIS':
      return { ...state, analysis: action.payload };
    case 'SET_MILESTONES':
      return { ...state, milestones: action.payload };
    case 'SET_ACTIVE_QUEUE_ITEM':
      return { ...state, activeQueueItemId: action.payload };
    case 'SET_FOCUS_REVIEW':
      return { ...state, focusReviewId: action.payload };
    case 'UPDATE_REVIEW_HELPFUL':
      return {
        ...state,
        receivedReviews: state.receivedReviews.map((r) =>
          r.id === action.payload.reviewId
            ? { ...r, helpfulCount: action.payload.helpfulCount, hasUserMarkedHelpful: action.payload.isHelpful }
            : r
        ),
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

interface TruthStreamContextValue extends TruthStreamState {
  // Navigation
  setView: (view: TruthStreamView) => void;
  setFocusReview: (reviewId: string | null) => void;

  // Data loading
  loadProfile: () => Promise<void>;
  loadQueue: () => Promise<void>;
  loadReceivedReviews: (append?: boolean) => Promise<void>;
  loadGivenReviews: (append?: boolean) => Promise<void>;
  loadStats: () => Promise<void>;
  loadAnalysis: () => Promise<void>;
  loadMilestones: () => Promise<void>;
  loadQuestionnaire: (goalCategory: string) => Promise<QuestionnaireData | null>;
  refreshAll: () => Promise<void>;

  // Actions
  createProfile: (data: CreateTruthProfileRequest) => Promise<boolean>;
  updateProfile: (data: UpdateTruthProfileRequest) => Promise<boolean>;
  startQueueItem: (queueId: string) => Promise<boolean>;
  submitReview: (
    queueId: string,
    responses: Record<string, Record<string, unknown>>,
    timeSpentSeconds: number
  ) => Promise<boolean>;
  requestAnalysis: () => Promise<boolean>;
  toggleHelpful: (reviewId: string, isCurrentlyHelpful: boolean) => Promise<void>;
  respondToReview: (reviewId: string, content: string) => Promise<boolean>;
  loadDialogue: (reviewId: string) => Promise<ReviewResponse[]>;
  flagReview: (reviewId: string, reason: string) => Promise<boolean>;
  clearError: () => void;
  clearSuccess: () => void;
}

const TruthStreamContext = createContext<TruthStreamContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function TruthStreamProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(truthStreamReducer, initialState);
  const { isAuthenticated, user } = useAuth();
  const lastUserIdRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Track mount state to prevent dispatch after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Guard: only dispatch if still mounted
  const safeDispatch = useCallback((action: TruthStreamAction) => {
    if (mountedRef.current) dispatch(action);
  }, []);

  // ---------- Navigation ----------

  const setView = useCallback((view: TruthStreamView) => {
    safeDispatch({ type: 'SET_VIEW', payload: view });
  }, [safeDispatch]);

  const setFocusReview = useCallback((reviewId: string | null) => {
    safeDispatch({ type: 'SET_FOCUS_REVIEW', payload: reviewId });
  }, [safeDispatch]);

  const clearError = useCallback(() => safeDispatch({ type: 'SET_ERROR', payload: null }), [safeDispatch]);
  const clearSuccess = useCallback(() => safeDispatch({ type: 'SET_SUCCESS', payload: null }), [safeDispatch]);

  // ---------- Data Loading ----------

  const loadProfile = useCallback(async () => {
    try {
      const res = await getMyTruthProfile();
      safeDispatch({ type: 'SET_PROFILE', payload: res.data || null });
    } catch {
      // No profile yet is not an error
      safeDispatch({ type: 'SET_PROFILE', payload: null });
    }
  }, [safeDispatch]);

  const loadQueue = useCallback(async () => {
    try {
      const res = await getReviewQueue();
      safeDispatch({ type: 'SET_QUEUE', payload: res.data || null });
    } catch {
      safeDispatch({ type: 'SET_QUEUE', payload: null });
    }
  }, [safeDispatch]);

  // Use ref for offset to avoid stale closure in pagination
  const receivedOffsetRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const loadReceivedReviews = useCallback(async (append: boolean = false) => {
    // Prevent concurrent pagination requests
    if (append && loadingMoreRef.current) return;
    try {
      if (append) {
        loadingMoreRef.current = true;
        safeDispatch({ type: 'SET_LOADING_MORE', payload: true });
      }
      const offset = append ? receivedOffsetRef.current : 0;
      const res = await getReceivedReviews(20, offset);
      const page = res.data as PaginatedTruthStreamResponse<AnonymousReview> | undefined;
      if (page) {
        safeDispatch({
          type: 'SET_RECEIVED_REVIEWS',
          payload: { items: page.items, total: page.total, hasMore: page.hasMore, append },
        });
        receivedOffsetRef.current = append ? offset + page.items.length : page.items.length;
      }
    } catch (err) {
      safeDispatch({ type: 'SET_ERROR', payload: getTruthStreamErrorMessage(err) });
    } finally {
      loadingMoreRef.current = false;
      safeDispatch({ type: 'SET_LOADING_MORE', payload: false });
    }
  }, [safeDispatch]);

  const givenOffsetRef = useRef(0);

  const loadGivenReviews = useCallback(async (append: boolean = false) => {
    try {
      const offset = append ? givenOffsetRef.current : 0;
      const res = await getGivenReviews(20, offset);
      const page = res.data as PaginatedTruthStreamResponse<TruthStreamReview> | undefined;
      if (page) {
        safeDispatch({
          type: 'SET_GIVEN_REVIEWS',
          payload: { items: page.items, total: page.total, hasMore: page.hasMore, append },
        });
        givenOffsetRef.current = append ? offset + page.items.length : page.items.length;
      }
    } catch (err) {
      safeDispatch({ type: 'SET_ERROR', payload: getTruthStreamErrorMessage(err) });
    }
  }, [safeDispatch]);

  const loadStats = useCallback(async () => {
    try {
      const res = await getTruthStats();
      safeDispatch({ type: 'SET_STATS', payload: res.data || null });
    } catch {
      // Non-critical
    }
  }, [safeDispatch]);

  const loadAnalysis = useCallback(async () => {
    try {
      const res = await getTruthAnalysis();
      safeDispatch({ type: 'SET_ANALYSIS', payload: res.data || null });
    } catch {
      // No analysis yet
      safeDispatch({ type: 'SET_ANALYSIS', payload: null });
    }
  }, [safeDispatch]);

  const loadMilestones = useCallback(async () => {
    try {
      const res = await getTruthMilestones();
      safeDispatch({ type: 'SET_MILESTONES', payload: res.data || [] });
    } catch {
      // Non-critical
    }
  }, [safeDispatch]);

  const refreshAll = useCallback(async () => {
    safeDispatch({ type: 'SET_LOADING', payload: true });
    clearTruthStreamCache();
    receivedOffsetRef.current = 0;
    givenOffsetRef.current = 0;
    try {
      await Promise.all([loadProfile(), loadQueue(), loadStats(), loadMilestones()]);
    } finally {
      safeDispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [safeDispatch, loadProfile, loadQueue, loadStats, loadMilestones]);

  // ---------- Actions ----------

  const handleCreateProfile = useCallback(async (data: CreateTruthProfileRequest): Promise<boolean> => {
    safeDispatch({ type: 'SET_SUBMITTING', payload: true });
    safeDispatch({ type: 'SET_ERROR', payload: null });
    try {
      const res = await createTruthProfile(data);
      if (res.data) {
        safeDispatch({ type: 'SET_PROFILE', payload: res.data });
        safeDispatch({ type: 'SET_SUCCESS', payload: 'Truth Card created! You can now receive reviews.' });
        safeDispatch({ type: 'SET_VIEW', payload: 'overview' });
        // Re-fetch full profile to ensure all fields (photoPath, vocalSalutationPath, etc.) are populated
        try {
          const fresh = await getMyTruthProfile();
          if (fresh.data) safeDispatch({ type: 'SET_PROFILE', payload: fresh.data });
        } catch { /* profile will refresh on next load */ }
        return true;
      }
      return false;
    } catch (err) {
      safeDispatch({ type: 'SET_ERROR', payload: getTruthStreamErrorMessage(err) });
      return false;
    } finally {
      safeDispatch({ type: 'SET_SUBMITTING', payload: false });
    }
  }, [safeDispatch]);

  const handleUpdateProfile = useCallback(async (data: UpdateTruthProfileRequest): Promise<boolean> => {
    safeDispatch({ type: 'SET_SUBMITTING', payload: true });
    safeDispatch({ type: 'SET_ERROR', payload: null });
    try {
      const res = await updateTruthProfile(data);
      if (res.success || res.data) {
        // Clear all caches so overview re-fetches with fresh shared data
        clearTruthStreamCache();

        // Re-fetch profile to get updated sharedDataTypes, photoPath, etc.
        try {
          const fresh = await getMyTruthProfile();
          if (fresh.data) safeDispatch({ type: 'SET_PROFILE', payload: fresh.data });
        } catch { /* profile will refresh on next load */ }

        // Re-fetch stats (profile completeness may have changed)
        try {
          const freshStats = await getTruthStats();
          if (freshStats.data) safeDispatch({ type: 'SET_STATS', payload: freshStats.data });
        } catch { /* stats will refresh on next load */ }

        safeDispatch({ type: 'SET_SUCCESS', payload: 'Truth Card updated.' });
        return true;
      }
      return false;
    } catch (err) {
      safeDispatch({ type: 'SET_ERROR', payload: getTruthStreamErrorMessage(err) });
      return false;
    } finally {
      safeDispatch({ type: 'SET_SUBMITTING', payload: false });
    }
  }, [safeDispatch]);

  const handleStartQueueItem = useCallback(async (queueId: string): Promise<boolean> => {
    safeDispatch({ type: 'SET_SUBMITTING', payload: true });
    try {
      const res = await startQueueItemApi(queueId);
      if (res.data) {
        safeDispatch({ type: 'SET_ACTIVE_QUEUE_ITEM', payload: queueId });
        safeDispatch({ type: 'SET_VIEW', payload: 'review' });
        return true;
      }
      return false;
    } catch (err) {
      safeDispatch({ type: 'SET_ERROR', payload: getTruthStreamErrorMessage(err) });
      return false;
    } finally {
      safeDispatch({ type: 'SET_SUBMITTING', payload: false });
    }
  }, [safeDispatch]);

  const loadQuestionnaire = useCallback(async (goalCategory: string): Promise<QuestionnaireData | null> => {
    try {
      const res = await getQuestionnaireApi(goalCategory);
      return res.data || null;
    } catch (err) {
      safeDispatch({ type: 'SET_ERROR', payload: getTruthStreamErrorMessage(err) });
      return null;
    }
  }, [safeDispatch]);

  const handleSubmitReview = useCallback(async (
    queueId: string,
    responses: Record<string, Record<string, unknown>>,
    timeSpentSeconds: number
  ): Promise<boolean> => {
    safeDispatch({ type: 'SET_SUBMITTING', payload: true });
    safeDispatch({ type: 'SET_ERROR', payload: null });
    try {
      const res = await submitReviewApi(queueId, responses, timeSpentSeconds);
      if (res.data) {
        safeDispatch({ type: 'SET_ACTIVE_QUEUE_ITEM', payload: null });
        safeDispatch({ type: 'SET_SUCCESS', payload: 'Review submitted! Thank you for your honest feedback.' });
        safeDispatch({ type: 'SET_VIEW', payload: 'queue' });
        // Refresh queue and stats in background
        loadQueue();
        loadStats();
        return true;
      }
      return false;
    } catch (err) {
      safeDispatch({ type: 'SET_ERROR', payload: getTruthStreamErrorMessage(err) });
      return false;
    } finally {
      safeDispatch({ type: 'SET_SUBMITTING', payload: false });
    }
  }, [safeDispatch, loadQueue, loadStats]);

  const requestAnalysis = useCallback(async (): Promise<boolean> => {
    safeDispatch({ type: 'SET_SUBMITTING', payload: true });
    try {
      const res = await generateTruthAnalysis();
      if (res.data) {
        safeDispatch({ type: 'SET_SUCCESS', payload: 'Analysis requested. You will be notified when it is ready.' });
        return true;
      }
      return false;
    } catch (err) {
      safeDispatch({ type: 'SET_ERROR', payload: getTruthStreamErrorMessage(err) });
      return false;
    } finally {
      safeDispatch({ type: 'SET_SUBMITTING', payload: false });
    }
  }, [safeDispatch]);

  // Debounce ref prevents rapid toggling
  const helpfulInFlightRef = useRef<Set<string>>(new Set());

  const toggleHelpful = useCallback(async (reviewId: string, isCurrentlyHelpful: boolean) => {
    // Prevent concurrent toggles for same review
    if (helpfulInFlightRef.current.has(reviewId)) return;
    helpfulInFlightRef.current.add(reviewId);

    // Optimistic update
    safeDispatch({
      type: 'UPDATE_REVIEW_HELPFUL',
      payload: {
        reviewId,
        helpfulCount: -1, // Sentinel; real count from API below
        isHelpful: !isCurrentlyHelpful,
      },
    });

    try {
      const res = isCurrentlyHelpful
        ? await unmarkReviewHelpfulApi(reviewId)
        : await markReviewHelpfulApi(reviewId);
      if (res.data) {
        safeDispatch({
          type: 'UPDATE_REVIEW_HELPFUL',
          payload: { reviewId, helpfulCount: res.data.helpfulCount, isHelpful: !isCurrentlyHelpful },
        });
      }
    } catch {
      // Revert optimistic update on failure
      safeDispatch({
        type: 'UPDATE_REVIEW_HELPFUL',
        payload: {
          reviewId,
          helpfulCount: -1, // Will need original; use best-effort here
          isHelpful: isCurrentlyHelpful,
        },
      });
    } finally {
      helpfulInFlightRef.current.delete(reviewId);
    }
  }, [safeDispatch]);

  const handleRespondToReview = useCallback(async (reviewId: string, content: string): Promise<boolean> => {
    safeDispatch({ type: 'SET_SUBMITTING', payload: true });
    try {
      await respondToReviewApi(reviewId, content);
      safeDispatch({ type: 'SET_SUCCESS', payload: 'Response sent.' });
      return true;
    } catch (err) {
      safeDispatch({ type: 'SET_ERROR', payload: getTruthStreamErrorMessage(err) });
      return false;
    } finally {
      safeDispatch({ type: 'SET_SUBMITTING', payload: false });
    }
  }, [safeDispatch]);

  const loadDialogue = useCallback(async (reviewId: string): Promise<ReviewResponse[]> => {
    try {
      const res = await getReviewResponsesApi(reviewId);
      const data = res.data as any;
      // Server returns { reviewId, messages[], messageCount, maxMessages }
      return (data?.messages || data || []) as ReviewResponse[];
    } catch {
      return [];
    }
  }, []);

  const handleFlagReview = useCallback(async (reviewId: string, reason: string): Promise<boolean> => {
    try {
      await flagReviewApi(reviewId, reason);
      safeDispatch({ type: 'SET_SUCCESS', payload: 'Review flagged for moderation.' });
      return true;
    } catch (err) {
      safeDispatch({ type: 'SET_ERROR', payload: getTruthStreamErrorMessage(err) });
      return false;
    }
  }, [safeDispatch]);

  // ---------- Auth Change Detection ----------
  // Reset state when user changes (logout/login as different user)

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (lastUserIdRef.current !== null && lastUserIdRef.current !== currentUserId) {
      // User changed — full reset
      safeDispatch({ type: 'RESET' });
      clearTruthStreamCache();
      receivedOffsetRef.current = 0;
      givenOffsetRef.current = 0;
    }
    lastUserIdRef.current = currentUserId;
  }, [user?.id, safeDispatch]);

  // ---------- Initial Load ----------

  useEffect(() => {
    if (isAuthenticated && user) {
      refreshAll();
    }
    // Only re-run when user ID changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---------- WebSocket Event Listeners ----------
  // Auto-refresh data when real-time events arrive via WebSocket

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // New review received → refresh received reviews + stats
    const unsubReviewReceived = onWebSocketEvent('ts:review_received' as any, () => {
      clearTruthStreamCache('received');
      receivedOffsetRef.current = 0;
      loadReceivedReviews();
      loadStats();
    });

    // Dialogue message → refresh received/given reviews to update response count badges
    const unsubDialogue = onWebSocketEvent('ts:dialogue_message' as any, () => {
      clearTruthStreamCache('given');
      clearTruthStreamCache('received');
      receivedOffsetRef.current = 0;
      givenOffsetRef.current = 0;
      loadReceivedReviews();
      loadGivenReviews();
    });

    // Helpful marked → refresh received reviews to update helpful counts
    const unsubHelpful = onWebSocketEvent('ts:helpful_marked' as any, () => {
      clearTruthStreamCache('given');
      givenOffsetRef.current = 0;
      loadGivenReviews();
    });

    // Review classified → refresh received reviews for new classification
    const unsubClassified = onWebSocketEvent('ts:review_classified' as any, () => {
      clearTruthStreamCache('received');
      receivedOffsetRef.current = 0;
      loadReceivedReviews();
    });

    // Analysis complete → refresh analysis
    const unsubAnalysis = onWebSocketEvent('ts:analysis_complete' as any, () => {
      clearTruthStreamCache('analysis');
      loadAnalysis();
    });

    // Queue assigned → refresh queue
    const unsubQueue = onWebSocketEvent('ts:queue_assigned' as any, () => {
      loadQueue();
    });

    // Milestone earned → refresh milestones + stats
    const unsubMilestone = onWebSocketEvent('ts:milestone_earned' as any, () => {
      loadMilestones();
      loadStats();
    });

    return () => {
      unsubReviewReceived();
      unsubDialogue();
      unsubHelpful();
      unsubClassified();
      unsubAnalysis();
      unsubQueue();
      unsubMilestone();
    };
  }, [isAuthenticated, user, loadReceivedReviews, loadGivenReviews, loadStats, loadAnalysis, loadQueue, loadMilestones]);

  // Auto-clear success messages after 5 seconds
  useEffect(() => {
    if (state.successMessage) {
      const timer = setTimeout(() => safeDispatch({ type: 'SET_SUCCESS', payload: null }), 5000);
      return () => clearTimeout(timer);
    }
  }, [state.successMessage, safeDispatch]);

  // ---------- Value ----------

  const value: TruthStreamContextValue = {
    ...state,
    setView,
    setFocusReview,
    loadProfile,
    loadQueue,
    loadReceivedReviews,
    loadGivenReviews,
    loadStats,
    loadAnalysis,
    loadMilestones,
    loadQuestionnaire,
    refreshAll,
    createProfile: handleCreateProfile,
    updateProfile: handleUpdateProfile,
    startQueueItem: handleStartQueueItem,
    submitReview: handleSubmitReview,
    requestAnalysis,
    toggleHelpful,
    respondToReview: handleRespondToReview,
    loadDialogue,
    flagReview: handleFlagReview,
    clearError,
    clearSuccess,
  };

  return (
    <TruthStreamContext.Provider value={value}>
      {children}
    </TruthStreamContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useTruthStream(): TruthStreamContextValue {
  const ctx = useContext(TruthStreamContext);
  if (!ctx) throw new Error('useTruthStream must be used within TruthStreamProvider');
  return ctx;
}
