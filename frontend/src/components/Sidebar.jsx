import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Plus } from 'lucide-react';
import { useState } from 'react';
import api from '../api/client';

const s = {
  sidebar: {
    width: 220,
    minHeight: '100vh',
    background: 'var(--bg2)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 12px',
    gap: 4,
    flexShrink: 0,
  },
  logo: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--accent)',
    padding: '8px 12px 20px',
    letterSpacing: '-0.3px',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    color: 'var(--muted)',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  btn: {
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 14px',
    borderRadius: 'var(--radius)',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    fontWeight: 600,
    fontSize: 13,
    width: '100%',
  },
};

export default function Sidebar({ onProjectCreated }) {
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  async function handleNew() {
    const name = window.prompt('Project name:');
    if (!name?.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/projects', { name: name.trim() });
      onProjectCreated?.();
      navigate(`/projects/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  const activeStyle = { color: 'var(--text)', background: 'var(--bg3)' };

  return (
    <aside style={s.sidebar}>
      <div style={s.logo}>Claude PM</div>
      <NavLink to="/" end style={({ isActive }) => ({ ...s.link, ...(isActive ? activeStyle : {}) })}>
        <LayoutDashboard size={16} /> Dashboard
      </NavLink>
      <NavLink to="/projects" style={({ isActive }) => ({ ...s.link, ...(isActive ? activeStyle : {}) })}>
        <FolderKanban size={16} /> Projects
      </NavLink>
      <button style={s.btn} onClick={handleNew} disabled={creating}>
        <Plus size={15} /> New Project
      </button>
    </aside>
  );
}
