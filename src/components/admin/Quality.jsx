import { useState, useEffect, useCallback } from "react";
import adminFetch from "../../lib/adminFetch";

export default function Quality() {
  const [validations, setValidations] = useState([]);
  const [trends, setTrends] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningInsights, setRunningInsights] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [qualRes, insightsRes] = await Promise.all([
        adminFetch("/api/admin?action=quality&limit=50"),
        adminFetch("/api/admin?action=insights"),
      ]);
      const q = await qualRes.json();
      const ins = await insightsRes.json();
      setValidations(q.validations || []);
      setTrends(q.trends || []);
      setInsights(ins.insights);
    } catch (err) {
      console.error("Failed to fetch quality:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runInsightsEngine = async () => {
    setRunningInsights(true);
    try {
      const res = await fetch("/api/insights-engine", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setInsights(data.insights);
      }
    } catch (err) {
      console.error("Failed to run insights:", err);
    }
    setRunningInsights(false);
  };

  if (loading) return <Loading />;

  // Calculate quality overview
  const recentVals = validations.slice(0, 100);
  const avgText = recentVals.length > 0
    ? (recentVals.reduce((sum, v) => sum + (v.textScore || 0), 0) / recentVals.length).toFixed(1) : "-";
  const avgFace = recentVals.length > 0
    ? (recentVals.reduce((sum, v) => sum + (v.faceScore || 0), 0) / recentVals.length).toFixed(1) : "-";
  const firstPass = recentVals.filter(v => v.attempt === 1 && v.pass).length;
  const firstPassRate = recentVals.length > 0
    ? Math.round((firstPass / recentVals.length) * 100) : 100;
  const retries = recentVals.filter(v => v.attempt > 1).length;
  const retryRate = recentVals.length > 0
    ? Math.round((retries / recentVals.length) * 100) : 0;

  // Issue frequency
  const issueMap = {};
  for (const v of recentVals) {
    for (const issue of (v.issues || [])) {
      const normalized = issue.toLowerCase().substring(0, 50);
      issueMap[normalized] = (issueMap[normalized] || 0) + 1;
    }
  }
  const topIssues = Object.entries(issueMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const failedVals = validations.filter(v => !v.pass);
  const passedVals = validations.filter(v => v.pass);

  return (
    <div>
      {/* Quality Overview */}
      <div style={grid4}>
        <MetricCard value={`${firstPassRate}%`} label="First-Pass Rate" color="#10b981" />
        <MetricCard value={`${retryRate}%`} label="Retry Rate" color="#f59e0b" />
        <MetricCard value={avgText} label="Avg Text Score" color="#3b82f6" />
        <MetricCard value={avgFace} label="Avg Face Score" color="#8b5cf6" />
      </div>

      {/* Quality Trends Chart */}
      {trends.length > 0 && (
        <div style={card}>
          <h3 style={cardTitle}>Quality Trends (30 Days)</h3>
          <div style={{ display: "flex", gap: 16 }}>
            <TrendChart data={trends.map(t => t.avgTextScore)} label="Avg Text Score" color="#3b82f6" />
            <TrendChart data={trends.map(t => t.avgFaceScore)} label="Avg Face Score" color="#8b5cf6" />
          </div>
        </div>
      )}

      {/* Common Issues */}
      {topIssues.length > 0 && (
        <div style={card}>
          <h3 style={cardTitle}>Common Validation Failures</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topIssues.map(([issue, count], i) => {
              const pct = recentVals.length > 0 ? (count / recentVals.length) * 100 : 0;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, fontSize: 13 }}>{issue}</div>
                  <div style={{ width: 60, textAlign: "right", fontSize: 12, fontWeight: 600, color: "#64748b" }}>{count}x</div>
                  <div style={{ width: 100, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#ef4444", borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Validation Log */}
      <div style={card}>
        <h3 style={cardTitle}>Recent Validation Failures</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Time</th>
                <th style={th}>Page</th>
                <th style={th}>Attempt</th>
                <th style={th}>Text</th>
                <th style={th}>Face</th>
                <th style={th}>TextBox</th>
                <th style={th}>Scene</th>
                <th style={th}>Likeness</th>
                <th style={th}>Format</th>
                <th style={th}>Fingers</th>
                <th style={th}>Pass</th>
                <th style={th}>Issues</th>
              </tr>
            </thead>
            <tbody>
              {failedVals.slice(0, 20).map((v, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{v.ts ? new Date(v.ts).toLocaleTimeString() : "-"}</td>
                  <td style={tdStyle}>{v.page || "-"}</td>
                  <td style={tdStyle}>{v.attempt || "-"}</td>
                  <td style={{ ...tdStyle, color: scoreColor(v.textScore), fontWeight: 600 }}>
                    {v.textScore ?? "-"}/10
                  </td>
                  <td style={{ ...tdStyle, color: scoreColor(v.faceScore), fontWeight: 600 }}>
                    {v.faceScore ?? "-"}/10
                  </td>
                  <td style={{ ...tdStyle, color: scoreColor(v.textBoxScore), fontWeight: 600 }}>
                    {v.textBoxScore ?? "-"}/10
                  </td>
                  <td style={{ ...tdStyle, color: scoreColor(v.sceneAccuracy), fontWeight: 600 }}>
                    {v.sceneAccuracy ?? "-"}/10
                  </td>
                  <td style={{ ...tdStyle, color: scoreColor(v.likenessScore), fontWeight: 600 }}>
                    {v.likenessScore != null ? `${v.likenessScore}/10` : "-"}
                  </td>
                  <td style={tdStyle}>{v.formatOk ? "\u2705" : "\u274C"}</td>
                  <td style={tdStyle}>{v.fingersOk != null ? (v.fingersOk ? "\u2705" : "\u274C") : "-"}</td>
                  <td style={tdStyle}>{"\u274C"}</td>
                  <td style={{ ...tdStyle, fontSize: 11, color: "#64748b", maxWidth: 300 }}>
                    {(v.issues || []).join(", ") || "-"}
                  </td>
                </tr>
              ))}
              {failedVals.length === 0 && (
                <tr><td colSpan={12} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8", padding: 40 }}>
                  No validation failures logged.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Validation Passes */}
      <div style={card}>
        <h3 style={cardTitle}>Recent Validation Passes</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Time</th>
                <th style={th}>Page</th>
                <th style={th}>Attempt</th>
                <th style={th}>Text</th>
                <th style={th}>Face</th>
                <th style={th}>TextBox</th>
                <th style={th}>Scene</th>
                <th style={th}>Likeness</th>
                <th style={th}>Format</th>
                <th style={th}>Fingers</th>
                <th style={th}>Pass</th>
                <th style={th}>Notes / Issues</th>
              </tr>
            </thead>
            <tbody>
              {passedVals.slice(0, 20).map((v, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{v.ts ? new Date(v.ts).toLocaleTimeString() : "-"}</td>
                  <td style={tdStyle}>{v.page || "-"}</td>
                  <td style={tdStyle}>{v.attempt || "-"}</td>
                  <td style={{ ...tdStyle, color: scoreColor(v.textScore), fontWeight: 600 }}>
                    {v.textScore ?? "-"}/10
                  </td>
                  <td style={{ ...tdStyle, color: scoreColor(v.faceScore), fontWeight: 600 }}>
                    {v.faceScore ?? "-"}/10
                  </td>
                  <td style={{ ...tdStyle, color: scoreColor(v.textBoxScore), fontWeight: 600 }}>
                    {v.textBoxScore ?? "-"}/10
                  </td>
                  <td style={{ ...tdStyle, color: scoreColor(v.sceneAccuracy), fontWeight: 600 }}>
                    {v.sceneAccuracy ?? "-"}/10
                  </td>
                  <td style={{ ...tdStyle, color: scoreColor(v.likenessScore), fontWeight: 600 }}>
                    {v.likenessScore != null ? `${v.likenessScore}/10` : "-"}
                  </td>
                  <td style={tdStyle}>{v.formatOk ? "\u2705" : "\u274C"}</td>
                  <td style={tdStyle}>{v.fingersOk != null ? (v.fingersOk ? "\u2705" : "\u274C") : "-"}</td>
                  <td style={tdStyle}>{"\u2705"}</td>
                  <td style={{ ...tdStyle, fontSize: 11, color: "#64748b", maxWidth: 300 }}>
                    {(v.issues || []).length > 0 ? (v.issues || []).join(", ") : v.fixNotes || "-"}
                  </td>
                </tr>
              ))}
              {passedVals.length === 0 && (
                <tr><td colSpan={12} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8", padding: 40 }}>
                  No validation passes logged yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Insights */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ ...cardTitle, margin: 0 }}>AI Insights (Pattern Recognition)</h3>
          <button onClick={runInsightsEngine} disabled={runningInsights} style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff",
            fontSize: 12, cursor: "pointer", fontWeight: 600, opacity: runningInsights ? 0.5 : 1,
          }}>
            {runningInsights ? "Running..." : "Run Insights Engine"}
          </button>
        </div>

        {insights ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
              <InsightCard label="Weakest Dimension" value={insights.aiInsights?.weakestDimension || insights.avgScores?.overall?.toFixed(1) || "-"} color="#ef4444" />
              <InsightCard label="Strongest Dimension" value={insights.aiInsights?.strongestDimension || "-"} color="#10b981" />
              <InsightCard label="Best Style" value={insights.aiInsights?.bestPerformingStyle || "-"} color="#3b82f6" />
              <InsightCard label="Worst Style" value={insights.aiInsights?.worstPerformingStyle || "-"} color="#f59e0b" />
            </div>

            {insights.aiInsights?.topRecommendations?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Top Recommendations</h4>
                {insights.aiInsights.topRecommendations.map((rec, i) => (
                  <div key={i} style={{ padding: "12px 16px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ background: "#dbeafe", color: "#1d4ed8", padding: "1px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        #{rec.priority}
                      </span>
                      <strong style={{ fontSize: 13 }}>{rec.title}</strong>
                      <span style={{ fontSize: 11, color: rec.confidence === "high" ? "#16a34a" : "#f59e0b" }}>
                        {rec.confidence} confidence
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>{rec.detail}</p>
                    {rec.expectedScoreImpact && (
                      <p style={{ fontSize: 11, color: "#10b981", margin: "4px 0 0", fontWeight: 600 }}>
                        Expected: {rec.expectedScoreImpact}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
              Based on {insights.sampleSize} book analyses | Generated: {insights.date}
            </p>
          </div>
        ) : (
          <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 24 }}>
            No insights generated yet. Click "Run Insights Engine" after at least 3 books have been analyzed.
          </p>
        )}
      </div>
    </div>
  );
}

function scoreColor(score) {
  if (score == null) return "#94a3b8";
  if (score >= 8) return "#16a34a";
  if (score >= 6) return "#f59e0b";
  return "#dc2626";
}

function MetricCard({ value, label, color }) {
  return (
    <div style={{ ...card, textAlign: "center", padding: "20px 16px" }}>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
    </div>
  );
}

function InsightCard({ label, value, color }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function TrendChart({ data, label, color }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.filter(Boolean), 10);
  const min = Math.min(...data.filter(Boolean), 0);
  const range = max - min || 1;

  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
        {data.map((v, i) => {
          const h = v ? Math.max(4, ((v - min) / range) * 70) : 2;
          return <div key={i} style={{ flex: 1, height: h, background: color, borderRadius: 2, opacity: 0.8 }} />;
        })}
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
const tdStyle = { padding: "8px 12px", fontSize: 13, borderBottom: "1px solid #f1f5f9" };
