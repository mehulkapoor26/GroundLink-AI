/**
 * App — root shell.
 *
 * Socket + group membership is managed HERE (lifted up), so switching
 * between Messaging and Walkie-Talkie tabs never causes a double
 * group:join, duplicate listeners, or a mid-switch message gap.
 *
 * Both MessagePanel and VoicePanel receive messages/connection/speakers
 * as props and no longer manage their own socket subscription.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import FeatureCard from '../components/FeatureCard.jsx';
import GroupActions from '../features/group-management/GroupActions.jsx';
import MessagePanel from '../features/messaging/MessagePanel.jsx';
import InvitePanel from '../features/qr-joining/InvitePanel.jsx';
import VoicePanel from '../features/voice-messages/VoicePanel.jsx';
import { features } from '../utils/features.js';
import { api } from '../services/api.js';
import { socket } from '../services/socket.js';
import { cacheMessage, getCachedMessages } from '../services/localDb.js';

const ACTIVE_GROUP_KEY = 'groundlink-active-group-id';

export default function App() {
  const initialCode = new URLSearchParams(window.location.search).get('join');
  const [active, setActive]           = useState('messaging');
  const [group, setGroup]             = useState(null);
  const [messages, setMessages]       = useState([]);
  const [members, setMembers]         = useState([]);
  const [connection, setConnection]   = useState(socket.connected);
  const [speakers, setSpeakers]       = useState([]);
  const [membersOnline, setMembersOnline] = useState(0);
  const [health, setHealth]           = useState(false);
  const [mobileNav, setMobileNav]     = useState(false);
  const [joinError, setJoinError]     = useState('');
  const userName = useRef(
    sessionStorage.getItem('groundlink-name') ||
    `Guest ${Math.floor(10 + Math.random() * 89)}`
  );

  // ── Persist / restore active group ───────────────────────────────
  const setActiveGroup = useCallback(nextGroup => {
    setGroup(nextGroup);
    setMessages([]);   // clear stale messages when group changes
    setMembers([]);
    setSpeakers([]);
    try {
      if (nextGroup?.id) window.localStorage.setItem(ACTIVE_GROUP_KEY, nextGroup.id);
      else window.localStorage.removeItem(ACTIVE_GROUP_KEY);
    } catch { /* ignore */ }
  }, []);

  // ── Health check + group restore on mount ────────────────────────
  useEffect(() => {
    let mounted = true;
    api('/health')
      .then(() => { if (mounted) setHealth(true); })
      .catch(() => { if (mounted) setHealth(false); });

    let savedGroupId = null;
    try { savedGroupId = window.localStorage.getItem(ACTIVE_GROUP_KEY); }
    catch { /* ignore */ }

    const restore = initialCode
      ? api(`/groups/${encodeURIComponent(initialCode)}/join`, { method: 'POST', body: JSON.stringify({}) })
      : savedGroupId
        ? api(`/groups/id/${encodeURIComponent(savedGroupId)}`)
        : Promise.resolve(null);

    restore.then(restoredGroup => {
      if (mounted && restoredGroup) setActiveGroup(restoredGroup);
    }).catch(() => {
      if (!initialCode && mounted && savedGroupId) {
        try {
          if (window.localStorage.getItem(ACTIVE_GROUP_KEY) === savedGroupId)
            window.localStorage.removeItem(ACTIVE_GROUP_KEY);
        } catch { /* ignore */ }
      }
    });
    return () => { mounted = false; };
  }, [initialCode, setActiveGroup]);

  // ── Single socket subscription — lives as long as group is active ─
  // This runs once per group.code change, not per tab switch.
  // Both MessagePanel and VoicePanel read from the shared state below.
  useEffect(() => {
    if (!group) return;
    let mounted = true;

    async function join() {
      // Load cached messages immediately (offline-first).
      try {
        const cached = await getCachedMessages(group.code);
        if (mounted) setMessages(cached);
        // Fetch authoritative history.
        const history = await api(`/groups/${group.code}/messages`);
        if (mounted) {
          setMessages(history);
          history.forEach(cacheMessage);
        }
      } catch { /* cached state remains usable */ }

      socket.connect();
      socket.emit('group:join', { code: group.code, name: userName.current }, result => {
        if (!mounted) return;
        if (result?.ok) {
          setJoinError('');
          // Persist the server-assigned name (may have been de-duped).
          sessionStorage.setItem('groundlink-name', result.member.name);
          userName.current = result.member.name;
        } else {
          setJoinError(result?.error || 'Unable to join group');
        }
      });
    }

    const onMessage = message => {
      if (message.groupCode !== group.code) return;
      setMessages(current =>
        current.some(m => m.id === message.id) ? current : [...current, message]
      );
      cacheMessage(message).catch(() => {});
    };

    const onMemberUpdate = list => {
      if (!mounted) return;
      setMembers(list);
      setMembersOnline(list.length);
    };

    const onConnect    = () => { if (mounted) setConnection(true); };
    const onDisconnect = () => { if (mounted) setConnection(false); };

    const onSpeaking = ({ socketId, name: speakerName, speaking }) => {
      if (!mounted) return;
      setSpeakers(prev => {
        const without = prev.filter(s => s.socketId !== socketId);
        return speaking
          ? [...without, { socketId, name: speakerName, speaking: true }]
          : without;
      });
    };

    socket.on('message:new',    onMessage);
    socket.on('members:update', onMemberUpdate);
    socket.on('connect',        onConnect);
    socket.on('disconnect',     onDisconnect);
    socket.on('voice:speaking', onSpeaking);

    // Re-join automatically after a reconnect so server state is restored.
    const onReconnect = () => {
      if (!mounted || !group) return;
      socket.emit('group:join', { code: group.code, name: userName.current }, result => {
        if (result?.ok) {
          sessionStorage.setItem('groundlink-name', result.member.name);
          userName.current = result.member.name;
        }
      });
    };
    socket.on('connect', onReconnect); // second listener — fires after onConnect

    join();

    return () => {
      mounted = false;
      socket.off('message:new',    onMessage);
      socket.off('members:update', onMemberUpdate);
      socket.off('connect',        onConnect);
      socket.off('connect',        onReconnect);
      socket.off('disconnect',     onDisconnect);
      socket.off('voice:speaking', onSpeaking);
    };
  }, [group]); // group object ref changes only when setActiveGroup is called

  // ── Optimistic append for voice messages sent from this client ───
  const onVoiceSent = useCallback(message => {
    if (message?.groupCode === group?.code) {
      setMessages(current =>
        current.some(m => m.id === message.id) ? current : [...current, message]
      );
      cacheMessage(message).catch(() => {});
    }
  }, [group]);

  // ── Sidebar navigation ───────────────────────────────────────────
  const chosenFeature = useMemo(
    () => features.find(item => item.id === active) || features[0],
    [active]
  );

  function selectFeature(id) {
    setActive(id);
    setMobileNav(false);
  }

  const isMessaging    = active === 'messaging';
  const isVoiceTab     = active === 'voice-messages';
  const isQrJoining    = active === 'qr-joining';
  const isKnownFeature = isMessaging || isVoiceTab || isQrJoining;

  return (
    <div className="app-shell">
      {/* ── Mobile top bar ─────────────────────────────────────── */}
      <div className="mobile-top">
        <button className="hamburger" onClick={() => setMobileNav(v => !v)}>☰</button>
        <span>GROUNDLINK <b>AI</b></span>
        <span className={`mini-status ${health ? 'up' : ''}`} />
      </div>

      <Sidebar active={active} onSelect={selectFeature} />

      {mobileNav && (
        <button
          aria-label="Close navigation"
          className="mobile-scrim"
          onClick={() => setMobileNav(false)}
        />
      )}

      <main className="main-content">
        {/* ── Top bar ──────────────────────────────────────────── */}
        <header className="topbar">
          <div className="breadcrumb">
            GROUNDLINK <span>/</span> {chosenFeature.label.toUpperCase()}
          </div>
          <div className="topbar-right">
            <div className="network-pill">
              <span className={`status-pulse ${health ? '' : 'offline'}`} />
              {health ? 'LOCAL SERVER ONLINE' : 'SERVER UNAVAILABLE'}
            </div>
            <div className="profile-avatar">GL</div>
          </div>
        </header>

        <div className="page-content">
          {/* ── Hero (always visible) ────────────────────────── */}
          <section className="hero">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" /> OFFLINE-FIRST COORDINATION
              </div>
              <h1>Stay connected.<br /><span>Stay in the loop.</span></h1>
              <p>
                Real-time coordination for teams on the ground.<br className="desktop-break" />
                No internet required. Just your local network.
              </p>
              <GroupActions onJoined={setActiveGroup} />
            </div>
            <div className="hero-graphic" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="orbit orbit-three" />
              <div className="signal-core"><span>G</span><i /></div>
              <div className="orbit-label label-a">LOCAL<br />WI-FI</div>
              <div className="orbit-label label-b">TEAM<br />LINKED</div>
            </div>
          </section>

          {/* ── Workspace (group active) ─────────────────────── */}
          {group ? (
            <>
              <div className="section-head">
                <div>
                  <div className="eyebrow">YOUR ACTIVE SPACE</div>
                  <h2>Team hub</h2>
                </div>
                <div className="member-count">
                  <span className="status-pulse" />{membersOnline} online
                </div>
              </div>

              {joinError && <div className="chat-error">{joinError}</div>}

              {/* Messaging tab */}
              {isMessaging && (
                <div className="workspace-grid">
                  <MessagePanel
                    group={group}
                    messages={messages}
                    members={members}
                    connection={connection}
                    speakers={speakers}
                    onVoiceSent={onVoiceSent}
                    currentUser={userName.current}
                  />
                  <InvitePanel group={group} />
                </div>
              )}

              {/* Walkie-Talkie tab */}
              {isVoiceTab && (
                <div className="workspace-grid">
                  <VoicePanel
                    group={group}
                    messages={messages}
                    members={members}
                    connection={connection}
                    speakers={speakers}
                    onVoiceSent={onVoiceSent}
                    currentUser={userName.current}
                  />
                </div>
              )}

              {/* QR Joining tab */}
              {isQrJoining && (
                <div className="workspace-grid">
                  <InvitePanel group={group} />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="section-head">
                <div>
                  <div className="eyebrow">BUILT FOR THE FIELD</div>
                  <h2>Everything your team needs</h2>
                </div>
                <span className="section-note">A LOCAL-FIRST TOOLKIT</span>
              </div>
              <div className="feature-grid">
                {features.map(feature => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    onClick={() => selectFeature(feature.id)}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── Coming-soon placeholder ──────────────────────── */}
          {!isKnownFeature && (
            <section className="placeholder">
              <div className="placeholder-icon">{chosenFeature.icon}</div>
              <div className="eyebrow">FEATURE MODULE / IN DEVELOPMENT</div>
              <h2>{chosenFeature.label}</h2>
              <p>{chosenFeature.description}. This module is reserved in the foundation and is not implemented yet.</p>
              <span className="tag">COMING SOON</span>
            </section>
          )}

          <footer>
            <span>© 2026 GROUNDLINK AI</span>
            <span>BUILT FOR CONNECTION, EVEN OFFLINE <b>↗</b></span>
          </footer>
        </div>
      </main>
    </div>
  );
}
