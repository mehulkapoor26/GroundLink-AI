import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import FeatureCard from '../components/FeatureCard.jsx';
import GroupActions from '../features/group-management/GroupActions.jsx';
import MessagePanel from '../features/messaging/MessagePanel.jsx';
import InvitePanel from '../features/qr-joining/InvitePanel.jsx';
import EmergencySOSPanel from '../features/emergency-sos/EmergencySOSPanel.jsx';
import { features } from '../utils/features.js';
import AdminDashboard from '../features/admin-dashboard/AdminDashboard.jsx';
import { api } from '../services/api.js';
import QrAttendancePanel from '../features/qr-attendance/QrAttendancePanel.jsx';

const ACTIVE_GROUP_KEY = 'groundlink-active-group-id';

export default function App() {
  const initialCode = new URLSearchParams(window.location.search).get('join');

const [active, setActive] = useState(() => {
  try {
    return window.localStorage.getItem('groundlink-active-tab') || 'messaging';
  } catch {
    return 'messaging';
  }
});  const [group, setGroup] = useState(null);
  const [membersOnline, setMembersOnline] = useState(0);
  const [health, setHealth] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const onMembers = useCallback(count => setMembersOnline(count), []);
  const setActiveGroup = useCallback(nextGroup => {
    setGroup(nextGroup);
    try {
      if (nextGroup?.id) window.localStorage.setItem(ACTIVE_GROUP_KEY, nextGroup.id);
      else window.localStorage.removeItem(ACTIVE_GROUP_KEY);
    } catch { /* Keep the current session usable if browser storage is unavailable. */ }
  }, []);

  useEffect(() => {
    let mounted = true;
    api('/health').then(() => { if (mounted) setHealth(true); }).catch(() => { if (mounted) setHealth(false); });
    let savedGroupId = null;
    try { savedGroupId = window.localStorage.getItem(ACTIVE_GROUP_KEY); } catch { /* Storage may be disabled by the browser. */ }
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
          if (window.localStorage.getItem(ACTIVE_GROUP_KEY) === savedGroupId) window.localStorage.removeItem(ACTIVE_GROUP_KEY);
        } catch { /* Storage may be disabled by the browser. */ }
      }
    });
    return () => { mounted = false; };
  }, [initialCode, setActiveGroup]);

  const chosenFeature = useMemo(() => features.find(item => item.id === active) || features[0], [active]);
  function selectFeature(id) { setActive(id); setMobileNav(false); }
try { window.localStorage.setItem('groundlink-active-tab', id); } catch {}
  return <div className="app-shell">
    <div className="mobile-top"><button className="hamburger" onClick={() => setMobileNav(value => !value)}>☰</button><span>GROUNDLINK <b>AI</b></span><span className={`mini-status ${health ? 'up' : ''}`}/></div>
    <Sidebar active={active} onSelect={selectFeature}/>
    {mobileNav && <button aria-label="Close navigation" className="mobile-scrim" onClick={() => setMobileNav(false)}/>}
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">GROUNDLINK <span>/</span> {chosenFeature.label.toUpperCase()}</div><div className="topbar-right"><div className="network-pill"><span className={`status-pulse ${health ? '' : 'offline'}`}/>{health ? 'LOCAL SERVER ONLINE' : 'SERVER UNAVAILABLE'}</div><div className="profile-avatar">GL</div></div></header>
      <div className="page-content">
        <section className="hero"><div><div className="eyebrow"><span className="eyebrow-line"/> OFFLINE-FIRST COORDINATION</div><h1>Stay connected.<br/><span>Stay in the loop.</span></h1><p>Real-time coordination for teams on the ground.<br className="desktop-break"/> No internet required. Just your local network.</p><GroupActions onJoined={setActiveGroup}/></div><div className="hero-graphic" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="signal-core"><span>G</span><i/></div><div className="orbit-label label-a">LOCAL<br/>WI-FI</div><div className="orbit-label label-b">TEAM<br/>LINKED</div></div></section>
        {active === 'admin-dashboard' && <AdminDashboard />}
        {group && active === 'emergency-sos' ? <>

        {active === 'qr-attendance' ? <>
          <div className="section-head"><div><div className="eyebrow">YOUR ACTIVE SPACE</div><h2>QR Attendance</h2></div>{group && <div className="member-count"><span className="status-pulse"/>{membersOnline} online</div>}</div>
          <QrAttendancePanel group={group}/>
        </> : group && active === 'emergency-sos' ? <>
          <div className="section-head"><div><div className="eyebrow">YOUR ACTIVE SPACE</div><h2>Emergency response</h2></div><div className="member-count"><span className="status-pulse"/>{membersOnline} online</div></div>
          <EmergencySOSPanel group={group} onMembers={onMembers}/>
        </> : group ? <>
          <div className="section-head"><div><div className="eyebrow">YOUR ACTIVE SPACE</div><h2>Team hub</h2></div><div className="member-count"><span className="status-pulse"/>{membersOnline} online</div></div>
          <div className="workspace-grid"><MessagePanel group={group} onMembers={onMembers}/><InvitePanel group={group}/></div>
        </> : <>
          <div className="section-head"><div><div className="eyebrow">BUILT FOR THE FIELD</div><h2>Everything your team needs</h2></div><span className="section-note">A LOCAL-FIRST TOOLKIT</span></div>
          <div className="feature-grid">{features.map(feature => <FeatureCard key={feature.id} feature={feature} onClick={() => selectFeature(feature.id)}/>)}</div>
          {active === 'emergency-sos' && <EmergencySOSPanel group={null}/>}
        </>}

        {active !== 'messaging' && active !== 'qr-joining' && active !== 'emergency-sos' && active !== 'admin-dashboard' && <section className="placeholder"><div className="placeholder-icon">{chosenFeature.icon}</div><div className="eyebrow">FEATURE MODULE / IN DEVELOPMENT</div><h2>{chosenFeature.label}</h2><p>{chosenFeature.description}. This module is reserved in the foundation and is not implemented yet.</p><span className="tag">COMING SOON</span></section>}
        {active !== 'messaging' && active !== 'qr-joining' && active !== 'emergency-sos' && active !== 'qr-attendance' && <section className="placeholder"><div className="placeholder-icon">{chosenFeature.icon}</div><div className="eyebrow">FEATURE MODULE / IN DEVELOPMENT</div><h2>{chosenFeature.label}</h2><p>{chosenFeature.description}. This module is reserved in the foundation and is not implemented yet.</p><span className="tag">COMING SOON</span></section>}
        <footer><span>© 2026 GROUNDLINK AI</span><span>BUILT FOR CONNECTION, EVEN OFFLINE <b>↗</b></span></footer>
      </div>
    </main>
  </div>;
}