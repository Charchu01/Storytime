import { useState } from "react";
import { editPageText, generatePageImage } from "../api/story";
import { claudeCall } from "../api/client";
import EditDrawer from "./EditDrawer";

function PageImage({ imageUrl, pageIndex, isLoading }) {
  if (isLoading) {
    return (
      <div className="sp-art sp-art-loading">
        <div className="sp-art-spinner" />
        <div className="sp-art-loading-text">Regenerating…</div>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <div className="sp-art sp-art-real">
        <img src={imageUrl} alt={`Page ${pageIndex + 1} illustration`} />
      </div>
    );
  }

  return (
    <div className="sp-art sp-art-fallback">
      <div className="sp-art-fallback-text">🎨</div>
      <div className="sp-art-fallback-label">Image unavailable</div>
    </div>
  );
}

export default function PreviewStep({ data, cast, onReset, onBack }) {
  const { story, dedication, style } = data;
  const [pages, setPages] = useState(story.pages);
  const [activeEdit, setActiveEdit] = useState(null);
  const [regeneratingImage, setRegeneratingImage] = useState(null);

  function toggleEdit(pageIndex, type) {
    setActiveEdit((current) =>
      current?.index === pageIndex && current?.type === type ? null : { index: pageIndex, type }
    );
  }

  async function handleEditSave(pageIndex, instruction, type) {
    if (type === "story") {
      const newText = await editPageText(pages[pageIndex].text, instruction, cast);
      setPages((prev) => prev.map((page, i) => (i === pageIndex ? { ...page, text: newText } : page)));
    } else {
      // Regenerate the image with new instructions
      setRegeneratingImage(pageIndex);
      try {
        const newImageUrl = await generatePageImage(
          `${pages[pageIndex].imagePrompt || pages[pageIndex].text}. Additional direction: ${instruction}`,
          cast,
          style
        );
        setPages((prev) =>
          prev.map((page, i) => (i === pageIndex ? { ...page, imageUrl: newImageUrl } : page))
        );
      } catch (err) {
        console.error("Failed to regenerate image:", err);
      }
      setRegeneratingImage(null);
    }
    setActiveEdit(null);
  }

  async function handleRefreshPage(pageIndex) {
    const newText = await editPageText(pages[pageIndex].text, "regenerate fresh, same characters", cast);
    setPages((prev) => prev.map((page, i) => (i === pageIndex ? { ...page, text: newText } : page)));
  }

  async function handleRegenerateImage(pageIndex) {
    setRegeneratingImage(pageIndex);
    try {
      const newImageUrl = await generatePageImage(
        pages[pageIndex].imagePrompt || pages[pageIndex].text,
        cast,
        style
      );
      setPages((prev) =>
        prev.map((page, i) => (i === pageIndex ? { ...page, imageUrl: newImageUrl } : page))
      );
    } catch (err) {
      console.error("Failed to regenerate image:", err);
    }
    setRegeneratingImage(null);
  }

  return (
    <div className="shell">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="prog-wrap">
          <div className="prog">
            <div className="prog-fill" style={{ width: "100%" }} />
          </div>
          <div className="prog-lbl">Step 4 of 4 · Your storybook!</div>
        </div>
      </div>

      <div className="prev-wrap">
        {/* Book cover */}
        <div className="book-cover">
          {pages[0]?.imageUrl && (
            <img className="book-cover-bg" src={pages[0].imageUrl} alt="" />
          )}
          <div className="book-cover-overlay" />
          <div className="book-cover-content">
            <div className="book-cover-badge">✨ A StoriKids Original</div>
            <h1 className="book-cover-title">{story.title}</h1>
            <div className="book-cover-meta">
              {style} · {pages.length} illustrated pages
            </div>
            <div className="book-cover-cast">
              {cast.map((character) => (
                <span key={character.id} className="book-cover-char">
                  {character.emoji} {character.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Dedication page */}
        {dedication && (
          <div className="ded-pg">
            <div style={{ fontSize: 28, marginBottom: 10 }}>📖</div>
            <div className="ded-pg-text">{dedication}</div>
          </div>
        )}

        {/* Story pages */}
        <div className="spreads">
          {pages.map((page, index) => (
            <div key={index} className="spread-wrap">
              <div className="spread">
                <div className="spread-in">
                  <PageImage
                    imageUrl={page.imageUrl}
                    pageIndex={index}
                    isLoading={regeneratingImage === index}
                  />
                  <div className="sp-txt">
                    <div>
                      <div className="sp-num">Page {index + 1}</div>
                      <div className="sp-story">{page.text}</div>
                    </div>
                    <div className="sp-acts">
                      <button className="sp-act" onClick={() => toggleEdit(index, "story")}>
                        ✏️ Edit story
                      </button>
                      <button className="sp-act" onClick={() => toggleEdit(index, "art")}>
                        🎨 Edit art
                      </button>
                      <button className="sp-act" onClick={() => handleRefreshPage(index)}>
                        🔄 Refresh text
                      </button>
                      <button
                        className="sp-act"
                        onClick={() => handleRegenerateImage(index)}
                        disabled={regeneratingImage === index}
                      >
                        🖼️ New image
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {activeEdit?.index === index && (
                <EditDrawer
                  type={activeEdit.type}
                  onSave={(instruction) => handleEditSave(index, instruction, activeEdit.type)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="final-row">
          <button className="f-btn f-pri" onClick={() => window.print()}>🖨️ Print Book</button>
          <button className="f-btn f-sec" onClick={onReset}>✨ New Story</button>
        </div>
      </div>
    </div>
  );
}
