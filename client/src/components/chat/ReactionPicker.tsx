// src/components/chat/ReactionPicker.tsx
// Quick emoji reaction picker

import { QUICK_REACTIONS } from '../../types/chat';

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function ReactionPicker({ onSelect }: ReactionPickerProps) {
  return (
    <div className="chat-reaction-picker" onClick={(e) => e.stopPropagation()}>
      {QUICK_REACTIONS.map((reaction) => (
        <button
          key={reaction.emoji}
          className="chat-reaction-option"
          onClick={() => onSelect(reaction.emoji)}
          title={reaction.label}
          aria-label={reaction.label}
        >
          {reaction.emoji}
        </button>
      ))}
    </div>
  );
}
