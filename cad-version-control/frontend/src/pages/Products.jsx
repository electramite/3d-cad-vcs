import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', sku: '' });

  const load = () => axios.get('/api/products').then(r => setProducts(r.data));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    await axios.post('/api/products', form);
    setForm({ name: '', description: '', sku: '' });
    setShowModal(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this product and all its parts?')) return;
    await axios.delete(`/api/products/${id}`);
    load();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Products</h1>
          <p className="page-subtitle">{products.length} product{products.length !== 1 ? 's' : ''} in your workspace</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ New Product</button>
      </div>

      <div className="grid">
        {products.map((p, i) => (
          <div key={p._id} className="item-card">
            <div className="item-card-number">{String(i + 1).padStart(2, '0')}</div>
            <div>
              <div className="item-card-meta">Product</div>
              <div className="item-card-title">{p.name}</div>
            </div>
            {p.sku && <span className="badge badge-gold">SKU: {p.sku}</span>}
            {p.description && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.description}</p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Link to={`/products/${p._id}`}>
                <button className="btn-primary btn-sm">View Parts →</button>
              </Link>
              <button className="btn-danger btn-sm" onClick={() => remove(p._id)}>Delete</button>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state-icon">📦</div>
            <p>No products yet. Create your first one to get started.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Product</h2>
            <form onSubmit={create}>
              <div className="form-group">
                <label>Product Name</label>
                <input placeholder="e.g. Phone Stand" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>SKU</label>
                <input placeholder="e.g. PS-001" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={3} placeholder="Optional description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
