import { useState, useEffect, useCallback } from "react";

export default function System() {
  const [health, setHealth] = useState(null);
  const [config, setConfig] = useState({});
  const [prompts, setPrompts] = useState({});
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sandboxSection, setSandboxSection] = useState("cover");
  const [sandboxText, setSandboxText] = useState("");
  const [sandboxResult, setSandboxResult] = useState(null);
  const [testingPrompt, setTestingPrompt] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, configRes, promptsRes, expRes] = await Promise.all([
        fetch("/api/admin?action=health"),
        fetch("/api/admin?action=get_config"),
        fetch("/api/admin?action=get_prompts"),
        fetch("/api/admin?action=experiments"),
      ]);
      setHealth(await healthRes.json());
      const cfg = await configRes.json();
      setConfig(cfg.config || {});
      const prm = await promptsRes.json();
      setPrompts(prm.prompts || {});
      const exp = await expRes.json();
      setExperiments(exp.experiments || []);
    } catch (err) {
      console.error("Failed to fetch system data:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateConfig = async (key, value) => {
    try {
      await fetch("/api/admin?action=set_config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      setConfig(prev => ({ ...prev, [key]: value }));
    } catch (err) {
      console.error("Failed to update config:", err);
    }
  };

  const savePrompt = async (section, text) => {
    try {
      await fetch("/api/admin?action=set_prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, text }),
      });
      setPrompts(prev => ({ ...prev, [section]: text }));
    } catch (err) {
      console.error("Failed to save prompt:", err);
    }
  };

  if (loading) return <Loading />;

  // Environment variable status
  const envVars = [
    { name: "ANTHROPIC_KEY", status: health?.services?.anthropic?.configured !== false },
    { name: "REPLICATE_KEY", status: health?.services?.replicate?.configured !== false },
    { name: "STRIPE_SECRET_KEY", status: health?.services?.stripe?.configured },
    { name: "ELEVENLABS_KEY", status: health?.services?.elevenlabs?.configured !== false },
    { name: "VERCEL_KV", status: health?.services?.vercel_kv?.status === "ok" },
  ];

  return (
    <div>
      {/* Environment Variables */}
      <div style={card}>
        <h3 style={cardTitle}>Environment Variables</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 8 }}>
          {envVars.map(env => (
            <div key={env.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: env.status ? "#f0fdf4" : "#fef2f2" }}>
              <span>{env.status ? "\u2705" : "\u274C"}</span>
              <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{env.name}</span>
              <span style={{ fontSize: 11, color: "#64748b", marginLeft: "auto" }}>
                {env.status ? "Set" : "Missing"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Panel */}
      <div style={card}>
        <h3 style={cardTitle}>Configuration</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          <ConfigToggle label="Validation Enabled" configKey="validation_enabled"
            value={config.validation_enabled !== false} onChange={v => updateConfig("validation_enabled", v)} />
          <ConfigSelect label="Validation Strictness" configKey="validation_strictness"
            value={config.validation_strictness || "normal"}
            options={[["strict", "Strict (7+)"], ["normal", "Normal (6+)"], ["lenient", "Lenient (5+)"]]}
            onChange={v => updateConfig("validation_strictness", v)} />
          <ConfigSelect label="Max Retries Per Image" configKey="max_retries"
            value={String(config.max_retries || 2)}
            options={[["1", "1"], ["2", "2"], ["3", "3"]]}
            onChange={v => updateConfig("max_retries", parseInt(v))} />
          <ConfigToggle label="Enable Narration" configKey="enable_narration"
            value={config.enable_narration !== false} onChange={v => updateConfig("enable_narration", v)} />
          <ConfigSelect label="Primary Image Model" configKey="primary_image_model"
            value={config.primary_image_model || "nano-banana-pro"}
            options={[["nano-banana-pro", "Nano Banana Pro"], ["flux-kontext-pro", "Flux Kontext Pro"], ["flux-1.1-pro-ultra", "Flux 1.1 Pro Ultra"]]}
            onChange={v => updateConfig("primary_image_model", v)} />
          <ConfigSelect label="Max Generation Time" configKey="max_generation_time"
            value={String(config.max_generation_time || 300)}
            options={[["180", "3 min"], ["300", "5 min"], ["600", "10 min"]]}
            onChange={v => updateConfig("max_generation_time", parseInt(v))} />
        </div>
      </div>

      {/* Prompt Sandbox */}
      <div style={card}>
        <h3 style={cardTitle}>Prompt Sandbox</h3>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
          Edit prompt sections. Overrides are stored in KV and take priority over code defaults.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {["cover", "spread", "backCover", "systemPrompt", "textBoxDesign", "characterDesc"].map(s => (
            <button key={s} onClick={() => { setSandboxSection(s); setSandboxText(prompts[s] || ""); }}
              style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: sandboxSection === s ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                background: sandboxSection === s ? "#eff6ff" : "#fff",
                color: sandboxSection === s ? "#1d4ed8" : "#64748b",
              }}>
              {s}
              {prompts[s] && <span style={{ marginLeft: 4, color: "#10b981" }}> *</span>}
            </button>
          ))}
        </div>

        <textarea
          value={sandboxText}
          onChange={e => setSandboxText(e.target.value)}
          placeholder={`Enter prompt override for "${sandboxSection}" section...\nLeave empty to use code default.`}
          style={{
            width: "100%", minHeight: 200, padding: 14, borderRadius: 10, border: "1px solid #e2e8f0",
            fontSize: 13, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box",
            lineHeight: 1.5,
          }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => savePrompt(sandboxSection, sandboxText)} style={primaryBtn}>
            Save Override
          </button>
          <button onClick={() => { savePrompt(sandboxSection, ""); setSandboxText(""); }} style={secondaryBtn}>
            Reset to Default
          </button>
        </div>
      </div>

      {/* A/B Experiments */}
      <div style={card}>
        <h3 style={cardTitle}>A/B Experiments</h3>
        {experiments.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 24 }}>
            No experiments created yet. Use the Insights Engine to auto-generate experiments, or create them manually below.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {experiments.map(exp => (
              <ExperimentCard key={exp.id} experiment={exp} />
            ))}
          </div>
        )}
      </div>

      {/* Cost Calculator */}
      <div style={card}>
        <h3 style={cardTitle}>Cost Calculator</h3>
        <CostCalculator />
      </div>
    </div>
  );
}

