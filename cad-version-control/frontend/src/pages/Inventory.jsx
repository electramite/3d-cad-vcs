import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const EMOJI_OPTIONS = ['📦','🧵','⚡','🔩','🔧','🖨','💡','🧪','🎨','🔋','📱','🖥','⚙','🛠','🧲','💎','🪛','🔌'];

function TypeManagerModal({ types, onClose, onSave }) {
  const [list, setList] = useState(types);
  const [form, setForm] = useState({ name: '', icon: '📦', color: '#4a3d5a' });
  const [error, setError] = useState('');

  const add = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await axios.post('/api/inventory/types', form);
      setList([...list, data]);
      setForm({ name: '', icon: '📦', color: '#4a3d5a' });
    } catch (e) { setError(e.response?.data?.message || 'Failed'); }
  };

  const remove = async (id) => {
    try {
      await axios.delete(`/api/inventory/types/${id}`);
      setList(list.filter(t => t._id !== id));
    } catch (e) { setError(e.response?.data?.message || 'Cannot delete'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <h2>Manage Types</h2>
        {/* Existing types */}
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(t => (
            <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{t.name}</span>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.color, border: '1px solid #aaa' }} />
              <button className="btn-danger btn-sm" onClick={() => remove(t._id)}>✕</button>
            </div>
          ))}
          {list.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No types yet.</p>}
        </div>

        {/* Add new type */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Add New Type</div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <form onSubmit={add}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Type Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. filament" required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Icon</label>
                <select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} style={{ width: 70 }}>
                  {EMOJI_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Color</label>
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: 50, height: 38, padding: 2, cursor: 'pointer' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="btn-ghost" onClick={() => { onSave(list); onClose(); }}>Done</button>
              <button type="submit" className="btn-primary">Add Type</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function AlertBanner({ alerts, onAck }) {
  if (!alerts?.count) return null;
  return (
    <div style={{
      background: '#fdf0ef', border: '1px solid #f5c6c2', borderRadius: 10,
      padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 14
    }}>
      <div style={{ fontSize: 20 }}>⚠️</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: '#c0392b', fontSize: 14, marginBottom: 6 }}>
          {alerts.count} component{alerts.count > 1 ? 's' : ''} below minimum threshold
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {alerts.items.map(item => (
            <div key={item._id} style={{
              background: '#fff', border: '1px solid #f5c6c2', borderRadius: 6,
              padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8
            }}>
              <span style={{ fontWeight: 700, color: '#c0392b' }}>{item.code}</span>
              <span>{item.name}</span>
              <span style={{ color: '#c0392b' }}>{item.inStock} / {item.minThreshold} {item.unit}</span>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: 12, padding: 0, fontWeight: 600 }}
                onClick={() => onAck(item._id)}
              >Ack</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StockBar({ inStock, inTransit, minThreshold }) {
  const total = Math.max(inStock + inTransit, minThreshold * 2, 1);
  const stockPct = Math.min((inStock / total) * 100, 100);
  const transitPct = Math.min((inTransit / total) * 100, 100 - stockPct);
  const thresholdPct = Math.min((minThreshold / total) * 100, 100);
  const isLow = inStock < minThreshold;
  return (
    <div style={{ position: 'relative', height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'visible', marginTop: 4 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${stockPct}%`, background: isLow ? '#ef4444' : 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }} />
      <div style={{ position: 'absolute', left: `${stockPct}%`, top: 0, height: '100%', width: `${transitPct}%`, background: 'var(--gold)', opacity: 0.6, borderRadius: 3 }} />
      {/* Threshold marker */}
      <div style={{ position: 'absolute', left: `${thresholdPct}%`, top: -3, width: 2, height: 12, background: '#ef4444', borderRadius: 1 }} title={`Min: ${minThreshold}`} />
    </div>
  );
}

function ComponentRow({ comp, onEdit, onAdjust, onDelete, onAck }) {
  const isLow = comp.inStock < comp.minThreshold;
  const isAlert = comp.alertTriggered && !comp.alertAcknowledged;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '90px 1fr 100px 100px 100px 90px 120px',
      gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--border)',
      alignItems: 'center', fontSize: 13,
      background: isAlert ? '#fff8f8' : 'transparent'
    }}>
      <div>
        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--gold)', background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>
          {comp.code}
        </span>
      </div>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{comp.name}</div>
        {comp.supplier && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{comp.supplier}</div>}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, color: isLow ? '#ef4444' : 'var(--text)', fontSize: 15 }}>{comp.inStock}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{comp.unit}</span>
          {isAlert && <span style={{ fontSize: 10, background: '#fdf0ef', color: '#c0392b', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>LOW</span>}
        </div>
        <StockBar inStock={comp.inStock} inTransit={comp.inTransit} minThreshold={comp.minThreshold} />
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        {comp.inTransit > 0
          ? <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{comp.inTransit} <span style={{ fontSize: 11 }}>{comp.unit}</span></span>
          : <span style={{ color: 'var(--text-light)' }}>—</span>
        }
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Min: <span style={{ fontWeight: 600, color: 'var(--text)' }}>{comp.minThreshold}</span> {comp.unit}
      </div>
      <div>
        {isAlert
          ? <button className="btn-sm" style={{ background: '#fdf0ef', color: '#c0392b', border: '1px solid #f5c6c2', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }} onClick={() => onAck(comp._id)}>Acknowledge</button>
          : <span className="badge badge-green" style={{ fontSize: 10 }}>OK</span>
        }
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="btn-ghost btn-sm" onClick={() => onAdjust(comp)} title="Adjust stock">±</button>
        <button className="btn-ghost btn-sm" onClick={() => onEdit(comp)}>Edit</button>
        <button className="btn-danger btn-sm" onClick={() => onDelete(comp._id)}>✕</button>
      </div>
    </div>
  );
}

function TypeSection({ type, groups, components, activeGroup, isTypeActive, typeCount, getLabel, onSelectType, onSelectGroup, onEditGroup, onDeleteGroup }) {
  const [open, setOpen] = useState(true);
  const hasActive = groups.some(g => g._id === activeGroup);

  return (
    <div>
      {/* Type header row */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', cursor: 'pointer',
          background: isTypeActive ? 'var(--surface2)' : 'transparent',
          borderBottom: '1px solid var(--border)',
          userSelect: 'none'
        }}
        onClick={() => { onSelectType(); setOpen(true); }}
      >
        <span
          style={{ fontSize: 11, color: 'var(--text-muted)', transition: 'transform 0.15s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          onClick={e => { e.stopPropagation(); setOpen(!open); }}
        >▶</span>
        <span style={{ fontSize: 16 }}>{type.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
          {getLabel(type.name)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{typeCount}</span>
      </div>

      {/* Groups under this type */}
      {open && groups.map(g => {
        const count = components.filter(c => c.group?._id === g._id).length;
        const isActive = activeGroup === g._id;
        return (
          <div
            key={g._id}
            onClick={() => onSelectGroup(g._id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 14px 7px 32px',
              cursor: 'pointer',
              background: isActive ? '#e8f0eb' : 'transparent',
              borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              borderBottom: '1px solid var(--border)',
              transition: 'background 0.1s'
            }}
          >
            <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {g.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{count}</span>
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              <button className="btn-ghost btn-sm" style={{ fontSize: 10, padding: '1px 5px' }}
                onClick={e => { e.stopPropagation(); onEditGroup(g); }}>✎</button>
              <button className="btn-danger btn-sm" style={{ fontSize: 10, padding: '1px 5px' }}
                onClick={e => { e.stopPropagation(); onDeleteGroup(g._id); }}>✕</button>
            </div>
          </div>
        );
      })}
      {open && groups.length === 0 && (
        <div style={{ padding: '6px 14px 6px 32px', fontSize: 11, color: 'var(--text-light)', borderBottom: '1px solid var(--border)' }}>
          No groups
        </div>
      )}
    </div>
  );
}

export default function Inventory() {
  const [groups, setGroups] = useState([]);
  const [components, setComponents] = useState([]);
  const [alerts, setAlerts] = useState({ count: 0, items: [] });
  const [types, setTypes] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeType, setActiveType] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showCompModal, setShowCompModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [editComp, setEditComp] = useState(null);
  const [adjustComp, setAdjustComp] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState({ inStock: 0, inTransit: 0 });
  const [groupForm, setGroupForm] = useState({ name: '', type: '', description: '' });
  const [compForm, setCompForm] = useState({ name: '', description: '', unit: 'pcs', inStock: 0, inTransit: 0, minThreshold: 10, supplier: '', notes: '', group: '' });

  // Helper lookups from dynamic types
  const typeMap = Object.fromEntries(types.map(t => [t.name, t]));
  const getIcon  = (name) => typeMap[name]?.icon  || '📦';
  const getLabel = (name) => name ? name.charAt(0).toUpperCase() + name.slice(1) : '';

  const load = useCallback(async () => {
    const params = {};
    if (activeGroup) params.group = activeGroup;
    const [g, c, a, t] = await Promise.all([
      axios.get('/api/inventory/groups'),
      axios.get('/api/inventory/components', { params }),
      axios.get('/api/inventory/alerts'),
      axios.get('/api/inventory/types')
    ]);
    setGroups(g.data);
    setComponents(c.data);
    setAlerts(a.data);
    setTypes(t.data);
    // Seed defaults if no types exist
    if (t.data.length === 0) {
      await axios.post('/api/inventory/types/seed');
      const t2 = await axios.get('/api/inventory/types');
      setTypes(t2.data);
    }
  }, [activeGroup]);

  useEffect(() => { load(); }, [load]);

  const saveGroup = async (e) => {
    e.preventDefault();
    if (editGroup) await axios.put(`/api/inventory/groups/${editGroup._id}`, groupForm);
    else await axios.post('/api/inventory/groups', groupForm);
    setShowGroupModal(false); setEditGroup(null);
    setGroupForm({ name: '', type: 'material', description: '' });
    load();
  };

  const saveComp = async (e) => {
    e.preventDefault();
    const data = { ...compForm, group: compForm.group || activeGroup || groups[0]?._id };
    if (editComp) await axios.put(`/api/inventory/components/${editComp._id}`, data);
    else await axios.post('/api/inventory/components', data);
    setShowCompModal(false); setEditComp(null);
    setCompForm({ name: '', description: '', unit: 'pcs', inStock: 0, inTransit: 0, minThreshold: 10, supplier: '', notes: '' });
    load();
  };

  const doAdjust = async (e) => {
    e.preventDefault();
    if (adjustDelta.inStock !== 0) await axios.post(`/api/inventory/components/${adjustComp._id}/adjust`, { field: 'inStock', delta: Number(adjustDelta.inStock) });
    if (adjustDelta.inTransit !== 0) await axios.post(`/api/inventory/components/${adjustComp._id}/adjust`, { field: 'inTransit', delta: Number(adjustDelta.inTransit) });
    setShowAdjustModal(false); setAdjustComp(null); setAdjustDelta({ inStock: 0, inTransit: 0 });
    load();
  };

  const ackAlert = async (id) => {
    await axios.post(`/api/inventory/components/${id}/acknowledge`);
    load();
  };

  const deleteComp = async (id) => {
    if (!confirm('Delete this component?')) return;
    await axios.delete(`/api/inventory/components/${id}`);
    load();
  };

  const deleteGroup = async (id) => {
    if (!confirm('Delete this group and all its components?')) return;
    await axios.delete(`/api/inventory/groups/${id}`);
    if (activeGroup === id) setActiveGroup(null);
    load();
  };

  const openEdit = (comp) => {
    setEditComp(comp);
    setCompForm({ name: comp.name, description: comp.description || '', unit: comp.unit, inStock: comp.inStock, inTransit: comp.inTransit, minThreshold: comp.minThreshold, supplier: comp.supplier || '', notes: comp.notes || '' });
    setShowCompModal(true);
  };

  const openAdjust = (comp) => { setAdjustComp(comp); setAdjustDelta({ inStock: 0, inTransit: 0 }); setShowAdjustModal(true); };

  // Filter by type
  const filteredGroups = activeType ? groups.filter(g => g.type === activeType) : groups;
  const filteredComponents = activeGroup
    ? components
    : activeType
      ? components.filter(c => filteredGroups.some(g => g._id === c.group?._id))
      : components;

  const totalStock = components.reduce((s, c) => s + c.inStock, 0);
  const totalTransit = components.reduce((s, c) => s + c.inTransit, 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Inventory</h1>
          <p className="page-subtitle">{components.length} components · {groups.length} groups</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => setShowTypeManager(true)}>⚙ Types</button>
          <button className="btn-ghost" onClick={() => { setEditGroup(null); setGroupForm({ name: '', type: types[0]?.name || '', description: '' }); setShowGroupModal(true); }}>+ New Group</button>
          <button className="btn-primary" onClick={() => { setEditComp(null); setCompForm({ name: '', description: '', unit: 'pcs', inStock: 0, inTransit: 0, minThreshold: 10, supplier: '', notes: '', group: activeGroup || groups[0]?._id || '' }); setShowCompModal(true); }} disabled={groups.length === 0}>+ Add Component</button>
        </div>
      </div>

      {/* Alert banner */}
      <AlertBanner alerts={alerts} onAck={ackAlert} />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Components', value: components.length },
          { label: 'Total In Stock', value: totalStock },
          { label: 'In Transit', value: totalTransit },
          { label: 'Low Stock Alerts', value: alerts.count, danger: alerts.count > 0 }
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.danger ? '#ef4444' : 'var(--accent)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Sidebar — groups as collapsible tree under types */}
        <div className="version-list">
          <div className="version-list-header">Groups</div>
          {/* All */}
          <div
            className={`version-row${!activeGroup && !activeType ? ' active' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => { setActiveGroup(null); setActiveType(null); }}
          >
            <span style={{ fontWeight: 600, fontSize: 13 }}>All Components</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{components.length} items</span>
          </div>

          {/* Types as collapsible sections */}
          {types.map(t => {
            const typeGroups = groups.filter(g => g.type === t.name);
            const isTypeActive = activeType === t.name && !activeGroup;
            const typeCount = components.filter(c => typeGroups.some(g => g._id === c.group?._id)).length;
            return (
              <TypeSection
                key={t._id}
                type={t}
                groups={typeGroups}
                components={components}
                activeGroup={activeGroup}
                activeType={activeType}
                isTypeActive={isTypeActive}
                typeCount={typeCount}
                getLabel={getLabel}
                onSelectType={() => { setActiveType(t.name); setActiveGroup(null); }}
                onSelectGroup={(id) => { setActiveGroup(id); setActiveType(null); }}
                onEditGroup={(g) => { setEditGroup(g); setGroupForm({ name: g.name, type: g.type, description: g.description || '' }); setShowGroupModal(true); }}
                onDeleteGroup={deleteGroup}
              />
            );
          })}

          {groups.length === 0 && types.length > 0 && (
            <div style={{ padding: '16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              No groups yet. Click "+ New Group".
            </div>
          )}
        </div>

        {/* Component table */}
        <div className="version-list">
          <div className="version-list-header" style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px 100px 100px 90px 120px', gap: 12 }}>
            <span>Code</span><span>Component</span><span>In Stock</span><span>In Transit</span><span>Min Level</span><span>Status</span><span>Actions</span>
          </div>
          {filteredComponents.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {groups.length === 0 ? 'Create a group first, then add components.' : 'No components in this group.'}
            </div>
          )}
          {filteredComponents.map(comp => (
            <ComponentRow key={comp._id} comp={comp} onEdit={openEdit} onAdjust={openAdjust} onDelete={deleteComp} onAck={ackAlert} />
          ))}
        </div>
      </div>

      {/* Type Manager Modal */}
      {showTypeManager && (
        <TypeManagerModal
          types={types}
          onClose={() => setShowTypeManager(false)}
          onSave={(updated) => { setTypes(updated); load(); }}
        />
      )}
      {showGroupModal && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editGroup ? 'Edit Group' : 'New Group'}</h2>
            <form onSubmit={saveGroup}>
              <div className="form-group"><label>Group Name</label>
                <input value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} required placeholder="e.g. PLA Filaments" />
              </div>
              <div className="form-group"><label>Type</label>
                <select value={groupForm.type} onChange={e => setGroupForm({ ...groupForm, type: e.target.value })}>
                  {types.map(t => <option key={t._id} value={t.name}>{t.icon} {getLabel(t.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Description</label>
                <textarea rows={2} value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowGroupModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editGroup ? 'Save' : 'Create Group'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Component Modal */}
      {showCompModal && (
        <div className="modal-overlay" onClick={() => setShowCompModal(false)}>
          <div className="modal" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
            <h2>{editComp ? 'Edit Component' : 'Add Component'}</h2>
            <form onSubmit={saveComp}>
              {!editComp && (
                <div className="form-group"><label>Group</label>
                  <select value={compForm.group} onChange={e => setCompForm({ ...compForm, group: e.target.value })}>
                    {groups.map(g => <option key={g._id} value={g._id}>{getIcon(g.type)} {g.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label>Component Name</label>
                  <input value={compForm.name} onChange={e => setCompForm({ ...compForm, name: e.target.value })} required placeholder="e.g. PLA White 1kg" />
                </div>
                <div className="form-group"><label>Unit</label>
                  <select value={compForm.unit} onChange={e => setCompForm({ ...compForm, unit: e.target.value })}>
                    {['pcs', 'kg', 'g', 'm', 'rolls', 'boxes', 'liters', 'sets'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>In Stock</label>
                  <input type="number" min="0" value={compForm.inStock} onChange={e => setCompForm({ ...compForm, inStock: Number(e.target.value) })} />
                </div>
                <div className="form-group"><label>In Transit</label>
                  <input type="number" min="0" value={compForm.inTransit} onChange={e => setCompForm({ ...compForm, inTransit: Number(e.target.value) })} />
                </div>
                <div className="form-group"><label>Min Threshold (alert below)</label>
                  <input type="number" min="0" value={compForm.minThreshold} onChange={e => setCompForm({ ...compForm, minThreshold: Number(e.target.value) })} />
                </div>
                <div className="form-group"><label>Supplier</label>
                  <input value={compForm.supplier} onChange={e => setCompForm({ ...compForm, supplier: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <div className="form-group"><label>Description / Notes</label>
                <textarea rows={2} value={compForm.notes} onChange={e => setCompForm({ ...compForm, notes: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowCompModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editComp ? 'Save Changes' : 'Add Component'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && adjustComp && (
        <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Adjust Stock — {adjustComp.name}</h2>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 24 }}>
                <span>Current stock: <strong>{adjustComp.inStock} {adjustComp.unit}</strong></span>
                <span>In transit: <strong>{adjustComp.inTransit} {adjustComp.unit}</strong></span>
                <span>Min: <strong>{adjustComp.minThreshold} {adjustComp.unit}</strong></span>
              </div>
            </div>
            <form onSubmit={doAdjust}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Adjust In Stock (+ add / - remove)</label>
                  <input type="number" value={adjustDelta.inStock} onChange={e => setAdjustDelta({ ...adjustDelta, inStock: e.target.value })} placeholder="e.g. +5 or -2" />
                </div>
                <div className="form-group">
                  <label>Adjust In Transit</label>
                  <input type="number" value={adjustDelta.inTransit} onChange={e => setAdjustDelta({ ...adjustDelta, inTransit: e.target.value })} placeholder="e.g. +10" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAdjustModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Apply Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
