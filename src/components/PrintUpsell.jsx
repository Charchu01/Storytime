import { useState } from "react";

const PRINT_OPTIONS = [
  { label: "Softcover", price: "$24.99", emoji: "📖" },
  { label: "Hardcover", price: "$34.99", emoji: "📚" },
  { label: "Gift Box", price: "$44.99", emoji: "🎁" },
];

export default function PrintUpsell({ onDismiss }) {
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleOrder() {
    setShowEmail(true);
  }

  function handleEmailSubmit(e) {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
      // Store for later — MVP doesn't actually send
      try {
        const waitlist = JSON.parse(localStorage.getItem("sk_print_waitlist") || "[]");
        waitlist.push({ email, date: new Date().toISOString() });
        localStorage.setItem("sk_print_waitlist", JSON.stringify(waitlist));
      } catch {}
    }
  }

  if (submitted) {
    return (
      <div className="print-overlay">
        <div className="print-modal">
          <div className="print-emoji">🎉</div>
          <h3 className="print-h3">You're on the list!</h3>
          <p className="print-p">We'll email you at <strong>{email}</strong> when print books are ready.</p>
          <button className="print-dismiss" onClick={onDismiss}>
            Back to my story
          </button>
        </div>
      </div>
    );
  }

  if (showEmail) {
    return (
      <div className="print-overlay">
        <div className="print-modal">
          <div className="print-emoji">📖</div>
          <h3 className="print-h3">Print books are coming soon!</h3>
          <p className="print-p">Leave your email and we'll notify you when ready.</p>
          <form onSubmit={handleEmailSubmit} className="print-form">
            <input
              type="email"
              className="print-input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="print-submit">
              Notify Me
            </button>
          </form>
          <button className="print-dismiss" onClick={onDismiss}>
            Maybe later
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="print-overlay">
      <div className="print-modal">
        <div className="print-emoji">📖</div>
        <h3 className="print-h3">Turn this into a real keepsake</h3>
        <p className="print-p">A physical book they'll treasure forever</p>

        <div className="print-options">
          {PRINT_OPTIONS.map((opt) => (
            <button key={opt.label} className="print-opt-card" onClick={handleOrder}>
              <span className="print-opt-emoji">{opt.emoji}</span>
              <span className="print-opt-label">{opt.label}</span>
              <span className="print-opt-price">{opt.price}</span>
              <span className="print-opt-btn">Order</span>
            </button>
          ))}
        </div>

        <button className="print-dismiss" onClick={onDismiss}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
