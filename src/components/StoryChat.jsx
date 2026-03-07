import { useState, useRef, useEffect, useCallback } from "react";
import ChatBubble from "./ChatBubble";

export default function StoryChat({ bookType, heroData, artStyle, onDataUpdate, onReady }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMoreIdeas, setLoadingMoreIdeas] = useState(false);
  const chatEndRef = useRef(null);
  const textareaRef = useRef();
  const initRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  const contextString = `${bookType?.title || "story"} about ${heroData?.heroName || "someone"}`;

  const sendToAssistant = useCallback(async (allMessages) => {
    setLoading(true);
    try {
      const apiMessages = allMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role,
          content: m.role === "assistant" ? (m.displayText || m.content) : m.content,
        }));

      const response = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          heroTypeContext: heroData?.heroType || "child",
          bookTypeContext: bookType?.id || "adventure",
          heroName: heroData?.heroName || "",
          heroAge: heroData?.heroAge || "",
          artStyleName: artStyle?.style?.name || "",
          toneName: artStyle?.tone?.label || "",
          companions: heroData?.companions || [],
          hasPhoto: !!heroData?.heroPhoto,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");
      const data = await response.json();

      const assistantMsg = {
        role: "assistant",
        content: data.message,
        displayText: data.message,
        suggestions: data.suggestions || [],
        action: data.action,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.dataUpdate && Object.keys(data.dataUpdate).length > 0) {
        onDataUpdate(data.dataUpdate);
      }

      if (data.action === "ready") {
        onReady();
      }

      scrollToBottom();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Oops, something went wrong! Let me try again. What were we talking about?",
          displayText: "Oops, something went wrong! Let me try again. What were we talking about?",
          suggestions: [],
          action: null,
          timestamp: Date.now(),
        },
      ]);
      scrollToBottom();
    } finally {
      setLoading(false);
    }
  }, [heroData, bookType, artStyle, onDataUpdate, onReady, scrollToBottom]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const greeting = {
      role: "user",
      content: `I'm making a ${contextString}. The art style is ${artStyle?.style?.name || "Classic Storybook"}${artStyle?.tone ? ` with a ${artStyle.tone.label} tone` : ""}. ${heroData?.companions?.length > 0 ? `Other characters: ${heroData.companions.map(c => `${c.name} (${c.relationship})`).join(", ")}. ` : ""}Let's figure out the story details!`,
      timestamp: Date.now(),
      hidden: true,
    };

    setMessages([greeting]);
    sendToAssistant([greeting]);
  }, [contextString, artStyle, heroData, sendToAssistant]);

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
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    scrollToBottom();
    sendToAssistant(newMessages);
  }

  function handleSuggestionClick(suggestion) {
    handleSend(suggestion);
  }

  async function handleMoreIdeas() {
    setLoadingMoreIdeas(true);
    try {
      const moreMsg = {
        role: "user",
        content: "Those ideas don't quite fit. Give me 4 completely different and creative story suggestions. Be surprising and unique!",
        timestamp: Date.now(),
        hidden: true,
      };
      const newMessages = [...messages, moreMsg];
      setMessages(newMessages);
      await sendToAssistant(newMessages);
    } catch (err) {
      console.warn("handleMoreIdeas failed:", err.message);
    } finally {
      setLoadingMoreIdeas(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInputChange(e) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const suggestions = lastAssistant?.suggestions || [];
  const visibleMessages = messages.filter((m) => !m.hidden);
  const hasUserReplied = messages.some(m => m.role === "user" && !m.hidden);
  const isFirstPromptPhase = !hasUserReplied && !loading;

  return (
    <div className="sc-panel">
      <div className="sc-messages">
        {/* First prompt phase: spark cards instead of chat bubbles */}
        {isFirstPromptPhase && visibleMessages.length > 0 && visibleMessages[0].role === "assistant" && suggestions.length > 0 ? (
          <div className="sc-first-prompt">
            <p className="sc-first-text">{visibleMessages[0].displayText}</p>
            <div className="sc-spark-grid">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className={`sc-spark-card${s.includes('my own idea') ? ' sc-spark-card--custom' : ''}`}
                  onClick={() => handleSuggestionClick(s)}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span className="sc-spark-text">{s}</span>
                </button>
              ))}
            </div>
            <button
              className="sc-more-ideas"
              onClick={handleMoreIdeas}
              disabled={loadingMoreIdeas}
            >
              {loadingMoreIdeas ? (
                <>
                  <span className="sc-more-spinner" />
                  Thinking...
                </>
              ) : (
                <>Show me different ideas</>
              )}
            </button>
          </div>
        ) : (
          <>
            {visibleMessages.map((msg, i) => (
              <ChatBubble key={i} message={msg} />
            ))}

            {/* Suggestion chips for follow-up questions */}
            {suggestions.length > 0 && !loading && (
              <div className="sc-suggestions">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="sc-suggestion-chip"
                    onClick={() => handleSuggestionClick(s)}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {loading && (
          <div className="cb-wrap cb-assistant">
            <div className="cb-typing">
              <span className="cb-dot" />
              <span className="cb-dot" />
              <span className="cb-dot" />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div className="sc-input-bar">
        <textarea
          ref={textareaRef}
          className="sc-input"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Tell me about the adventure..."
          disabled={loading}
          rows={1}
        />
        <button
          className="sc-send-btn"
          disabled={!input.trim() || loading}
          onClick={() => handleSend()}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
