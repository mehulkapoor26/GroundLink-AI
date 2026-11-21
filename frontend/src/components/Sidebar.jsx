import Brand from './Brand.jsx';
import { features } from '../utils/features.js';
export default function Sidebar({ active, onSelect }) {
  return <aside className="sidebar"><Brand/><div className="nav-label">WORKSPACE</div><nav>{features.map(item => <button key={item.id} onClick={() => onSelect(item.id)} className={`nav-item ${active === item.id ? 'selected' : ''}`}><span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.state === 'planned' && <i className="nav-dot"/>}</button>)}</nav><div className="sidebar-foot"><span className="status-pulse"/> Local network ready <span className="version">v0.1</span></div></aside>;
}
