/**
 * MessagePanel — live chat view (Messaging sidebar tab).
 *
 * Socket connection, group:join, and message/member/speaker state are
 * managed by App.jsx (lifted up) and passed in as props.  This prevents
 * the double group:join race that occurred when switching between the
 * Messaging and Walkie-Talkie tabs.
 */
import { useEffect, useRef, useState } from 'react';
import { socket } from '../../services/socket.js';
import AudioBubble from '../voice-messages/AudioBubble.jsx';
import TextToSpeech from '../voice-messages/TextToSpeech.jsx';
import WalkieTalkie from '../voice-messages/WalkieTalkie.jsx';
import SpeakingIndicator from '../voice-messages/SpeakingIndicator.jsx';
import RadioMode from '../voice-messages/RadioMode.jsx';

const initials = name => name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const NAME_STORAGE_KEY = 'groundlink-display-name';

function loadSavedName() {
  try {
    return (window.localStorage.getItem(NAME_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export default function MessagePanel({
  group,
  messages,
  members,
  connection,
  speakers,
  onVoiceSent,
  currentUser,
  onUserNameChange,
}) {
  const [text, setText] = useState('');
  const [displayName, setDisplayName] = useState(() => currentUser || loadSavedName());
  const [nameInput, setNameInput] = useState(() => currentUser || loadSavedName());
  const [nameSavedNotice, setNameSavedNotice] = useState(false);
  const [error, setError] = useState('');
  const [gnaniAvailable, setGnaniAvailable] = useState(false);
  const bottom = useRef(null);

  // Check Gnani (transcription / TTS) availability once per mount.
  useEffect(() => {
    fetch('/api/gnani/status').then(r => r.json())
      .then(d => setGnaniAvailable(!!d.configured))
      .catch(() => setGnaniAvailable(false));
  }, []);

  useEffect(() => {
    if (currentUser && currentUser !== displayName) {
      setDisplayName(currentUser);
      setNameInput(currentUser);
    }
  }, [currentUser, displayName]);

  // Auto-scroll to newest message.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body || !socket.connected) return;
    setText('');
    socket.emit('message:send', {
      text: body,
      clientId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    }, result => {
      if (!result?.ok) { setText(body); setError(result?.error || 'Message failed'); }
      else setError('');
    });
  }

  function saveDisplayName(event) {
    event.preventDefault();
    const cleaned = nameInput.trim().slice(0, 32);
    if (!cleaned) return;
    setDisplayName(cleaned);
    setNameInput(cleaned);
    try { window.localStorage.setItem(NAME_STORAGE_KEY, cleaned); } catch { /* Storage may be disabled. */ }
    onUserNameChange?.(cleaned);
    setNameSavedNotice(true);
    setTimeout(() => setNameSavedNotice(false), 1500);
  }

  const activeUser = displayName || currentUser;

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

      <form onSubmit={saveDisplayName} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', margin: '0 0 10px', borderRadius: 10, background: '#131915', border: '1px solid #263229' }}>
        <span style={{ fontSize: 12, color: '#8fa395', whiteSpace: 'nowrap' }}>DISPLAY NAME</span>
        <input
          value={nameInput}
          onChange={event => setNameInput(event.target.value)}
          placeholder={`Current: ${displayName}`}
          maxLength={32}
          aria-label="Your display name"
          style={{ flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: 8, border: '1px solid #2c3a30', background: '#0c100d', color: '#f2f7f3', fontSize: 13, outline: 'none' }}
        />
        <button type="submit" disabled={!nameInput.trim() || nameInput.trim() === displayName} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #88e636', background: !nameInput.trim() || nameInput.trim() === displayName ? '#1b241d' : '#88e636', color: !nameInput.trim() || nameInput.trim() === displayName ? '#7b8b80' : '#0b110c', fontWeight: 600, fontSize: 12, cursor: !nameInput.trim() || nameInput.trim() === displayName ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
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
          const own = message.sender === activeUser;
          return (
            <div className={`message ${own ? 'own' : ''}`} key={message.id}>
              <div className="avatar">{initials(message.sender)}</div>
              <div>
                <div className="message-meta">
                  <strong>{own ? 'You' : message.sender}</strong>
                  <time>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </time>
                </div>
                {message.type === 'voice' ? (
                  <AudioBubble message={message} />
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

      {/* Walkie-Talkie PTT bar */}
      <WalkieTalkie group={group} connection={connection} onSend={onVoiceSent} />

      {/* Radio Mode */}
      <RadioMode messages={messages} currentUser={activeUser} />

      <div className="chat-foot">
        <span>Messages save on this device</span>
        <span>{members.length} {members.length === 1 ? 'member' : 'members'} online</span>
      </div>
    </section>
  );
}
