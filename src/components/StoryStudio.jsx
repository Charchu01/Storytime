import { useState, useCallback } from "react";
import StoryChat from "./StoryChat";
import StoryBlueprint from "./StoryBlueprint";
import { STYLES } from "../constants/data";

export default function StoryStudio({ heroType, tier, isGift, onComplete, onBack }) {
  const [blueprintData, setBlueprintData] = useState({
    heroName: "",
    heroAge: "",
    heroType: "",
    heroPhoto: null,
    characters: [],
    storyIdea: "",
    details: "",
    personalIngredient: "",
    dedication: "",
    authorName: "",
    artStyle: "",
    tone: "",
  });
  const [bpCollapsed, setBpCollapsed] = useState(true); // collapsed on mobile by default
  const [ready, setReady] = useState(false);

  const handleDataUpdate = useCallback((update) => {
    setBlueprintData((prev) => {
      const next = { ...prev };

      // Merge characters array rather than replace
      if (update.characters) {
        next.characters = [...(prev.characters || []), ...update.characters];
      }

      // Merge all other fields
      for (const [key, value] of Object.entries(update)) {
        if (key === "characters") continue;
        if (value !== undefined && value !== null && value !== "") {
          next[key] = value;
        }
      }

      return next;
    });
  }, []);

  const handleReady = useCallback(() => {
    setReady(true);
  }, []);

  function handleCreateBook() {
    // Map blueprint data to the format CreatePage expects
    const styleName = STYLES.find((s) => s.id === blueprintData.artStyle)?.name || blueprintData.artStyle || "Storybook";
    const length = tier === "premium" ? 10 : 6;

    // Build hero photos array
    const heroPhotos = blueprintData.heroPhoto
      ? [{ dataUri: blueprintData.heroPhoto, quality: "fair", feedback: "" }]
      : [];

    // Build cast from characters
    const cast = (blueprintData.characters || []).map((c, i) => ({
      name: c.name,
      role: c.relationship || "friend",
      emoji: c.relationship === "pet" ? "🐾" :
             c.relationship === "partner" ? "💕" :
             c.relationship === "child" ? "🧒" : "🤝",
      description: c.description || "",
    }));

    // Map heroType to heroRole
    const heroRole = blueprintData.heroType === "pet" ? "pet" :
                     blueprintData.heroType === "adult" ? "adult" :
                     blueprintData.heroType === "grandparent" ? "grandparent" :
                     "child";

    onComplete({
      heroName: blueprintData.heroName || "",
      heroAge: blueprintData.heroAge || "",
      heroRole,
      heroType: blueprintData.heroType || "",
      heroPhotos,
      cast,
      storyIdea: blueprintData.storyIdea || "",
      spark: "custom",
      style: blueprintData.artStyle || "sb",
      dedication: blueprintData.dedication || "",
      authorName: blueprintData.authorName || "A loving family",
      tone: blueprintData.tone || "",
      format: "classic",
      secret: blueprintData.personalIngredient || "",
      details: blueprintData.details || "",
      length,
    });
  }

  return (
    <div className="ss-container">
      {/* Top bar */}
      <div className="ss-topbar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h1 className="ss-topbar-title">Story Studio</h1>
        <div className="ss-topbar-spacer" />
      </div>

      {/* Split screen content */}
      <div className="ss-content">
        {/* Left: Blueprint */}
        <div className={`ss-left${bpCollapsed ? " ss-left-collapsed" : ""}`}>
          <StoryBlueprint
            data={blueprintData}
            collapsed={bpCollapsed}
            onToggle={() => setBpCollapsed(!bpCollapsed)}
            onCreateBook={handleCreateBook}
          />
        </div>

        {/* Right: Chat */}
        <div className="ss-right">
          <StoryChat
            heroType={heroType}
            onDataUpdate={handleDataUpdate}
            onReady={handleReady}
          />
        </div>
      </div>

      {/* Floating create button (visible when ready) */}
      {ready && (
        <div className="ss-float-create">
          <button className="ss-float-btn" onClick={handleCreateBook}>
            Create My Book →
          </button>
        </div>
      )}
    </div>
  );
}
