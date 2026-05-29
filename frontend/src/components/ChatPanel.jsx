import { useEffect, useRef, useState } from 'react';
import { Send, Loader } from 'lucide-react';
import api from '../api/client';

const s = {
  panel: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    display: 'flex',
    flexDirection: 'column',
    height: 480,
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    fontWeight: 600,
    fontSize: 13,
    color: 'var(--muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  messages: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  bubble: (role) => ({
    maxWidth: '80%',
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    background: role === 'user' ? 'var(--accent)' : 'var(--bg3)',
    color: role === 'user' ? '#fff' : 'var(--text)',
    borderRadius: role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
    padding: '10px 14px',
    fontSize: 13,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  }),
  inputRow: {
    padding: '10px 12px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    gap: 8,
  },
  input: {
    flex: 1,
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    padding: '9px 12px',
    fontSize: 13,
    outline: 'none',
    resize: 'none',
  },
  send: {
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    padding: '0 14px',
    display: 'flex',
    alignItems: 'center',
  },
};

export default function ChatPanel({ projectId, session, onSaved }) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (session) {
      api.get(`/sessions/${session.id}`).then(r => {
        setMessages(r.data.messages);
        setSessionId(r.data.id);
      });
    } else {
      setMessages([]);
      setSessionId(null);
    }
  }, [session]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/chat`, {
        messages: newMessages,
        session_id: sessionId,
        session_title: session?.title,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (!sessionId) {
        setSessionId(data.session_id);
        onSaved?.();
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.detail || 'Error: could not reach Claude. Check your ANTHROPIC_API_KEY.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const title = session?.title || 'New chat';

  return (
    <div style={s.panel}>
      <div style={s.header}>{title}</div>
      <div style={s.messages}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            Ask Claude anything about this project.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={s.bubble(m.role)}>{m.content}</div>
        ))}
        {loading && (
          <div style={{ ...s.bubble('assistant'), display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={s.inputRow}>
        <textarea
          style={s.input}
          rows={2}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message Claude… (Enter to send, Shift+Enter for newline)"
        />
        <button style={s.send} onClick={send} disabled={loading || !input.trim()}>
          <Send size={16} />
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
