// ============================================================================
// DATA EXPORT TAB — Generates and downloads a comprehensive PDF report
// ============================================================================
// Fetches all user data from GET /user/export, renders a styled HTML preview,
// and converts to PDF via html2pdf.js (client-side, zero server load).
// ============================================================================

import React, { useState, useRef } from 'react';

const THEME = {
  heading: '#3d1428',
  body: '#2e1018',
  subtle: '#6b4050',
  muted: '#8a6070',
  accent: '#c6469b',
  bg: '#fdf2f4',
  cardBg: '#fff',
  border: '#e8c4d0',
};

interface ExportData {
  exportDate: string;
  username: string;
  sections: Record<string, { title: string; data: any; count?: number }>;
}

export default function DataExportTab() {
  const [loading, setLoading] = useState(false);
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const fetchExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('mirror_jwt');
      const res = await fetch('/mirror/api/user/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const data = await res.json();
      setExportData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate export');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!reportRef.current || !exportData) return;
    setDownloading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `Mirror-Export-${exportData.username}-${new Date().toISOString().split('T')[0]}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        } as any)
        .from(reportRef.current)
        .save();
    } catch (err: any) {
      setError('PDF generation failed. Try again.');
      console.error('PDF error:', err);
    } finally {
      setDownloading(false);
    }
  };

  // ========================================================================
  // PRE-EXPORT STATE
  // ========================================================================

  if (!exportData) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📥</div>
        <h3 style={{ fontFamily: "'Poppins', sans-serif", color: THEME.heading, fontSize: '1.3rem', marginBottom: '8px' }}>
          Export Your Data
        </h3>
        <p style={{ fontFamily: "'Inter', sans-serif", color: THEME.muted, fontSize: '0.85rem', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
          Download a comprehensive PDF report containing all your Mirror data — profile, journal entries,
          analysis reports, group memberships, TruthStream reviews, and more.
        </p>
        {error && (
          <p style={{ color: '#dc2626', fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', marginBottom: '12px' }}>{error}</p>
        )}
        <button
          onClick={fetchExport}
          disabled={loading}
          style={{
            padding: '12px 32px',
            borderRadius: '9999px',
            border: 'none',
            background: loading ? '#ccc' : `linear-gradient(135deg, ${THEME.accent}, #ff1493)`,
            color: '#fff',
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="animate-spin" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />
              Generating report...
            </span>
          ) : 'Generate Export'}
        </button>
      </div>
    );
  }

  // ========================================================================
  // REPORT PREVIEW + DOWNLOAD
  // ========================================================================

  const { sections } = exportData;

  return (
    <div>
      {/* Download bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p style={{ fontFamily: "'Inter', sans-serif", color: THEME.subtle, fontSize: '0.8rem' }}>
          Generated {new Date(exportData.exportDate).toLocaleString()}
        </p>
        <button
          onClick={downloadPDF}
          disabled={downloading}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 20px',
            borderRadius: '9999px',
            border: 'none',
            background: `linear-gradient(135deg, ${THEME.accent}, #ff1493)`,
            color: '#fff',
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: downloading ? 'default' : 'pointer',
            opacity: downloading ? 0.7 : 1,
          }}
        >
          {downloading ? (
            <>
              <span className="animate-spin" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />
              Creating PDF...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF
            </>
          )}
        </button>
      </div>

      {/* Report content (this div gets converted to PDF) */}
      <div ref={reportRef} style={{ background: THEME.bg, padding: '24px', borderRadius: '16px', fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: `2px solid ${THEME.border}`, paddingBottom: '16px' }}>
          <h1 style={{ fontFamily: "'Poppins', sans-serif", color: THEME.heading, fontSize: '1.5rem', margin: 0 }}>
            Mirror Data Export
          </h1>
          <p style={{ color: THEME.muted, fontSize: '0.8rem', marginTop: '4px' }}>
            {exportData.username} &mdash; {new Date(exportData.exportDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Sections */}
        {Object.entries(sections).map(([key, section]) => (
          <ReportSection key={key} section={section} sectionKey={key} />
        ))}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '16px', borderTop: `1px solid ${THEME.border}` }}>
          <p style={{ color: THEME.muted, fontSize: '0.7rem' }}>
            Mirror &mdash; Self-reflection and personal growth platform
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// REPORT SECTION RENDERER
// ============================================================================

