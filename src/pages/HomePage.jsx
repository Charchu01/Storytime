import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

/* ── Demo book data (loaded inline to avoid async) ── */
const DEMO_BOOK = {
  title: "Mia and the Whispering Forest",
  coverEmoji: "🌲",
  artStyle: "Soft Watercolour",
  heroName: "Mia",
  dedication: "For every child who believes in magic — and every parent who keeps that belief alive.",
  pages: [
    { label: "Cover", text: "Mia and the Whispering Forest", emoji: "🌲", gradient: "linear-gradient(135deg, #2d6a4f, #40916c, #95d5b2)" },
    { label: "Page 1", text: "Mia had always known the old oak at the bottom of the garden was special. Its branches whispered secrets when the wind blew just right.", emoji: "🌳", gradient: "linear-gradient(135deg, #ffd166, #f4a261, #e76f51)" },
    { label: "Page 2", text: "Today, the whispers were louder. She squeezed through the gap in the roots and found herself tumbling into a world made entirely of starlight and moss.", emoji: "✨", gradient: "linear-gradient(135deg, #7b2cbf, #5a189a, #3c096c)" },
    { label: "Page 3", text: "'We've been expecting you,' said the fox with tiny spectacles. 'The forest has a problem, and it thinks you're brave enough to help.'", emoji: "🦊", gradient: "linear-gradient(135deg, #e76f51, #f4a261, #e9c46a)" },
    { label: "Page 4", text: "Mia took a deep breath, stood up as tall as she could, and smiled. 'I'm ready,' she said. And the trees began to sing.", emoji: "🌟", gradient: "linear-gradient(135deg, #f9c74f, #f9844a, #f94144)" },
    { label: "Back Cover", text: "For every child who believes in magic — and every parent who keeps that belief alive.", emoji: "📖", gradient: "linear-gradient(135deg, #2d6a4f, #40916c, #74c69d)" },
  ],
};

const STYLE_GALLERY = [
  { name: "Classic Storybook", key: "storybook", emoji: "📖", gradient: "linear-gradient(135deg, #fce4ec, #f8bbd0, #e8a0bf)" },
  { name: "Soft Watercolour", key: "watercolor", emoji: "🎨", gradient: "linear-gradient(135deg, #e3f2fd, #90caf9, #64b5f6)" },
  { name: "Pixar 3D", key: "pixar", emoji: "✨", gradient: "linear-gradient(135deg, #fff3e0, #ffcc80, #ffa726)" },
  { name: "Bold & Bright", key: "bold", emoji: "🌈", gradient: "linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcb77)" },
  { name: "Cozy & Warm", key: "cozy", emoji: "🧸", gradient: "linear-gradient(135deg, #d7ccc8, #bcaaa4, #a1887f)" },
  { name: "Pencil Sketch", key: "sketch", emoji: "✏️", gradient: "linear-gradient(135deg, #f5f5f5, #e0e0e0, #bdbdbd)" },
  { name: "Anime", key: "anime", emoji: "🌸", gradient: "linear-gradient(135deg, #f3e5f5, #ce93d8, #ab47bc)" },
  { name: "Retro Vintage", key: "retro", emoji: "📻", gradient: "linear-gradient(135deg, #efebe9, #d7ccc8, #a1887f)" },
  { name: "Paper Collage", key: "collage", emoji: "✂️", gradient: "linear-gradient(135deg, #e8f5e9, #a5d6a7, #66bb6a)" },
];

const OCCASIONS = [
  { emoji: "🎂", label: "Birthdays" },
  { emoji: "🎒", label: "First Day" },
  { emoji: "👶", label: "New Sibling" },
  { emoji: "🐾", label: "Pet Story" },
  { emoji: "💝", label: "Anniversary" },
  { emoji: "🎓", label: "Graduation" },
  { emoji: "💌", label: "Just Because" },
  { emoji: "🎄", label: "Christmas" },
  { emoji: "💐", label: "Mother's Day" },
  { emoji: "👔", label: "Father's Day" },
];

const WHO_CARDS = [
  { emoji: "👶", title: "For your child", desc: "They'll beg you to read it every single night." },
  { emoji: "🐾", title: "For your pet", desc: "Turn your furry best friend into a storybook legend." },
  { emoji: "💛", title: "For someone you love", desc: "The most personal gift you'll ever give." },
  { emoji: "👨‍👩‍👧", title: "For the whole family", desc: "Everyone in one adventure — mum, dad, kids, and all." },
  { emoji: "👴", title: "For grandparents", desc: "A story they'll read to the grandkids on repeat." },
  { emoji: "💑", title: "For your partner", desc: "Better than flowers. More personal than a card." },
];

