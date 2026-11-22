/**
 * App — root shell.
 *
 * Socket + group membership is managed HERE (lifted up), so switching
 * between Messaging and Walkie-Talkie tabs never causes a double
 * group:join, duplicate listeners, or a mid-switch message gap.
 *
 * Both MessagePanel and VoicePanel receive messages/connection/speakers
 * as props and no longer manage their own socket subscription.
 * Emergency SOS, QR Attendance, and Admin Dashboard panels are integrated alongside them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import FeatureCard from '../components/FeatureCard.jsx';
import GroupActions from '../features/group-management/GroupActions.jsx';
import MessagePanel from '../features/messaging/MessagePanel.jsx';
import InvitePanel from '../features/qr-joining/InvitePanel.jsx';
import VoicePanel from '../features/voice-messages/VoicePanel.jsx';
import EmergencySOSPanel from '../features/emergency-sos/EmergencySOSPanel.jsx';
import AdminDashboard from '../features/admin-dashboard/AdminDashboard.jsx';
import QrAttendancePanel from '../features/qr-attendance/QrAttendancePanel.jsx';
import { features } from '../utils/features.js';
import { api } from '../services/api.js';
import { socket } from '../services/socket.js';
import {
  cacheGroup, cacheMessage, getCachedGroup, getCachedGroupByCode,
  getCachedMessages, getVoiceNote, mergeMessages, updateVoiceNote,
} from '../services/localDb.js';
import {
import CampusVectorNav from "../components/CampusVectorNav";
  broadcastPendingVoiceNotes, resetInterruptedVoiceNotes, syncPendingVoiceNotes,
} from '../services/voiceNotes.js';

const ACTIVE_GROUP_KEY = 'groundlink-active-group-id';

export default function App() {
  const initialCode = new URLSearchParams(window.location.search).get('join');
  const [active, setActive] = useState(() => {
    if (initialCode) return 'messaging';
    try {
      return window.localStorage.getItem('groundlink-active-tab') || 'messaging';
    } catch {
      return 'messaging';
    }
  });
  const [group, setGroup]             = useState(null);
  const [messages, setMessages]       = useState([]);
  const [members, setMembers]         = useState([]);
  const [connection, setConnection]   = useState(socket.connected);
  const [speakers, setSpeakers]       = useState([]);
  const [membersOnline, setMembersOnline] = useState(0);
  const [health, setHealth]           = useState(false);
  const [mobileNav, setMobileNav]     = useState(false);
  const [joinError, setJoinError]     = useState('');
  const onMembers = useCallback(count => setMembersOnline(count), []);
  const [currentUser, setCurrentUser] = useState(() => {
    const guestName = `Guest ${Math.floor(10 + Math.random() * 89)}`;
    try {
      return window.localStorage.getItem('groundlink-display-name') ||
        window.sessionStorage.getItem('groundlink-name') || guestName;
    } catch { return guestName; }
  });
  const userName = useRef(currentUser);
  const joinedRef = useRef(false);

  const updateUserName = useCallback(nextName => {
    const cleaned = String(nextName || '').trim().slice(0, 32);
    if (!cleaned) return;
    userName.current = cleaned;
    setCurrentUser(cleaned);
    try {
      window.localStorage.setItem('groundlink-display-name', cleaned);
      window.sessionStorage.setItem('groundlink-name', cleaned);
    } catch { /* Storage may be disabled. */ }
    if (group?.code && socket.connected) {
      try {
        socket.emit('group:join', { code: group.code, name: cleaned }, result => {
          if (result?.ok && result.member?.name) {
            userName.current = result.member.name;
            setCurrentUser(result.member.name);
            try { window.sessionStorage.setItem('groundlink-name', result.member.name); } catch { /* ignore */ }
          }
        });
      } catch { /* A local display name still works while offline. */ }
    }
  }, [group?.code]);

  // ── Persist / restore active group ───────────────────────────────
  const setActiveGroup = useCallback(nextGroup => {
    setGroup(nextGroup);
    cacheGroup(nextGroup).catch(() => {});
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

    const restoreOnline = initialCode
      ? api(`/groups/${encodeURIComponent(initialCode)}/join`, { method: 'POST', body: JSON.stringify({}) })
      : savedGroupId
        ? api(`/groups/id/${encodeURIComponent(savedGroupId)}`)
        : Promise.resolve(null);
    const restore = restoreOnline.catch(async () => initialCode
      ? getCachedGroupByCode(initialCode)
      : getCachedGroup(savedGroupId));

    restore.then(restoredGroup => {
      if (mounted && restoredGroup) setActiveGroup(restoredGroup);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [initialCode, setActiveGroup]);

  // ── Single socket subscription — lives as long as group is active ─
  // This runs once per group.code change, not per tab switch.
  // Both MessagePanel and VoicePanel read from the shared state below.
  useEffect(() => {
    if (!group) return;
    let mounted = true;
    joinedRef.current = false;

    function onQueueChange(message) {
      if (!mounted) return;
      setMessages(current => mergeMessages(current, [message]));
      cacheMessage(message).catch(() => {});
    }

    async function syncAndPublish() {
      await syncPendingVoiceNotes(group.code, onQueueChange);
      if (joinedRef.current) await broadcastPendingVoiceNotes(group.code, onQueueChange);
    }

    async function join() {
      // Load cached messages immediately (offline-first).
      try {
        const cached = await getCachedMessages(group.code);
        if (mounted) setMessages(cached);
        if (group.localOnly) {
          if (socket.connected) socket.disconnect();
          if (mounted) setConnection(false);
          return;
        }
        // Fetch authoritative history.
        const history = await api(`/groups/${group.code}/messages`);
        if (mounted) {
          const hydratedHistory = history.map(message => message.type === 'voice'
            ? { ...message, status: 'synced' }
            : message);
          setMessages(current => mergeMessages(current, hydratedHistory));
          await Promise.all(hydratedHistory.map(async message => {
            cacheMessage(message).catch(() => {});
            const clientMessageId = message.clientMessageId || message.clientId;
            if (message.type === 'voice' && clientMessageId) {
              const localNote = await getVoiceNote(clientMessageId).catch(() => null);
              if (localNote && localNote.status !== 'synced') {
                await updateVoiceNote(clientMessageId, { ...message, status: 'synced', broadcastPending: true }).catch(() => {});
              }
            }
          }));
        }
      } catch { /* Cached messages and voice blobs remain available offline. */ }

      socket.connect();
      if (socket.connected) joinSocketGroup();
    }

    function joinSocketGroup() {
      if (!socket.connected) return;
      try {
        socket.emit('group:join', { code: group.code, name: userName.current }, result => {
          if (!mounted) return;
          if (result?.ok) {
            joinedRef.current = true;
            setJoinError('');
            sessionStorage.setItem('groundlink-name', result.member.name);
            userName.current = result.member.name;
            setCurrentUser(result.member.name);
            syncAndPublish();
          } else {
            setJoinError(result?.error || 'Unable to join group');
          }
        });
      } catch { /* Socket access is optional; local voice notes remain usable. */ }
    }

    const onMessage = message => {
      if (message.groupCode !== group.code) return;
      const deliveredMessage = message.type === 'voice' ? { ...message, status: 'synced' } : message;
      setMessages(current => mergeMessages(current, [deliveredMessage]));
      const clientMessageId = message.clientMessageId || message.clientId;
      if (clientMessageId) {
        updateVoiceNote(clientMessageId, { ...deliveredMessage, status: 'synced', broadcastPending: false }).catch(() => {});
      }
      cacheMessage(deliveredMessage).catch(() => {});
    };

    const onMemberUpdate = list => {
      if (!mounted) return;
      setMembers(list);
      setMembersOnline(list.length);
    };

    const onConnect    = () => { if (mounted) { setConnection(!group.localOnly); if (!group.localOnly) joinSocketGroup(); } };
    const onDisconnect = () => { joinedRef.current = false; if (mounted) setConnection(false); };
    const onOnline = () => { syncAndPublish(); };
    const onOffline = () => { resetInterruptedVoiceNotes(group.code, onQueueChange); };
    const onFocus = () => { if (document.visibilityState === 'visible') syncAndPublish(); };
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') syncAndPublish(); };

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
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    syncAndPublish();

    join();

    return () => {
      mounted = false;
      socket.off('message:new',    onMessage);
      socket.off('members:update', onMemberUpdate);
      socket.off('connect',        onConnect);
      socket.off('disconnect',     onDisconnect);
      socket.off('voice:speaking', onSpeaking);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      joinedRef.current = false;
    };
  }, [group]);

  // ── Optimistic append for voice messages sent from this client ───
  const onVoiceSent = useCallback(message => {
    if (message?.groupCode === group?.code) {
      setMessages(current => mergeMessages(current, [message]));
      cacheMessage(message).catch(() => {});
      if (message.status === 'synced' && message.broadcastPending && joinedRef.current) {
        broadcastPendingVoiceNotes(group.code, updated => {
          setMessages(current => mergeMessages(current, [updated]));
          cacheMessage(updated).catch(() => {});
        });
      }
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
    try { window.localStorage.setItem('groundlink-active-tab', id); } catch {}
  }

  const isMessaging       = active === 'messaging';
  const isVoiceTab        = active === 'voice-messages';
  const isQrJoining       = active === 'qr-joining';
  const isEmergencySos    = active === 'emergency-sos';
  const isQrAttendance    = active === 'qr-attendance';
  const isAdminDashboard  = active === 'admin-dashboard';
  const isKnownFeature    = isMessaging || isVoiceTab || isQrJoining || isEmergencySos || isQrAttendance || isAdminDashboard;

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

          {/* ── Admin Dashboard tab ──────────────────────────── */}
          {isAdminDashboard && (
            <AdminDashboard />
          )}

          {/* ── QR Attendance tab ────────────────────────────── */}
          {isQrAttendance && (
            <>
              <div className="section-head">
                <div>
                  <div className="eyebrow">YOUR ACTIVE SPACE</div>
                  <h2>QR Attendance</h2>
                </div>
                {group && (
                  <div className="member-count">
                    <span className="status-pulse" />{membersOnline} online
                  </div>
                )}
              </div>
              <QrAttendancePanel group={group} />
            </>
          )}

          {/* ── Group workspace panels ───────────────────────── */}
          {!isAdminDashboard && !isQrAttendance && (
            group ? (
              <>
                <div className="section-head">
                  <div>
                    <div className="eyebrow">YOUR ACTIVE SPACE</div>
                    <h2>{isEmergencySos ? 'Emergency response' : isVoiceTab ? 'Walkie-Talkie' : 'Team hub'}</h2>
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
                      currentUser={currentUser}
                      onUserNameChange={updateUserName}
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
                      currentUser={currentUser}
                    />
                  </div>
                )}

                {/* Emergency SOS tab */}
                {isEmergencySos && (
                  <EmergencySOSPanel group={group} onMembers={onMembers} />
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
                {isEmergencySos && <EmergencySOSPanel group={null} />}
            {(chosenFeature?.id === "offline-directions" || chosenFeature?.id === "nav" || chosenFeature?.id === "navigation" || chosenFeature?.id === "campus-nav") && (
              <CampusVectorNav />
            )}
              </>
            )
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
