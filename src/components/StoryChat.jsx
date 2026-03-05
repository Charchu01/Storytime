import { useState, useRef, useEffect, useCallback } from "react";
import ChatBubble from "./ChatBubble";
import { STYLES } from "../constants/data";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const PHOTO_MAX_DIM = 1024;
const PHOTO_QUALITY = 0.85;

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > PHOTO_MAX_DIM || height > PHOTO_MAX_DIM) {
        const scale = PHOTO_MAX_DIM / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

const STYLE_OPTIONS = STYLES.map((s) => ({
  id: s.id,
  label: `${s.emoji} ${s.name}`,
  desc: s.tagline,
}));

const TONE_OPTIONS = [
  { id: "cozy", label: "🧸 Cozy" },
  { id: "exciting", label: "🎉 Exciting" },
  { id: "funny", label: "😂 Funny" },
  { id: "heartfelt", label: "❤️ Heartfelt" },
];

export default function StoryChat({ heroType, onDataUpdate, onReady }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showStyles, setShowStyles] = useState(false);
  const [showTones, setShowTones] = useState(false);
  const [photoMode, setPhotoMode] = useState(false);
  const chatEndRef = useRef(null);
  const fileRef = useRef();
  const inputRef = useRef();
  const initRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  // Send message to Claude and process response
  const sendToAssistant = useCallback(async (allMessages) => {
    setLoading(true);
    try {
      // Build API messages (only user/assistant, skip system display messages)
      const apiMessages = allMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.imageDataUrl ? { imageDataUrl: m.imageDataUrl } : {}),
        }));

      const response = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          heroTypeContext: heroType,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      // Add assistant message
      const assistantMsg = {
        role: "assistant",
        content: data.message,
        suggestions: data.suggestions || [],
        action: data.action,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Process data updates
      if (data.dataUpdate && Object.keys(data.dataUpdate).length > 0) {
        onDataUpdate(data.dataUpdate);
      }

      // Handle actions
      if (data.action === "request_photo") {
        setPhotoMode(true);
      } else if (data.action === "show_styles") {
        setShowStyles(true);
      } else if (data.action === "show_tones") {
        setShowTones(true);
      } else if (data.action === "ready") {
        onReady();
      }

      scrollToBottom();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Oops, something went wrong! Let me try again. What were we talking about?",
          suggestions: [],
          action: null,
          timestamp: Date.now(),
        },
      ]);
      scrollToBottom();
    } finally {
      setLoading(false);
    }
  }, [heroType, onDataUpdate, onReady, scrollToBottom]);

  // Initial greeting
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const greeting = {
      role: "user",
      content: `I want to create a story about ${heroType}. Let's get started!`,
      timestamp: Date.now(),
      hidden: true,
    };

    setMessages([greeting]);
    sendToAssistant([greeting]);
  }, [heroType, sendToAssistant]);

  function handleSend(text) {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    const userMsg = {
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setShowStyles(false);
    setShowTones(false);
    setPhotoMode(false);
    scrollToBottom();
    sendToAssistant(newMessages);
  }

  function handleSuggestionClick(suggestion) {
    handleSend(suggestion);
  }

  function handleStyleSelect(styleId) {
    const styleName = STYLES.find((s) => s.id === styleId)?.name || styleId;
    setShowStyles(false);
    handleSend(styleName);
  }

  function handleToneSelect(toneId) {
    const tone = TONE_OPTIONS.find((t) => t.id === toneId);
    setShowTones(false);
    handleSend(tone?.label?.replace(/^[^\s]+\s/, "") || toneId);
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > MAX_PHOTO_SIZE) {
      setMessages((prev) => [
        ...prev,
        { role: "system", content: "Photo must be under 10 MB. Please try a smaller one.", timestamp: Date.now() },
      ]);
      return;
    }

    try {
      const compressed = await compressPhoto(file);

      const userMsg = {
        role: "user",
        content: "Here's a photo!",
        imageDataUrl: compressed,
        timestamp: Date.now(),
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setPhotoMode(false);
      scrollToBottom();

      // Update blueprint with hero photo
      onDataUpdate({ heroPhoto: compressed });

      sendToAssistant(newMessages);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "system", content: "Failed to process photo. Please try again.", timestamp: Date.now() },
      ]);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Get the latest suggestions from the most recent assistant message
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const suggestions = lastAssistant?.suggestions || [];

  // Filter out hidden initial message for display
  const visibleMessages = messages.filter((m) => !m.hidden);

  return (
    <div className="sc-panel">
      <div className="sc-messages">
        {visibleMessages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="cb-wrap cb-assistant">
            <div className="cb-avatar">📖</div>
            <div className="cb-bubble cb-bubble-ai cb-typing">
              <span className="cb-dot" />
              <span className="cb-dot" />
              <span className="cb-dot" />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Style picker overlay */}
      {showStyles && (
        <div className="sc-picker">
          <div className="sc-picker-title">Pick your art style</div>
          <div className="sc-style-grid">
            {STYLE_OPTIONS.map((s) => (
              <button
                key={s.id}
                className="sc-style-card"
                onClick={() => handleStyleSelect(s.id)}
              >
                <span className="sc-style-label">{s.label}</span>
                <span className="sc-style-desc">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tone picker overlay */}
      {showTones && (
        <div className="sc-picker">
          <div className="sc-picker-title">Choose the tone</div>
          <div className="sc-tone-row">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t.id}
                className="sc-tone-chip"
                onClick={() => handleToneSelect(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggestion chips */}
      {suggestions.length > 0 && !loading && (
        <div className="sc-suggestions">
          {suggestions.map((s, i) => (
            <button
              key={i}
              className="sc-suggestion-chip"
              onClick={() => handleSuggestionClick(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Photo upload prompt */}
      {photoMode && !loading && (
        <div className="sc-photo-prompt">
          <button className="sc-photo-btn" onClick={() => fileRef.current?.click()}>
            📷 Upload Photo
          </button>
          <button className="sc-photo-skip" onClick={() => handleSend("Skip for now")}>
            Skip for now
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="sc-input-bar">
        <button className="sc-attach-btn" onClick={() => fileRef.current?.click()}>
          📷
        </button>
        <input
          ref={inputRef}
          className="sc-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer..."
          disabled={loading}
        />
        <button
          className="sc-send-btn"
          disabled={!input.trim() || loading}
          onClick={() => handleSend()}
        >
          →
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        style={{ display: "none" }}
        onChange={handlePhotoUpload}
      />
    </div>
  );
}
