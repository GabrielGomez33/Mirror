// src/pages/Dashboard.tsx
// Main dashboard — zen scene + magical sphere orb navigation only
// All content panels (MyJournal, MyMirror, TruthStream, MirrorGroups) are now
// their own dedicated pages accessible via sphere navigation.

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/enhanced-glass.css';
import ZenGardenScene from '../components/three/ZenGardenScene';
import MagicalSphereNavigation from '../components/home/MagicalSphereNavigation';
import { useGroups } from '../context/GroupContext';
import CreateGroupModal from '../components/mirrorgroups/CreateGroupModal';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Dashboard() {
  const navigate = useNavigate();

  const {
    showCreateModal,
    setShowCreateModal,
  } = useGroups();

  const handleGroupCreated = useCallback((_groupId: string) => {
    navigate('/groups');
  }, [navigate]);

  const handlePanelChange = useCallback((panelId: string) => {
    switch (panelId) {
      case 'myjournal':
        navigate('/journal');
        break;
      case 'mymirror':
        navigate('/mymirror');
        break;
      case 'truthstream':
        navigate('/truthstream');
        break;
      case 'mirrorgroups':
        navigate('/groups');
        break;
      default:
        break;
    }
  }, [navigate]);

  return (
    <>
      {/* Global scrollbar hide for dashboard */}
      <style>{`
        .dashboard-root { scrollbar-width: none; -ms-overflow-style: none; }
        .dashboard-root::-webkit-scrollbar { display: none; }
        .dashboard-root *, .dashboard-root *::before, .dashboard-root *::after {
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .dashboard-root *::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        className="dashboard-root"
        style={{
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background layers */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, #fff1f2, #fce7f3, #f3e8ff)',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <ZenGardenScene />
        </div>

        {/* Sphere Navigation — the sole interactive element on dashboard */}
        <MagicalSphereNavigation
          activePanel=""
          onPanelChange={handlePanelChange}
        />

        {/* Create Group Modal (can be triggered from group context) */}
        {showCreateModal && (
          <CreateGroupModal
            onClose={() => setShowCreateModal(false)}
            onGroupCreated={handleGroupCreated}
          />
        )}
      </div>
    </>
  );
}
