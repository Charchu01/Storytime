import { useState, useEffect, useCallback } from "react";

export default function Overview() {
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, healthRes] = await Promise.all([
        fetch("/api/admin?action=overview"),
        fetch("/api/admin?action=health"),
      ]);

      if (!overviewRes.ok) {
        const errData = await overviewRes.json().catch(() => ({}));
        setError(`Overview API error (${overviewRes.status}): ${errData.error || 'Unknown error'}. Check that Vercel KV is configured.`);
        setLoading(false);
        return;
      }

      const overview = await overviewRes.json();
      const healthData = await healthRes.json();
      setData(overview);
      setHealth(healthData);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch overview:", err);
      setError(`Failed to connect to admin API: ${err.message}. Check that API routes are deployed.`);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div style={{ ...card, border: "1px solid #fecaca", background: "#fef2f2" }}>
        <h3 style={{ ...cardTitle, color: "#dc2626" }}>Dashboard Error</h3>
        <p style={{ fontSize: 13, color: "#991b1b", margin: 0 }}>{error}</p>
        <button onClick={() => { setLoading(true); setError(null); fetchData(); }}
          style={{ marginTop: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid #fecaca",
            background: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600, color: "#dc2626" }}>
          Retry
        </button>
      </div>
    );
  }

  const daily = data?.daily || {};
  const events = data?.events || [];
  const totalBooks = data?.totalBooks || 0;
  const totalUsers = data?.totalUsers || 0;
  const monthlyRevenue = data?.monthlyRevenue || 0;
  const books = daily?.books || {};
  const successRate = books.total > 0
    ? Math.round(((books.healthy || 0) / books.total) * 100) : 100;
  const kvConfigured = data?.kvConfigured !== false;

  return (
    <div>
      {!kvConfigured && (
        <div style={{ ...card, border: "1px solid #fef08a", background: "#fefce8", marginBottom: 20 }}>
          <h3 style={{ ...cardTitle, color: "#a16207", margin: "0 0 8px" }}>Vercel KV Not Configured</h3>
          <p style={{ fontSize: 13, color: "#854d0e", margin: 0 }}>
            The admin dashboard uses Vercel KV (Redis) to store analytics data. To enable it:
          </p>
          <ol style={{ fontSize: 13, color: "#854d0e", margin: "8px 0 0", paddingLeft: 20 }}>
            <li>Go to your Vercel Dashboard &rarr; this project &rarr; <strong>Storage</strong> tab</li>
            <li>Click <strong>Create Database</strong> &rarr; select <strong>KV</strong></li>
            <li>Redeploy the project so the env vars take effect</li>
          </ol>
        </div>
      )}
      {/* Key Metrics */}
      <div style={grid4}>
        <MetricCard
          icon={"\u{1F4B0}"}
          value={`$${monthlyRevenue.toFixed(2)}`}
          label="Revenue This Month"
          color="#10b981"
        />
        <MetricCard
          icon={"\u{1F4DA}"}
          value={totalBooks}
          label="Books Generated"
          color="#3b82f6"
        />
        <MetricCard
          icon={"\u{1F3A8}"}
          value={`${successRate}%`}
          label="Success Rate"
          color="#8b5cf6"
        />
        <MetricCard
          icon={"\u{1F465}"}
          value={totalUsers}
          label="Total Users"
          color="#f59e0b"
        />
      </div>

      {/* Live Activity Feed */}
      <div style={card}>
        <h3 style={cardTitle}>Live Activity Feed</h3>
        {events.length === 0 ? (
          <p style={emptyText}>No events yet. Events will appear as users create books.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {events.map((event, i) => (
              <EventRow key={i} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* System Health */}
      <div style={card}>
        <h3 style={cardTitle}>System Health</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {health?.services && Object.entries(health.services).map(([name, svc]) => (
            <ServiceCard key={name} name={name} service={svc} />
          ))}
          {!health?.services && (
            <p style={emptyText}>Checking services...</p>
          )}
        </div>
        {health?.checkedAt && (
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 12 }}>
            Last checked: {new Date(health.checkedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, value, label, color }) {
  return (
    <div style={{ ...card, textAlign: "center", padding: "20px 16px" }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function EventRow({ event }) {
  const typeConfig = {
    book_completed: { dot: "#22c55e", label: "Book completed" },
    payment_received: { dot: "#22c55e", label: "Payment received" },
    payment_failed: { dot: "#ef4444", label: "Payment failed" },
    validation_retry: { dot: "#eab308", label: "Validation retry" },
    postgame_complete: { dot: "#3b82f6", label: "Post-game analysis" },
    experiment_created: { dot: "#8b5cf6", label: "Experiment created" },
    experiment_concluded: { dot: "#8b5cf6", label: "Experiment concluded" },
    experiment_promoted: { dot: "#22c55e", label: "Experiment promoted" },
    insights_generated: { dot: "#3b82f6", label: "Insights generated" },
    user_feedback: { dot: "#3b82f6", label: "User feedback" },
  };

  const cfg = typeConfig[event.type] || { dot: "#94a3b8", label: event.type };
  const time = event.ts ? new Date(event.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  let detail = "";
  if (event.title) detail = `\u2014 "${event.title}"`;
  if (event.amount) detail = `\u2014 $${event.amount} ${event.tier || ""}`;
  if (event.page) detail = `\u2014 ${event.page} (text: ${event.textScore || "?"}/10)`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      <span style={{ color: "#94a3b8", width: 56, flexShrink: 0, fontSize: 12 }}>{time}</span>
      <span style={{ fontWeight: 600, color: "#334155" }}>{cfg.label}</span>
      <span style={{ color: "#64748b" }}>{detail}</span>
    </div>
  );
}

function ServiceCard({ name, service }) {
  const isOk = service.status === "ok" && (service.httpStatus === undefined || service.httpStatus < 300);
  const label = name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: 10,
      background: isOk ? "#f0fdf4" : service.configured === false ? "#fefce8" : "#fef2f2",
      border: `1px solid ${isOk ? "#bbf7d0" : service.configured === false ? "#fef08a" : "#fecaca"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 12 }}>{isOk ? "\u{1F7E2}" : service.configured === false ? "\u{1F7E1}" : "\u{1F534}"}</span>
        <strong style={{ fontSize: 13 }}>{label}</strong>
      </div>
      <div style={{ fontSize: 11, color: "#64748b" }}>
        {isOk ? "Operational" : service.configured === false ? "Not configured" : service.error || "Error"}
        {service.responseMs !== undefined && ` (${service.responseMs}ms)`}
        {service.pingMs !== undefined && ` (${service.pingMs}ms)`}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{
        width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6",
        borderRadius: "50%", animation: "spin 0.8s linear infinite",
      }} />
    </div>
  );
}

const grid4 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const card = {
  background: "#fff",
  borderRadius: 14,
  padding: "20px 24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  border: "1px solid #e2e8f0",
  marginBottom: 20,
};

const cardTitle = {
  fontSize: 15,
  fontWeight: 700,
  color: "#0f172a",
  margin: "0 0 16px",
};

const emptyText = {
  color: "#94a3b8",
  fontSize: 13,
  textAlign: "center",
  padding: "24px 0",
};
