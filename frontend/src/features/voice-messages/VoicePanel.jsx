/**
 * VoicePanel — full-page Walkie-Talkie tab (standalone sidebar view).
 *
 * Socket connection, group:join, and message/member/speaker state are
 * managed by App.jsx (lifted up) and passed in as props — matching the
 * same pattern as MessagePanel so switching tabs is instant and
 * race-condition-free.
 */
import { useEffect, useRef, useState } from 'react';
import WalkieTalkie from './WalkieTalkie.jsx';
import SpeakingIndicator from './SpeakingIndicator.jsx';
import RadioMode from './RadioMode.jsx';
import AudioBubble from './AudioBubble.jsx';

const initials = name =>
  name.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

export default function VoicePanel({
  group,
  messages,
  members,
  connection,
  speakers,
  onVoiceSent,
  currentUser,
}) {
  const [gnaniAvailable, setGnaniAvailable] = useState(false);
  const bottom = useRef(null);

  // Check Gnani (transcription) availability once per mount.
  useEffect(() => {
    fetch('/api/gnani/status').then(r => r.json())
      .then(d => setGnaniAvailable(!!d.configured))
      .catch(() => setGnaniAvailable(false));
  }, []);

  // Only voice messages are shown in this tab.
  const voiceMessages = messages.filter(m => m.type === 'voice');

  // Auto-scroll to newest clip.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [voiceMessages.length]);

  return (
    <section className="chat-panel">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="panel-heading">
        <div>
          <div className="eyebrow">WALKIE-TALKIE · LIVE CHANNEL</div>
          <h2>{group.name}</h2>
        </div>
        <div className={`connection ${connection ? 'is-online' : ''}`}>
          <span /> {connection ? 'Connected' : 'Reconnecting'}
        </div>
      </div>

      {/* ── Members online ───────────────────────────────────────── */}
      <div className="chat-date">
        {members.length} {members.length === 1 ? 'MEMBER' : 'MEMBERS'} ONLINE · LOCAL SESSION
      </div>

      {/* ── JIT Push-to-Talk button ──────────────────────────────── */}
      <WalkieTalkie group={group} connection={connection} onSend={onVoiceSent} />

      {/* ── Live speaking indicator ──────────────────────────────── */}
      <SpeakingIndicator speakers={speakers} />

      {/* ── Radio Mode auto-play toggle ──────────────────────────── */}
      <RadioMode messages={voiceMessages} currentUser={currentUser} />

      {/* ── Recent voice transmissions ───────────────────────────── */}
      <div className="chat-body">
        {voiceMessages.length === 0 ? (
          <div className="empty-chat">
            <span>🎙</span>
            <strong>Channel is clear</strong>
            <p>Hold the button above to send your first voice message.</p>
          </div>
        ) : (
          voiceMessages.map(message => {
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
                  <AudioBubble message={message} gnaniAvailable={gnaniAvailable} />
                </div>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>

      <div className="chat-foot">
        <span>Voice clips save on this device</span>
        <span>{members.length} {members.length === 1 ? 'member' : 'members'} online</span>
      </div>
    </section>
  );
}
