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

export default function MessagePanel({ group, onMembers }) {
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [text, setText] = useState('');
  const [connection, setConnection] = useState(socket.connected);
  const [error, setError] = useState('');
  const [speakers, setSpeakers] = useState([]);
  const [gnaniAvailable, setGnaniAvailable] = useState(false);
  const bottom = useRef(null);
  const name = useRef(sessionStorage.getItem('groundlink-name') || `Guest ${Math.floor(10 + Math.random() * 89)}`);

  // Check Gnani availability once
  useEffect(() => {
    fetch('/api/gnani/status').then(r => r.json())
      .then(d => setGnaniAvailable(!!d.configured))
      .catch(() => setGnaniAvailable(false));
  }, []);

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
      socket.emit('group:join', { code: group.code, name: name.current }, result => {
        if (!mounted) return;
        if (result?.ok) { setError(''); sessionStorage.setItem('groundlink-name', result.member.name); }
        else setError(result?.error || 'Unable to join group');
      });
    }
    const onMessage = message => {
      if (message.groupCode === group.code) {
        setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
        cacheMessage(message).catch(() => { });
      }
    };
    const onMemberUpdate = list => { setMembers(list); onMembers(list.length); };
    const onConnect = () => setConnection(true);
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

  const currentUser = name.current;

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
