// client/src/components/journal/JournalTab.tsx
// Enhanced journal with auto-save, keyboard shortcuts, error handling, and offline support

import React, { useState, useEffect, useRef } from 'react';
import {
  getEntriesByDate,
  createEntry,
  searchEntries,
  getTodayDate,
  formatDateForAPI,
  type JournalEntry,
  type CreateEntryPayload,
} from '../../services/journalApi';

// ============================================================================
// CONSTANTS
// ============================================================================

const THEME = {
  textPrimary: 'var(--mg-label, #6a1f33)',
  textBody: 'var(--mg-body, #7e4151)',
  textHeading: 'var(--mg-heading, #784552)',
  textSubtle: 'var(--mg-body, #7e4151)', // Same as textBody for consistency
  textShadow: '0px 1px 3px var(--mg-body, #7e4151)',
};

const EMOTIONS = [
  'joyful', 'excited', 'calm', 'grateful', 'content',
  'anxious', 'sad', 'frustrated', 'angry', 'overwhelmed'
];

const TIMES_OF_DAY = [
  { value: 'morning', label: '🌅 Morning', icon: '🌅' },
  { value: 'afternoon', label: '☀️ Afternoon', icon: '☀️' },
  { value: 'evening', label: '🌇 Evening', icon: '🌇' },
  { value: 'night', label: '🌙 Night', icon: '🌙' },
] as const;

const AUTOSAVE_DELAY = 3000; // 3 seconds
const DRAFT_STORAGE_KEY = 'journal_draft';

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

interface DraftData {
  date: string;
  timeOfDay: string;
  moodRating: number;
  energyLevel: number;
  primaryEmotion: string;
  emotionIntensity: number;
  freeFormEntry: string;
  gratefulFor: string;
  tags: string;
  timestamp: number;
}

function saveDraft(data: DraftData): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save draft:', error);
  }
}

