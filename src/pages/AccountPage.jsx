import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext, useToast } from "../App";

export default function AccountPage() {
  useEffect(() => { document.title = "Account & Billing — Storytime"; }, []);
  const { stories, deleteStory } = useAppContext();
  const { addToast } = useToast();
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [printEmail, setPrintEmail] = useState("");
  const [printDone, setPrintDone] = useState(false);

  const activity = (() => { try { return JSON.parse(localStorage.getItem("sk_activity") || "[]"); } catch { return []; } })();
  const pdfCount = activity.filter((a) => a.action === "PDF Download").length;
  const shareCount = activity.filter((a) => a.action === "Link Shared").length;

  function handleWaitlist() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waitlistEmail)) {
      addToast("Please enter a valid email address", "error");
      return;
    }
    localStorage.setItem("sk_waitlist_email", waitlistEmail);
    setWaitlistDone(true);
    addToast("You're on the list! 🎉", "success");
  }

  function handleExportData() {
    const data = { stories, activity, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "storytime-data.json"; a.click();
    URL.revokeObjectURL(url);
    addToast("Data exported ✓", "success");
  }

  function handleDeleteAll() {
    if (!confirm("Are you sure? This will delete ALL your stories. This cannot be undone.")) return;
    stories.forEach((s) => deleteStory(s.id));
    addToast("All stories deleted", "info");
  }

  function handleDeleteAccount() {
    if (!confirm("Are you sure you want to delete your account and ALL data? This cannot be undone.")) return;
    localStorage.clear();
    window.location.href = "/";
  }

  return (
    <div className="acct-page">
      <Link to="/" className="legal-back">← Back</Link>
      <h1 className="acct-h1">Account & Billing</h1>

      {/* Plan card */}
      <div className="acct-plan">
        <div className="acct-plan-left">
          <h2 className="acct-plan-title">Free Plan</h2>
          <span className="acct-plan-badge">Current Plan</span>
          <div className="acct-features">
            <div className="acct-feat acct-feat-yes">✓ 3 stories saved</div>
            <div className="acct-feat acct-feat-yes">✓ Share via link</div>
            <div className="acct-feat acct-feat-yes">✓ Read in browser</div>
            <div className="acct-feat acct-feat-yes">✓ Basic narration preview</div>
            <div className="acct-feat acct-feat-no">✗ PDF downloads</div>
            <div className="acct-feat acct-feat-no">✗ Unlimited saves</div>
            <div className="acct-feat acct-feat-no">✗ Full AI narration</div>
            <div className="acct-feat acct-feat-no">✗ Printed book orders</div>
          </div>
        </div>
        <div className="acct-plan-right">
          <div className="acct-price">$7.99<span>/month</span></div>
          <p className="acct-plan-desc">Get unlimited stories, PDF downloads, full AI narration, and 20% off printed books.</p>
          <button className="acct-upgrade-btn" onClick={() => document.getElementById("upgrade-modal").showModal()}>
            Upgrade Now →
          </button>
        </div>
      </div>

      {/* Upgrade modal */}
      <dialog id="upgrade-modal" className="acct-modal">
        <div className="acct-modal-inner">
          {waitlistDone ? (
            <>
              <div style={{ fontSize: 48, textAlign: "center" }}>✓</div>
              <h3 className="acct-modal-h">You're on the list!</h3>
              <p className="acct-modal-p">We'll email you soon. 🎉</p>
              <button className="acct-modal-close" onClick={() => document.getElementById("upgrade-modal").close()}>Close</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, textAlign: "center" }}>🚀</div>
              <h3 className="acct-modal-h">Pro Plan — Coming Soon!</h3>
              <p className="acct-modal-p">We're putting the finishing touches on Pro. Join the waitlist for a special launch discount.</p>
              <input className="acct-modal-input" type="email" placeholder="your@email.com" value={waitlistEmail} onChange={(e) => setWaitlistEmail(e.target.value)} />
              <button className="acct-modal-btn" onClick={handleWaitlist}>Join the Waitlist</button>
              <button className="acct-modal-cancel" onClick={() => document.getElementById("upgrade-modal").close()}>Cancel</button>
            </>
          )}
        </div>
      </dialog>

      {/* Usage stats */}
      <div className="acct-stats">
        <div className="acct-stat">
          <div className="acct-stat-num">{stories.length}</div>
          <div className="acct-stat-lbl">📚 Stories Created</div>
        </div>
        <div className="acct-stat">
          <div className="acct-stat-num">{pdfCount}</div>
          <div className="acct-stat-lbl">⬇ PDFs Downloaded</div>
        </div>
        <div className="acct-stat">
          <div className="acct-stat-num">{shareCount}</div>
          <div className="acct-stat-lbl">🔗 Links Shared</div>
        </div>
      </div>

      {/* Activity history */}
      <section className="acct-section">
        <h2 className="acct-sec-h">Activity History</h2>
        {activity.length === 0 ? (
          <p className="acct-empty">No activity yet — create a story and download your first book!</p>
        ) : (
          <div className="acct-table">
            {activity.map((a, i) => (
              <div key={i} className={`acct-row${i % 2 === 0 ? "" : " acct-row-alt"}`}>
                <span className="acct-row-date">{new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="acct-row-title">{a.title}</span>
                <span className="acct-row-action">{a.action}</span>
                <span className="acct-row-status">✓ {a.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Printed book teaser */}
      <div className="acct-print-teaser">
        <div className="acct-print-left">📚</div>
        <div className="acct-print-right">
          <h3>Turn your story into a real book</h3>
          <p>Printed, bound, and shipped worldwide — from $29. A gift they'll keep forever.</p>
          <span className="acct-print-badge">Coming soon</span>
          {!printDone ? (
            <div className="acct-print-row">
              <input className="acct-print-input" type="email" placeholder="your@email.com" value={printEmail} onChange={(e) => setPrintEmail(e.target.value)} />
              <button className="acct-print-btn" onClick={() => { if (printEmail.includes("@")) { setPrintDone(true); addToast("We'll let you know!", "success"); } }}>Notify me</button>
            </div>
          ) : (
            <p className="acct-print-done">✓ We'll email you when it launches!</p>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <section className="acct-danger">
        <h3 className="acct-danger-h">Danger Zone</h3>
        <button className="acct-danger-btn" onClick={handleExportData}>Download all my data</button>
        <button className="acct-danger-btn" onClick={handleDeleteAll}>Delete all my stories</button>
        <button className="acct-danger-btn" onClick={handleDeleteAccount}>Delete my account</button>
      </section>
    </div>
  );
}
