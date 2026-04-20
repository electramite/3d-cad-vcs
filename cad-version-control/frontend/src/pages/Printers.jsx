import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const STATE_COLOR = {
  RUNNING: '#22c55e', PAUSE: '#f59e0b', FINISH: '#6366f1',
  FAILED: '#ef4444', IDLE: '#94a3b8', unknown: '#94a3b8'
};

function StatusDot({ state }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: STATE_COLOR[state] || STATE_COLOR.unknown, marginRight: 6
    }} />
  );
}

function PrinterCard({ printer, onDelete, onPrint, onEdit }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSd, setShowSd] = useState(false);
  const [sdFiles, setSdFiles] = useState([]);
  const [sdLoading, setSdLoading] = useState(false);
  const [sdError, setSdError] = useState('');

  const fetchStatus = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await axios.get(`/api/printers/${printer._id}/status`);
      setStatus(data);
    } catch (e) {
      setError(e.response?.data?.message || 'Unreachable');
    }
    setLoading(false);
  }, [printer._id]);

  const loadSdCard = async () => {
    setSdLoading(true); setSdError(''); setSdFiles([]);
    try {
      const { data } = await axios.get(`/api/printers/${printer._id}/sdcard`);
      setSdFiles(data.filter(f => !f.isDirectory && f.name.match(/\.(3mf|gcode|gc)$/i)));
    } catch (e) {
      setSdError(e.response?.data?.message || 'Could not read SD card');
    }
    setSdLoading(false);
  };

  const deleteSdFile = async (filename) => {
    if (!confirm(`Delete "${filename}" from printer SD card?`)) return;
    try {
      await axios.delete(`/api/printers/${printer._id}/sdcard/${encodeURIComponent(filename)}`);
      setSdFiles(f => f.filter(x => x.name !== filename));
    } catch (e) {
      alert(e.response?.data?.message || 'Delete failed');
    }
  };

  const toggleSd = () => {
    if (!showSd) loadSdCard();
    setShowSd(s => !s);
  };

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{printer.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {printer.model} · {printer.ip}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-ghost btn-sm" onClick={() => onEdit(printer)}>✎ Edit IP</button>
          <button className="btn-danger btn-sm" onClick={() => onDelete(printer._id)}>Delete</button>
        </div>
      </div>

      {/* Status */}
      <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>
        {loading && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Connecting...</span>}
        {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>⚠ {error}</span>}
        {status && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                <StatusDot state={status.state} />{status.state}
              </span>
              <button className="btn-ghost btn-sm" onClick={fetchStatus}>↻ Refresh</button>
            </div>
            {status.state === 'RUNNING' && (
              <>
                <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${status.progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
                  <span>{status.progress}% complete</span>
                  <span>~{status.remainingTime} min left</span>
                </div>
              </>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>🌡 Nozzle: {status.nozzleTemp}°C</span>
              <span>🛏 Bed: {status.bedTemp}°C</span>
              {status.currentFile && <span>📄 {status.currentFile}</span>}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary btn-sm" onClick={() => onPrint(printer)}>
          🖨 Send File to Print
        </button>
        <button className="btn-ghost btn-sm" onClick={toggleSd}>
          💾 {showSd ? 'Hide' : 'SD Card'}
        </button>
      </div>

      {/* SD Card browser */}
      {showSd && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              SD Card Files
            </span>
            <button className="btn-ghost btn-sm" onClick={loadSdCard} style={{ fontSize: 11 }}>↻ Refresh</button>
          </div>
          {sdLoading && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Reading SD card...</p>}
          {sdError && <p style={{ fontSize: 13, color: 'var(--danger)' }}>⚠ {sdError}</p>}
          {!sdLoading && sdFiles.length === 0 && !sdError && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No .3mf or .gcode files found</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
            {sdFiles.map(f => (
              <div key={f.name} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6, fontSize: 12
              }}>
                <span style={{ flex: 1, fontFamily: 'monospace', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </span>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  {f.size ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : ''}
                </span>
                <button
                  className="btn-danger btn-sm"
                  style={{ fontSize: 10, padding: '2px 7px', flexShrink: 0 }}
                  onClick={() => deleteSdFile(f.name)}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Printers() {
  const [printers, setPrinters] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [editPrinter, setEditPrinter] = useState(null); // printer being edited
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [form, setForm] = useState({ name: '', ip: '', serial: '', accessCode: '', model: 'X1C', agentToken: '' });
  const [printForm, setPrintForm] = useState({ versionId: '', useAms: false, bedLeveling: true, timelapse: false });
  const [versions, setVersions] = useState([]);
  const [printing, setPrinting] = useState(false);
  const [printStep, setPrintStep] = useState('idle'); // 'idle' | 'uploading' | 'uploaded' | 'starting' | 'done' | 'error'
  const [printResult, setPrintResult] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  const load = () => axios.get('/api/printers').then(r => setPrinters(r.data));
  useEffect(() => { load(); }, []);

  // Load all versions for the print modal
  const loadVersions = async () => {
    const { data: products } = await axios.get('/api/products');
    const all = [];
    for (const p of products) {
      const { data: parts } = await axios.get(`/api/parts/product/${p._id}`);
      for (const part of parts) {
        const { data: vers } = await axios.get(`/api/gcodes/part/${part._id}`);
        vers.filter(v => v.fileType === '3mf').forEach(v =>
          all.push({ ...v, label: `${p.name} › ${part.name} › ${v.version} (${v.originalName})` })
        );
      }
    }
    setVersions(all);
  };

  const addPrinter = async (e) => {
    e.preventDefault();
    await axios.post('/api/printers', form);
    setForm({ name: '', ip: '', serial: '', accessCode: '', model: 'X1C', agentToken: '' });
    setShowAdd(false);
    load();
  };

  const deletePrinter = async (id) => {
    if (!confirm('Remove this printer?')) return;
    await axios.delete(`/api/printers/${id}`);
    load();
  };

  const openEdit = (printer) => setEditPrinter({ ...printer });

  const saveEdit = async (e) => {
    e.preventDefault();
    await axios.put(`/api/printers/${editPrinter._id}`, {
      name: editPrinter.name,
      ip: editPrinter.ip,
      serial: editPrinter.serial,
      accessCode: editPrinter.accessCode,
      model: editPrinter.model,
      agentToken: editPrinter.agentToken
    });
    setEditPrinter(null);
    load();
  };

  const openPrint = (printer) => {
    setSelectedPrinter(printer);
    setPrintResult('');
    setPrintStep('idle');
    setUploadedFileName('');
    setPrintForm({ versionId: '', useAms: false, bedLeveling: true, timelapse: false });
    loadVersions();
    setShowPrint(true);
  };

  const sendFile = async (e) => {
    e.preventDefault();
    if (!printForm.versionId) return;
    setPrintStep('uploading');
    setPrintResult('');
    try {
      const { data } = await axios.post(
        `/api/printers/${selectedPrinter._id}/upload/${printForm.versionId}`
      );
      setUploadedFileName(data.remoteFileName);
      setPrintStep('uploaded');
      setPrintResult('✓ File sent to printer SD card');
    } catch (e) {
      setPrintStep('error');
      setPrintResult(`✗ ${e.response?.data?.message || 'Upload failed'}`);
    }
  };

  const startPrint = async () => {
    setPrintStep('starting');
    try {
      await axios.post(`/api/printers/${selectedPrinter._id}/startprint`, {
        remoteFileName: uploadedFileName,
        versionId: printForm.versionId,
        useAms: printForm.useAms,
        bedLeveling: printForm.bedLeveling,
        timelapse: printForm.timelapse
      });
      setPrintStep('done');
      setPrintResult('✓ Print started successfully');
    } catch (e) {
      setPrintStep('error');
      setPrintResult(`✗ ${e.response?.data?.message || 'Failed to start print'}`);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Printers</h1>
          <p className="page-subtitle">{printers.length} printer{printers.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Printer</button>
      </div>

      <div className="grid">
        {printers.map(p => (
          <PrinterCard key={p._id} printer={p} onDelete={deletePrinter} onPrint={openPrint} onEdit={openEdit} />
        ))}
        {printers.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state-icon">🖨</div>
            <p>No printers added yet. Add your Bambu Lab printer to get started.</p>
          </div>
        )}
      </div>

      {/* Add Printer Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Bambu Lab Printer</h2>
            <form onSubmit={addPrinter}>
              <div className="form-group">
                <label>Printer Name</label>
                <input placeholder="e.g. Workshop X1C" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Model</label>
                <select value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}>
                  {['X1C', 'X1E', 'P1P', 'P1S', 'A1', 'A1 Mini'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Printer IP Address</label>
                <input placeholder="192.168.1.x" value={form.ip} onChange={e => setForm({ ...form, ip: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Serial Number</label>
                <input placeholder="Found in Settings on printer screen" value={form.serial} onChange={e => setForm({ ...form, serial: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Access Code</label>
                <input placeholder="Found in Settings → LAN mode" value={form.accessCode} onChange={e => setForm({ ...form, accessCode: e.target.value })} required />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Find Serial & Access Code on the printer: Settings → Network → LAN Mode Liveview
              </p>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Remote Access (optional)
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Agent Token</label>
                  <input
                    placeholder="Leave empty if portal is on same network"
                    value={form.agentToken}
                    onChange={e => setForm({ ...form, agentToken: e.target.value })}
                  />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Run the local agent on your workshop PC and paste the same token here to enable remote printing from anywhere.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Printer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPrint && selectedPrinter && (
        <div className="modal-overlay" onClick={() => setShowPrint(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Send to {selectedPrinter.name}</h2>

            <form onSubmit={sendFile}>
              <div className="form-group">
                <label>Select File (3MF only)</label>
                <select
                  value={printForm.versionId}
                  onChange={e => { setPrintForm({ ...printForm, versionId: e.target.value }); setPrintStep('idle'); setUploadedFileName(''); setPrintResult(''); }}
                  required
                  disabled={printStep === 'uploading' || printStep === 'starting' || printStep === 'done'}
                >
                  <option value="">— choose a version —</option>
                  {versions.map(v => <option key={v._id} value={v._id}>{v.label}</option>)}
                </select>
                {versions.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>No .3mf versions found.</p>
                )}
              </div>

              {/* Print options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {[
                  { key: 'bedLeveling', label: 'Bed Leveling' },
                  { key: 'useAms', label: 'Use AMS (multi-color)' },
                  { key: 'timelapse', label: 'Record Timelapse' }
                ].map(opt => (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={printForm[opt.key]}
                      onChange={e => setPrintForm({ ...printForm, [opt.key]: e.target.checked })}
                      style={{ width: 16, height: 16 }}
                      disabled={printStep === 'uploading' || printStep === 'starting' || printStep === 'done'}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              {/* Status message */}
              {printResult && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
                  background: printResult.startsWith('✓') ? '#d4ede3' : '#fdf0ef',
                  color: printResult.startsWith('✓') ? 'var(--success)' : 'var(--danger)',
                  border: `1px solid ${printResult.startsWith('✓') ? '#a8d5bc' : '#f5c6c2'}`
                }}>
                  {printResult}
                </div>
              )}

              {/* Step indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <StepDot active={['uploading','uploaded','starting','done'].includes(printStep)} done={['uploaded','starting','done'].includes(printStep)} label="1. Send File" />
                <div style={{ flex: 1, height: 1, background: ['uploaded','starting','done'].includes(printStep) ? 'var(--accent)' : 'var(--border)' }} />
                <StepDot active={['starting','done'].includes(printStep)} done={printStep === 'done'} label="2. Start Print" />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowPrint(false)}>Close</button>

                {/* Step 1 button — send file */}
                {(printStep === 'idle' || printStep === 'error') && (
                  <button type="submit" className="btn-primary" disabled={!printForm.versionId || printStep === 'uploading'}>
                    {printStep === 'uploading' ? 'Sending...' : '📤 Send File to Printer'}
                  </button>
                )}

                {printStep === 'uploading' && (
                  <button className="btn-primary" disabled>⟳ Uploading...</button>
                )}

                {/* Step 2 button — start print */}
                {printStep === 'uploaded' && (
                  <button type="button" className="btn-primary" onClick={startPrint}>
                    🖨 Start Print
                  </button>
                )}

                {printStep === 'starting' && (
                  <button className="btn-primary" disabled>⟳ Starting...</button>
                )}

                {printStep === 'done' && (
                  <button type="button" className="btn-ghost" onClick={() => { setPrintStep('idle'); setUploadedFileName(''); setPrintResult(''); }}>
                    Send Another
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Printer Modal */}
      {editPrinter && (
        <div className="modal-overlay" onClick={() => setEditPrinter(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Edit Printer</h2>
            <form onSubmit={saveEdit}>
              <div className="form-group">
                <label>Printer Name</label>
                <input value={editPrinter.name} onChange={e => setEditPrinter({ ...editPrinter, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Model</label>
                <select value={editPrinter.model} onChange={e => setEditPrinter({ ...editPrinter, model: e.target.value })}>
                  {['X1C', 'X1E', 'P1P', 'P1S', 'A1', 'A1 Mini'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>IP Address</label>
                <input value={editPrinter.ip} onChange={e => setEditPrinter({ ...editPrinter, ip: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Serial Number</label>
                <input value={editPrinter.serial} onChange={e => setEditPrinter({ ...editPrinter, serial: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Access Code</label>
                <input value={editPrinter.accessCode} onChange={e => setEditPrinter({ ...editPrinter, accessCode: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Agent Token (optional)</label>
                <input value={editPrinter.agentToken || ''} onChange={e => setEditPrinter({ ...editPrinter, agentToken: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setEditPrinter(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function StepDot({ active, done, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700,
        background: done ? 'var(--accent)' : active ? 'var(--gold)' : 'var(--surface2)',
        color: (done || active) ? '#fff' : 'var(--text-muted)',
        border: `2px solid ${done ? 'var(--accent)' : active ? 'var(--gold)' : 'var(--border)'}`
      }}>
        {done ? '✓' : active ? '●' : '○'}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}
