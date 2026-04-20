import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate('/products');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: 'var(--bg)'
    }}>
      {/* Left panel */}
      <div style={{
        flex: 1, background: 'var(--bg-deep)',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px',
        borderRight: '1px solid var(--border-dark)'
      }}>
        <div style={{ maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <div style={{
              width: 42, height: 42, background: 'var(--gold)',
              borderRadius: 10, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 20
            }}>⚙</div>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-on-dark)' }}>CAD Portal</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-on-dark)', lineHeight: 1.2, marginBottom: 14 }}>
            Version control<br />for your designs
          </h1>
          <p style={{ color: 'var(--text-muted-dark)', fontSize: 15, lineHeight: 1.6 }}>
            Manage G-code and 3MF files across products and parts. Track every version, preview toolpaths in 3D.
          </p>
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {['Upload .gcode & .3mf files', 'Full version history per part', '3D toolpath preview', 'Multi-filament color support'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted-dark)', fontSize: 14 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        width: 460, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '40px',
        background: 'var(--surface)'
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>
            {mode === 'login' ? 'Sign in to access your workspace' : 'Get started with CAD Portal'}
          </p>

          {error && (
            <div style={{
              background: '#fdf0ef', border: '1px solid #f5c6c2',
              borderRadius: 8, padding: '10px 14px',
              color: 'var(--danger)', fontSize: 13, marginBottom: 18
            }}>{error}</div>
          )}

          <form onSubmit={submit}>
            {mode === 'register' && (
              <div className="form-group">
                <label>Full Name</label>
                <input placeholder="[name]" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
            )}
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" placeholder="[email]" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 8, padding: '11px 18px', fontSize: 14 }}>
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p style={{ marginTop: 20, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <a href="#" onClick={e => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); }}>
              {mode === 'login' ? 'Register' : 'Sign in'}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
