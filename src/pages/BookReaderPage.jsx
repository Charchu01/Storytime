import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
const BookReader = lazy(() => import("../components/BookReader"));
const PrintUpsell = lazy(() => import("../components/PrintUpsell"));

function loadStoriesFromDisk() {
  try { return JSON.parse(localStorage.getItem("sk_stories") || "[]"); }
  catch { return []; }
}

export default function BookReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { stories } = useAppContext();
  const [showPrint, setShowPrint] = useState(false);
  const [demoData, setDemoData] = useState(null);

  // Handle demo book
  useEffect(() => {
    if (id === "demo") {
      fetch("/demo/book.json")
        .then((r) => r.json())
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
          // Fallback: construct a minimal demo
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

  // Try context first, then localStorage directly
  const story = id === "demo"
    ? demoData
    : stories.find((s) => s.id === id)
      || loadStoriesFromDisk().find((s) => s.id === id);

  useEffect(() => {
    if (story && id !== "demo") document.title = `${story.story?.title || "Your Book"} — Storytime`;
  }, [story, id]);

  useEffect(() => {
    if (!story || id === "demo") return;
    const dismissed = localStorage.getItem(`sk_print_dismissed_${id}`);
    if (!dismissed) {
      const timer = setTimeout(() => setShowPrint(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [story, id]);

  function handleDismissPrint() {
    setShowPrint(false);
    localStorage.setItem(`sk_print_dismissed_${id}`, "1");
  }

  if (id === "demo" && !demoData) {
    return (
      <div className="gen-screen">
        <div className="gen-emoji">📖</div>
        <div className="gen-headline">Loading demo story...</div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="page-404">
        <div className="p404-book">📖</div>
        <h1 className="p404-h">Story not found</h1>
        <p className="p404-p">This story may have been deleted or the link is invalid.</p>
        <button className="p404-btn" onClick={() => navigate("/library")}>Go to Library →</button>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="gen-screen"><div className="gen-emoji gen-spin">📖</div><div className="gen-headline">Loading your book...</div></div>}>
      <BookReader
        data={story}
        cast={story.cast || []}
        styleName={story.styleName || "Watercolor"}
        onReset={() => navigate("/create")}
      />
      {showPrint && <PrintUpsell onDismiss={handleDismissPrint} />}
    </Suspense>
  );
}
