import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

export default function ProductDetail() {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [parts, setParts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  useEffect(() => {
    axios.get(`/api/products/${productId}`).then(r => setProduct(r.data));
    loadParts();
  }, [productId]);

  const loadParts = () =>
    axios.get(`/api/parts/product/${productId}`).then(r => setParts(r.data));

  const create = async (e) => {
    e.preventDefault();
    await axios.post('/api/parts', { ...form, product: productId });
    setForm({ name: '', description: '' });
    setShowModal(false);
    loadParts();
  };

  const remove = async (id) => {
    if (!confirm('Delete this part?')) return;
    await axios.delete(`/api/parts/${id}`);
    loadParts();
  };

  if (!product) return <p style={{ color: 'var(--text-muted-dark)' }}>Loading...</p>;

  return (
    <>
      <div className="breadcrumb">
        <Link to="/products">Products</Link>
        <span className="breadcrumb-sep">›</span>
        <span style={{ color: 'var(--text-on-dark)' }}>{product.name}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{product.name}</h1>
          <p className="page-subtitle">
            {product.sku && <span className="badge badge-gold" style={{ marginRight: 8 }}>SKU: {product.sku}</span>}
            {parts.length} part{parts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Add Part</button>
      </div>

      {product.description && (
        <p style={{ color: 'var(--text-muted-dark)', marginBottom: 24, fontSize: 14 }}>{product.description}</p>
      )}

      <div className="grid">
        {parts.map((p, i) => (
          <div key={p._id} className="item-card">
            <div className="item-card-number">{String(i + 1).padStart(2, '0')}</div>
            <div>
              <div className="item-card-meta">Part</div>
              <div className="item-card-title">{p.name}</div>
            </div>
            {p.description && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.description}</p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Link to={`/parts/${p._id}`}>
                <button className="btn-primary btn-sm">G-Code Versions →</button>
              </Link>
              <button className="btn-danger btn-sm" onClick={() => remove(p._id)}>Delete</button>
            </div>
          </div>
        ))}
        {parts.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state-icon">🔩</div>
            <p>No parts yet. Add the first part for this product.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Part</h2>
            <form onSubmit={create}>
              <div className="form-group">
                <label>Part Name</label>
                <input placeholder="e.g. Base Plate" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={3} placeholder="Optional description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create Part</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