function ConfigToggle({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{
        padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
        border: "none",
        background: value ? "#dcfce7" : "#fee2e2",
        color: value ? "#16a34a" : "#dc2626",
      }}>
        {value ? "On" : "Off"}
      </button>
    </div>
  );
}

function ConfigSelect({ label, value, options, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, background: "#fff",
      }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function ExperimentCard({ experiment }) {
  const exp = experiment;
  const statusColors = {
    running: { bg: "#dbeafe", text: "#1d4ed8" },
    concluded: { bg: "#fef3c7", text: "#92400e" },
    promoted: { bg: "#dcfce7", text: "#166534" },
  };
  const sc = statusColors[exp.status] || statusColors.running;

  return (
    <div style={{ padding: "14px 18px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>{exp.hypothesis || exp.id}</strong>
        <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.text }}>
          {exp.status}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
        <div>
          <div style={{ color: "#94a3b8", marginBottom: 2 }}>Variant A: {exp.variantA?.name}</div>
          <div>Books: {exp.variantA?.bookCount || 0} | Avg: {(exp.variantA?.avgOverall || 0).toFixed(1)}</div>
        </div>
        <div>
          <div style={{ color: "#94a3b8", marginBottom: 2 }}>Variant B: {exp.variantB?.name}</div>
          <div>Books: {exp.variantB?.bookCount || 0} | Avg: {(exp.variantB?.avgOverall || 0).toFixed(1)}</div>
        </div>
      </div>
      {exp.result && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#10b981", fontWeight: 600 }}>
          Winner: Variant {exp.result.winner} (+{exp.result.improvement}) | Confidence: {exp.result.confidence}
        </div>
      )}
    </div>
  );
}

