import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

const OCCASIONS = [
  { emoji: "🎂", label: "Birthdays" },
  { emoji: "🏫", label: "First Day" },
  { emoji: "👶", label: "New Sibling" },
  { emoji: "🐾", label: "Pet Story" },
  { emoji: "💑", label: "Anniversary" },
  { emoji: "🎓", label: "Graduation" },
  { emoji: "🕊️", label: "In Memory" },
  { emoji: "🌟", label: "Just Because" },
];

const WHO_CARDS = [
  { emoji: "👦", title: "For your child", desc: "The bedtime story where they're the hero.", mode: "child" },
  { emoji: "🐾", title: "For your pet", desc: "Because Biscuit deserves an adventure too.", mode: "pet" },
  { emoji: "💛", title: "For someone special", desc: "A gift they'll keep forever.", mode: "special" },
];

const HOW_STEPS = [
  { emoji: "🎭", title: "Build your cast", desc: "Add your family, upload a photo, and tell us a little about them." },
  { emoji: "✨", title: "Pick an adventure", desc: "Choose a theme, a world, and a mood — or let us surprise you." },
  { emoji: "📖", title: "Read your story", desc: "Your personalised illustrated book is ready to share, save, or print." },
];

const TESTIMONIALS = [
  { initials: "J.M.", quote: "We read it every single night. He's memorised every word and corrects me if I skip a line.", name: "James M.", desc: "father", stars: 5 },
  { initials: "P.K.", quote: "I made one for our golden retriever and now every dog parent I know is making one.", name: "Priya K.", desc: "pet owner", stars: 5 },
  { initials: "L.T.", quote: "I gave it to my mum for her birthday — a story about her life, illustrated. She couldn't stop crying.", name: "Laura T.", desc: "", stars: 5 },
];

const SHOWCASE = [
  { title: "Emma's Space Adventure", style: "Soft Watercolour", emoji: "🚀", gradient: "linear-gradient(135deg, #1a1a3e, #2d1b69, #0f4c75)" },
  { title: "Biscuit Saves the Kingdom", style: "Bold & Bright", emoji: "🐕", gradient: "linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcb77)" },
  { title: "Grandma's Garden", style: "Cozy & Warm", emoji: "🌸", gradient: "linear-gradient(135deg, #fce4ec, #f8bbd0, #f48fb1)" },
];

function Stars() {
  return <span className="hp-stars" aria-label="5 stars">★★★★★</span>;
}

