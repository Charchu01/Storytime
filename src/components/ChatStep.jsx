import { useState, useRef, useEffect } from "react";
import { SPARKS, LOVES, MOODS, SPARK_REACTIONS } from "../constants/data";
import {
  generateStory,
  generateAllImages,
  generateAllPremiumImages,
  generatePageImage,
  generatePremiumPageImage,
  analyzeCharacterPhotos,
  uploadHeroPhoto,
  STYLE_GRADIENTS,
} from "../api/story";
import {
  uploadPhoto,
  zipPhotos,
  trainLora,
  checkTraining,
  saveToVault,
} from "../api/client";
import Paywall from "./Paywall";
import ConsentCheckbox from "./ConsentCheckbox";

const OCCASIONS = [
  { emoji: "🎂", label: "Birthday" },
  { emoji: "🏫", label: "First Day of School" },
  { emoji: "👶", label: "New Baby Sibling" },
  { emoji: "🦷", label: "Lost a Tooth" },
  { emoji: "😨", label: "Facing a Fear" },
  { emoji: "🐾", label: "Pet Story" },
  { emoji: "✈️", label: "Big Trip" },
  { emoji: "🌟", label: "Just Because" },
];

const WRITING_PHRASES = [
  "Crafting the perfect adventure...",
  "Adding just the right amount of magic...",
  "Making sure the hero saves the day...",
  "Choosing the most exciting moments...",
  "Sprinkling in some wonder...",
  "Building a world worth exploring...",
];

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

function TrainingScreen({ childName, progress }) {
  return (
    <div className="gen-screen">
      <div className="gen-emoji train-sparkle">✨</div>
      <div className="gen-headline">Teaching the AI {childName}'s face...</div>
      <div className="train-bar-wrap">
        <div className="train-bar">
          <div className="train-bar-fill" style={{ width: `${Math.min(progress, 95)}%` }} />
        </div>
      </div>
      <div className="gen-sub">This creates perfect face consistency across all 10 pages</div>
      <div className="train-fine">Usually takes 1-3 minutes</div>
    </div>
  );
}

