// client/src/components/home/MyJournalPanel.tsx
// Wrapper component for the Journal section in the main dashboard

import JournalTab from '../journal/JournalTab';

export function MyJournalPanel() {
  return (
    <div className="enhanced-glass-panel enhanced-panel-myjournal relative flex items-center justify-center">
      <JournalTab />
    </div>
  );
}

export default MyJournalPanel;
