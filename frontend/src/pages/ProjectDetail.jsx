import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, MessageSquare, CheckSquare, ChevronRight } from 'lucide-react';
import api from '../api/client';
import ChatPanel from '../components/ChatPanel';

const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

const PRIORITY_COLOR = { low: 'var(--info)', medium: 'var(--warning)', high: 'var(--danger)' };
const STATUS_LABEL = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

const s = {
  page: { padding: 32, maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 28 },
  header: { display: 'flex', alignItems: 'flex-start', gap: 16, justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: 700 },
  desc: { color: 'var(--muted)', marginTop: 4, fontSize: 13 },
  tabs: { display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 },
  tab: {
    padding: '8px 18px',
    border: 'none',
    background: 'none',
    color: 'var(--muted)',
    fontWeight: 500,
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    fontSize: 13,
  },
  board: { display: 'flex', gap: 16 },
  col: {
    flex: 1,
    background: 'var(--bg2)',
    borderRadius: 10,
    border: '1px solid var(--border)',
    padding: 14,
    minHeight: 300,
  },
  colHead: { fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--muted)' },
  card: {
    background: 'var(--bg3)',
    borderRadius: 7,
    padding: '10px 12px',
    marginBottom: 8,
    border: '1px solid transparent',
    cursor: 'pointer',
  },
  cardTitle: { fontWeight: 500, fontSize: 13 },
  cardMeta: { fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 8 },
  addBtn: {
    width: '100%',
    padding: '7px 10px',
    border: '1px dashed var(--border)',
    borderRadius: 7,
    background: 'none',
    color: 'var(--muted)',
    fontSize: 13,
    marginTop: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  sessionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    marginBottom: 8,
    cursor: 'pointer',
  },
  statusSelect: {
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 13,
  },
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('tasks');
  const [selectedSession, setSelectedSession] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);

  async function load() {
    const { data } = await api.get(`/projects/${id}`);
    setProject(data);
  }

  useEffect(() => { load(); }, [id]);

  async function addTask(status) {
    const title = window.prompt('Task title:');
    if (!title?.trim()) return;
    await api.post(`/projects/${id}/tasks`, { title: title.trim(), status });
    load();
  }

  async function moveTask(taskId, newStatus) {
    await api.patch(`/tasks/${taskId}`, { status: newStatus });
    load();
  }

  async function deleteTask(e, taskId) {
    e.stopPropagation();
    if (!confirm('Delete this task?')) return;
    await api.delete(`/tasks/${taskId}`);
    load();
  }

  async function deleteSession(e, sessionId) {
    e.stopPropagation();
    if (!confirm('Delete this chat session?')) return;
    await api.delete(`/sessions/${sessionId}`);
    load();
  }

  async function updateStatus(newStatus) {
    await api.patch(`/projects/${id}`, { status: newStatus });
    load();
  }

  if (!project) return <div style={{ padding: 32, color: 'var(--muted)' }}>Loading...</div>;

  const tasksByStatus = STATUSES.reduce((acc, st) => {
    acc[st] = project.tasks.filter(t => t.status === st);
    return acc;
  }, {});

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.title}>{project.name}</div>
          <div style={s.desc}>{project.description || 'No description'}</div>
        </div>
        <select style={s.statusSelect} value={project.status} onChange={e => updateStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="done">Done</option>
        </select>
      </div>

      <div style={s.tabs}>
        {[['tasks', <CheckSquare size={14} />, 'Tasks'], ['chat', <MessageSquare size={14} />, 'Chat Sessions']].map(
          ([key, icon, label]) => (
            <button
              key={key}
              style={{ ...s.tab, ...(tab === key ? { color: 'var(--accent)', borderBottomColor: 'var(--accent)' } : {}) }}
              onClick={() => setTab(key)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {label}</span>
            </button>
          )
        )}
      </div>

      {tab === 'tasks' && (
        <div style={s.board}>
          {STATUSES.map(status => (
            <div key={status} style={s.col}>
              <div style={s.colHead}>{STATUS_LABEL[status]} ({tasksByStatus[status].length})</div>
              {tasksByStatus[status].map(task => (
                <div
                  key={task.id}
                  style={s.card}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={s.cardTitle}>{task.title}</div>
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', padding: 2 }}
                      onClick={e => deleteTask(e, task.id)}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div style={s.cardMeta}>
                    <span style={{ color: PRIORITY_COLOR[task.priority] }}>{task.priority}</span>
                    {status !== 'todo' && (
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11, padding: 0, cursor: 'pointer' }}
                        onClick={() => moveTask(task.id, STATUSES[STATUSES.indexOf(status) - 1])}
                      >
                        ← back
                      </button>
                    )}
                    {status !== 'done' && (
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, padding: 0, cursor: 'pointer' }}
                        onClick={() => moveTask(task.id, STATUSES[STATUSES.indexOf(status) + 1])}
                      >
                        next →
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button style={s.addBtn} onClick={() => addTask(status)}>
                <Plus size={13} /> Add task
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'chat' && (
        <div>
          <button
            style={{
              padding: '9px 18px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            onClick={() => { setSelectedSession(null); setShowNewChat(true); }}
          >
            <Plus size={14} /> New chat
          </button>

          {(showNewChat || selectedSession) && (
            <div style={{ marginBottom: 20 }}>
              <ChatPanel
                projectId={id}
                session={selectedSession}
                onSaved={() => { setShowNewChat(false); load(); }}
              />
            </div>
          )}

          {project.sessions.length === 0 && !showNewChat && (
            <div style={{ color: 'var(--muted)' }}>No chat sessions yet.</div>
          )}

          {project.sessions.map(sess => (
            <div
              key={sess.id}
              style={s.sessionRow}
              onClick={() => { setSelectedSession(sess); setShowNewChat(false); }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <MessageSquare size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{sess.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {sess.message_count} messages · {new Date(sess.updated_at).toLocaleString()}
                </div>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--muted)', padding: 4 }}
                onClick={e => deleteSession(e, sess.id)}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
              >
                <Trash2 size={14} />
              </button>
              <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
