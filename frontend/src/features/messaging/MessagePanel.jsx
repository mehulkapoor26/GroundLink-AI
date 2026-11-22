/**
 * MessagePanel — live chat view (Messaging sidebar tab).
 *
 * Socket connection, group:join, and message/member/speaker state are
 * managed by App.jsx (lifted up) and passed in as props.  This prevents
 * the double group:join race that occurred when switching between the
 * Messaging and Walkie-Talkie tabs.
 */
import { useEffect, useRef } from 'react';
import { socket } from '../../services/socket.js';
import AudioBubble from '../voice-messages/AudioBubble.jsx';
import TextToSpeech from '../voice-messages/TextToSpeech.jsx';
import WalkieTalkie from '../voice-messages/WalkieTalkie.jsx';
import SpeakingIndicator from '../voice-messages/SpeakingIndicator.jsx';
import RadioMode from '../voice-messages/RadioMode.jsx';
import { useState } from 'react';

const initials = name => name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

export default function MessagePanel({
  group,
  messages,
  members,
  connection,
  speakers,
  onVoiceSent,
  currentUser,
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [gnaniAvailable, setGnaniAvailable] = useState(false);
  const bottom = useRef(null);

  // Check Gnani (transcription / TTS) availability once per mount.
  useEffect(() => {
    fetch('/api/gnani/status').then(r => r.json())
      .then(d => setGnaniAvailable(!!d.configured))
      .catch(() => setGnaniAvailable(false));
  }, []);

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
                  <time>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </time>
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

      {/* Walkie-Talkie PTT bar */}
      <WalkieTalkie group={group} connection={connection} onSend={onVoiceSent} />

      {/* Radio Mode */}
      <RadioMode messages={messages} currentUser={currentUser} />

      <div className="chat-foot">
        <span>Messages save on this device</span>
        <span>{members.length} {members.length === 1 ? 'member' : 'members'} online</span>
      </div>
    </section>
  );
}
