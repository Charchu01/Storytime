import { useEffect, useState, useCallback } from "react";

export default function StatusPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [costs, setCosts] = useState([]);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => { document.title = "System Status — Storytime"; }, []);

  useEffect(() => {
    try {
      const clerkUser = window.__clerk_user;
      const email = clerkUser?.primaryEmailAddress?.emailAddress;
      if (email === "dom@ready.cards") {
        setAuthorized(true);
        return;
      }
    } catch (err) { console.warn("Auth check failed:", err.message); }
    // If not authorized via Clerk, remain unauthorized
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error(`Health check returned ${res.status}`);
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setHealth({ status: "error", error: err.message });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  useEffect(() => {
    try {
      const log = JSON.parse(localStorage.getItem("st_costs") || "[]");
      setCosts(log);
    } catch (err) { console.warn("Failed to load cost data:", err.message); }
  }, []);

  if (!authorized) {
    return (
      <div className="legal-page">
        <div className="legal-inner">
          <h1 className="legal-h1">Access Denied</h1>
          <p>This page is restricted to administrators.</p>
        </div>
      </div>
    );
  }

  const last10 = costs.slice(-10).reverse();
  const thisMonth = costs.filter(c => {
    const d = new Date(c.ts);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalCost = thisMonth.reduce((sum, c) => sum + (c.cost || 0), 0);
  const last50 = costs.slice(-50);
  const successRate = last50.length > 0
    ? Math.round((last50.filter(c => c.success).length / last50.length) * 100)
    : 0;

  return (
    <div className="legal-page">
      <div className="legal-inner">
        <h1 className="legal-h1">System Status</h1>

        {loading ? (
          <p>Checking services...</p>
        ) : (
          <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
            <div style={{ padding: 16, borderRadius: 12, background: health?.hasAnthropic ? "#dcfce7" : "#fee2e2", flex: 1 }}>
              <strong>{health?.hasAnthropic ? "🟢" : "🔴"} Anthropic</strong>
              <p style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{health?.hasAnthropic ? "Connected" : "Not configured"}</p>
            </div>
            <div style={{ padding: 16, borderRadius: 12, background: health?.hasReplicate ? "#dcfce7" : "#fee2e2", flex: 1 }}>
              <strong>{health?.hasReplicate ? "🟢" : "🔴"} Replicate</strong>
              <p style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{health?.hasReplicate ? "Connected" : "Not configured"}</p>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <div style={{ padding: 16, borderRadius: 12, background: "#f3f4f6", flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 900 }}>${totalCost.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: "#666" }}>This month</div>
          </div>
          <div style={{ padding: 16, borderRadius: 12, background: "#f3f4f6", flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{successRate}%</div>
            <div style={{ fontSize: 12, color: "#666" }}>Success rate (last 50)</div>
          </div>
        </div>

        <h2>Recent generations</h2>
        {last10.length === 0 ? (
          <p style={{ color: "#666" }}>No generation logs yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: 8, textAlign: "left" }}>Time</th>
                  <th style={{ padding: 8, textAlign: "left" }}>Type</th>
                  <th style={{ padding: 8, textAlign: "left" }}>Status</th>
                  <th style={{ padding: 8, textAlign: "right" }}>Duration</th>
                  <th style={{ padding: 8, textAlign: "right" }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {last10.map((c, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: 8 }}>{new Date(c.ts).toLocaleTimeString()}</td>
                    <td style={{ padding: 8 }}>{c.type}</td>
                    <td style={{ padding: 8 }}>{c.success ? "✅" : "❌"}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{c.durationMs ? `${(c.durationMs / 1000).toFixed(1)}s` : "-"}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>${(c.cost || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
