import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

const OCCASIONS = [
  { emoji: "🎂", label: "Birthday" },
  { emoji: "🏫", label: "First Day of School" },
  { emoji: "👶", label: "New Baby Sibling" },
  { emoji: "🦷", label: "Lost a Tooth" },
  { emoji: "😨", label: "Facing a Fear" },
  { emoji: "🐾", label: "Pet Story" },
  { emoji: "✈️", label: "Big Trip" },
  { emoji: "🌟", label: "Just Because" },
];

const TESTIMONIALS = [
  { quote: "Emma cried happy tears when she saw her name on the cover. We've read it every night for two weeks.", name: "Sarah M.", desc: "Mother of two", stars: 5 },
  { quote: "Best birthday gift idea I've ever found. My son was absolutely speechless. He asked me to read it five times in a row.", name: "James T.", desc: "Dad of three", stars: 5 },
  { quote: "I sent the link to my mom and she called me crying. She said it was the most special thing she'd ever seen.", name: "Priya K.", desc: "Grandmother", stars: 5 },
];

function Stars() {
  return <div className="hp-stars">{"★★★★★"}</div>;
}

export default function HomePage() {
  const navigate = useNavigate();
  useEffect(() => { document.title = "StoriKids — Personalized AI Storybooks"; }, []);

  return (
    <div className="hp">
      {/* Hero */}
      <section className="hp-hero">
        <div className="hp-blob hp-blob-1" />
        <div className="hp-blob hp-blob-2" />

        <div className="hp-hero-inner">
          <div className="hp-left">
            <div className="hp-label">✨ Personalized AI Storybooks</div>
            <h1 className="hp-h1">
              The storybook where<br />
              <span className="hp-your">YOUR child</span><br />
              is the hero.
            </h1>
            <p className="hp-sub">
              In 2 minutes, create a personalized picture book starring your family.
              The gift they'll ask you to read again and again. Starting at $9.99.
            </p>
            <div className="hp-ctas">
              <Link to="/create" className="hp-cta-pri">Create Our Story ✨</Link>
              <button className="hp-cta-sec" onClick={() => navigate("/create?demo=1")}>See an example →</button>
            </div>
            <div className="hp-proof">
              <Stars />
              <span className="hp-proof-txt">Loved by 50,000+ families</span>
            </div>
            <p className="hp-quote">
              "Emma cried happy tears seeing herself in the story."<br />
              <span className="hp-quote-attr">— Sarah M., mother of three</span>
            </p>
          </div>

          <div className="hp-right">
            <div className="hp-book-wrap">
              <div className="hp-float-em hp-fe-1">⭐</div>
              <div className="hp-float-em hp-fe-2">✨</div>
              <div className="hp-float-em hp-fe-3">📖</div>
              <div className="hp-float-em hp-fe-4">🎨</div>
              <div className="hp-book-float">
                <div className="hp-book">
                  <div className="hp-bk-left">
                    <span className="hp-bk-star">⭐</span>
                    <span className="hp-bk-sparkle hp-sp1">✨</span>
                    <span className="hp-bk-sparkle hp-sp2">✨</span>
                    <span className="hp-bk-sparkle hp-sp3">✨</span>
                  </div>
                  <div className="hp-bk-spine" />
                  <div className="hp-bk-right">
                    <div className="hp-bk-line" />
                    <div className="hp-bk-line hp-bk-line-m" />
                    <div className="hp-bk-line" />
                    <div className="hp-bk-line hp-bk-line-s" />
                  </div>
                  <div className="hp-bk-pages" />
                </div>
                <div className="hp-book-shadow" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="hp-how">
        <h2 className="hp-sec-h">Creating your family's book is magical — and easy</h2>
        <div className="hp-steps">
          <div className="hp-step">
            <div className="hp-step-num">01</div>
            <div className="hp-step-icon">🎭</div>
            <div className="hp-step-title">Build your cast</div>
            <div className="hp-step-desc">Add your family, name everyone, upload photos</div>
          </div>
          <div className="hp-step-line" />
          <div className="hp-step">
            <div className="hp-step-num">02</div>
            <div className="hp-step-icon">✨</div>
            <div className="hp-step-title">Tell Stori your idea</div>
            <div className="hp-step-desc">Our AI guide asks warm, fun questions to shape your perfect story</div>
          </div>
          <div className="hp-step-line" />
          <div className="hp-step">
            <div className="hp-step-num">03</div>
            <div className="hp-step-icon">📚</div>
            <div className="hp-step-title">Your book is ready</div>
            <div className="hp-step-desc">Read it together, share with family, or download as a PDF</div>
          </div>
        </div>
        <Link to="/create" className="hp-how-cta">Start Creating →</Link>
      </section>

      {/* Emotional testimonials */}
      <section className="hp-emo">
        <h2 className="hp-emo-h">Every child deserves to see themselves as the hero.</h2>
        <p className="hp-emo-sub">Over 50,000 families have created their first StoriKids book. Here's what they're saying.</p>
        <div className="hp-test-grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="hp-test-card">
              <Stars />
              <p className="hp-test-q">"{t.quote}"</p>
              <div className="hp-test-who">
                <div className="hp-test-av">{t.name[0]}</div>
                <div>
                  <div className="hp-test-name">{t.name}</div>
                  <div className="hp-test-desc">{t.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Occasions */}
      <section className="hp-occ">
        <p className="hp-occ-lbl">Perfect for every special moment:</p>
        <div className="hp-occ-row">
          {OCCASIONS.map((o) => (
            <Link key={o.label} to={`/create?occasion=${encodeURIComponent(o.label)}`} className="hp-occ-card">
              <span className="hp-occ-em">{o.emoji}</span>
              <span className="hp-occ-txt">{o.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="hp-bottom-cta">
        <h2 className="hp-bot-h">Ready to create your family's story?</h2>
        <p className="hp-bot-sub">From $9.99 · Takes 2 minutes · Pay after you see page 1</p>
        <Link to="/create" className="hp-bot-btn">Create Your Story →</Link>
      </section>

      {/* Footer */}
      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div className="hp-f-col">
            <div className="hp-f-logo">📖 StoriKids</div>
            <p className="hp-f-tag">Stories that make your child the hero.</p>
          </div>
          <div className="hp-f-col">
            <div className="hp-f-label">Product</div>
            <Link to="/" className="hp-f-link">Home</Link>
            <Link to="/create" className="hp-f-link">Create Story</Link>
            <Link to="/library" className="hp-f-link">My Library</Link>
          </div>
          <div className="hp-f-col">
            <div className="hp-f-label">Legal</div>
            <Link to="/privacy" className="hp-f-link">Privacy Policy</Link>
            <Link to="/terms" className="hp-f-link">Terms of Service</Link>
          </div>
        </div>
        <div className="hp-f-bottom">
          <div className="hp-f-sep" />
          <p className="hp-f-copy">© 2026 StoriKids · Made with ❤️ for families everywhere</p>
        </div>
      </footer>
    </div>
  );
}
