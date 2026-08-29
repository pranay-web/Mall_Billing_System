import { useState, useEffect } from 'react';
import { TrendingUp, Activity, Store } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

export default function ManagerDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/dashboard`);
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error("Failed to fetch dashboard stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    // In a real app, we'd use WebSocket for real-time updates. Polling for demo.
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div style={{ textAlign: 'center', marginTop: '40px' }}>Loading dashboard...</div>;
  if (!stats) return <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--danger)' }}>Failed to load data</div>;

  return (
    <div className="animate-fade-in">
      <h2 style={{ marginBottom: '24px' }}>Mall Management Dashboard</h2>
      
      <div className="grid" style={{ marginBottom: '24px' }}>
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '50%' }}>
            <TrendingUp size={32} color="var(--accent)" />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)' }}>Total Sales</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>₹{stats.total_sales.toLocaleString()}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '50%' }}>
            <Activity size={32} color="var(--success)" />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)' }}>Completed Transactions</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.total_transactions}</div>
          </div>
        </div>
      </div>

      <div className="glass-panel">
        <h3><Store style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} /> Showroom Performance</h3>
        <table style={{ marginTop: '16px' }}>
          <thead>
            <tr>
              <th>Showroom Name</th>
              <th>Total Revenue Generated</th>
            </tr>
          </thead>
          <tbody>
            {stats.showroom_breakdown.map((row, idx) => (
              <tr key={idx}>
                <td>{row.name}</td>
                <td style={{ fontWeight: '500' }}>₹{row.showroom_sales ? row.showroom_sales.toLocaleString() : 0}</td>
              </tr>
            ))}
            {stats.showroom_breakdown.length === 0 && (
              <tr><td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No sales data yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
