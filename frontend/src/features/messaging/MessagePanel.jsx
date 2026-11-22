import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../../services/socket.js';
import { api } from '../../services/api.js';
import { cacheMessage, getCachedMessages } from '../../services/localDb.js';
import AudioBubble from '../voice-messages/AudioBubble.jsx';
import TextToSpeech from '../voice-messages/TextToSpeech.jsx';
import WalkieTalkie from '../voice-messages/WalkieTalkie.jsx';
import SpeakingIndicator from '../voice-messages/SpeakingIndicator.jsx';
import RadioMode from '../voice-messages/RadioMode.jsx';

const initials = name => name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const NAME_STORAGE_KEY = 'groundlink-display-name';

function loadSavedName() {
  try {
    return (
      window.localStorage.getItem(NAME_STORAGE_KEY) ||
      window.sessionStorage.getItem('groundlink-name') ||
      ''
    ).trim();
  } catch {
    return '';
  }
}

export default function MessagePanel({ group, onMembers }) {
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [text, setText] = useState('');
  const [displayName, setDisplayName] = useState(() => loadSavedName() || `Guest ${Math.floor(10 + Math.random() * 89)}`);
  const [nameInput, setNameInput] = useState(() => loadSavedName());
  const [nameSavedNotice, setNameSavedNotice] = useState(false);
  const [connection, setConnection] = useState(socket.connected);
  const [error, setError] = useState('');
  const [speakers, setSpeakers] = useState([]);
  const [gnaniAvailable, setGnaniAvailable] = useState(false);
  const bottom = useRef(null);
  const activeNameRef = useRef(displayName);
  activeNameRef.current = displayName;

  // Check Gnani availability once
  useEffect(() => {
    fetch('/api/gnani/status').then(r => r.json())
      .then(d => setGnaniAvailable(!!d.configured))
      .catch(() => setGnaniAvailable(false));
  }, []);

  const syncNameWithSocket = useCallback((nextName, persist = true) => {
    const cleaned = String(nextName || '').trim().slice(0, 32);
    if (!cleaned) return;
    setDisplayName(cleaned);
    activeNameRef.current = cleaned;
    if (persist) {
      try {
        window.localStorage.setItem(NAME_STORAGE_KEY, cleaned);
        window.sessionStorage.setItem('groundlink-name', cleaned);
      } catch { /* Storage may be unavailable */ }
    }
    if (socket.connected && group?.code) {
      socket.emit('group:join', { code: group.code, name: cleaned }, result => {
        if (result?.ok) {
          setError('');
        } else if (result?.error) {
          setError(result.error);
        }
      });
    }
  }, [group?.code]);

  function handleNameSave(e) {
    e.preventDefault();
    const cleaned = nameInput.trim().slice(0, 32);
    if (!cleaned) return;
    syncNameWithSocket(cleaned, true);
    setNameSavedNotice(true);
    setTimeout(() => setNameSavedNotice(false), 1500);
  }

  useEffect(() => {
    let mounted = true;
    async function join() {
      try {
        const cached = await getCachedMessages(group.code);
        if (mounted) setMessages(cached);
        const history = await api(`/groups/${group.code}/messages`);
        if (mounted) { setMessages(history); history.forEach(cacheMessage); }
      } catch { /* Cached messages remain available while disconnected. */ }
      socket.connect();
      socket.emit('group:join', { code: group.code, name: activeNameRef.current }, result => {
        if (!mounted) return;
        if (result?.ok) {
          setError('');
          const confirmedName = result.member?.name || activeNameRef.current;
          setDisplayName(confirmedName);
          activeNameRef.current = confirmedName;
          try { window.sessionStorage.setItem('groundlink-name', confirmedName); } catch { /* ignore */ }
        } else {
          setError(result?.error || 'Unable to join group');
        }
      });
    }
    const onMessage = message => {
      if (message.groupCode === group.code) {
        setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
        cacheMessage(message).catch(() => { });
      }
    };
    const onMemberUpdate = list => { setMembers(list); onMembers(list.length); };
    const onConnect = () => {
      setConnection(true);
      socket.emit('group:join', { code: group.code, name: activeNameRef.current }, () => {});
    };
    const onDisconnect = () => setConnection(false);
    const onSpeaking = ({ socketId, name: speakerName, speaking }) => {
      setSpeakers(prev => {
        const without = prev.filter(s => s.socketId !== socketId);
        if (speaking) return [...without, { socketId, name: speakerName, speaking: true }];
        return without;
      });
    };
    socket.on('message:new', onMessage);
    socket.on('members:update', onMemberUpdate);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('voice:speaking', onSpeaking);
    join();
    return () => {
      mounted = false;
      socket.off('message:new', onMessage);
      socket.off('members:update', onMemberUpdate);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('voice:speaking', onSpeaking);
    };
  }, [group.code, onMembers]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function send(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body || !socket.connected) return;
    setText('');
    socket.emit('message:send', {
      text: body,
      clientId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
    }, result => {
      if (!result?.ok) { setText(body); setError(result?.error || 'Message failed'); }
    });
  }

  const currentUser = displayName;

  return (
    <section className="chat-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">LIVE CONVERSATION</div>
          <h2>{group.name}</h2>
        </div>
        <div className={`connection ${connection ? 'is-online' : ''}`}>
          <span /> {connection ? 'Connected' : 'Reconnecting'}
        </div>
      </div>

     <form
        onSubmit={handleNameSave}
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          padding: '8px 12px',
          margin: '0 0 10px 0',
          borderRadius: '10px',
          background: '#131915',
          border: '1px solid #263229'
        }}
      >
        <span style={{ fontSize: '12px', color: '#8fa395', whiteSpace: 'nowrap' }}>
          DISPLAY NAME
        </span>
        <input
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          placeholder={`Current: ${displayName}`}
          maxLength={32}
          aria-label="Your display name"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '7px 10px',
            borderRadius: '8px',
            border: '1px solid #2c3a30',
            background: '#0c100d',
            color: '#f2f7f3',
            fontSize: '13px',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={!nameInput.trim() || nameInput.trim() === displayName}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #88e636',
            background: !nameInput.trim() || nameInput.trim() === displayName ? '#1b241d' : '#88e636',
            color: !nameInput.trim() || nameInput.trim() === displayName ? '#7b8b80' : '#0b110c',
            fontWeight: 600,
            fontSize: '12px',
            cursor: !nameInput.trim() || nameInput.trim() === displayName ? 'default' : 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          {nameSavedNotice ? 'Saved ✓' : 'Set name'}
        </button>
      </form>

      <div className="chat-body">
        <div className="chat-date">TODAY · LOCAL SESSION</div>
        {messages.length === 0 && (
          <div className="empty-chat">
            <span>↗</span>
            <strong>Your channel is ready</strong>
            <p>Send the first update to your group.</p>
          </div>
        )}
        {messages.map(message => {
          const own = message.sender === currentUser;
          return (
            <div className={`message ${own ? 'own' : ''}`} key={message.id}>
              <div className="avatar">{initials(message.sender)}</div>
              <div>
                <div className="message-meta">
                  <strong>{own ? 'You' : message.sender}</strong>
                  <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
                {message.type === 'voice' ? (
                  <AudioBubble message={message} gnaniAvailable={gnaniAvailable} />
                ) : (
                  <>
                    <div className="bubble">{message.text}</div>
                    <TextToSpeech text={message.text} gnaniAvailable={gnaniAvailable} />
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <SpeakingIndicator speakers={speakers} />
      {error && <div className="chat-error">{error}</div>}

      {/* Text composer */}
      <form className="composer" onSubmit={send}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={connection ? 'Write a message…' : 'Waiting for network connection…'}
          maxLength={2000}
        />
        <button disabled={!connection || !text.trim()} aria-label="Send message">↑</button>
      </form>

      {/* Walkie-Talkie */}
      <WalkieTalkie group={group} connection={connection} />

      {/* Radio Mode */}
      <RadioMode messages={messages} currentUser={currentUser} />

      <div className="chat-foot">
        <span>Messages save on this device</span>
        <span>{members.length} {members.length === 1 ? 'member' : 'members'} online</span>
      </div>
    </section>
  );
}