function useScrollReveal() {
  const ref = useRef();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

export default function HomePage() {
  const navigate = useNavigate();

  useEffect(() => { document.title = "Storytime — Personalised AI Storybooks for Your Family"; }, []);

  const [whoRef, whoVisible] = useScrollReveal();
  const [howRef, howVisible] = useScrollReveal();
  const [showRef, showVisible] = useScrollReveal();
  const [testRef, testVisible] = useScrollReveal();

  return (
    <div className="hp">
      {/* HERO */}
      <section className="hp-hero">
        <div className="hp-blob hp-blob-1" />
        <div className="hp-blob hp-blob-2" />

        <div className="hp-hero-inner">
          <div className="hp-left">
            <div className="hp-label"><span className="hp-shimmer">✨</span> Personalised Storybooks</div>
            <h1 className="hp-h1">Make someone you love the hero of their own story.</h1>
            <p className="hp-sub">
              A personalised illustrated storybook — with their name, their face,
              and a world built just for them. Ready in two minutes.
            </p>
            <div className="hp-ctas">
              <Link to="/create" className="hp-cta-pri">Create Their Story ✨</Link>
              <button className="hp-cta-sec" onClick={() => navigate("/book/demo")}>
                See an example first →
              </button>
            </div>
            <div className="hp-proof">
              <Stars />
              <span className="hp-proof-txt">Loved by 50,000+ families</span>
            </div>
            <blockquote className="hp-quote">
              <p>"My daughter saw herself on the first page and her whole face changed. That's when I knew this was worth every penny."</p>
              <cite>— Sarah M., mother of 2</cite>
            </blockquote>
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

      {/* WHO IS THIS FOR */}
      <section className="hp-who" ref={whoRef}>
        <h2 className="hp-sec-h">For every person (and pet) you love</h2>
        <div className="hp-who-grid">
          {WHO_CARDS.map((card, i) => (
            <Link
              key={card.mode}
              to={`/create?mode=${card.mode}`}
              className={`hp-who-card${whoVisible ? " hp-reveal" : ""}`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="hp-who-emoji">{card.emoji}</div>
              <h3 className="hp-who-title">{card.title}</h3>
              <p className="hp-who-desc">{card.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="hp-how" ref={howRef}>
        <h2 className="hp-sec-h">Three steps. Two minutes. One unforgettable book.</h2>
        <div className="hp-steps">
          {HOW_STEPS.map((step, i) => (
            <div
              key={step.title}
              className={`hp-step${howVisible ? " hp-reveal" : ""}`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="hp-step-icon">{step.emoji}</div>
              <div className="hp-step-title">{step.title}</div>
              <div className="hp-step-desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCT SHOWCASE */}
      <section className="hp-showcase" ref={showRef}>
        <h2 className="hp-sec-h">Stories as unique as your family</h2>
        <div className="hp-show-scroll">
          {SHOWCASE.map((item, i) => (
            <div
              key={item.title}
              className={`hp-show-card${showVisible ? " hp-reveal" : ""}`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="hp-show-img" style={{ background: item.gradient }}>
                <span className="hp-show-emoji">{item.emoji}</span>
              </div>
              <div className="hp-show-info">
                <span className="hp-show-badge">{item.style}</span>
                <span className="hp-show-title">{item.title}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="hp-test" ref={testRef}>
        <h2 className="hp-sec-h">Don't just take our word for it</h2>
        <div className="hp-test-grid">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.name}
              className={`hp-test-card${testVisible ? " hp-reveal" : ""}`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <Stars />
              <p className="hp-test-q">"{t.quote}"</p>
              <div className="hp-test-who">
                <div className="hp-test-av">{t.initials}</div>
                <div>
                  <div className="hp-test-name">{t.name}</div>
                  <div className="hp-test-desc">{t.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* OCCASIONS */}
      <section className="hp-occ">
        <p className="hp-occ-lbl">Perfect for every moment</p>
        <div className="hp-occ-row">
          {OCCASIONS.map((o) => (
            <Link key={o.label} to={`/create?occasion=${encodeURIComponent(o.label)}`} className="hp-occ-pill">
              <span className="hp-occ-em">{o.emoji}</span>
              <span className="hp-occ-txt">{o.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="hp-bottom-cta">
        <h2 className="hp-bot-h">The best stories haven't been written yet. Yours is next.</h2>
        <Link to="/create" className="hp-bot-btn">Create Their Story →</Link>
        <p className="hp-bot-fine">No credit card · Takes 2 minutes · Free to preview</p>
      </section>

      {/* FOOTER */}
      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div className="hp-f-col">
            <div className="hp-f-logo">📖 Storytime</div>
            <p className="hp-f-tag">Every family has a story.</p>
          </div>
          <div className="hp-f-col">
            <div className="hp-f-label">Product</div>
            <Link to="/" className="hp-f-link">Home</Link>
            <Link to="/create" className="hp-f-link">Create a Story</Link>
            <Link to="/library" className="hp-f-link">My Library</Link>
          </div>
          <div className="hp-f-col">
            <div className="hp-f-label">Legal</div>
            <Link to="/privacy" className="hp-f-link">Privacy Policy</Link>
            <Link to="/terms" className="hp-f-link">Terms of Service</Link>
            <a href="mailto:dom@ready.cards" className="hp-f-link">Contact</a>
          </div>
        </div>
        <div className="hp-f-bottom">
          <div className="hp-f-sep" />
          <p className="hp-f-copy">© 2026 Storytime · Made with ❤️ for families everywhere</p>
        </div>
      </footer>
    </div>
  );
}
