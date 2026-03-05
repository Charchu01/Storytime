import { useState, useCallback } from "react";
import StoryChat from "./StoryChat";

export default function StoryStudio({ bookType, heroData, artStyle, onComplete, onBack }) {
  const [ready, setReady] = useState(false);
  const [collectedData, setCollectedData] = useState({
    storyIdea: "",
    details: "",
    tone: "",
    dedication: "",
    authorName: "",
    occasion: "",
    theme: "",
    world: "",
    language: "en",
  });

  const handleDataUpdate = useCallback((update) => {
    setCollectedData((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(update)) {
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
    onComplete({
      ...collectedData,
      heroName: heroData.heroName,
      heroAge: heroData.heroAge,
      heroType: heroData.heroType,
      bookType: bookType.id,
    });
  }

  return (
    <div className="ss-container">
      <div className="ss-topbar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h1 className="ss-topbar-title">Story Details</h1>
        <div className="ss-topbar-spacer" />
      </div>

      <div className="ss-content ss-content-full">
        <div className="ss-right">
          <StoryChat
            bookType={bookType}
            heroData={heroData}
            artStyle={artStyle}
            onDataUpdate={handleDataUpdate}
            onReady={handleReady}
          />
        </div>
      </div>

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
