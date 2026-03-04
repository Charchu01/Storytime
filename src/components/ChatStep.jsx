import { useState, useRef, useEffect } from "react";
import { SPARKS, LOVES, MOODS, SPARK_REACTIONS } from "../constants/data";
import { generateStory, generateAllImages, analyzeCharacterPhotos, uploadHeroPhoto } from "../api/story";

function TypingIndicator() {
  return (
    <div className="typing-r">
      <div className="av-sm">✨</div>
      <div className="typing-b">
        <div className="dot" />
        <div className="dot" />
        <div className="dot" />
      </div>
    </div>
  );
}

function Message({ message }) {
  if (message.type === "typing") return <TypingIndicator />;

  if (message.type === "ai") {
    // Safe bold rendering without dangerouslySetInnerHTML
    const parts = message.text.split(/\*\*(.*?)\*\*/g);
    return (
      <div className="mrow ai">
        <div className="av-sm">✨</div>
        <div className="bub ai">
          {parts.map((part, i) =>
            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mrow hu">
      <div className="bub hu">{message.text}</div>
    </div>
  );
}

function LoadingScreen({ step, error, onRetry }) {
  const steps = [
    "Analyzing character photos…",
    "Writing the story…",
    "Generating illustrations…",
    "Adding the finishing touches…",
  ];

  return (
    <div className="loading">
      <div style={{ fontSize: 56 }}>{error ? "😔" : "📚"}</div>
      {!error && <div className="load-ring" />}
      <div className="load-h">{error ? "Something went wrong" : "Creating your storybook…"}</div>
      {error ? (
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 14, color: "var(--mid)", marginBottom: 16, lineHeight: 1.6, wordBreak: "break-word" }}>
            {error}
          </div>
          <button className="big-btn" style={{ maxWidth: 240, margin: "0 auto" }} onClick={onRetry}>
            Try Again
          </button>
        </div>
      ) : (
        <div className="load-steps">
          {steps.map((label, i) => (
            <div key={i} className={`ls${step === i ? " act" : step > i ? " dn" : ""}`}>
              <span>{step > i ? "✓" : "→"}</span>
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatStep({ cast, style, onNext, onBack }) {
  const hero = cast.find((c) => c.isHero) || cast[0];
  const [phase, setPhase] = useState("spark");
  const [answers, setAnswers] = useState({});
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [dedication, setDedication] = useState(
    `For ${cast.filter((c) => ["child", "baby"].includes(c.role)).map((c) => c.name).join(" & ") || "our little ones"}, who make every day magical. ❤️`
  );
  const [showTray, setShowTray] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [error, setError] = useState(null);
  const [booted, setBooted] = useState(false);

  const endRef = useRef();
  const textareaRef = useRef();

  function scrollToBottom() {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function addAI(text, callback) {
    const id = Date.now();
    setMessages((prev) => [...prev, { id, type: "typing" }]);
    scrollToBottom();
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { id, type: "ai", text } : m)));
      scrollToBottom();
      setTimeout(() => callback?.(), 200);
    }, 900);
  }

  function addUser(text) {
    setMessages((prev) => [...prev, { id: Date.now(), type: "user", text }]);
    scrollToBottom();
  }

  useEffect(() => {
    if (booted) return;
    setBooted(true);
    const names = cast.map((c) => c.name).join(", ");
    addAI(`I've got your cast — **${names}**! 🎉 They're all going to be in this story.`, () => {
      setTimeout(() => {
        addAI("What kind of adventure should this be? Pick one of my ideas below — or just type your own!", () => {
          setShowTray(true);
        });
      }, 600);
    });
  }, []);

  function pickSpark(id, text) {
    if (answers.spark) return;
    setShowTray(false);
    setAnswers((prev) => ({ ...prev, spark: id, sparkText: text }));
    setInputText("");
    addUser(text);
    setTimeout(() => {
      addAI(SPARK_REACTIONS[id] || "Love it! ✨", () => {
        setTimeout(() => {
          addAI("Who should be the **star** of this story? Tap their name below — or just type it!", () => {
            setPhase("hero");
            setShowTray(true);
          });
        }, 500);
      });
    }, 300);
  }

  function pickHero(id, name) {
    if (answers.hero) return;
    setShowTray(false);
    setAnswers((prev) => ({ ...prev, hero: id, heroName: name }));
    setInputText("");
    const character = cast.find((c) => c.id === id);
    addUser(`${character?.emoji || ""} ${name}`);
    setTimeout(() => {
      addAI(`**${name}** is the perfect hero! 🌟`, () => {
        setTimeout(() => {
          addAI(`What does **${name}** absolutely love? I'll weave it into the story! Tap below or type anything.`, () => {
            setPhase("loves");
            setShowTray(true);
          });
        }, 500);
      });
    }, 300);
  }

  function pickLoves(id, text) {
    if (answers.loves) return;
    setShowTray(false);
    setAnswers((prev) => ({ ...prev, loves: id, lovesText: text }));
    setInputText("");
    addUser(text);
    setTimeout(() => {
      addAI(`${text}! That's going right into the story 🎯`, () => {
        setTimeout(() => {
          addAI("Last one — what's the **vibe** of this book? Tap below or describe it!", () => {
            setPhase("mood");
            setShowTray(true);
          });
        }, 500);
      });
    }, 300);
  }

  function pickMood(id, text) {
    if (answers.mood) return;
    setShowTray(false);
    setAnswers((prev) => ({ ...prev, mood: id, moodText: text }));
    setInputText("");
    addUser(text);
    setTimeout(() => {
      addAI(`${text} — that's going to be so beautiful 🥹`, () => {
        setTimeout(() => {
          addAI("One last touch — want to add a **dedication page**? I wrote one below. Edit it or skip!", () => {
            setPhase("ded");
            setShowTray(true);
          });
        }, 500);
      });
    }, 300);
  }

  function pickDedication(value) {
    setShowTray(false);
    setAnswers((prev) => ({ ...prev, dedication: value }));
    if (value !== "skip") addUser(`"${value.slice(0, 55)}…"`);
    else addUser("Skip the dedication");
    setTimeout(() => {
      addAI("I have everything I need ✨ Check the summary below — then let's create your book!", () => {
        setPhase("done");
        setShowTray(true);
      });
    }, 300);
  }

  function handleSend() {
    const value = inputText.trim();
    if (!value) return;
    setInputText("");
    textareaRef.current?.focus();

    if (phase === "spark") pickSpark("custom", value);
    else if (phase === "hero") {
      const found = cast.find((c) => c.name.toLowerCase() === value.toLowerCase());
      pickHero(found?.id || "custom", found?.name || value);
    } else if (phase === "loves") pickLoves("custom", value);
    else if (phase === "mood") pickMood("custom", value);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setLoadStep(0);

    try {
      // Step 0: Analyze character photos for better image generation
      setLoadStep(0);
      const hasPhotos = cast.some((c) => c.photo);
      let enrichedCast = cast;
      if (hasPhotos) {
        enrichedCast = await analyzeCharacterPhotos(cast);
      }
      await new Promise((r) => setTimeout(r, 300));

      // Step 1: Generate story text
      setLoadStep(1);
      const story = await generateStory(enrichedCast, style, {
        hero: answers.heroName || hero.name,
        spark: answers.sparkText || answers.spark,
        loves: answers.lovesText || answers.loves,
        mood: answers.moodText || answers.mood,
      });

      // Step 2: Upload hero photo once, then generate all illustrations
      setLoadStep(2);
      const heroPhotoUrl = await uploadHeroPhoto(enrichedCast);
      const images = await generateAllImages(story.pages, enrichedCast, style, heroPhotoUrl, (current, total) => {
        // Could add per-image progress here
      });

      // Step 3: Finalize
      setLoadStep(3);
      await new Promise((r) => setTimeout(r, 500));

      // Merge images into pages
      const pagesWithImages = story.pages.map((page, i) => ({
        ...page,
        imageUrl: images[i] || null,
      }));

      onNext({
        story: { ...story, pages: pagesWithImages },
        dedication: answers.dedication !== "skip" ? answers.dedication : null,
        style,
        enrichedCast,
        heroPhotoUrl,
      });
    } catch (err) {
      console.error("Story generation failed:", err);
      setError(err.message || "Something went wrong. Please try again.");
    }
  }

  if (loading || error) return <LoadingScreen step={loadStep} error={error} onRetry={() => { setError(null); setLoading(false); }} />;

  const progressMap = { spark: 55, hero: 67, loves: 78, mood: 88, ded: 94, done: 100 };

  return (
    <div className="chat-shell">
      <div className="chat-top">
        <button className="chat-back" onClick={onBack}>← Back</button>
        <div className="chat-prog-w">
          <div className="prog">
            <div className="prog-fill" style={{ width: `${progressMap[phase] || 55}%` }} />
          </div>
          <div className="prog-lbl">Step 3 of 4 · Build the story</div>
        </div>
        <div className="chat-stori">
          <div className="cs-av">✨</div>
          <div>
            <div className="cs-name">Stori</div>
            <div className="cs-online">● Ready</div>
          </div>
        </div>
      </div>

      <div className="msgs">
        {messages.map((msg) => <Message key={msg.id} message={msg} />)}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="tray">
          <div style={{ color: "#e53e3e", fontSize: 14, fontWeight: 700, textAlign: "center", padding: 12 }}>
            {error}
            <button
              style={{ display: "block", margin: "10px auto 0", background: "var(--terra)", color: "white", border: "none", borderRadius: 10, padding: "8px 20px", fontWeight: 800, cursor: "pointer" }}
              onClick={handleGenerate}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {showTray && (
        <div className="tray">
          {phase === "spark" && !answers.spark && (
            <>
              <div className="tray-lbl">💡 Quick ideas — or type your own below</div>
              <div className="sug-grid">
                {SPARKS.map((spark) => (
                  <div
                    key={spark.id}
                    className="sgcard"
                    onClick={() => pickSpark(spark.id, spark.id === "custom" ? (inputText || spark.title) : spark.title)}
                  >
                    <span className="sg-em">{spark.emoji}</span>
                    <div className="sg-ttl">{spark.title}</div>
                    <div className="sg-sub">{spark.subtitle}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {phase === "hero" && !answers.hero && (
            <>
              <div className="tray-lbl">👥 Your cast — tap to pick, or type a name</div>
              <div className="pill-row">
                {cast.map((character) => (
                  <button key={character.id} className="pill" onClick={() => pickHero(character.id, character.name)}>
                    {character.photo ? <img src={character.photo} alt="" /> : character.emoji} {character.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {phase === "loves" && !answers.loves && (
            <>
              <div className="tray-lbl">❤️ Things kids love — or type your own</div>
              <div className="pill-row">
                {LOVES.map((love) => (
                  <button key={love.id} className="pill" onClick={() => pickLoves(love.id, `${love.emoji} ${love.label}`)}>
                    {love.emoji} {love.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {phase === "mood" && !answers.mood && (
            <>
              <div className="tray-lbl">🎭 Pick the vibe — or describe it</div>
              <div className="pill-row">
                {MOODS.map((mood) => (
                  <button key={mood.id} className="pill" onClick={() => pickMood(mood.id, `${mood.emoji} ${mood.label}`)}>
                    {mood.emoji} {mood.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {phase === "ded" && !answers.dedication && (
            <>
              <div className="tray-lbl">📖 Dedication page — edit or skip</div>
              <textarea
                className="ded-ta"
                rows={3}
                value={dedication}
                onChange={(e) => setDedication(e.target.value)}
              />
              <div className="ded-row">
                <button className="ded-skip" onClick={() => pickDedication("skip")}>Skip</button>
                <button className="ded-use" onClick={() => pickDedication(dedication)}>✓ Add dedication</button>
              </div>
            </>
          )}

          {phase === "done" && (
            <>
              <div className="recap">
                <div>
                  <div className="rc-lbl">Story</div>
                  <div className="rc-val">
                    {SPARKS.find((s) => s.id === answers.spark)?.emoji || "💭"} {answers.sparkText}
                  </div>
                </div>
                <div>
                  <div className="rc-lbl">Hero</div>
                  <div className="rc-val">
                    {cast.find((c) => c.id === answers.hero)?.emoji || "🌟"} {answers.heroName}
                  </div>
                </div>
                <div>
                  <div className="rc-lbl">They love</div>
                  <div className="rc-val">{answers.lovesText}</div>
                </div>
                <div>
                  <div className="rc-lbl">Vibe</div>
                  <div className="rc-val">{answers.moodText}</div>
                </div>
              </div>
              <button className="final-cta" onClick={handleGenerate}>
                🪄 Write My Storybook!
              </button>
            </>
          )}
        </div>
      )}

      {!["ded", "done"].includes(phase) && (
        <div className="ibar">
          <div className="iwrap">
            <textarea
              ref={textareaRef}
              className="ita"
              rows={1}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                phase === "spark" ? "Type your story idea… or pick one above"
                : phase === "hero" ? "Type a name… or tap above"
                : phase === "loves" ? "Type what they love… or tap above"
                : "Describe the vibe… or tap above"
              }
            />
            <button className="isend" onClick={handleSend} disabled={!inputText.trim()}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}
