import { useState, useEffect } from 'react';
import axios from 'axios';

const STATUS_STYLE = {
  finished: { bg: '#d4ede3', color: '#2d5040', label: '✓ Finished' },
  failed:   { bg: '#fdf0ef', color: '#c0392b', label: '✗ Failed' },
  running:  { bg: '#e8f0eb', color: '#2d5040', label: '⟳ Running' },
  started:  { bg: '#f5e9d8', color: '#8a6535', label: '↑ Started' },
  cancelled:{ bg: '#f0f0f0', color: '#666',    label: '— Cancelled' }
};

function StatCard({ label, value, sub }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function PrintLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('');

  const load = async () => {
    const params = filter ? `?status=${filter}` : '';
    const [logsRes, statsRes] = await Promise.all([
      axios.get(`/api/printlogs${params}`),
      axios.get('/api/printlogs/stats')
    ]);
    setLogs(logsRes.data);
    setStats(statsRes.data);
  };

  useEffect(() => { load(); }, [filter]);

  const fmtDate = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtDur = (min) => min >= 60 ? `${Math.floor(min/60)}h ${min%60}m` : `${min}m`;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Print Logs</h1>
          <p className="page-subtitle">Material usage and print history across all printers</p>
        </div>
        <button className="btn-ghost" onClick={load}>↻ Refresh</button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
          <StatCard label="Total Prints" value={stats.total} />
          <StatCard label="Success Rate" value={`${stats.successRate}%`} sub={`${stats.finished} finished`} />
          <StatCard label="Failed" value={stats.failed} sub="prints" />
          <StatCard label="Filament Used" value={`${stats.totalFilamentGrams}g`} sub={`${(stats.totalFilamentMm / 1000).toFixed(1)}m total`} />
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['', 'running', 'finished', 'failed', 'cancelled'].map(s => (
          <button
            key={s}
            className={filter === s ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
            onClick={() => setFilter(s)}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Log table */}
      <div className="version-list">
        <div className="version-list-header" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 90px 90px 80px', gap: 12 }}>
          <span>File</span>
          <span>Printer</span>
          <span>Status</span>
          <span>Duration</span>
          <span>Filament</span>
          <span>Date</span>
        </div>

        {logs.length === 0 && (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No print logs yet. Start a print from the Printers tab.
          </div>
        )}

        {logs.map(log => {
          const s = STATUS_STYLE[log.status] || STATUS_STYLE.started;
          return (
            <div key={log._id} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 100px 90px 90px 80px',
              gap: 12,
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center',
              fontSize: 13
            }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{log.fileName || log.version?.originalName || '—'}</div>
                {log.version?.version && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.version.version}</div>
                )}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                {log.printer?.name || '—'}
                <div style={{ fontSize: 11 }}>{log.printer?.model}</div>
              </div>
              <div>
                <span style={{
                  display: 'inline-block', padding: '3px 8px', borderRadius: 999,
                  fontSize: 11, fontWeight: 700,
                  background: s.bg, color: s.color
                }}>{s.label}</span>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                {log.durationMinutes ? fmtDur(log.durationMinutes) : '—'}
              </div>
              <div>
                {log.filamentUsedGrams > 0 ? (
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{log.filamentUsedGrams}g</span>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(log.filamentUsedMm / 1000).toFixed(1)}m</div>
                  </div>
                ) : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {fmtDate(log.startedAt)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
