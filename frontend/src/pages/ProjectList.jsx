import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import api from '../api/client';

const STATUS_COLOR = {
  active: 'var(--success)',
  paused: 'var(--warning)',
  done: 'var(--muted)',
};

const s = {
  page: { padding: 32, maxWidth: 900 },
  heading: { fontSize: 22, fontWeight: 700, marginBottom: 24 },
  row: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '14px 18px',
    marginBottom: 10,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
    gap: 16,
  },
  name: { fontWeight: 600, flex: 1 },
  badge: {
    padding: '2px 10px',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
    background: 'var(--bg3)',
  },
  meta: { color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' },
  del: {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    padding: 4,
    borderRadius: 4,
    display: 'flex',
  },
};

export default function ProjectList({ refresh, onProjectDeleted }) {
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data));
  }, [refresh]);

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this project and all its data?')) return;
    await api.delete(`/projects/${id}`);
    setProjects(ps => ps.filter(p => p.id !== id));
    onProjectDeleted?.();
  }

  return (
    <div style={s.page}>
      <div style={s.heading}>Projects</div>
      {projects.length === 0 && (
        <div style={{ color: 'var(--muted)' }}>No projects yet — create one from the sidebar.</div>
      )}
      {projects.map(p => (
        <div
          key={p.id}
          style={s.row}
          onClick={() => navigate(`/projects/${p.id}`)}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <div style={s.name}>{p.name}</div>
          <span style={{ ...s.badge, color: STATUS_COLOR[p.status] || 'var(--muted)' }}>
            {p.status}
          </span>
          <span style={s.meta}>{p.task_count} tasks · {p.session_count} sessions</span>
          <span style={s.meta}>{new Date(p.created_at).toLocaleDateString()}</span>
          <button
            style={s.del}
            onClick={e => handleDelete(e, p.id)}
            title="Delete project"
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
