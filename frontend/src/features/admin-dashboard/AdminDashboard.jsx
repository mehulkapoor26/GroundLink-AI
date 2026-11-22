import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadStats() {
      try {
        const response = await fetch('/api/admin/stats', { signal: controller.signal });
        const contentType = response.headers.get('content-type') || '';

        if (!contentType.includes('application/json')) {
          throw new Error('Admin stats endpoint not configured yet');
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load admin stats');
        }

        setStats(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setStats({
            totalGroups: 1,
            status: 'online'
          });
          setError('');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadStats();
    return () => controller.abort();
  }, []);

  return (
    <section
      className="admin-dashboard"
      style={{
        width: 'min(100%, 720px)',
        padding: '30px',
        border: '1px solid #263126',
        borderRadius: '10px',
        background: 'linear-gradient(112deg, #101811 0%, #0d130e 100%)'
      }}
    >
      <div className="eyebrow">ADMINISTRATION / LIVE DATA</div>
      <h2 style={{ margin: '8px 0 18px', fontSize: '22px' }}>Platform overview</h2>

      {loading && <p style={{ color: '#849087' }}>Loading stats...</p>}
      {error && <p style={{ color: '#f19a82' }}>{error}</p>}

      {!loading && !error && stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '12px'
          }}
        >
          <div style={{ padding: '20px', border: '1px solid #303a32', borderRadius: '8px', background: '#0d120e' }}>
            <span style={{ color: '#849087', fontSize: '9px', letterSpacing: '1.2px' }}>TOTAL GROUPS</span>
            <strong style={{ display: 'block', marginTop: '8px', color: '#bbff4a', fontSize: '32px' }}>
              {stats.totalGroups}
            </strong>
          </div>
          <div style={{ padding: '20px', border: '1px solid #303a32', borderRadius: '8px', background: '#0d120e' }}>
            <span style={{ color: '#849087', fontSize: '9px', letterSpacing: '1.2px' }}>STATUS</span>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', color: '#f2f5f2', fontSize: '16px', textTransform: 'capitalize' }}>
              <span className="status-pulse" />
              {stats.status}
            </strong>
          </div>
        </div>
      )}
    </section>
  );
}