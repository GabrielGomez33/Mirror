// ============================================================================
// STUDENTS PAGE
// ============================================================================
// File: pages/StudentsPage.tsx
// Canonical authenticated surface for claiming student Premium. Public CTAs
// and the re-verify emails point here (/students). It simply frames the
// StudentAccessCard, which handles all state (form / sent / already-active).
// ============================================================================


import { useNavigate } from 'react-router-dom';
import StudentAccessCard from '../components/paywall/StudentAccessCard';

export default function StudentsPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#0a0a0f' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ color: '#fff', fontSize: 28, margin: 0 }}>Mirror for students</h1>
          <p style={{ color: '#888', fontSize: 15, marginTop: 8 }}>
            Full Premium, free while you're enrolled.
          </p>
        </div>

        <StudentAccessCard />

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', fontSize: 14 }}
          >
            ← Back to Mirror
          </button>
        </div>
      </div>
    </div>
  );
}