function CostCalculator() {
  const [tier, setTier] = useState("standard");
  const [pageCount, setPageCount] = useState(6);
  const [hasPhoto, setHasPhoto] = useState(true);
  const [validateAll, setValidateAll] = useState(true);

  const imgCost = 0.045;
  const images = pageCount + 2; // cover + pages + back
  const imageCost = images * imgCost;
  const retryEstimate = validateAll ? images * 0.13 * imgCost : 0;
  const storyCost = 0.05;
  const photoCost = hasPhoto ? 0.02 : 0;
  const validationCost = (validateAll ? images : 2) * 0.004;
  const total = imageCost + retryEstimate + storyCost + photoCost + validationCost;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={calcLabel}>Tier</label>
          <select value={tier} onChange={e => { setTier(e.target.value); setPageCount(e.target.value === "premium" ? 10 : 6); }} style={calcSelect}>
            <option value="standard">Standard ($9.99)</option>
            <option value="premium">Premium ($19.99)</option>
          </select>
        </div>
        <div>
          <label style={calcLabel}>Pages</label>
          <select value={pageCount} onChange={e => setPageCount(parseInt(e.target.value))} style={calcSelect}>
            <option value="4">4</option><option value="6">6</option><option value="10">10</option>
          </select>
        </div>
        <div>
          <label style={calcLabel}>Has Photo</label>
          <select value={hasPhoto ? "yes" : "no"} onChange={e => setHasPhoto(e.target.value === "yes")} style={calcSelect}>
            <option value="yes">Yes</option><option value="no">No</option>
          </select>
        </div>
        <div>
          <label style={calcLabel}>Validate All</label>
          <select value={validateAll ? "all" : "cover"} onChange={e => setValidateAll(e.target.value === "all")} style={calcSelect}>
            <option value="all">All Pages</option><option value="cover">Cover Only</option>
          </select>
        </div>
      </div>

      <div style={{ padding: 16, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, fontSize: 13 }}>
          <span>Story writing (Claude)</span><span style={{ textAlign: "right" }}>${storyCost.toFixed(3)}</span>
          {hasPhoto && <><span>Photo analysis (Claude)</span><span style={{ textAlign: "right" }}>${photoCost.toFixed(3)}</span></>}
          <span>Images ({images}x Nano Banana)</span><span style={{ textAlign: "right" }}>${imageCost.toFixed(3)}</span>
          <span>Retry estimate (~13%)</span><span style={{ textAlign: "right" }}>${retryEstimate.toFixed(3)}</span>
          <span>Validation ({validateAll ? images : 2}x Claude)</span><span style={{ textAlign: "right" }}>${validationCost.toFixed(3)}</span>
          <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #bbf7d0", margin: "4px 0" }} />
          <strong>Estimated Total</strong>
          <strong style={{ textAlign: "right", color: "#16a34a", fontSize: 16 }}>${total.toFixed(2)}</strong>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
          Margin: {tier === "premium" ? `$${(19.99 - total).toFixed(2)} (${((1 - total / 19.99) * 100).toFixed(1)}%)` : `$${(9.99 - total).toFixed(2)} (${((1 - total / 9.99) * 100).toFixed(1)}%)`}
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
    <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
  </div>;
}

const card = { background: "#fff", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", marginBottom: 20 };
const cardTitle = { fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 16px" };
const primaryBtn = { padding: "8px 18px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const secondaryBtn = { padding: "8px 18px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const calcLabel = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 };
const calcSelect = { width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, background: "#fff" };
