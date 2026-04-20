import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">⚙</div>
          CAD Portal
        </div>

        <div className="sidebar-section">Navigation</div>
        <NavLink to="/products" className={({ isActive }) => isActive ? 'active' : ''}>
          📦 Products
        </NavLink>
        <NavLink to="/printers" className={({ isActive }) => isActive ? 'active' : ''}>
          🖨 Printers
        </NavLink>
        <NavLink to="/printlogs" className={({ isActive }) => isActive ? 'active' : ''}>
          📋 Print Logs
        </NavLink>
        <NavLink to="/inventory" className={({ isActive }) => isActive ? 'active' : ''}>
          📦 Inventory
        </NavLink>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted-dark)' }}>{user?.role}</div>
            </div>
          </div>
          <button
            className="btn-ghost btn-sm"
            onClick={logout}
            style={{ width: '100%', color: 'var(--text-muted-dark)', borderColor: 'var(--border-dark)' }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