function ReportSection({ section, sectionKey }: { section: { title: string; data: any; count?: number }; sectionKey: string }) {
  if (!section.data || (Array.isArray(section.data) && section.data.length === 0)) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: "'Poppins', sans-serif", color: THEME.heading, fontSize: '1rem', marginBottom: '4px' }}>
          {section.title}
        </h2>
        <p style={{ color: THEME.muted, fontSize: '0.75rem', fontStyle: 'italic' }}>No data available</p>
      </div>
    );
  }

  // Profile section — key-value pairs
  if (sectionKey === 'profile' || sectionKey === 'subscription' || sectionKey === 'truthStreamProfile') {
    return (
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: "'Poppins', sans-serif", color: THEME.heading, fontSize: '1rem', marginBottom: '8px' }}>
          {section.title}
        </h2>
        <div style={{ background: THEME.cardBg, borderRadius: '12px', padding: '12px', border: `1px solid ${THEME.border}` }}>
          {Object.entries(section.data).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${THEME.border}22` }}>
              <span style={{ color: THEME.subtle, fontSize: '0.75rem', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
              <span style={{ color: THEME.body, fontSize: '0.75rem', fontWeight: 500, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-word' }}>
                {formatValue(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Array sections — journal entries, analysis reports, reviews, etc.
  if (Array.isArray(section.data)) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: "'Poppins', sans-serif", color: THEME.heading, fontSize: '1rem', marginBottom: '4px' }}>
          {section.title}
          {section.count !== undefined && (
            <span style={{ color: THEME.muted, fontSize: '0.75rem', fontWeight: 400, marginLeft: '8px' }}>({section.count})</span>
          )}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {section.data.slice(0, 50).map((item: any, i: number) => (
            <div key={i} style={{ background: THEME.cardBg, borderRadius: '10px', padding: '10px 12px', border: `1px solid ${THEME.border}`, fontSize: '0.72rem' }}>
              {renderItem(item, sectionKey)}
            </div>
          ))}
          {section.data.length > 50 && (
            <p style={{ color: THEME.muted, fontSize: '0.7rem', textAlign: 'center' }}>
              ...and {section.data.length - 50} more entries
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================================
// ITEM RENDERERS
// ============================================================================

function renderItem(item: any, sectionKey: string): React.ReactElement {
  switch (sectionKey) {
    case 'journal':
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: THEME.heading, fontWeight: 600 }}>{item.entry_date}</span>
            <span style={{ color: THEME.muted }}>{item.time_of_day} &middot; Mood: {item.mood_rating}/10</span>
          </div>
          <div style={{ color: THEME.subtle }}>
            {item.primary_emotion && <span>Feeling: {item.primary_emotion} ({item.emotion_intensity}/10) &middot; </span>}
            Energy: {item.energy_level}/10 &middot; {item.word_count} words
          </div>
          {item.free_form_entry && (
            <p style={{ color: THEME.body, marginTop: '4px', lineHeight: 1.4 }}>
              {item.free_form_entry.substring(0, 200)}{item.free_form_entry.length > 200 ? '...' : ''}
            </p>
          )}
        </div>
      );

    case 'personalAnalysis':
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: THEME.heading, fontWeight: 600, textTransform: 'capitalize' }}>{item.analysis_type?.replace(/_/g, ' ')}</span>
            <span style={{ color: THEME.muted }}>{new Date(item.created_at).toLocaleDateString()}</span>
          </div>
          {item.overall_score && <div style={{ color: THEME.accent, marginTop: '2px' }}>Score: {(item.overall_score * 100).toFixed(0)}% &middot; Confidence: {(item.confidence_level * 100).toFixed(0)}%</div>}
          {item.analysis_data?.summary && <p style={{ color: THEME.body, marginTop: '4px', lineHeight: 1.4 }}>{item.analysis_data.summary.substring(0, 300)}...</p>}
        </div>
      );

    case 'reviewsReceived':
    case 'reviewsGiven':
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: THEME.heading, fontWeight: 600 }}>{item.classification || 'Review'}</span>
            <span style={{ color: THEME.muted }}>{new Date(item.created_at).toLocaleDateString()}</span>
          </div>
          <div style={{ color: THEME.subtle }}>
            Quality: {item.quality_score ? `${(item.quality_score * 100).toFixed(0)}%` : 'N/A'}
            {item.helpful_count > 0 && ` &middot; ${item.helpful_count} found helpful`}
          </div>
        </div>
      );

    case 'groups':
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: THEME.heading, fontWeight: 600 }}>{item.name}</span>
          <span style={{ color: THEME.muted }}>{item.role} &middot; {item.type} &middot; Joined {new Date(item.joined_at).toLocaleDateString()}</span>
        </div>
      );

    case 'milestones':
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: THEME.heading, fontWeight: 600 }}>{item.milestone_name}</span>
          <span style={{ color: THEME.muted }}>{new Date(item.achieved_at).toLocaleDateString()}</span>
        </div>
      );

    default:
      return (
        <div style={{ color: THEME.body }}>
          {Object.entries(item).slice(0, 6).map(([k, v]) => (
            <span key={k} style={{ marginRight: '12px' }}>
              <span style={{ color: THEME.subtle }}>{k.replace(/_/g, ' ')}: </span>
              <span>{formatValue(v)}</span>
            </span>
          ))}
        </div>
      );
  }
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
    try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
  }
  if (typeof value === 'object') return JSON.stringify(value).substring(0, 100);
  return String(value);
}