function loadDraft(): DraftData | null {
  try {
    const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!draft) return null;
    
    const parsed = JSON.parse(draft);
    const age = Date.now() - (parsed.timestamp || 0);
    
    // Draft expires after 24 hours
    if (age > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.warn('Failed to load draft:', error);
    return null;
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear draft:', error);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getMoodEmoji = (mood: number): string => {
  if (mood >= 9) return '🌟';
  if (mood >= 7) return '😊';
  if (mood >= 5) return '😐';
  if (mood >= 3) return '😔';
  return '😢';
};

const getEmotionColor = (emotion: string): string => {
  const positiveEmotions = ['joyful', 'excited', 'grateful', 'content', 'calm'];
  const negativeEmotions = ['anxious', 'sad', 'frustrated', 'angry', 'overwhelmed'];
  
  if (positiveEmotions.includes(emotion.toLowerCase())) {
    return 'rgba(52, 211, 153, 0.3)';
  }
  if (negativeEmotions.includes(emotion.toLowerCase())) {
    return 'rgba(248, 113, 113, 0.3)';
  }
  return 'rgba(147, 197, 253, 0.3)';
};

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

class JournalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Journal Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="enhanced-glass-card p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-xl mb-2" style={{ color: THEME.textHeading }}>
            Something went wrong
          </h3>
          <p className="mb-4" style={{ color: THEME.textBody }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="enhanced-action-button px-6 py-2"
          >
            Reload Journal
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function JournalTabInner() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<JournalEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N: New entry
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setShowCreateModal(true);
      }
      
      // Cmd/Ctrl + K: Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('journal-search')?.focus();
      }
      
      // Escape: Close modal or clear search
      if (e.key === 'Escape') {
        if (showCreateModal) {
          setShowCreateModal(false);
        } else if (searchQuery) {
          setSearchQuery('');
          setSearchResults([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal, searchQuery]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setError(null);
      // Refresh entries when coming back online
      fetchEntriesForDate(selectedDate);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setError('You are offline. Some features may be unavailable.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [selectedDate]);

  // Fetch entries for selected date
  useEffect(() => {
    fetchEntriesForDate(selectedDate);
  }, [selectedDate]);

  const fetchEntriesForDate = async (date: Date) => {
    if (!isOnline) {
      setError('Cannot fetch entries while offline');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const dateStr = formatDateForAPI(date);
      const fetchedEntries = await getEntriesByDate(dateStr);
      setEntries(fetchedEntries);
    } catch (err: any) {
      console.error('Error fetching entries:', err);
      setError(err.message || 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  // Search functionality with debouncing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await searchEntries(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // Date navigation
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const isToday = formatDateForAPI(selectedDate) === getTodayDate();

  // Display entries or search results
  const displayEntries = searchQuery.trim() ? searchResults : entries;

  return (
    <JournalErrorBoundary>
      <div className="h-auto max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="enhanced-glass-card mb-4">
          <div className="welcome-header">
            <h2 className="welcome-title" style={{ color: THEME.textHeading, textShadow: THEME.textShadow }}>
              Journal
            </h2>
            <p className="welcome-subtitle" style={{ color: THEME.textPrimary, textShadow: THEME.textShadow }}>
              Reflect, track, and grow
            </p>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="mt-2 flex flex-wrap gap-2 text-xs" style={{ color: THEME.textPrimary }}>
            <span className="px-2 py-1 bg-white/10 rounded">⌘/Ctrl + N: New Entry</span>
            <span className="px-2 py-1 bg-white/10 rounded">⌘/Ctrl + K: Search</span>
            <span className="px-2 py-1 bg-white/10 rounded">ESC: Close/Clear</span>
          </div>
        </div>

        {/* Online/Offline Status */}
        {!isOnline && (
          <div className="enhanced-glass-card mb-4 bg-yellow-500/20 border-yellow-500/30">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span style={{ color: THEME.textPrimary }}>
                You're offline. Journal entries cannot be saved until you're back online.
              </span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && error !== 'You are offline. Some features may be unavailable.' && (
          <div className="enhanced-glass-card mb-4 bg-red-500/20 border-red-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">❌</span>
                <span style={{ color: '#ef4444' }}>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="enhanced-glass-card mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔍</span>
            <input
              id="journal-search"
              type="text"
              placeholder="Search entries... (⌘K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20 bg-white/10"
              style={{ color: THEME.textPrimary }}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="px-3 py-2 text-white/70 hover:text-white"
              >
                Clear
              </button>
            )}
            {isSearching && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white/30" />
            )}
          </div>
          {searchQuery && (
            <div className="mt-2 text-xs" style={{ color: THEME.textPrimary }}>
              Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Date Navigation (hidden during search) */}
        {!searchQuery && (
          <div className="enhanced-glass-card mb-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex justify-start">
                <button
                  onClick={goToPreviousDay}
                  className="enhanced-action-button px-3 sm:px-4 py-2 hover:scale-105 transition-transform"
                  aria-label="Previous day"
                >
                  <span className="whitespace-nowrap" style={{ color: THEME.textPrimary }}>← Prev</span>
                </button>
              </div>

              <div className="flex flex-col items-center text-center px-1">
                <div className="text-lg sm:text-2xl font-bold" style={{ color: THEME.textHeading, textShadow: THEME.textShadow }}>
                  {selectedDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                {!isToday && (
                  <button
                    onClick={goToToday}
                    className="text-xs mt-1 hover:underline"
                    style={{ color: THEME.textPrimary }}
                  >
                    Go to today
                  </button>
                )}
              </div>

              <div className="flex-1 flex justify-end">
                <button
                  onClick={goToNextDay}
                  disabled={isToday}
                  className={`enhanced-action-button px-3 sm:px-4 py-2 hover:scale-105 transition-transform ${isToday ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Next day"
                >
                  <span className="whitespace-nowrap" style={{ color: THEME.textPrimary }}>Next →</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Entry Button */}
        <div className="enhanced-glass-card mb-4">
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!isOnline}
            className={`w-full enhanced-action-button py-3 hover:scale-[1.02] transition-transform ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="text-lg" style={{ color: THEME.textHeading, textShadow: THEME.textShadow }}>
              ✍️ New Entry {!isOnline && '(Offline)'}
            </span>
          </button>
        </div>

        {/* Entries Display */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {loading ? (
            <div className="enhanced-glass-card py-12">
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mb-4" />
                <span style={{ color: THEME.textPrimary }}>Loading entries...</span>
              </div>
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="enhanced-glass-card py-12">
              <div className="text-center">
                <div className="text-4xl mb-4">📓</div>
                <p className="text-lg mb-2" style={{ color: THEME.textHeading }}>
                  {searchQuery ? 'No matching entries found' : 'No entries yet'}
                </p>
                <p className="text-sm" style={{ color: THEME.textSubtle }}>
                  {searchQuery 
                    ? 'Try a different search term' 
                    : `Create your first entry for ${selectedDate.toLocaleDateString()}`
                  }
                </p>
              </div>
            </div>
          ) : (
            displayEntries.map((entry) => (
              <JournalEntryCard key={entry.id} entry={entry} />
            ))
          )}
        </div>

        {/* Create Entry Modal */}
        {showCreateModal && (
          <CreateEntryModal
            date={selectedDate}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchEntriesForDate(selectedDate);
              clearDraft();
            }}
          />
        )}
      </div>
    </JournalErrorBoundary>
  );
}

// ============================================================================
// JOURNAL ENTRY CARD
// ============================================================================

function JournalEntryCard({ entry }: { entry: JournalEntry }) {
  const [expanded, setExpanded] = useState(false);

  const timeIcon = TIMES_OF_DAY.find(t => t.value === entry.timeOfDay)?.icon || '⏰';
  const moodEmoji = getMoodEmoji(entry.moodRating);
  const emotionColor = getEmotionColor(entry.primaryEmotion);

  const handleCardClick = () => {
    setExpanded(prev => !prev);  // ✅ FIX: Use functional update to avoid stale closure
  };

  return (
    <div 
      className="enhanced-glass-card p-4 hover:scale-[1.01] transition-transform cursor-pointer"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      aria-expanded={expanded}
      aria-label={`Journal entry for ${entry.timeOfDay}. Click to ${expanded ? 'collapse' : 'expand'}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{timeIcon}</span>
          <div>
            <div className="font-semibold" style={{ color: THEME.textHeading }}>
              {entry.timeOfDay.charAt(0).toUpperCase() + entry.timeOfDay.slice(1)}
            </div>
            <div className="text-xs" style={{ color: THEME.textSubtle }}>
              {new Date(entry.createdAt).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit' 
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div 
            className="px-3 py-1 rounded-full backdrop-blur-sm border border-white/20"
            style={{ backgroundColor: emotionColor }}
          >
            <span className="text-sm font-medium" style={{ color: THEME.textPrimary }}>
              {entry.primaryEmotion}
            </span>
          </div>
          <div className="text-2xl">{moodEmoji}</div>
        </div>
      </div>

      {/* Mood/Energy Bars */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs w-16" style={{ color: THEME.textSubtle }}>Mood</span>
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
            <div 
              className="h-full bg-gradient-to-r from-pink-400/60 to-purple-400/60 transition-all duration-500"
              style={{ width: `${entry.moodRating * 10}%` }}
            />
          </div>
          <span className="text-xs w-8 text-right" style={{ color: THEME.textPrimary }}>
            {entry.moodRating}/10
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs w-16" style={{ color: THEME.textSubtle }}>Energy</span>
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
            <div 
              className="h-full bg-gradient-to-r from-blue-400/60 to-cyan-400/60 transition-all duration-500"
              style={{ width: `${entry.energyLevel * 10}%` }}
            />
          </div>
          <span className="text-xs w-8 text-right" style={{ color: THEME.textPrimary }}>
            {entry.energyLevel}/10
          </span>
        </div>
      </div>

      {/* Free Form Entry Preview */}
      {entry.freeFormEntry && (
        <div className="mb-3">
          <p 
            className={`text-sm leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}
            style={{ color: THEME.textPrimary }}
          >
            {entry.freeFormEntry}
          </p>
        </div>
      )}

      {/* Prompt Responses (Expanded) */}
      {expanded && entry.promptResponses && Object.keys(entry.promptResponses).length > 0 && (
        <div className="space-y-2 mb-3 pt-3 border-t border-white/10">
          {Object.entries(entry.promptResponses).map(([key, value]) => (
            <div key={key}>
              <div className="text-xs font-medium mb-1" style={{ color: THEME.textSubtle }}>
                {key.replace(/([A-Z])/g, ' $1').trim()}:
              </div>
              <div className="text-sm" style={{ color: THEME.textPrimary }}>
                {Array.isArray(value) ? value.join(', ') : String(value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {entry.tags.map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-1 text-xs rounded-full backdrop-blur-sm border border-white/20"
              style={{ 
                backgroundColor: 'rgba(255, 182, 193, 0.2)',
                color: THEME.textPrimary 
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Expand Indicator */}
      <div className="text-center mt-2 pt-2 border-t border-white/10">
        <span className="text-xs font-medium" style={{ color: THEME.textPrimary }}>
          {expanded ? '▲ Click to collapse' : '▼ Click to expand'}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// CREATE ENTRY MODAL (with auto-save and unsaved changes warning)
// ============================================================================

interface CreateEntryModalProps {
  date: Date;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateEntryModal({ date, onClose, onSuccess }: CreateEntryModalProps) {
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('morning');
  const [moodRating, setMoodRating] = useState(7);
  const [energyLevel, setEnergyLevel] = useState(7);
  const [primaryEmotion, setPrimaryEmotion] = useState('content');
  const [emotionIntensity, setEmotionIntensity] = useState(5);
  const [freeFormEntry, setFreeFormEntry] = useState('');
  const [gratefulFor, setGratefulFor] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Draft-save status pill. Transitions:
  //   idle  -> saved (after autosave timer fires + saveDraft() succeeds)
  //   saved -> idle  (after a short fade timer; the pill auto-hides)
  // Kept as a single state machine to avoid the visual flicker that
  // happens when you derive "showSaved" from a timestamp + Date.now().
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saved'>('idle');

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Independent timer for the "Draft saved" pill fade; lives alongside
  // autoSaveTimerRef so the two don't stomp each other.
  const savedFadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debug log
  useEffect(() => {
    console.log('✅ CreateEntryModal mounted for date:', formatDateForAPI(date));
    return () => console.log('❌ CreateEntryModal unmounted');
  }, [date]);

  // Load draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft && draft.date === formatDateForAPI(date)) {
      setTimeOfDay(draft.timeOfDay as any);
      setMoodRating(draft.moodRating);
      setEnergyLevel(draft.energyLevel);
      setPrimaryEmotion(draft.primaryEmotion);
      setEmotionIntensity(draft.emotionIntensity);
      setFreeFormEntry(draft.freeFormEntry);
      setGratefulFor(draft.gratefulFor);
      setTags(draft.tags);
    }
  }, [date]);

  // Auto-save draft
  useEffect(() => {
    if (freeFormEntry.trim()) {
      setHasUnsavedChanges(true);
      
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(() => {
        saveDraft({
          date: formatDateForAPI(date),
          timeOfDay,
          moodRating,
          energyLevel,
          primaryEmotion,
          emotionIntensity,
          freeFormEntry,
          gratefulFor,
          tags,
          timestamp: Date.now(),
        });
        console.log('💾 Draft auto-saved');
        // Surface the save with a brief pill near the header so the
        // user has a visible "your draft is safe" signal. The pill
        // fades after ~2.5s; the next autosave bumps it back into view.
        setDraftStatus('saved');
        if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);
        savedFadeTimerRef.current = setTimeout(() => setDraftStatus('idle'), 2500);
      }, AUTOSAVE_DELAY);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [date, timeOfDay, moodRating, energyLevel, primaryEmotion, emotionIntensity, freeFormEntry, gratefulFor, tags]);

  // Defensive cleanup: the pill fade timer is independent of the autosave
  // timer's cleanup above and would otherwise leak if the modal unmounts
  // mid-fade. Clears once on unmount.
  useEffect(() => {
    return () => {
      if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);
    };
  }, []);

  // Warn before closing with unsaved changes
  const handleClose = () => {
    if (hasUnsavedChanges && !submitting) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  };

  const handleForceClose = () => {
    clearDraft();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    // Race fix: persist the very latest form state to the draft
    // SYNCHRONOUSLY before the network call. The autosave runs on a
    // 3s debounce, so without this, a fast type-then-submit-then-fail
    // would leave the localStorage draft 2-3s stale — the user would
    // recover an outdated version after reload.
    //
    // If the POST succeeds, this draft is immediately cleared below
    // (clearDraft on the success path). If the POST fails, the user
    // sees the error, the React form state is unchanged, AND the
    // draft on disk now matches what they had at the moment of submit.
    saveDraft({
      date: formatDateForAPI(date),
      timeOfDay,
      moodRating,
      energyLevel,
      primaryEmotion,
      emotionIntensity,
      freeFormEntry,
      gratefulFor,
      tags,
      timestamp: Date.now(),
    });

    try {
      const payload: CreateEntryPayload = {
        entryDate: formatDateForAPI(date),
        timeOfDay,
        moodRating,
        primaryEmotion,
        emotionIntensity,
        energyLevel,
        freeFormEntry,
        promptResponses: {
          howAreYou: freeFormEntry.substring(0, 100),
          gratefulFor: gratefulFor.split(',').map(s => s.trim()).filter(Boolean),
        },
        tags: tags.split(',').map(s => s.trim()).filter(Boolean),
      };

      await createEntry(payload);
      setHasUnsavedChanges(false);
      clearDraft();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          backgroundColor: 'var(--journal-modal-bg, rgba(255, 247, 252))',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px) saturate(50%)',
          borderRadius: '20px',
        }}
      >
        <div
          className="enhanced-glass-panel w-full max-w-2xl"
          style={{ maxHeight: '100%', overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold mb-1" style={{ color: THEME.textHeading }}>
                  New Entry {hasUnsavedChanges && '(Unsaved)'}
                </h3>
                <p className="text-sm" style={{ color: THEME.textSubtle }}>
                  {date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
                {/* "Draft saved" pill — appears for ~2.5s after each
                    autosave fires. aria-live so screen readers
                    announce the save. Position absolute would clip
                    against the header; inline keeps it part of the
                    natural flow with no layout shift (height matched
                    to the timestamp line above). */}
                <div
                  aria-live="polite"
                  style={{
                    marginTop: 4,
                    height: 18,
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    color: '#34d399',
                    opacity: draftStatus === 'saved' ? 1 : 0,
                    transition: 'opacity 0.25s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {draftStatus === 'saved' && (
                    <>
                      <span aria-hidden="true">✓</span>
                      <span>Draft saved</span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-2xl hover:scale-110 transition-transform"
                style={{ color: THEME.textPrimary }}
              >
                ×
              </button>
            </div>

            {/* Time of Day */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: THEME.textPrimary }}>
                Time of Day
              </label>
              <div className="grid grid-cols-4 gap-2">
                {TIMES_OF_DAY.map((time) => (
                  <button
                    key={time.value}
                    type="button"
                    onClick={() => setTimeOfDay(time.value)}
                    className="flex flex-col items-center gap-1.5 bg-transparent border-0 p-0 hover:scale-105 transition-transform"
                    aria-pressed={timeOfDay === time.value}
                  >
                    <span
                      className={`flex items-center justify-center rounded-full text-xl w-12 h-12 border transition-all ${
                        timeOfDay === time.value
                          ? 'bg-white/15 border-pink-400/60 ring-2 ring-pink-400/40'
                          : 'bg-white/10 border-white/15'
                      }`}
                    >
                      {time.icon}
                    </span>
                    <span className="text-[0.7rem] leading-tight text-center" style={{ color: THEME.textPrimary }}>
                      {time.value}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mood Rating */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: THEME.textPrimary }}>
                Mood: {moodRating}/10 {getMoodEmoji(moodRating)}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={moodRating}
                onChange={(e) => setMoodRating(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              />
            </div>

            {/* Energy Level */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: THEME.textPrimary }}>
                Energy: {energyLevel}/10
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={energyLevel}
                onChange={(e) => setEnergyLevel(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              />
            </div>

            {/* Primary Emotion */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: THEME.textPrimary }}>
                Primary Emotion
              </label>
              <select
                value={primaryEmotion}
                onChange={(e) => setPrimaryEmotion(e.target.value)}
                className="w-full px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: THEME.textPrimary,
                }}
              >
                {EMOTIONS.map((emotion) => (
                  <option key={emotion} value={emotion} className="bg-gray-800">
                    {emotion}
                  </option>
                ))}
              </select>
            </div>

            {/* Emotion Intensity */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: THEME.textPrimary }}>
                Emotion Intensity: {emotionIntensity}/10
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={emotionIntensity}
                onChange={(e) => setEmotionIntensity(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              />
            </div>

            {/* Free Form Entry */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: THEME.textPrimary }}>
                Your Thoughts <span className="text-xs opacity-70">({freeFormEntry.length}/10000 chars)</span>
              </label>
              <textarea
                value={freeFormEntry}
                onChange={(e) => setFreeFormEntry(e.target.value)}
                placeholder="What's on your mind today?"
                rows={5}
                maxLength={10000}
                className="w-full px-4 py-3 rounded-lg backdrop-blur-sm border border-white/20 resize-none"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: THEME.textPrimary,
                }}
              />
            </div>

            {/* Grateful For */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: THEME.textPrimary }}>
                Grateful For (comma-separated)
              </label>
              <input
                type="text"
                value={gratefulFor}
                onChange={(e) => setGratefulFor(e.target.value)}
                placeholder="family, health, progress"
                maxLength={500}
                className="w-full px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: THEME.textPrimary,
                }}
              />
            </div>

            {/* Tags */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: THEME.textPrimary }}>
                Tags (comma-separated, max 20)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="work, health, reflection"
                maxLength={500}
                className="w-full px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: THEME.textPrimary,
                }}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30">
                <p className="text-sm" style={{ color: '#f87171' }}>
                  {error}
                </p>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="flex-1 px-6 py-3 rounded-lg backdrop-blur-sm border border-white/20 hover:scale-[1.02] transition-transform disabled:opacity-50"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: THEME.textPrimary,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !freeFormEntry.trim()}
                className="flex-1 px-6 py-3 rounded-lg backdrop-blur-sm border border-white/20 hover:scale-[1.02] transition-transform disabled:opacity-50"
                style={{
                  backgroundColor: 'rgba(255, 182, 193, 0.3)',
                  color: THEME.textHeading,
                }}
              >
                {submitting ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {showUnsavedWarning && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{
            backgroundColor: 'var(--journal-modal-bg, rgba(255, 247, 252))',
            backdropFilter: 'blur(50px) saturate(30%)',
            WebkitBackdropFilter: 'blur(50px) saturate(30%)',
            borderRadius: '20px'
          }}
        >
          <div className="enhanced-glass-panel max-w-md">
            <h3 className="text-xl font-bold mb-4" style={{ color: THEME.textHeading }}>
              Unsaved Changes
            </h3>
            <p className="mb-6" style={{ color: THEME.textBody }}>
              You have unsaved changes. Are you sure you want to close?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUnsavedWarning(false)}
                className="flex-1 px-6 py-3 rounded-lg backdrop-blur-sm border border-white/20"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: THEME.textPrimary,
                }}
              >
                Keep Editing
              </button>
              <button
                onClick={handleForceClose}
                className="flex-1 px-6 py-3 rounded-lg backdrop-blur-sm border border-red-500/30 bg-red-500/20"
                style={{ color: '#f87171' }}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default JournalTabInner;