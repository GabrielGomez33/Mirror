// src/components/mirrorgroups/VotingSystem.tsx
// Real-time voting system for MirrorGroups

import { useState, useCallback, useEffect } from 'react';
import { useGroups } from '../../context/GroupContext';
import type { Vote, VoteType, ProposeVoteRequest } from '../../types/groups';

interface VotingSystemProps {
  groupId: string;
  votes: Vote[];
  pastVotes?: Vote[];
}

export default function VotingSystem({ groupId, votes, pastVotes = [] }: VotingSystemProps) {
  const { proposeVote, castVote, isLoadingVotes } = useGroups();
  const [showNewVote, setShowNewVote] = useState(false);
  const [selectedVote, setSelectedVote] = useState<Vote | null>(null);

  const activeVotes = votes.filter((v) => v.status === 'active');

  // Use pastVotes from props (fetched from API) - show all completed votes
  const completedVotes = pastVotes.filter((v) => v.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="enhanced-glass-heading text-lg" style={{ color: '#784552' }}>
          Group Voting
        </h3>
        {!showNewVote && (
          <button
            onClick={() => setShowNewVote(true)}
            className="enhanced-action-button px-4 py-2"
          >
            <span className="enhanced-glass-text text-sm" style={{ color: '#6a1f33' }}>
              + New Vote
            </span>
          </button>
        )}
      </div>

      {/* Inline New Vote Form */}
      {showNewVote && (
        <NewVoteInlineForm
          groupId={groupId}
          onClose={() => setShowNewVote(false)}
          onSubmit={proposeVote}
        />
      )}

      {/* Active Votes */}
      {activeVotes.length > 0 && (
        <div className="space-y-4">
          <h4 className="enhanced-glass-text text-sm" style={{ color: '#6a1f33' }}>
            Active Votes ({activeVotes.length})
          </h4>
          {activeVotes.map((vote) => (
            <ActiveVoteCard
              key={vote.id}
              vote={vote}
              groupId={groupId}
              onCastVote={castVote}
              onSelect={() => setSelectedVote(vote)}
            />
          ))}
        </div>
      )}

      {/* No Active Votes */}
      {activeVotes.length === 0 && !isLoadingVotes && !showNewVote && (
        <div className="text-center py-8">
          <span className="text-4xl mb-4 block">🗳️</span>
          <p className="enhanced-glass-body mb-2" style={{ color: '#7e4151' }}>
            No active votes
          </p>
          <p className="enhanced-glass-subtle text-sm" style={{ color: '#6a1f33' }}>
            Start a vote to gather group decisions
          </p>
        </div>
      )}

      {/* Completed Votes */}
      {completedVotes.length > 0 && (
        <div className="space-y-4">
          <h4 className="enhanced-glass-text text-sm" style={{ color: '#6a1f33' }}>
            Vote History ({completedVotes.length})
          </h4>
          {completedVotes.map((vote) => (
            <CompletedVoteCard key={vote.id} vote={vote} />
          ))}
        </div>
      )}

      {/* Vote Detail Modal */}
      {selectedVote && (
        <VoteDetailModal
          vote={selectedVote}
          groupId={groupId}
          onClose={() => setSelectedVote(null)}
          onCastVote={castVote}
        />
      )}
    </div>
  );
}

// ============================================================================
// ACTIVE VOTE CARD
// ============================================================================

interface ActiveVoteCardProps {
  vote: Vote;
  groupId: string;
  onCastVote: (groupId: string, voteId: string, request: { response: string }) => Promise<boolean>;
  onSelect: () => void;
}

