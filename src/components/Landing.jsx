export default function Landing({ onStart }) {
  return (
    <div className="land">
      <div className="land-bg" />
      <div className="land-nav">
        <div className="logo">📖 StoriKids</div>
        <button className="nav-btn" onClick={onStart}>Start Free →</button>
      </div>
      <div className="land-body">
        <div className="land-badge">⭐ AI-Powered Storybooks</div>
        <div className="book-mock">
          <div className="bk-back" />
          <div className="bk-mid" />
          <div className="bk-front">
            <div className="bk-img">🧒🌟</div>
            <div className="bk-txt">
              <div className="bk-ttl">Emma and the Magic Forest</div>
              <div className="bk-sub">Personalized · 5 pages</div>
            </div>
          </div>
          <div className="bk-badge">Ready in 2 min ⚡</div>
        </div>
        <h1 className="land-h1">
          Your family,<br />
          their <em>magic</em> story.
        </h1>
        <p className="land-p">
          Add your kids and family, pick an art style, and our AI writes a
          gorgeous personalized picture book with real illustrations in minutes.
        </p>
        <button className="land-cta" onClick={onStart}>Create Our Story ✨</button>
        <div className="land-note">Free to try · No account needed</div>
        <div className="land-steps">
          {["👨‍👩‍👧 Build your cast", "🎨 Pick art style", "✨ AI writes it", "🖼️ Real illustrations", "📚 Print & share"].map(
            (step) => (
              <div key={step} className="land-step">{step}</div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
