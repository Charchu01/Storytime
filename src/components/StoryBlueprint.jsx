import { STYLES } from "../constants/data";

const FIELD_WEIGHTS = {
  heroName: 10,
  heroType: 5,
  heroPhoto: 10,
  characters: 10,
  storyIdea: 20,
  details: 10,
  personalIngredient: 5,
  dedication: 5,
  authorName: 5,
  artStyle: 10,
  tone: 10,
};

function calcProgress(data) {
  let filled = 0;
  let total = 0;
  for (const [key, weight] of Object.entries(FIELD_WEIGHTS)) {
    total += weight;
    if (key === "characters") {
      if (data.characters && data.characters.length > 0) filled += weight;
    } else if (key === "heroPhoto") {
      if (data.heroPhoto) filled += weight;
    } else if (data[key]) {
      filled += weight;
    }
  }
  return Math.round((filled / total) * 100);
}

export default function StoryBlueprint({ data, collapsed, onToggle, onCreateBook }) {
  const progress = calcProgress(data);
  const styleDef = STYLES.find((s) => s.id === data.artStyle);
  const hasCharacters = data.characters && data.characters.length > 0;
  const canCreate = progress >= 60;

  // Mobile collapsed summary bar
  if (collapsed) {
    return (
      <div className="bp-collapsed" onClick={onToggle}>
        <div className="bp-collapsed-bar">
          <div className="bp-collapsed-info">
            {data.heroName && <span className="bp-collapsed-chip">{data.heroName}</span>}
            {hasCharacters && (
              <span className="bp-collapsed-chip">
                {data.characters.length + 1} character{data.characters.length > 0 ? "s" : ""}
              </span>
            )}
            {data.storyIdea && <span className="bp-collapsed-chip">Story idea set</span>}
            {data.artStyle && <span className="bp-collapsed-chip">{styleDef?.name || data.artStyle}</span>}
          </div>
          <div className="bp-collapsed-progress">
            <span className="bp-collapsed-pct">{progress}% ready</span>
            <span className="bp-collapsed-arrow">▲</span>
          </div>
        </div>
        <div className="bp-collapsed-prog-bar">
          <div className="bp-collapsed-prog-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="bp-panel">
      <div className="bp-header">
        <h2 className="bp-title">Story Blueprint</h2>
        {onToggle && (
          <button className="bp-collapse-btn" onClick={onToggle}>▼</button>
        )}
      </div>

      {/* Progress bar */}
      <div className="bp-progress">
        <div className="bp-progress-bar">
          <div className="bp-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="bp-progress-label">{progress}% complete</span>
      </div>

      {/* Cover preview */}
      <div className="bp-cover">
        {data.heroPhoto ? (
          <div className="bp-cover-photo">
            <img src={data.heroPhoto} alt={data.heroName || "Hero"} />
          </div>
        ) : (
          <div className="bp-cover-empty">
            <span className="bp-cover-icon">📖</span>
          </div>
        )}
        <div className="bp-cover-info">
          <div className="bp-cover-title">
            {data.heroName ? `${data.heroName}'s Story` : "Your Story"}
          </div>
          {data.authorName && (
            <div className="bp-cover-author">By {data.authorName}</div>
          )}
        </div>
      </div>

      {/* Characters */}
      <div className="bp-section">
        <h3 className="bp-section-h">Characters</h3>
        <div className="bp-chars">
          {data.heroName && (
            <div className="bp-char-card bp-char-hero">
              {data.heroPhoto ? (
                <img className="bp-char-photo" src={data.heroPhoto} alt={data.heroName} />
              ) : (
                <div className="bp-char-avatar">
                  {data.heroType === "pet" ? "🐾" : "⭐"}
                </div>
              )}
              <div className="bp-char-info">
                <span className="bp-char-name">{data.heroName}</span>
                <span className="bp-char-role">
                  Hero{data.heroType ? ` · ${data.heroType}` : ""}
                  {data.heroAge ? `, ${data.heroAge}` : ""}
                </span>
              </div>
            </div>
          )}
          {hasCharacters && data.characters.map((c, i) => (
            <div key={i} className="bp-char-card">
              {c.photo ? (
                <img className="bp-char-photo" src={c.photo} alt={c.name} />
              ) : (
                <div className="bp-char-avatar">
                  {c.relationship === "pet" ? "🐾" :
                   c.relationship === "partner" ? "💕" :
                   c.relationship === "child" ? "🧒" :
                   c.relationship === "friend" ? "🤝" : "👤"}
                </div>
              )}
              <div className="bp-char-info">
                <span className="bp-char-name">{c.name}</span>
                <span className="bp-char-role">{c.relationship || "Character"}</span>
                {c.description && (
                  <span className="bp-char-desc">{c.description}</span>
                )}
              </div>
            </div>
          ))}
          {!data.heroName && (
            <div className="bp-empty-hint">Characters will appear here as you chat</div>
          )}
        </div>
      </div>

      {/* Story idea */}
      <div className="bp-section">
        <h3 className="bp-section-h">Story Idea</h3>
        {data.storyIdea ? (
          <p className="bp-story-idea">"{data.storyIdea}"</p>
        ) : (
          <p className="bp-empty-hint">Tell the assistant about your story idea</p>
        )}
        {data.details && (
          <p className="bp-details">{data.details}</p>
        )}
      </div>

      {/* Style & Tone badges */}
      <div className="bp-section bp-badges">
        {data.artStyle && (
          <div className="bp-badge">
            <span className="bp-badge-em">{styleDef?.emoji || "🎨"}</span>
            <span className="bp-badge-label">{styleDef?.name || data.artStyle}</span>
          </div>
        )}
        {data.tone && (
          <div className="bp-badge">
            <span className="bp-badge-em">
              {data.tone === "cozy" ? "🧸" : data.tone === "exciting" ? "🎉" :
               data.tone === "funny" ? "😂" : "❤️"}
            </span>
            <span className="bp-badge-label">{data.tone}</span>
          </div>
        )}
      </div>

      {/* Dedication */}
      {data.dedication && (
        <div className="bp-section">
          <h3 className="bp-section-h">Dedication</h3>
          <p className="bp-dedication">"{data.dedication}"</p>
        </div>
      )}

      {/* Personal ingredient */}
      {data.personalIngredient && (
        <div className="bp-section">
          <h3 className="bp-section-h">Special Ingredient</h3>
          <p className="bp-ingredient">{data.personalIngredient}</p>
        </div>
      )}

      {/* Create button */}
      <button
        className={`bp-create-btn${canCreate ? " bp-create-ready" : ""}`}
        disabled={!canCreate}
        onClick={onCreateBook}
      >
        {canCreate ? "Create My Book →" : `Add more details (${progress}%)`}
      </button>
    </div>
  );
}
