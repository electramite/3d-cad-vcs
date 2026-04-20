import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import GCodeRenderer from '../components/GCodeRenderer';
import StlViewer from '../components/StlViewer';
import GCodeInfo from '../components/GCodeInfo';

export default function PartDetail() {
  const { partId } = useParams();
  const [part, setPart] = useState(null);
  const [tab, setTab] = useState('gcode'); // 'gcode' | 'stl'

  // G-code state
  const [versions, setVersions] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [gcodePartName, setGcodePartName] = useState('');
  const [gcodeUnits, setGcodeUnits] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [gcodeContent, setGcodeContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);

  // STL state
  const [stlVersions, setStlVersions] = useState([]);
  const [showStlUpload, setShowStlUpload] = useState(false);
  const [stlFile, setStlFile] = useState(null);
  const [stlNotes, setStlNotes] = useState('');
  const [stlPartName, setStlPartName] = useState('');
  const [stlUploading, setStlUploading] = useState(false);
  const [selectedStl, setSelectedStl] = useState(null);

  useEffect(() => {
    axios.get(`/api/parts/${partId}`).then(r => {
      setPart(r.data);
      setGcodePartName(r.data.name);
      setStlPartName(r.data.name);
    });
    loadVersions();
    loadStlVersions();
  }, [partId]);

  const loadVersions = () =>
    axios.get(`/api/gcodes/part/${partId}`).then(r => {
      setVersions(r.data);
      if (r.data.length > 0) selectVersion(r.data[0]);
    });

  const loadStlVersions = () =>
    axios.get(`/api/stl/part/${partId}`).then(r => {
      setStlVersions(r.data);
      if (r.data.length > 0) setSelectedStl(r.data[0]);
    });

  const selectVersion = async (v) => {
    setSelected(v);
    setLoadingContent(true);
    setGcodeContent('');
    try {
      const res = await axios.get(`/api/gcodes/${v._id}/content`, { responseType: 'text' });
      setGcodeContent(res.data);
    } catch { setGcodeContent(''); }
    setLoadingContent(false);
  };

  const download = async (v, type = 'gcode') => {
    try {
      const token = localStorage.getItem('cad_token');
      const url = type === 'stl' ? `/api/stl/${v._id}/download` : `/api/gcodes/${v._id}/download`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = v.originalName;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { alert('Download failed'); }
  };

  const uploadGcode = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    // Build formatted name: {partName}_{units}units_{version}.3mf
    const nextVersion = `v${versions.length + 1}.0`;
    const safeName = gcodePartName.trim().replace(/\s+/g, '_');
    const formattedName = `${safeName}_${gcodeUnits}units_${nextVersion}${file.name.match(/\.[^.]+$/)?.[0] || ''}`;
    const renamedFile = new File([file], formattedName, { type: file.type });
    const fd = new FormData();
    fd.append('file', renamedFile);
    fd.append('notes', notes);
    fd.append('displayName', formattedName);
    try {
      await axios.post(`/api/gcodes/part/${partId}`, fd);
      setFile(null); setNotes(''); setGcodeUnits(1); setShowUpload(false);
      loadVersions();
    } catch (err) { alert(err.response?.data?.message || 'Upload failed'); }
    setUploading(false);
  };

  const uploadStl = async (e) => {
    e.preventDefault();
    if (!stlFile) return;
    setStlUploading(true);
    // Build formatted name: {partName}_{version}.stl
    const nextVersion = `v${stlVersions.length + 1}.0`;
    const safeName = stlPartName.trim().replace(/\s+/g, '_');
    const formattedName = `${safeName}_${nextVersion}.stl`;
    const renamedFile = new File([stlFile], formattedName, { type: stlFile.type });
    const fd = new FormData();
    fd.append('file', renamedFile);
    fd.append('notes', stlNotes);
    try {
      await axios.post(`/api/stl/part/${partId}`, fd);
      setStlFile(null); setStlNotes(''); setShowStlUpload(false);
      loadStlVersions();
    } catch (err) { alert(err.response?.data?.message || 'Upload failed'); }
    setStlUploading(false);
  };

  const removeGcode = async (id) => {
    if (!confirm('Delete this version?')) return;
    await axios.delete(`/api/gcodes/${id}`);
    if (selected?._id === id) { setSelected(null); setGcodeContent(''); }
    loadVersions();
  };

  const removeStl = async (id) => {
    if (!confirm('Delete this STL version?')) return;
    await axios.delete(`/api/stl/${id}`);
    if (selectedStl?._id === id) setSelectedStl(null);
    loadStlVersions();
  };

  const fmt = (b) => !b ? '—' : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  if (!part) return <p style={{ color: 'var(--text-muted-dark)' }}>Loading...</p>;

  return (
    <>
      <div className="breadcrumb">
        <Link to="/products">Products</Link>
        <span className="breadcrumb-sep">›</span>
        <Link to={`/products/${part.product?._id}`}>{part.product?.name || 'Product'}</Link>
        <span className="breadcrumb-sep">›</span>
        <span style={{ color: 'var(--text-on-dark)' }}>{part.name}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{part.name}</h1>
          {part.description && <p className="page-subtitle">{part.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'gcode'
            ? <button className="btn-primary" onClick={() => { setGcodePartName(part?.name || ''); setGcodeUnits(1); setShowUpload(true); }}>↑ Upload G-Code</button>
            : <button className="btn-primary" onClick={() => { setStlPartName(part?.name || ''); setShowStlUpload(true); }}>↑ Upload STL</button>
          }
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border-dark)', paddingBottom: 0 }}>
        {[
          { key: 'gcode', label: `G-Code / 3MF (${versions.length})` },
          { key: 'stl',   label: `STL Files (${stlVersions.length})` }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'transparent', border: 'none', borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
              color: tab === t.key ? 'var(--text-on-dark)' : 'var(--text-muted-dark)',
              padding: '8px 16px', fontWeight: tab === t.key ? 700 : 400,
              fontSize: 14, cursor: 'pointer', borderRadius: 0, marginBottom: -1
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* G-Code Tab */}
      {tab === 'gcode' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
          <VersionList
            versions={versions} selected={selected}
            onSelect={selectVersion} onDelete={removeGcode} onDownload={v => download(v, 'gcode')}
            fmt={fmt} fmtDate={fmtDate}
          />
          <div>
            {selected ? (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>{selected.originalName}</span>
                    <span className="badge badge-gold">{selected.version}</span>
                  </div>
                  <button className="btn-ghost btn-sm" onClick={() => download(selected, 'gcode')}>↓ Download</button>
                </div>
                {loadingContent
                  ? <div style={{ height: 520, background: '#111318', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading preview...</div>
                  : <GCodeRenderer content={gcodeContent} />
                }
                <GCodeInfo content={gcodeContent} />
                {selected.notes && <NoteBox note={selected.notes} />}
              </div>
            ) : <EmptyViewer label="Select a version to preview" />}
          </div>
        </div>
      )}

      {/* STL Tab */}
      {tab === 'stl' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
          <VersionList
            versions={stlVersions} selected={selectedStl}
            onSelect={setSelectedStl} onDelete={removeStl} onDownload={v => download(v, 'stl')}
            fmt={fmt} fmtDate={fmtDate}
          />
          <div>
            {selectedStl ? (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>{selectedStl.originalName}</span>
                    <span className="badge badge-gold">{selectedStl.version}</span>
                  </div>
                  <button className="btn-ghost btn-sm" onClick={() => download(selectedStl, 'stl')}>↓ Download</button>
                </div>
                <StlViewer versionId={selectedStl._id} />
                {selectedStl.notes && <NoteBox note={selectedStl.notes} />}
              </div>
            ) : <EmptyViewer label="Select an STL version to preview" />}
          </div>
        </div>
      )}

      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Upload G-Code / 3MF Version</h2>
            <form onSubmit={uploadGcode}>
              <div className="form-group">
                <label>Part Name</label>
                <input value={gcodePartName} onChange={e => setGcodePartName(e.target.value)} required placeholder="e.g. Phone Stand Base" />
              </div>
              <div className="form-group">
                <label>No. of Units in Sliced File</label>
                <input type="number" min="1" value={gcodeUnits} onChange={e => setGcodeUnits(e.target.value)} required />
              </div>
              {/* Live filename preview */}
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, fontWeight: 700 }}>File will be saved as</div>
                <div style={{ fontFamily: 'monospace', color: 'var(--gold)', fontWeight: 600 }}>
                  {gcodePartName.trim().replace(/\s+/g, '_') || 'PartName'}_{gcodeUnits}units_v{versions.length + 1}.0
                  {file ? file.name.match(/\.[^.]+$/)?.[0] : '.3mf'}
                </div>
              </div>
              <div className="form-group">
                <label>File (.gcode, .3mf, .nc, .mf)</label>
                <input type="file" accept=".gcode,.gc,.mf,.3mf,.nc,.tap,.txt"
                  onChange={e => setFile(e.target.files[0])} required
                  style={{ padding: '8px 0', background: 'transparent', border: 'none', boxShadow: 'none' }} />
              </div>
              <div className="form-group">
                <label>Version Notes</label>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What changed in this version?" />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStlUpload && (
        <div className="modal-overlay" onClick={() => setShowStlUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Upload STL Version</h2>
            <form onSubmit={uploadStl}>
              <div className="form-group">
                <label>Part Name</label>
                <input value={stlPartName} onChange={e => setStlPartName(e.target.value)} required placeholder="e.g. Phone Stand Base" />
              </div>
              {/* Live filename preview */}
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, fontWeight: 700 }}>File will be saved as</div>
                <div style={{ fontFamily: 'monospace', color: 'var(--gold)', fontWeight: 600 }}>
                  {stlPartName.trim().replace(/\s+/g, '_') || 'PartName'}_v{stlVersions.length + 1}.0.stl
                </div>
              </div>
              <div className="form-group">
                <label>STL File</label>
                <input type="file" accept=".stl"
                  onChange={e => setStlFile(e.target.files[0])} required
                  style={{ padding: '8px 0', background: 'transparent', border: 'none', boxShadow: 'none' }} />
              </div>
              <div className="form-group">
                <label>Version Notes</label>
                <textarea rows={2} value={stlNotes} onChange={e => setStlNotes(e.target.value)} placeholder="What changed in this version?" />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowStlUpload(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={stlUploading}>{stlUploading ? 'Uploading...' : 'Upload'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function VersionList({ versions, selected, onSelect, onDelete, onDownload, fmt, fmtDate }) {
  return (
    <div className="version-list">
      <div className="version-list-header">Version History ({versions.length})</div>
      {versions.length === 0 && (
        <div style={{ padding: '24px 18px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No versions yet</div>
      )}
      {versions.map(v => (
        <div key={v._id} className={`version-row${selected?._id === v._id ? ' active' : ''}`} onClick={() => onSelect(v)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{v.version}</span>
            {v.isLatest && <span className="badge badge-green">Latest</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button className="btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onDownload(v); }}>↓</button>
              <button className="btn-danger btn-sm" onClick={e => { e.stopPropagation(); onDelete(v._id); }}>✕</button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.originalName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-light)', display: 'flex', gap: 10 }}>
            <span>{fmtDate(v.createdAt)}</span>
            <span>{fmt(v.fileSize)}</span>
            <span>by {v.uploadedBy?.name || '—'}</span>
          </div>
          {v.notes && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--surface2)', borderRadius: 6, padding: '5px 8px', marginTop: 2 }}>
              "{v.notes}"
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function NoteBox({ note }) {
  return (
    <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', borderLeft: '3px solid var(--gold)' }}>
      <span style={{ fontWeight: 600, color: 'var(--gold)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Version Notes</span>
      <p style={{ marginTop: 4 }}>{note}</p>
    </div>
  );
}

function EmptyViewer({ label }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div className="empty-state"><div className="empty-state-icon">🖥</div><p>{label}</p></div>
    </div>
  );
}

function UploadModal({ title, accept, file, setFile, notes, setNotes, uploading, onSubmit, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>File</label>
            <input type="file" accept={accept} onChange={e => setFile(e.target.files[0])} required
              style={{ padding: '8px 0', background: 'transparent', border: 'none', boxShadow: 'none' }} />
          </div>
          <div className="form-group">
            <label>Version Notes</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What changed in this version?" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
