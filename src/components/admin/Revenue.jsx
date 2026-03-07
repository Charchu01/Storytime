import { useState, useEffect, useCallback } from "react";
import adminFetch from "../../lib/adminFetch";

export default function Revenue() {
  const [revenueData, setRevenueData] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [revRes, statsRes] = await Promise.all([
        adminFetch("/api/admin?action=revenue&days=30"),
        adminFetch("/api/admin?action=daily_stats&days=30"),
      ]);
      if (revRes.ok) { const rev = await revRes.json(); setRevenueData(rev.revenue || []); }
      if (statsRes.ok) { const stats = await statsRes.json(); setDailyStats(stats.stats || []); }
    } catch (err) {
      console.error("Failed to fetch revenue:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <Loading />;

  // Calculate totals
  const grossRevenue = revenueData.reduce((sum, d) => sum + (d.gross || 0), 0);
  const totalTransactions = revenueData.reduce((sum, d) => sum + (d.transactions || 0), 0);
  const failedPayments = revenueData.reduce((sum, d) => sum + (d.failed || 0), 0);

  const totalCosts = dailyStats.reduce((sum, d) => sum + (d.revenue?.costs || 0), 0);
  const netProfit = grossRevenue - totalCosts;
  const avgPerDay = revenueData.length > 0 ? grossRevenue / revenueData.length : 0;

  // Tier breakdown
  const standardCount = revenueData.reduce((sum, d) => sum + (d.byTier?.standard?.count || 0), 0);
  const premiumCount = revenueData.reduce((sum, d) => sum + (d.byTier?.premium?.count || 0), 0);
  const standardRev = revenueData.reduce((sum, d) => sum + (d.byTier?.standard?.revenue || 0), 0);
  const premiumRev = revenueData.reduce((sum, d) => sum + (d.byTier?.premium?.revenue || 0), 0);

  // API costs breakdown
  const apiCosts = { anthropic: 0, replicate: 0, elevenlabs: 0 };
  for (const d of dailyStats) {
    if (d.api) {
      apiCosts.anthropic += d.api.anthropic?.cost || 0;
      apiCosts.replicate += d.api.replicate?.cost || 0;
      apiCosts.elevenlabs += d.api.elevenlabs?.cost || 0;
    }
  }

  // Revenue chart data
  const maxRevenue = Math.max(...revenueData.map(d => d.gross || 0), 1);

  return (
    <div>
      {/* Revenue Cards */}
      <div style={grid4}>
        <MetricCard value={`$${grossRevenue.toFixed(2)}`} label="Gross Revenue" sub="This Month" color="#10b981" />
        <MetricCard value={`$${avgPerDay.toFixed(2)}`} label="Avg/Day" sub="30 day" color="#3b82f6" />
        <MetricCard value={`$${totalCosts.toFixed(2)}`} label="Total Costs" sub="This Month" color="#ef4444" />
        <MetricCard value={`$${netProfit.toFixed(2)}`} label="Net Profit" sub={`${grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : 0}%`} color="#8b5cf6" />
      </div>

      {/* Revenue Chart */}
      <div style={card}>
        <h3 style={cardTitle}>Daily Revenue (Last 30 Days)</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 160, padding: "0 4px" }}>
          {revenueData.map((d, i) => {
            const height = maxRevenue > 0 ? Math.max(2, (d.gross / maxRevenue) * 140) : 2;
            return (
              <div key={i} title={`${d.date}: $${(d.gross || 0).toFixed(2)}`}
                style={{ flex: 1, minWidth: 4, background: "#3b82f6", borderRadius: "3px 3px 0 0", height, transition: "height 0.3s" }} />
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>{revenueData[0]?.date || ""}</span>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>{revenueData[revenueData.length - 1]?.date || ""}</span>
        </div>
      </div>

      {/* Tier Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={card}>
          <h3 style={cardTitle}>Tier Breakdown</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <TierRow label="Standard ($9.99)" count={standardCount} revenue={standardRev} color="#0ea5e9" total={grossRevenue} />
            <TierRow label="Premium ($19.99)" count={premiumCount} revenue={premiumRev} color="#8b5cf6" total={grossRevenue} />
          </div>
        </div>

        <div style={card}>
          <h3 style={cardTitle}>Cost Breakdown</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <CostRow label="Anthropic (Claude)" cost={apiCosts.anthropic} total={totalCosts} color="#f59e0b" />
            <CostRow label="Replicate (Images)" cost={apiCosts.replicate} total={totalCosts} color="#ef4444" />
            <CostRow label="ElevenLabs (Audio)" cost={apiCosts.elevenlabs} total={totalCosts} color="#8b5cf6" />
          </div>
        </div>
      </div>

      {/* Per-Book Economics */}
      <div style={card}>
        <h3 style={cardTitle}>Per-Book Economics</h3>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Tier</th>
              <th style={th}>Price</th>
              <th style={{ ...th, textAlign: "right" }}>Avg Cost</th>
              <th style={{ ...th, textAlign: "right" }}>Profit</th>
              <th style={{ ...th, textAlign: "right" }}>Margin</th>
            </tr>
          </thead>
          <tbody>
            <tr style={trow}>
              <td style={tdStyle}>Standard</td>
              <td style={tdStyle}>$9.99</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>${standardCount > 0 ? (totalCosts * (grossRevenue > 0 ? standardRev / grossRevenue : 0.5) / standardCount).toFixed(2) : "0.00"}</td>
              <td style={{ ...tdStyle, textAlign: "right", color: "#10b981", fontWeight: 700 }}>
                ${standardCount > 0 ? (9.99 - totalCosts * (grossRevenue > 0 ? standardRev / grossRevenue : 0.5) / standardCount).toFixed(2) : "9.99"}
              </td>
              <td style={{ ...tdStyle, textAlign: "right" }}>
                {standardCount > 0 ? ((1 - totalCosts * (grossRevenue > 0 ? standardRev / grossRevenue : 0.5) / standardCount / 9.99) * 100).toFixed(1) : "100"}%
              </td>
            </tr>
            <tr style={trow}>
              <td style={tdStyle}>Premium</td>
              <td style={tdStyle}>$19.99</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>${premiumCount > 0 ? (totalCosts * (grossRevenue > 0 ? premiumRev / grossRevenue : 0.5) / premiumCount).toFixed(2) : "0.00"}</td>
              <td style={{ ...tdStyle, textAlign: "right", color: "#10b981", fontWeight: 700 }}>
                ${premiumCount > 0 ? (19.99 - totalCosts * (grossRevenue > 0 ? premiumRev / grossRevenue : 0.5) / premiumCount).toFixed(2) : "19.99"}
              </td>
              <td style={{ ...tdStyle, textAlign: "right" }}>
                {premiumCount > 0 ? ((1 - totalCosts * (grossRevenue > 0 ? premiumRev / grossRevenue : 0.5) / premiumCount / 19.99) * 100).toFixed(1) : "100"}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payment Stats */}
      <div style={card}>
        <h3 style={cardTitle}>Payment Summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{totalTransactions}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Total Transactions</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#ef4444" }}>{failedPayments}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Failed Payments</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#10b981" }}>
              {totalTransactions > 0 ? ((1 - failedPayments / totalTransactions) * 100).toFixed(1) : "100"}%
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Success Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ value, label, sub, color }) {
  return (
    <div style={{ ...card, textAlign: "center", padding: "20px 16px" }}>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div>}
    </div>
  );
}

function TierRow({ label, count, revenue, color, total }) {
  const pct = total > 0 ? (revenue / total) * 100 : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span>{count} books = <strong>${revenue.toFixed(2)}</strong> ({pct.toFixed(0)}%)</span>
      </div>
      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function CostRow({ label, cost, total, color }) {
  const pct = total > 0 ? (cost / total) * 100 : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span>{label}</span>
        <span><strong>${cost.toFixed(2)}</strong> ({pct.toFixed(0)}%)</span>
      </div>
      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
    </div>
  );
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
const trow = {};
