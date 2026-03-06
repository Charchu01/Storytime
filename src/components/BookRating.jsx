import { useState } from "react";
import { submitBookFeedback } from "../api/client";

export default function BookRating({ bookId, onClose }) {
  const [stars, setStars] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [reaction, setReaction] = useState(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reactions = [
    { id: "love", emoji: "\u{1F60D}", label: "Love it" },
    { id: "good", emoji: "\u{1F60A}", label: "Good" },
    { id: "okay", emoji: "\u{1F610}", label: "Okay" },
    { id: "issues", emoji: "\u{1F615}", label: "Issues" },
  ];

  const handleSubmit = async () => {
    if (stars === 0 && !reaction) return;
    setSubmitting(true);
    await submitBookFeedback(bookId, { stars, reaction, comment: comment.trim() || null });
    setSubmitted(true);
    setSubmitting(false);
    setTimeout(() => onClose?.(), 2000);
  };

  if (submitted) {
    return (
      <div style={container}>
        <div style={inner}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#x2764;&#xFE0F;</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#334155", margin: 0 }}>Thanks for your feedback!</p>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>It helps us make better books.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={container}>
      <div style={inner}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#334155", margin: "0 0 12px" }}>
          How does this book look?
        </p>

        {/* Stars */}
        <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 16 }}>
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s}
              onMouseEnter={() => setHoveredStar(s)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => setStars(s)}
              style={{
                background: "none", border: "none", cursor: "pointer", fontSize: 28, padding: 2,
                opacity: s <= (hoveredStar || stars) ? 1 : 0.3,
                transform: s <= (hoveredStar || stars) ? "scale(1.1)" : "scale(1)",
                transition: "all 0.15s",
              }}
            >
              &#x2B50;
            </button>
          ))}
        </div>

        {/* Reactions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          {reactions.map(r => (
            <button key={r.id}
              onClick={() => setReaction(reaction === r.id ? null : r.id)}
              style={{
                padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontSize: 13,
                border: reaction === r.id ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                background: reaction === r.id ? "#eff6ff" : "#fff",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              }}
            >
              <span style={{ fontSize: 20 }}>{r.emoji}</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>{r.label}</span>
            </button>
          ))}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="What could be better? (optional)"
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
            fontSize: 13, resize: "none", height: 60, boxSizing: "border-box", marginBottom: 12,
            fontFamily: "inherit",
          }}
        />

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={handleSubmit} disabled={submitting || (stars === 0 && !reaction)}
            style={{
              padding: "10px 24px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700,
              cursor: "pointer",
              background: (stars > 0 || reaction) ? "#3b82f6" : "#e2e8f0",
              color: (stars > 0 || reaction) ? "#fff" : "#94a3b8",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Sending..." : "Submit"}
          </button>
          <button onClick={onClose} style={{
            padding: "10px 16px", borderRadius: 10, border: "1px solid #e2e8f0",
            background: "#fff", color: "#64748b", fontSize: 14, cursor: "pointer",
          }}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

const container = {
  animation: "fadeIn 0.3s ease",
};

const inner = {
  textAlign: "center",
  padding: "20px 16px",
};
