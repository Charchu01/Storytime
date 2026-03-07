import { useEffect, useState, lazy, Suspense, Component } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
const BookReader = lazy(() => import("../components/BookReader"));
const PrintUpsell = lazy(() => import("../components/PrintUpsell"));

class BookErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error("BookReader crash:", err); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="gen-screen">
          <div className="gen-emoji">📖</div>
          <div className="gen-headline">Something went wrong</div>
          <p style={{ color: "#64748b", marginTop: 8 }}>Try reloading the page.</p>
          <button className="gen-retry-btn" onClick={() => window.location.reload()} style={{ marginTop: 16 }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function transformSupabaseBook(data) {
  const pages = (data.book_pages || []).sort((a, b) => a.page_index - b.page_index);
  const spreads = pages
    .filter(p => p.page_type === "spread")
    .map(p => ({
      leftPageText: p.left_page_text ?? "",
      rightPageText: p.right_page_text ?? "",
      scene: p.scene_description || "",
      layout: p.layout_type || "full",
      mood: "wonder",
    }));

  const images = {};
  for (const p of pages) {
    const url = p.image_url_permanent || p.image_url;
    if (!url) continue;
    if (p.page_type === "cover") images.cover = url;
    else if (p.page_type === "back_cover") images.backCover = url;
    else if (p.page_type === "spread") images[`spread_${p.page_index - 1}`] = url;
  }

  // Extract story_plan but don't let it override our transformed spreads/title
  const { spreads: _rawSpreads, title: _rawTitle, ...storyPlanExtras } = (data.story_plan || {});

  return {
    id: data.id,
    story: {
      title: data.title || "Untitled",
      spreads,
      ...storyPlanExtras,
    },
    images,
    styleName: data.style || "Watercolor",
    hero_name: data.hero_name || null,
    cast: [],
    tier: data.tier || "standard",
    mode: data.hero_type || "child",
    bookType: data.book_type || "adventure",
    dedication: data.dedication || null,
    authorName: data.author_name || "A loving family",
    createdAt: data.created_at,
  };
}

export default function BookReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPrint, setShowPrint] = useState(false);
  const [demoData, setDemoData] = useState(null);
  const [resolvedStory, setResolvedStory] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Load book from Supabase (or from navigation state as immediate fallback)
  useEffect(() => {
    if (id === "demo") return;

    // Check if story was passed via navigation state (immediate after generation)
    if (location.state?.storyData) {
      setResolvedStory(location.state.storyData);
      return;
    }

    let cancelled = false;
    async function loadBook() {
      try {
        const { data, error } = await supabase
          .from('books')
          .select('*, book_pages(*)')
          .eq('id', id)
          .single();

        if (cancelled) return;

        if (error || !data) {
          if (!cancelled) setNotFound(true);
          return;
        }
        setResolvedStory(transformSupabaseBook(data));
      } catch {
        if (!cancelled) setNotFound(true);
      }
    }

    loadBook();
    return () => { cancelled = true; };
  }, [id, location.state]);

  // Handle demo book
  useEffect(() => {
    if (id === "demo") {
      fetch("/demo/book.json")
        .then((r) => { if (!r.ok) throw new Error("Demo fetch failed"); return r.json(); })
        .then((data) => {
          setDemoData({
            story: data,
            cast: [{ id: "mia", name: data.heroName || "Mia", role: "child", age: data.heroAge || 6, isHero: true, emoji: "👧" }],
            styleName: data.artStyle || "Watercolor",
            authorName: data.authorName || "The Storytime Team",
            dedication: data.dedication,
          });
        })
        .catch(() => {
          setDemoData({
            story: {
              title: "Mia and the Whispering Forest",
              coverEmoji: "🌲",
              pages: [
                { text: "Mia had always known the old oak at the bottom of the garden was special.", scene_emoji: "🌳", mood: "wonder" },
                { text: "Today, the whispers were louder. She squeezed through the roots into a world of starlight.", scene_emoji: "✨", mood: "wonder" },
                { text: "A fox with autumn-leaf fur sat on a toadstool. 'We've been expecting you,' he said.", scene_emoji: "🦊", mood: "cozy" },
                { text: "Mia smiled. 'I'm ready.' And the trees began to sing.", scene_emoji: "🌟", mood: "triumphant" },
              ],
            },
            cast: [{ id: "mia", name: "Mia", role: "child", age: 6, isHero: true, emoji: "👧" }],
            styleName: "Watercolor",
            dedication: "For every child who believes in magic.",
          });
        });
      document.title = "Demo Story — Storytime";
      return;
    }
  }, [id]);

  const story = id === "demo" ? demoData : resolvedStory;

  useEffect(() => {
    if (story && id !== "demo") document.title = `${story.story?.title || "Your Book"} — Storytime`;
  }, [story, id]);

  useEffect(() => {
    if (!story || id === "demo") return;
    try {
      const dismissed = localStorage.getItem(`sk_print_dismissed_${id}`);
      if (!dismissed) {
        const timer = setTimeout(() => setShowPrint(true), 2000);
        return () => clearTimeout(timer);
      }
    } catch { /* storage unavailable */ }
  }, [story, id]);

  function handleDismissPrint() {
    setShowPrint(false);
    try { localStorage.setItem(`sk_print_dismissed_${id}`, "1"); }
    catch { /* storage unavailable */ }
  }

  if (id === "demo" && !demoData) {
    return (
      <div className="gen-screen">
        <div className="gen-emoji">📖</div>
        <div className="gen-headline">Loading demo story...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="gen-screen">
        <div className="gen-emoji">📖</div>
        <div className="gen-headline">Book not found</div>
        <p style={{ color: "#64748b", marginTop: 8 }}>This book may have been deleted or the link is invalid.</p>
        <button className="gen-retry-btn" onClick={() => navigate("/library")} style={{ marginTop: 16 }}>Go to Library</button>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="gen-screen">
        <div className="gen-emoji">📖</div>
        <div className="gen-headline">Loading your book...</div>
      </div>
    );
  }

  return (
    <BookErrorBoundary>
      <Suspense fallback={<div className="gen-screen"><div className="gen-emoji gen-spin">📖</div><div className="gen-headline">Loading your book...</div></div>}>
        <BookReader
          data={story}
          cast={story.cast || []}
          styleName={story.styleName || "Watercolor"}
          onReset={() => navigate("/create")}
        />
        {showPrint && <PrintUpsell onDismiss={handleDismissPrint} />}
      </Suspense>
    </BookErrorBoundary>
  );
}
