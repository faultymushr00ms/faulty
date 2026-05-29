import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const STATUS_COLOR = {
  active: 'var(--success)',
  paused: 'var(--warning)',
  done: 'var(--muted)',
};

const s = {
  page: { padding: 32, maxWidth: 900 },
  heading: { fontSize: 22, fontWeight: 700, marginBottom: 8 },
  sub: { color: 'var(--muted)', marginBottom: 28 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 },
  card: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 20,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  cardName: { fontWeight: 600, fontSize: 15, marginBottom: 6 },
  cardDesc: { color: 'var(--muted)', fontSize: 13, marginBottom: 14, minHeight: 36 },
  badge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
    background: 'var(--bg3)',
  },
  meta: { display: 'flex', gap: 14, marginTop: 12, color: 'var(--muted)', fontSize: 12 },
  empty: { color: 'var(--muted)', padding: '40px 0' },
};

export default function Dashboard({ refresh }) {
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data));
  }, [refresh]);

  const active = projects.filter(p => p.status === 'active');
  const tasks = projects.reduce((a, p) => a + p.task_count, 0);
  const sessions = projects.reduce((a, p) => a + p.session_count, 0);

  return (
    <div style={s.page}>
      <div style={s.heading}>Dashboard</div>
      <div style={s.sub}>All your Claude-assisted projects at a glance.</div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Projects', value: projects.length },
          { label: 'Active', value: active.length },
          { label: 'Tasks', value: tasks },
          { label: 'Chat sessions', value: sessions },
        ].map(stat => (
          <div key={stat.label} style={{ ...s.card, cursor: 'default', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{stat.value}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 600, marginBottom: 14 }}>Recent projects</div>
      {projects.length === 0 ? (
        <div style={s.empty}>No projects yet — create one from the sidebar.</div>
      ) : (
        <div style={s.grid}>
          {projects.slice(0, 6).map(p => (
            <div
              key={p.id}
              style={s.card}
              onClick={() => navigate(`/projects/${p.id}`)}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={s.cardName}>{p.name}</div>
              <div style={s.cardDesc}>{p.description || 'No description'}</div>
              <span style={{ ...s.badge, color: STATUS_COLOR[p.status] || 'var(--muted)' }}>
                {p.status}
              </span>
              <div style={s.meta}>
                <span>{p.task_count} tasks</span>
                <span>{p.session_count} sessions</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