function LoadingScreen({ heroName, loadPhase, pageImages, pageCount, style, error, onRetry }) {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const gradient = STYLE_GRADIENTS[style] || STYLE_GRADIENTS["Storybook"];
  const completedCount = pageImages.filter((url) => url !== undefined).length;

  useEffect(() => {
    if (loadPhase !== "writing") return;
    const interval = setInterval(() => {
      setPhraseIdx((prev) => (prev + 1) % WRITING_PHRASES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [loadPhase]);

  if (error) {
    return (
      <div className="gen-screen">
        <div style={{ fontSize: 56 }}>😔</div>
        <div className="gen-headline">Something went wrong</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 16, lineHeight: 1.6, maxWidth: 400, textAlign: "center", wordBreak: "break-word" }}>
          {error}
        </div>
        <button className="br-end-btn" onClick={onRetry}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="gen-screen">
      {loadPhase === "photos" && (
        <>
          <div className="gen-emoji">📷</div>
          <div className="gen-headline">Studying {heroName}'s photos...</div>
          <div className="gen-sub">Learning every freckle and curl</div>
        </>
      )}

      {loadPhase === "writing" && (
        <>
          <div className="gen-emoji gen-spin">📖</div>
          <div className="gen-headline">Writing {heroName}'s story...</div>
          <div className="gen-sub gen-phrase-fade" key={phraseIdx}>{WRITING_PHRASES[phraseIdx]}</div>
        </>
      )}

      {loadPhase === "illustrating" && (
        <>
          <div className="gen-emoji">🎨</div>
          <div className="gen-headline">Now illustrating...</div>

          <div className="gen-thumbs">
            {Array.from({ length: pageCount }).map((_, i) => {
              const imageUrl = pageImages[i];
              const hasImage = imageUrl && imageUrl !== "pending";
              return (
                <div key={i} className="gen-thumb-slot">
                  {hasImage ? (
                    <img className="gen-thumb-img gen-thumb-pop" src={imageUrl} alt={`Page ${i + 1}`} />
                  ) : (
                    <div className="gen-thumb-placeholder" style={{ background: gradient }}>
                      <div className="gen-thumb-shimmer" />
                      <span className="gen-thumb-num">{i + 1}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="gen-progress-text">
            {completedCount} of {pageCount} illustrations complete
          </div>
        </>
      )}

      {loadPhase === "finishing" && (
        <>
          <div className="gen-emoji">✨</div>
          <div className="gen-headline">Adding the finishing touches...</div>
        </>
      )}
    </div>
  );
}

export default function ChatStep({ cast, style, length = 6, occasion, tier, storySessionId, vaultChar, onNext, onBack, wizardData = {} }) {
  const hero = cast.find((c) => c.isHero) || cast[0];
  const [phase, setPhase] = useState("occasion");
  const [answers, setAnswers] = useState({});
  const [authorName, setAuthorName] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [dedication, setDedication] = useState(
    `For ${cast.filter((c) => ["child", "baby"].includes(c.role)).map((c) => c.name).join(" & ") || "our little ones"}, who make every day magical.`
  );
  const [showTray, setShowTray] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadPhase, setLoadPhase] = useState("photos");
  const [pageImages, setPageImages] = useState([]);
  const [pageCount, setPageCount] = useState(length);
  const [error, setError] = useState(null);
  const [booted, setBooted] = useState(false);

  // Consent
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError] = useState(false);

  // Paywall state
  const [showPaywall, setShowPaywall] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [pendingStory, setPendingStory] = useState(null);
  const [pendingEnrichedCast, setPendingEnrichedCast] = useState(null);
  const [pendingHeroPhotoUrl, setPendingHeroPhotoUrl] = useState(null);

  // LoRA training state
  const [trainingStatus, setTrainingStatus] = useState(null);
  const loraUrlRef = useRef(vaultChar?.loraUrl || null);
  const triggerWordRef = useRef(vaultChar?.triggerWord || null);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [showTraining, setShowTraining] = useState(false);

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
    addAI(`I've got your cast — **${names}**! They're all going to be in this story.`, () => {
      setTimeout(() => {
        addAI("Before we dive in — what's the occasion? Pick one or just skip and tell me your idea!", () => {
          setShowTray(true);
        });
      }, 600);
    });
  }, []);

  function pickOccasion(label) {
    if (answers.occasion) return;
    setShowTray(false);
    setAnswers((prev) => ({ ...prev, occasion: label }));
    addUser(label === "skip" ? "No specific occasion" : label);
    setTimeout(() => {
      const reaction = label === "skip" ? "No problem!" : `${label} — love it!`;
      addAI(`${reaction} Now, what kind of adventure should this be? Pick one of my ideas below — or just type your own!`, () => {
        setPhase("spark");
        setShowTray(true);
      });
    }, 300);
  }

  function pickSpark(id, text) {
    if (answers.spark) return;
    setShowTray(false);
    setAnswers((prev) => ({ ...prev, spark: id, sparkText: text }));
    setInputText("");
    addUser(text);
    setTimeout(() => {
      addAI(SPARK_REACTIONS[id] || "Love it!", () => {
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
      addAI(`**${name}** is the perfect hero!`, () => {
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
      addAI(`${text}! That's going right into the story`, () => {
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
      addAI(`${text} — that's going to be beautiful`, () => {
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
    if (value !== "skip") addUser(`"${value.slice(0, 55)}..."`);
    else addUser("Skip the dedication");
    setTimeout(() => {
      addAI("One last thing — what name should go on the cover as the author? This is YOUR book too!", () => {
        setPhase("author");
        setShowTray(true);
      });
    }, 300);
  }

  function pickAuthor(name) {
    if (answers.authorName) return;
    setShowTray(false);
    setAnswers((prev) => ({ ...prev, authorName: name }));
    addUser(name);
    setTimeout(() => {
      addAI(`By **${name}** — perfect! I have everything I need. Check the summary below — then let's create your book!`, () => {
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

  // ── Premium LoRA training ───────────────────────────────────────────────────
  function startLoraTraining(enrichedCast) {
    return new Promise(async (resolve) => {
      const heroChar = enrichedCast.find((c) => c.isHero) || enrichedCast[0];
      if (!heroChar) { resolve(false); return; }

      // Already have LoRA from vault
      if (loraUrlRef.current && triggerWordRef.current) {
        resolve(true);
        return;
      }

      setShowTraining(true);
      setTrainingProgress(0);

      try {
        const photos = heroChar.photos?.filter((p) => p.dataUri) || [];
        const singlePhoto = heroChar.photo && heroChar.photo !== "has_photo" ? [heroChar.photo] : [];
        const photoDataUris = photos.length > 0 ? photos.map((p) => p.dataUri) : singlePhoto;

        if (photoDataUris.length === 0) {
          setShowTraining(false);
          resolve(false);
          return;
        }

        const uploadedUrls = await Promise.all(photoDataUris.map((uri) => uploadPhoto(uri)));
        const zipUrl = await zipPhotos(uploadedUrls);

        const { trainingId, triggerWord: tw } = await trainLora(
          zipUrl,
          heroChar.name,
          storySessionId
        );

        triggerWordRef.current = tw;

        const startTime = Date.now();
        const pollInterval = setInterval(async () => {
          const elapsed = (Date.now() - startTime) / 1000;
          setTrainingProgress(Math.min((elapsed / 120) * 100, 95));

          try {
            const result = await checkTraining(trainingId);
            if (result.status === "succeeded") {
              clearInterval(pollInterval);
              loraUrlRef.current = result.loraUrl;
              setTrainingProgress(100);
              setShowTraining(false);
              resolve(true);
            } else if (result.status === "failed") {
              clearInterval(pollInterval);
              setShowTraining(false);
              resolve(false);
            }
          } catch {
            // Poll error — will retry on next interval
          }
        }, 5000);
      } catch {
        setShowTraining(false);
        resolve(false);
      }
    });
  }

  // ── Main generation flow ────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!consentChecked) {
      setConsentError(true);
      return;
    }

    setLoading(true);
    setError(null);
    setPageImages([]);

    try {
      // Phase 1: Analyze character photos
      setLoadPhase("photos");
      const hasPhotos = cast.some((c) => c.photos?.length > 0 || c.photo);
      let enrichedCast = cast;
      if (hasPhotos) {
        enrichedCast = await analyzeCharacterPhotos(cast);
      }

      // For Premium: train LoRA (blocks until done, shows training screen)
      let useLoRA = false;
      if (tier === "premium") {
        useLoRA = await startLoraTraining(enrichedCast);
      }

      // Phase 2: Generate story text
      setLoadPhase("writing");
      const story = await generateStory(enrichedCast, style, {
        hero: answers.heroName || hero.name,
        spark: answers.sparkText || answers.spark,
        loves: answers.lovesText || answers.loves,
        mood: answers.moodText || answers.mood,
        pageCount: length,
        ...wizardData,
      });

      // Phase 3: Generate page 1 as preview
      setLoadPhase("illustrating");
      setPageCount(story.pages.length);
      setPageImages(new Array(story.pages.length).fill(undefined));

      let heroPhotoUrl = null;
      if (!useLoRA) {
        heroPhotoUrl = await uploadHeroPhoto(enrichedCast);
      }

      const page1 = story.pages[0];
      const sceneDesc = page1.scene_description || page1.imagePrompt || page1.text;
      const mood = page1.mood || "wonder";

      let page1Url;
      if (useLoRA && loraUrlRef.current) {
        page1Url = await generatePremiumPageImage(sceneDesc, enrichedCast, style, loraUrlRef.current, triggerWordRef.current, mood);
      } else {
        page1Url = await generatePageImage(sceneDesc, enrichedCast, style, heroPhotoUrl, mood);
      }

      setPageImages((prev) => {
        const next = [...prev];
        next[0] = page1Url;
        return next;
      });
      setPreviewImageUrl(page1Url);

      // Store pending state for after payment
      setPendingStory(story);
      setPendingEnrichedCast(enrichedCast);
      setPendingHeroPhotoUrl(heroPhotoUrl);

      // Show paywall
      setShowPaywall(true);
      setLoading(false);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
  }

  // ── After payment: generate remaining pages ─────────────────────────────────
  async function handlePaymentSuccess() {
    setPaymentConfirmed(true);
    setShowPaywall(false);
    setLoading(true);
    setLoadPhase("illustrating");
    setError(null);

    try {
      const story = pendingStory;
      const enrichedCast = pendingEnrichedCast;

      const remainingPages = story.pages.slice(1);
      const onPageImage = (pageIdx, url) => {
        setPageImages((prev) => {
          const next = [...prev];
          next[pageIdx + 1] = url || null;
          return next;
        });
      };

      let finalResult;
      if (tier === "premium" && loraUrlRef.current && triggerWordRef.current) {
        finalResult = await generateAllPremiumImages(
          remainingPages, enrichedCast, style, loraUrlRef.current, triggerWordRef.current,
          onPageImage, story.coverScene
        );
      } else {
        finalResult = await generateAllImages(
          remainingPages, enrichedCast, style, pendingHeroPhotoUrl,
          onPageImage, story.coverScene
        );
      }

      const allPageImages = [previewImageUrl, ...finalResult.pageImages];

      setLoadPhase("finishing");
      await new Promise((r) => setTimeout(r, 500));

      const pagesWithImages = story.pages.map((page, i) => ({
        ...page,
        imageUrl: allPageImages[i] || null,
      }));

      // Save LoRA to vault for premium
      if (tier === "premium" && loraUrlRef.current && triggerWordRef.current) {
        try {
          const heroChar = enrichedCast.find((c) => c.isHero) || enrichedCast[0];
          await saveToVault({
            name: heroChar.name,
            loraUrl: loraUrlRef.current,
            triggerWord: triggerWordRef.current,
            thumbnailUrl: previewImageUrl,
          });
        } catch {
          // Vault save is non-critical — story still delivers
        }
      }

      onNext({
        story: { ...story, pages: pagesWithImages, coverImageUrl: finalResult.coverImageUrl },
        dedication: answers.dedication !== "skip" ? answers.dedication : null,
        authorName: answers.authorName || "A loving family",
        style,
        enrichedCast,
        heroPhotoUrl: pendingHeroPhotoUrl,
        tier,
      });
    } catch (err) {
      setError(err.message || "Something went wrong generating the remaining pages.");
    }
  }

  // ── Training screen ─────────────────────────────────────────────────────────
  if (showTraining) {
    return (
      <TrainingScreen
        childName={(cast.find((c) => c.isHero) || cast[0])?.name || "your child"}
        progress={trainingProgress}
      />
    );
  }

  // ── Paywall ─────────────────────────────────────────────────────────────────
  if (showPaywall) {
    return (
      <Paywall
        tier={tier}
        previewImageUrl={previewImageUrl}
        pageCount={length}
        price={tier === "premium" ? "$19.99" : "$9.99"}
        storySessionId={storySessionId}
        onPaid={handlePaymentSuccess}
      />
    );
  }

  // ── Loading / error screen ──────────────────────────────────────────────────
  if (loading || error) {
    return (
      <LoadingScreen
        heroName={answers.heroName || hero.name}
        loadPhase={loadPhase}
        pageImages={pageImages}
        pageCount={pageCount}
        style={style}
        error={error}
        onRetry={() => { setError(null); setLoading(false); }}
      />
    );
  }

  const progressMap = { occasion: 50, spark: 58, hero: 67, loves: 76, mood: 84, ded: 90, author: 95, done: 100 };

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

      {showTray && (
        <div className="tray">
          {phase === "occasion" && !answers.occasion && (
            <>
              <div className="tray-lbl">What's the occasion?</div>
              <div className="occ-grid">
                {OCCASIONS.map((o) => (
                  <button key={o.label} className="occ-card" onClick={() => pickOccasion(o.label)}>
                    <span className="occ-em">{o.emoji}</span>
                    <span className="occ-txt">{o.label}</span>
                  </button>
                ))}
              </div>
              <button className="occ-skip" onClick={() => pickOccasion("skip")}>Skip — I have my own idea →</button>
            </>
          )}

          {phase === "spark" && !answers.spark && (
            <>
              <div className="tray-lbl">Quick ideas — or type your own below</div>
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
              <div className="tray-lbl">Your cast — tap to pick, or type a name</div>
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
              <div className="tray-lbl">Things kids love — or type your own</div>
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
              <div className="tray-lbl">Pick the vibe — or describe it</div>
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
              <div className="tray-lbl">Dedication page — edit or skip</div>
              <textarea
                className="ded-ta"
                rows={3}
                value={dedication}
                onChange={(e) => setDedication(e.target.value)}
              />
              <div className="ded-row">
                <button className="ded-skip" onClick={() => pickDedication("skip")}>Skip</button>
                <button className="ded-use" onClick={() => pickDedication(dedication)}>Add dedication</button>
              </div>
            </>
          )}

          {phase === "author" && !answers.authorName && (
            <>
              <div className="tray-lbl">Author name for the cover</div>
              <input
                className="f-inp"
                style={{ marginBottom: 10 }}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="e.g. The Johnson Family"
                maxLength={40}
              />
              <button
                className="ded-use"
                disabled={!authorName.trim()}
                onClick={() => pickAuthor(authorName.trim())}
              >
                Use this name
              </button>
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
                <div>
                  <div className="rc-lbl">Plan</div>
                  <div className="rc-val">
                    {tier === "premium" ? "✨ Premium — 10 pages" : "📖 Standard — 6 pages"}
                  </div>
                </div>
              </div>

              <ConsentCheckbox
                checked={consentChecked}
                onChange={(v) => { setConsentChecked(v); setConsentError(false); }}
                error={consentError}
              />

              <button className="final-cta" onClick={handleGenerate} disabled={loading}>
                {loading ? (
                  <><span className="btn-spinner" /> Creating...</>
                ) : (
                  "Write My Storybook ✨"
                )}
              </button>
            </>
          )}
        </div>
      )}

      {!["occasion", "ded", "author", "done"].includes(phase) && (
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
                phase === "spark" ? "Type your story idea... or pick one above"
                : phase === "hero" ? "Type a name... or tap above"
                : phase === "loves" ? "Type what they love... or tap above"
                : "Describe the vibe... or tap above"
              }
            />
            <button className="isend" onClick={handleSend} disabled={!inputText.trim()}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}