const TESTIMONIALS = [
  { initials: "J.M.", quote: "We read it every single night. He's memorised every word and corrects me if I skip a line.", name: "James M.", desc: "father", stars: 5 },
  { initials: "P.K.", quote: "I made one for our golden retriever and now every dog parent I know is making one.", name: "Priya K.", desc: "pet owner", stars: 5 },
  { initials: "L.T.", quote: "I gave it to my mum for her birthday — a story about her life, illustrated. She couldn't stop crying.", name: "Laura T.", desc: "", stars: 5 },
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

/* ── Demo Book Viewer ── */
function DemoBookViewer() {
  const scrollRef = useRef(null);
  const [activePage, setActivePage] = useState(0);
  const pages = DEMO_BOOK.pages;

  const scrollToPage = (idx) => {
    const container = scrollRef.current;
    if (!container) return;
    const cards = container.querySelectorAll(".hp-demo-card");
    if (cards[idx]) {
      cards[idx].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const cards = container.querySelectorAll(".hp-demo-card");
    const containerRect = container.getBoundingClientRect();
    const center = containerRect.left + containerRect.width / 2;
    let closest = 0;
    let minDist = Infinity;
    cards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const dist = Math.abs(cardCenter - center);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setActivePage(closest);
  };

  const prev = () => scrollToPage(Math.max(0, activePage - 1));
  const next = () => scrollToPage(Math.min(pages.length - 1, activePage + 1));

  return (
    <div className="hp-demo-viewer">
      <div className="hp-demo-nav">
        <button className="hp-demo-arrow hp-demo-arrow--left" onClick={prev} aria-label="Previous page" disabled={activePage === 0}>‹</button>
        <div className="hp-demo-scroll" ref={scrollRef} onScroll={handleScroll}>
          {pages.map((page, i) => (
            <div className="hp-demo-card" key={i}>
              <div className="hp-demo-img" style={{ background: page.gradient }}>
                <span className="hp-demo-emoji">{page.emoji}</span>
              </div>
              <div className="hp-demo-text">
                <span className="hp-demo-label">{page.label}</span>
                <p className="hp-demo-excerpt">{page.text}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="hp-demo-arrow hp-demo-arrow--right" onClick={next} aria-label="Next page" disabled={activePage === pages.length - 1}>›</button>
      </div>
      <div className="hp-demo-dots">
        {pages.map((_, i) => (
          <button
            key={i}
            className={`hp-demo-dot${i === activePage ? " hp-demo-dot--active" : ""}`}
            onClick={() => scrollToPage(i)}
            aria-label={`Go to page ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();

  useEffect(() => { document.title = "Storytime — Personalised AI Storybooks for Your Family"; }, []);

  const [demoRef, demoVisible] = useScrollReveal();
  const [diffRef, diffVisible] = useScrollReveal();
  const [howRef, howVisible] = useScrollReveal();
  const [styleRef, styleVisible] = useScrollReveal();
  const [whoRef, whoVisible] = useScrollReveal();
  const [priceRef, priceVisible] = useScrollReveal();
  const [occRef, occVisible] = useScrollReveal();
  const [testRef, testVisible] = useScrollReveal();
  const [shelfRef, shelfVisible] = useScrollReveal();

  const smoothScroll = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="hp">
      {/* ── SECTION 1: HERO ── */}
      <section className="hp-hero">
        <div className="hp-blob hp-blob-1" />
        <div className="hp-blob hp-blob-2" />

        <div className="hp-hero-inner">
          <div className="hp-left">
            <div className="hp-pill-label">✨ AI-Powered Personalised Storybooks</div>
            <h1 className="hp-h1">A storybook no one else has ever read.</h1>
            <p className="hp-sub">
              Upload their photo. Choose an adventure. In minutes, you'll have a fully illustrated
              storybook starring the people they love most.
            </p>
            <div className="hp-ctas">
              <Link to="/create" className="hp-cta-pri">Make Their Book — From $9.99</Link>
              <button className="hp-cta-sec" onClick={() => smoothScroll("demo-book")}>
                See a sample book ↓
              </button>
            </div>
            <div className="hp-hero-fine">📖 Digital storybook · Hardcover coming soon · Ready in minutes</div>
          </div>

          <div className="hp-right">
            <div className="hp-hero-img-wrap">
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
        </div>
      </section>

      {/* ── SECTION 2: DEMO BOOK FLIP-THROUGH ── */}
      <section className="hp-section" id="demo-book" ref={demoRef}>
        <span className="hp-sec-label">SEE THE MAGIC</span>
        <h2 className="hp-sec-h">Flip through a real Storytime book</h2>
        <p className="hp-sec-sub">Every page illustrated by AI. Every story one-of-a-kind.</p>
        <DemoBookViewer />
        <p className="hp-demo-note">Every book is completely unique — this is just one of millions of possible stories.</p>
        <Link to="/create" className="hp-inline-cta">Create yours now →</Link>
      </section>

      {/* ── SECTION 3: THE AI DIFFERENCE ── */}
      <section className="hp-section" ref={diffRef}>
        <span className="hp-sec-label">WHY STORYTIME</span>
        <h2 className="hp-sec-h">Not a template. Not a fill-in-the-blank.</h2>
        <div className={`hp-diff-grid${diffVisible ? " hp-reveal" : ""}`}>
          <div className="hp-diff-card hp-diff-card--muted">
            <h3 className="hp-diff-title">Traditional personalised books</h3>
            <p className="hp-diff-subtitle">What you get elsewhere</p>
            <ul className="hp-diff-list">
              <li><span className="hp-diff-icon hp-diff-icon--no">✗</span> Pre-drawn templates with name swapped in</li>
              <li><span className="hp-diff-icon hp-diff-icon--no">✗</span> Same illustrations for every child</li>
              <li><span className="hp-diff-icon hp-diff-icon--no">✗</span> Limited story choices</li>
              <li><span className="hp-diff-icon hp-diff-icon--no">✗</span> $35–50 per book</li>
            </ul>
          </div>
          <div className="hp-diff-card hp-diff-card--highlight">
            <h3 className="hp-diff-title">Storytime AI</h3>
            <p className="hp-diff-subtitle">What we do differently</p>
            <ul className="hp-diff-list">
              <li><span className="hp-diff-icon hp-diff-icon--yes">✓</span> Every illustration uniquely generated by AI</li>
              <li><span className="hp-diff-icon hp-diff-icon--yes">✓</span> Upload a photo — they actually look like your child</li>
              <li><span className="hp-diff-icon hp-diff-icon--yes">✓</span> Any story, any style, any adventure you dream up</li>
              <li><span className="hp-diff-icon hp-diff-icon--yes">✓</span> From just $9.99</li>
            </ul>
          </div>
        </div>
        <div className={`hp-diff-stats${diffVisible ? " hp-reveal" : ""}`}>
          ∞ unique combinations · 9 art styles · 8+ story types
        </div>
      </section>

      {/* ── SECTION 4: HOW IT WORKS ── */}
      <section className="hp-section" ref={howRef}>
        <span className="hp-sec-label">SIMPLE AS 1-2-3</span>
        <h2 className="hp-sec-h">From photo to storybook in minutes</h2>
        <div className="hp-how-steps">
          {[
            { emoji: "📷", title: "Upload a photo", desc: "A clear face photo helps our AI match their look in every illustration. No photo? No problem." },
            { emoji: "✨", title: "Design your story", desc: "Pick a book type, choose an art style, add family members. Tell us the adventure or let AI surprise you." },
            { emoji: "📖", title: "Open your book", desc: "A fully illustrated storybook, uniquely painted by AI. Read together, share with grandma, or order a hardcover." },
          ].map((step, i) => (
            <div key={step.title} className={`hp-how-step${howVisible ? " hp-reveal" : ""}`} style={{ animationDelay: `${i * 0.1}s` }}>
              {i > 0 && <div className="hp-how-connector" />}
              <div className="hp-how-icon">{step.emoji}</div>
              <h3 className="hp-how-title">{step.title}</h3>
              <p className="hp-how-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 5: STYLE GALLERY ── */}
      <section className="hp-section" ref={styleRef}>
        <span className="hp-sec-label">CHOOSE THEIR LOOK</span>
        <h2 className="hp-sec-h">9 hand-picked art styles</h2>
        <p className="hp-sec-sub">From watercolours to Pixar-style 3D. Pick the one that matches their personality.</p>
        <div className="hp-style-scroll">
          {STYLE_GALLERY.map((s) => (
            <div className="hp-style-card" key={s.key}>
              <div className="hp-style-img" style={{ background: s.gradient }}>
                <span className="hp-style-emoji">{s.emoji}</span>
              </div>
              <span className="hp-style-name">{s.name}</span>
            </div>
          ))}
        </div>
        <p className="hp-sec-note">Can't decide? We'll help you pick during the creation process.</p>
      </section>

      {/* ── SECTION 6: WHO'S THE STAR ── */}
      <section className="hp-section" ref={whoRef}>
        <span className="hp-sec-label">MADE FOR EVERYONE</span>
        <h2 className="hp-sec-h">Who's the star of your story?</h2>
        <div className="hp-who-grid">
          {WHO_CARDS.map((card, i) => (
            <Link
              key={card.title}
              to="/create"
              className={`hp-who-card${whoVisible ? " hp-reveal" : ""}`}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="hp-who-emoji">{card.emoji}</div>
              <h3 className="hp-who-title">{card.title}</h3>
              <p className="hp-who-desc">{card.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── SECTION 7: PRICING ── */}
      <section className="hp-section" ref={priceRef}>
        <span className="hp-sec-label">SIMPLE PRICING</span>
        <h2 className="hp-sec-h">Transparent pricing. No surprises.</h2>
        <div className={`hp-price-grid${priceVisible ? " hp-reveal" : ""}`}>
          <div className="hp-price-card">
            <h3 className="hp-price-tier">Standard</h3>
            <div className="hp-price-amount">$9.99</div>
            <ul className="hp-price-features">
              <li>✓ 6 illustrated pages</li>
              <li>✓ Unique AI-generated story</li>
              <li>✓ Digital storybook</li>
              <li>✓ Read aloud narration</li>
              <li>✓ Share with family</li>
            </ul>
            <Link to="/create" className="hp-price-cta">Create for $9.99 →</Link>
          </div>
          <div className="hp-price-card hp-price-card--premium">
            <span className="hp-price-badge">BEST VALUE</span>
            <h3 className="hp-price-tier">Premium</h3>
            <div className="hp-price-amount">$19.99</div>
            <ul className="hp-price-features">
              <li>✓ 10 illustrated pages</li>
              <li>✓ Everything in Standard</li>
              <li>✓ Family Vault (save characters)</li>
              <li>✓ Priority generation</li>
            </ul>
            <Link to="/create" className="hp-price-cta hp-price-cta--premium">Create for $19.99 →</Link>
          </div>
        </div>
        <p className="hp-sec-note">Both plans include unlimited reading, sharing, and PDF download.</p>
      </section>

      {/* ── SECTION 8: OCCASIONS ── */}
      <section className="hp-section" ref={occRef}>
        <span className="hp-sec-label">PERFECT FOR ANY MOMENT</span>
        <h2 className="hp-sec-h">A story for every chapter of life</h2>
        <div className="hp-occ-row">
          {OCCASIONS.map((o) => (
            <Link key={o.label} to="/create" className="hp-occ-pill">
              <span className="hp-occ-em">{o.emoji}</span>
              <span className="hp-occ-txt">{o.label}</span>
            </Link>
          ))}
        </div>
        <Link to="/create" className="hp-inline-cta" style={{ marginTop: 24 }}>Start creating →</Link>
      </section>

      {/* ── SECTION 9: TESTIMONIALS ── */}
      <section className="hp-section" ref={testRef}>
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
                  {t.desc && <div className="hp-test-desc">{t.desc}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 10: FROM SCREEN TO SHELF ── */}
      <section className="hp-section hp-section--alt" ref={shelfRef}>
        <span className="hp-sec-label">FROM SCREEN TO SHELF</span>
        <h2 className="hp-sec-h">A real book, delivered to your door</h2>
        <p className="hp-sec-sub">Coming soon — turn your digital storybook into a premium hardcover.</p>
        <div className="hp-how-steps">
          {[
            { emoji: "📱", title: "Create digitally", desc: "Design your storybook online. Read it instantly on any device." },
            { emoji: "📖", title: "Order a hardcover", desc: "One click turns your digital book into a professionally printed hardcover." },
            { emoji: "📬", title: "Delivered to you", desc: "Premium quality, shipped worldwide. The perfect keepsake." },
          ].map((step, i) => (
            <div key={step.title} className={`hp-how-step${shelfVisible ? " hp-reveal" : ""}`} style={{ animationDelay: `${i * 0.1}s` }}>
              {i > 0 && <div className="hp-how-connector" />}
              <div className="hp-how-icon">{step.emoji}</div>
              <h3 className="hp-how-title">{step.title}</h3>
              <p className="hp-how-desc">{step.desc}</p>
            </div>
          ))}
        </div>
        <Link to="/create" className="hp-inline-cta" style={{ marginTop: 32 }}>Start with your digital book →</Link>
      </section>

      {/* ── SECTION 11: BOTTOM CTA ── */}
      <section className="hp-bottom-cta">
        <h2 className="hp-bot-h">They won't just read it. They'll treasure it.</h2>
        <p className="hp-bot-sub">Create a one-of-a-kind storybook in minutes. No design skills needed.</p>
        <Link to="/create" className="hp-bot-btn">Make Their Book Now ✨</Link>
        <p className="hp-bot-fine">From $9.99 · Ready in minutes · A keepsake they'll love forever</p>
      </section>

      {/* ── FOOTER ── */}
      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div className="hp-f-left">📖 Storytime</div>
          <div className="hp-f-center">
            <Link to="/privacy" className="hp-f-link">Privacy Policy</Link>
            <span className="hp-f-sep-dot">·</span>
            <Link to="/terms" className="hp-f-link">Terms of Service</Link>
            <span className="hp-f-sep-dot">·</span>
            <a href="mailto:dom@ready.cards" className="hp-f-link">Contact</a>
          </div>
          <div className="hp-f-right">Made with ❤️ for families everywhere</div>
        </div>
      </footer>
    </div>
  );
}
