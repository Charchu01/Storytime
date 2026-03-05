import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAppContext } from "../App";
const BookReader = lazy(() => import("../components/BookReader"));
const PrintUpsell = lazy(() => import("../components/PrintUpsell"));

function loadStoriesFromDisk() {
  try { return JSON.parse(localStorage.getItem("sk_stories") || "[]"); }
  catch { return []; }
}

function findStory(id, stories, locationState) {
  return stories.find((s) => s.id === id)
    || locationState?.storyData
    || loadStoriesFromDisk().find((s) => s.id === id)
    || null;
}

export default function BookReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { stories } = useAppContext();
  const [showPrint, setShowPrint] = useState(false);
  const [demoData, setDemoData] = useState(null);
  const [resolvedStory, setResolvedStory] = useState(() =>
    id !== "demo" ? findStory(id, stories, location.state) : null
  );

  // Keep trying to find the story as React state propagates
  useEffect(() => {
    if (id === "demo" || resolvedStory) return;
    const found = findStory(id, stories, location.state);
    if (found) {
      setResolvedStory(found);
      return;
    }
    // Retry a few times for race condition with state propagation
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const retry = findStory(id, stories, location.state);
      if (retry) {
        setResolvedStory(retry);
        clearInterval(interval);
      } else if (attempts >= 10) {
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [id, stories, location.state, resolvedStory]);

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
      <div className="gen-screen">
        <div className="gen-emoji">📖</div>
        <div className="gen-headline">Loading your book...</div>
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