function ActiveVoteCard({ vote, groupId, onCastVote, onSelect }: ActiveVoteCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const expiresAt = new Date(vote.expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [vote.expiresAt]);

  const handleVote = useCallback(async () => {
    if (!selectedOption || hasVoted) return;

    const success = await onCastVote(groupId, vote.id, { response: selectedOption });
    if (success) {
      setHasVoted(true);
    }
  }, [selectedOption, hasVoted, onCastVote, groupId, vote.id]);

  const getVoteTypeIcon = (type: VoteType) => {
    switch (type) {
      case 'yes_no':
        return '👍👎';
      case 'multiple_choice':
        return '📋';
      case 'rating':
        return '⭐';
      default:
        return '🗳️';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const options = vote.voteType === 'yes_no' ? ['Yes', 'No'] : vote.options || [];

  return (
    <div className="enhanced-glass-card border-l-4 border-pink-400">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{getVoteTypeIcon(vote.voteType)}</span>
          <span className="enhanced-glass-heading text-sm" style={{ color: '#784552' }}>
            {vote.topic}
          </span>
        </div>
        <div
          className={`px-2 py-1 rounded text-xs font-medium ${
            timeLeft <= 10 ? 'bg-red-500/30 text-red-300 animate-pulse' : 'bg-pink-500/20 text-pink-300'
          }`}
        >
          {formatTime(timeLeft)}
        </div>
      </div>

      {vote.argument && (
        <p className="enhanced-glass-subtle text-sm mb-3" style={{ color: '#7e4151' }}>
          {vote.argument}
        </p>
      )}

      <p className="enhanced-glass-subtle text-xs mb-3" style={{ color: '#6a1f33' }}>
        Proposed by {vote.proposerUsername}
      </p>

      {/* Vote Options */}
      {!hasVoted ? (
        <div className="space-y-2 mb-4">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => setSelectedOption(option)}
              className={`w-full p-3 rounded-lg border text-left transition-all ${
                selectedOption === option
                  ? 'bg-gradient-to-r from-pink-400/20 to-purple-400/20 border-pink-400/50'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    selectedOption === option
                      ? 'border-pink-400 bg-pink-400'
                      : 'border-white/30'
                  }`}
                />
                <span className="enhanced-glass-text text-sm" style={{ color: '#7e4151' }}>
                  {option}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-green-500/20 rounded-lg p-3 mb-4">
          <p className="text-green-300 text-sm">
            ✓ You voted: {selectedOption}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {!hasVoted && (
          <button
            onClick={handleVote}
            disabled={!selectedOption || timeLeft === 0}
            className="flex-1 enhanced-action-button py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="enhanced-glass-text" style={{ color: '#6a1f33' }}>
              Submit Vote
            </span>
          </button>
        )}
        <button
          onClick={onSelect}
          className="px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors text-sm"
        >
          Details
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// COMPLETED VOTE CARD
// ============================================================================

interface VoteResultDisplay {
  option: string;
  count: number;
  percentage: number;
}

function CompletedVoteCard({ vote }: { vote: Vote }) {
  const [showResults, setShowResults] = useState(false);

  // Parse results from either the expected format or the raw final_results from backend
  const parseResults = (): VoteResultDisplay[] => {
    // If we have properly formatted results array, use it
    if (vote.results && Array.isArray(vote.results) && vote.results.length > 0) {
      return vote.results;
    }

    // Otherwise, try to parse from finalResults (backend format: {yes: 2, no: 0, total: 2, winner: "yes"})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalResults = (vote as any).finalResults || (vote as any).final_results;
    if (finalResults) {
      const parsed = typeof finalResults === 'string' ? JSON.parse(finalResults) : finalResults;
      const total = parsed.total || 0;

      // For yes/no votes
      if (vote.voteType === 'yes_no') {
        const yesCount = parsed.yes || parsed.Yes || 0;
        const noCount = parsed.no || parsed.No || 0;
        return [
          { option: 'Yes', count: yesCount, percentage: total > 0 ? (yesCount / total) * 100 : 0 },
          { option: 'No', count: noCount, percentage: total > 0 ? (noCount / total) * 100 : 0 },
        ];
      }

      // For multiple choice, extract options from the parsed results
      const results: VoteResultDisplay[] = [];
      for (const [key, value] of Object.entries(parsed)) {
        if (!['total', 'winner', 'totalMembers', 'participationRate'].includes(key) && typeof value === 'number') {
          results.push({
            option: key.charAt(0).toUpperCase() + key.slice(1),
            count: value,
            percentage: total > 0 ? (value / total) * 100 : 0,
          });
        }
      }
      return results;
    }

    return [];
  };

  const results = parseResults();
  const winningResult = results.length > 0
    ? results.reduce((prev, curr) => (curr.count > (prev?.count || 0)) ? curr : prev, results[0])
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalResults = (vote as any).finalResults || (vote as any).final_results;
  const parsedFinal = finalResults ? (typeof finalResults === 'string' ? JSON.parse(finalResults) : finalResults) : null;
  const participationRate = vote.participationRate ?? (parsedFinal?.totalMembers ? (parsedFinal.total / parsedFinal.totalMembers) * 100 : undefined);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowResults(!showResults);
  };

  return (
    <div className="enhanced-glass-card">
      <div
        className="cursor-pointer select-none"
        onClick={handleToggle}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span className="enhanced-glass-text text-sm" style={{ color: '#7e4151' }}>
              {vote.topic}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {participationRate !== undefined && (
              <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/60">
                {Math.round(participationRate)}% voted
              </span>
            )}
            <span className="text-xs text-white/50">
              {new Date(vote.completedAt || vote.createdAt).toLocaleDateString()}
            </span>
            <span className="text-white/40 text-sm transition-transform duration-200" style={{ transform: showResults ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
          </div>
        </div>

        {winningResult && (
          <p className="enhanced-glass-subtle text-xs" style={{ color: '#6a1f33' }}>
            Winner: <span className="text-pink-400 font-medium">{winningResult.option}</span>
            {' '}({winningResult.percentage.toFixed(0)}%)
          </p>
        )}
      </div>

      {/* Expanded Results */}
      {showResults && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
          {results.length > 0 ? (
            results.map((result, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="enhanced-glass-text text-xs" style={{ color: '#7e4151' }}>
                      {result.option}
                    </span>
                    <span className="text-xs text-white/60">
                      {result.count} vote{result.count !== 1 ? 's' : ''} ({result.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400"
                      style={{ width: `${result.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-white/50 text-center py-2">
              Detailed results not available
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NEW VOTE INLINE FORM
// ============================================================================

interface NewVoteInlineFormProps {
  groupId: string;
  onClose: () => void;
  onSubmit: (groupId: string, request: ProposeVoteRequest) => Promise<boolean>;
}

function NewVoteInlineForm({ groupId, onClose, onSubmit }: NewVoteInlineFormProps) {
  const [topic, setTopic] = useState('');
  const [argument, setArgument] = useState('');
  const [voteType, setVoteType] = useState<VoteType>('yes_no');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [duration, setDuration] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async () => {
    if (!topic.trim()) return;

    setIsSubmitting(true);
    const request: ProposeVoteRequest = {
      topic: topic.trim(),
      argument: argument.trim() || undefined,
      voteType,
      options: voteType === 'multiple_choice' ? options.filter((o) => o.trim()) : undefined,
      durationSeconds: duration,
    };

    const success = await onSubmit(groupId, request);
    setIsSubmitting(false);

    if (success) {
      onClose();
    }
  };

  return (
    <div className="enhanced-glass-card border-l-4 border-purple-400">
      <div className="flex items-center justify-between mb-4">
        <h4 className="enhanced-glass-heading text-lg" style={{ color: '#784552' }}>
          Create New Vote
        </h4>
        <button
          onClick={onClose}
          className="text-white/50 hover:text-white/80 transition-colors text-xl"
        >
          ×
        </button>
      </div>

      <div className="space-y-4">
        {/* Topic */}
        <div>
          <label className="block enhanced-glass-text text-sm mb-2" style={{ color: '#6a1f33' }}>
            Question *
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-pink-400/50"
            placeholder="What should we decide?"
            maxLength={200}
          />
        </div>

        {/* Argument */}
        <div>
          <label className="block enhanced-glass-text text-sm mb-2" style={{ color: '#6a1f33' }}>
            Context (optional)
          </label>
          <textarea
            value={argument}
            onChange={(e) => setArgument(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-pink-400/50 resize-none"
            placeholder="Provide more context..."
            rows={2}
            maxLength={1000}
          />
        </div>

        {/* Vote Type */}
        <div>
          <label className="block enhanced-glass-text text-sm mb-2" style={{ color: '#6a1f33' }}>
            Vote Type
          </label>
          <div className="flex gap-2">
            {[
              { value: 'yes_no', label: 'Yes/No', icon: '👍' },
              { value: 'multiple_choice', label: 'Multiple Choice', icon: '📋' },
            ].map((type) => (
              <button
                key={type.value}
                onClick={() => setVoteType(type.value as VoteType)}
                className={`flex-1 p-3 rounded-lg border transition-all ${
                  voteType === type.value
                    ? 'bg-gradient-to-r from-pink-400/20 to-purple-400/20 border-pink-400/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <span className="mr-2">{type.icon}</span>
                <span className="enhanced-glass-text text-sm" style={{ color: '#7e4151' }}>
                  {type.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Options for Multiple Choice */}
        {voteType === 'multiple_choice' && (
          <div>
            <label className="block enhanced-glass-text text-sm mb-2" style={{ color: '#6a1f33' }}>
              Options
            </label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-pink-400/50"
                    placeholder={`Option ${index + 1}`}
                    maxLength={100}
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => handleRemoveOption(index)}
                      className="px-3 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {options.length < 10 && (
                <button
                  onClick={handleAddOption}
                  className="text-pink-400 text-sm hover:text-pink-300"
                >
                  + Add Option
                </button>
              )}
            </div>
          </div>
        )}

        {/* Duration */}
        <div>
          <label className="block enhanced-glass-text text-sm mb-2" style={{ color: '#6a1f33' }}>
            Duration: {duration} seconds
          </label>
          <input
            type="range"
            min="30"
            max="300"
            step="30"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full accent-pink-400"
          />
          <div className="flex justify-between text-xs text-white/40 mt-1">
            <span>30s</span>
            <span>5 min</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!topic.trim() || isSubmitting}
          className="flex-1 enhanced-action-button py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="enhanced-glass-text" style={{ color: '#6a1f33' }}>
            {isSubmitting ? 'Creating...' : 'Start Vote'}
          </span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// VOTE DETAIL MODAL
// ============================================================================

interface VoteDetailModalProps {
  vote: Vote;
  groupId: string;
  onClose: () => void;
  onCastVote: (groupId: string, voteId: string, request: { response: string }) => Promise<boolean>;
}

function VoteDetailModal({ vote, onClose }: VoteDetailModalProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg enhanced-glass-panel p-6">
        <h3 className="enhanced-glass-heading text-xl mb-4" style={{ color: '#784552' }}>
          {vote.topic}
        </h3>

        {vote.argument && (
          <p className="enhanced-glass-body mb-4" style={{ color: '#7e4151' }}>
            {vote.argument}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
              Type:
            </span>
            <span className="enhanced-glass-text ml-2 capitalize" style={{ color: '#7e4151' }}>
              {vote.voteType.replace('_', ' ')}
            </span>
          </div>
          <div>
            <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
              Duration:
            </span>
            <span className="enhanced-glass-text ml-2" style={{ color: '#7e4151' }}>
              {vote.durationSeconds}s
            </span>
          </div>
          <div>
            <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
              Proposed by:
            </span>
            <span className="enhanced-glass-text ml-2" style={{ color: '#7e4151' }}>
              {vote.proposerUsername}
            </span>
          </div>
          <div>
            <span className="enhanced-glass-subtle" style={{ color: '#6a1f33' }}>
              Status:
            </span>
            <span className="enhanced-glass-text ml-2 capitalize" style={{ color: '#7e4151' }}>
              {vote.status}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full enhanced-action-button py-2"
        >
          <span className="enhanced-glass-text" style={{ color: '#6a1f33' }}>
            Close
          </span>
        </button>
      </div>
    </div>
  );
}
