import { useState, useEffect, useCallback } from "react";

export default function APIs() {
  const [health, setHealth] = useState(null);
  const [calls, setCalls] = useState([]);
  const [errors, setErrors] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, callsRes, errorsRes, statsRes] = await Promise.all([
        fetch("/api/admin?action=health"),
        fetch("/api/admin?action=api_calls&limit=50"),
        fetch("/api/admin?action=errors&limit=20"),
        fetch("/api/admin?action=daily_stats&days=7"),
      ]);
      setHealth(await healthRes.json());
      setCalls((await callsRes.json()).calls || []);
      setErrors((await errorsRes.json()).errors || []);
      setDailyStats((await statsRes.json()).stats || []);
    } catch (err) {
      console.error("Failed to fetch API data:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <Loading />;

  // Aggregate today's stats
  const today = dailyStats[dailyStats.length - 1] || {};
  const apiStats = today.api || {};

  const services = [
    {
      name: "Anthropic (Claude)", key: "anthropic",
      model: "claude-sonnet-4-20250514",
      types: "Story / Validation / Photo Analysis",
    },
    {
      name: "Replicate (Images)", key: "replicate",
      model: "google/nano-banana-pro",
      types: "Cover / Spread / Back Cover",
      fallbacks: ["flux-kontext-pro", "flux-1.1-pro-ultra"],
    },
    {
      name: "ElevenLabs (Audio)", key: "elevenlabs",
      model: "eleven_turbo_v2_5",
      types: "Narration",
    },
  ];

  return (
    <div>
      {/* Service Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 24 }}>
        {services.map(svc => {
          const h = health?.services?.[svc.key] || {};
          const s = apiStats[svc.key] || {};
          const isOk = h.status === "ok";
          const avgMs = s.calls > 0 ? Math.round(s.totalMs / s.calls) : 0;
          const errorRate = s.calls > 0 ? ((s.errors / s.calls) * 100).toFixed(1) : "0";

          // Weekly totals
          const weekCalls = dailyStats.reduce((sum, d) => sum + (d.api?.[svc.key]?.calls || 0), 0);
          const weekCost = dailyStats.reduce((sum, d) => sum + (d.api?.[svc.key]?.cost || 0), 0);

          return (
            <div key={svc.key} style={{ ...card, borderLeft: `4px solid ${isOk ? "#22c55e" : "#ef4444"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{svc.name}</h3>
                <span style={{
                  padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: isOk ? "#dcfce7" : "#fef2f2",
                  color: isOk ? "#16a34a" : "#dc2626",
                }}>
                  {isOk ? "Operational" : h.configured === false ? "Not Configured" : "Error"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                <Stat label="Avg Response" value={avgMs ? `${avgMs}ms` : "-"} />
                <Stat label="Calls Today" value={s.calls || 0} />
                <Stat label="Calls This Week" value={weekCalls} />
                <Stat label="Est. Cost (Week)" value={`$${weekCost.toFixed(2)}`} />
                <Stat label="Errors Today" value={`${s.errors || 0} (${errorRate}%)`} />
                <Stat label="Response Time" value={h.responseMs ? `${h.responseMs}ms` : "-"} />
              </div>

              {/* ElevenLabs usage */}
              {svc.key === "elevenlabs" && h.usage && (
                <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, marginBottom: 4 }}>Character Usage</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span>{(h.usage.characterCount || 0).toLocaleString()} / {(h.usage.characterLimit || 0).toLocaleString()}</span>
                    <span style={{ fontWeight: 700 }}>{(h.usage.remainingCharacters || 0).toLocaleString()} left</span>
                  </div>
                  <div style={{ marginTop: 4, height: 6, borderRadius: 3, background: "#dcfce7", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, background: h.usage.characterLimit && (h.usage.characterCount / h.usage.characterLimit) > 0.9 ? "#ef4444" : "#22c55e", width: `${Math.min(100, h.usage.characterLimit ? (h.usage.characterCount / h.usage.characterLimit) * 100 : 0)}%` }} />
                  </div>
                  {h.usage.tier && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>Tier: {h.usage.tier}{h.usage.nextReset ? ` | Resets: ${new Date(h.usage.nextReset).toLocaleDateString()}` : ""}</div>}
                </div>
              )}

              <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
                Model: {svc.model}
                {svc.fallbacks && <span> | Fallbacks: {svc.fallbacks.join(", ")}</span>}
              </div>
            </div>
          );
        })}

        {/* Stripe card */}
        <div style={{ ...card, borderLeft: `4px solid ${health?.services?.stripe?.configured ? "#22c55e" : "#eab308"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Stripe (Payments)</h3>
            <span style={{
              padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: health?.services?.stripe?.configured ? "#dcfce7" : "#fefce8",
              color: health?.services?.stripe?.configured ? "#16a34a" : "#a16207",
            }}>
              {health?.services?.stripe?.configured ? "Configured" : "Not Configured"}
            </span>
          </div>
          {health?.services?.stripe?.balance ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, marginBottom: 8 }}>
                <Stat label="Available" value={`$${health.services.stripe.balance.available.toFixed(2)} ${health.services.stripe.balance.currency.toUpperCase()}`} />
                <Stat label="Pending" value={`$${health.services.stripe.balance.pending.toFixed(2)} ${health.services.stripe.balance.currency.toUpperCase()}`} />
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Webhook logs payments to Supabase.</div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Payment processing via Stripe. Webhook logs payments to Supabase.
            </div>
          )}
        </div>

        {/* Supabase card */}
        <div style={{ ...card, borderLeft: `4px solid ${health?.services?.supabase?.status === "ok" ? "#22c55e" : "#ef4444"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Supabase</h3>
            <span style={{
              padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: health?.services?.supabase?.status === "ok" ? "#dcfce7" : "#fef2f2",
              color: health?.services?.supabase?.status === "ok" ? "#16a34a" : "#dc2626",
            }}>
              {health?.services?.supabase?.status === "ok" ? "Operational" : "Error"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Ping: {health?.services?.supabase?.pingMs || "?"}ms | Used for books, users, admin data, image storage
          </div>
        </div>
      </div>

      {/* API Call Log */}
      <div style={card}>
        <h3 style={cardTitle}>Recent API Calls</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Time</th>
                <th style={th}>Service</th>
                <th style={th}>Type</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "right" }}>Ms</th>
                <th style={th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {calls.slice(0, 30).map((c, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{c.ts ? new Date(c.ts).toLocaleTimeString() : "-"}</td>
                  <td style={tdStyle}>
                    <span style={{ ...badge, background: serviceColor(c.service).bg, color: serviceColor(c.service).text }}>
                      {c.service}
                    </span>
                  </td>
                  <td style={tdStyle}>{c.type || "-"}</td>
                  <td style={tdStyle}>
                    <span style={{ color: c.status === 200 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                      {c.status || "-"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {c.durationMs ? c.durationMs.toLocaleString() : "-"}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11, color: "#64748b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.error || c.details || "-"}
                  </td>
                </tr>
              ))}
              {calls.length === 0 && (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8", padding: 40 }}>
                  No API calls logged yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error Log */}
      <div style={card}>
        <h3 style={{ ...cardTitle, color: "#dc2626" }}>Error Log</h3>
        {errors.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 24 }}>No errors logged.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {errors.map((err, i) => (
              <div key={i} style={{ padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 13 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ color: "#dc2626", fontWeight: 700 }}>{err.service}</span>
                  <span style={{ color: "#94a3b8", fontSize: 11 }}>
                    {err.ts ? new Date(err.ts).toLocaleString() : ""}
                  </span>
                </div>
                <div style={{ color: "#991b1b" }}>{err.error}</div>
                {err.details && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{err.details}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ color: "#94a3b8", fontSize: 11 }}>{label}</div>
      <div style={{ fontWeight: 700, color: "#334155" }}>{value}</div>
    </div>
  );
}

function serviceColor(service) {
  const colors = {
    anthropic: { bg: "#fef3c7", text: "#92400e" },
    replicate: { bg: "#dbeafe", text: "#1e40af" },
    elevenlabs: { bg: "#ede9fe", text: "#5b21b6" },
    stripe: { bg: "#dcfce7", text: "#166534" },
  };
  return colors[service] || { bg: "#f1f5f9", text: "#475569" };
}

function Loading() {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
    <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
  </div>;
}

const card = { background: "#fff", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", marginBottom: 20 };
const cardTitle = { fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 16px" };
const table = { width: "100%", fontSize: 13, borderCollapse: "collapse" };
const th = { padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" };
const tdStyle = { padding: "8px 12px", fontSize: 13, borderBottom: "1px solid #f1f5f9" };
const badge = { display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 };
