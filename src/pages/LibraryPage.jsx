import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext, useToast } from "../App";

import { STYLE_GRADIENTS } from "../api/story";

export default function LibraryPage() {
  const { stories, storiesLoading, deleteStory } = useAppContext();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => { document.title = "My Library — Storytime"; }, []);

  function handleDelete(id, title) {
    if (confirm(`Delete "${title}"? This cannot be undone.`)) {
      deleteStory(id);
      addToast("Story deleted", "info");
    }
  }

  function handleShare(story) {
    try {
      const shareData = { story: { title: story.title || story.story?.title }, styleName: story.style || story.styleName, heroName: story.hero_name };
      const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
      navigator.clipboard.writeText(`${window.location.origin}/shared?d=${encoded}`);
      addToast("Link copied! Send it to grandma 👵", "magic");
    } catch { addToast("Failed to copy link", "error"); }
  }

  if (storiesLoading) {
    return (
      <div className="lib-page">
        <div className="lib-empty">
          <div className="lib-empty-book">📚</div>
          <h2 className="lib-empty-h">Loading your library...</h2>
        </div>
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="lib-page">
        <div className="lib-empty">
          <div className="lib-empty-book">📚</div>
          <h2 className="lib-empty-h">Your family's first story is waiting ✨</h2>
          <p className="lib-empty-p">Every family has a story to tell. Let's write yours together.</p>
          <Link to="/create" className="lib-empty-cta">Create Your First Story →</Link>
        </div>
      </div>
    );
  }

  const heroName = stories[0]?.hero_name || "friend";

  return (
    <div className="lib-page">
      <div className="lib-header">
        <div>
          <h1 className="lib-h1">Welcome back, {heroName} 👋</h1>
          <p className="lib-sub">Your family's storybook collection · {stories.length} {stories.length === 1 ? "story" : "stories"} created</p>
        </div>
        <Link to="/create" className="lib-create-btn">✨ Create New Story</Link>
      </div>

      <div className="lib-grid">
        {/* Create new card */}
        <Link to="/create" className="lib-card lib-card-new">
          <div className="lib-new-inner">
            <span className="lib-new-em">✨</span>
            <span className="lib-new-txt">Create a New Story</span>
          </div>
        </Link>

        {stories.map((s, i) => {
          const title = s.title || s.story?.title || "Untitled";
          const styleName = s.style || s.styleName || "Watercolor";
          const grad = STYLE_GRADIENTS[styleName] || STYLE_GRADIENTS.Storybook;
          const childName = s.hero_name || "";
          const date = s.created_at ? new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
          const hovered = hoveredId === s.id;

          return (
            <div
              key={s.id}
              className="lib-card"
              style={{ animationDelay: `${i * 0.07}s` }}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="lib-card-cover" style={{ background: grad }}>
                <div className="lib-card-spine" />
                <h3 className="lib-card-title">{title}</h3>
                <div className="lib-card-badge">{styleName}</div>

                {hovered && (
                  <div className="lib-card-overlay">
                    <button className="lib-act-btn" onClick={() => navigate(`/book/${s.id}`)}>📖 Open</button>
                    <button className="lib-act-btn" onClick={() => handleShare(s)}>🔗 Share</button>
                    <button className="lib-act-btn lib-act-del" onClick={() => handleDelete(s.id, title)}>🗑 Delete</button>
                  </div>
                )}
              </div>
              <div className="lib-card-info">
                {childName && <div className="lib-card-child">For {childName}</div>}
                {s.tier === "premium" && <div className="lib-tier-badge">✨ Premium</div>}
                {date && <div className="lib-card-date">{date}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
