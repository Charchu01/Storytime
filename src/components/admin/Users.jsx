import { useState, useEffect, useCallback } from "react";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch(`/api/admin?action=users&page=${page}&limit=20`),
        fetch("/api/admin?action=daily_stats&days=7"),
      ]);
      const u = await usersRes.json();
      const s = await statsRes.json();
      setUsers(u.users || []);
      setTotal(u.total || 0);
      setDailyStats(s.stats || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <Loading />;

  const today = dailyStats[dailyStats.length - 1] || {};
  const userStats = today.users || {};
  const totalBooks = users.reduce((sum, u) => sum + (u.bookCount || 0), 0);
  const avgBooksPerUser = total > 0 ? (totalBooks / total).toFixed(1) : "0";
  const returningUsers = users.filter(u => u.bookCount > 1).length;
  const returnRate = total > 0 ? Math.round((returningUsers / total) * 100) : 0;

  return (
    <div>
      {/* User Stats */}
      <div style={grid4}>
        <MetricCard value={total} label="Total Users" color="#3b82f6" />
        <MetricCard value={userStats.new || 0} label="New Today" color="#10b981" />
        <MetricCard value={`${returnRate}%`} label="Return Rate" color="#8b5cf6" />
        <MetricCard value={avgBooksPerUser} label="Books/User" color="#f59e0b" />
      </div>

      {/* User Table */}
      <div style={card}>
        <h3 style={cardTitle}>All Users</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>User</th>
                <th style={th}>Books</th>
                <th style={{ ...th, textAlign: "right" }}>Spent</th>
                <th style={th}>Last Active</th>
                <th style={th}>Vault</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.userId || i}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{user.email || user.userId}</div>
                  </td>
                  <td style={tdStyle}>{user.bookCount || 0}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#10b981" }}>
                    ${(user.totalSpent || 0).toFixed(2)}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "#64748b" }}>
                    {user.lastActive ? timeAgo(user.lastActive) : "-"}
                  </td>
                  <td style={tdStyle}>{user.vaultCharacters || 0}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8", padding: 40 }}>
                  No users tracked yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {total > 20 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
            <button style={pageBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span style={{ fontSize: 13, color: "#64748b", padding: "6px 12px" }}>
              Page {page + 1} of {Math.ceil(total / 20)}
            </span>
            <button style={pageBtn} disabled={(page + 1) * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ value, label, color }) {
  return (
    <div style={{ ...card, textAlign: "center", padding: "20px 16px" }}>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
    </div>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Loading() {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
    <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
  </div>;
}

const grid4 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 };
const card = { background: "#fff", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", marginBottom: 20 };
const cardTitle = { fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 16px" };
const table = { width: "100%", fontSize: 13, borderCollapse: "collapse" };
const th = { padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" };
const tdStyle = { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #f1f5f9" };
const pageBtn = { padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 };
