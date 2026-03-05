import { useState, useRef, useEffect, useCallback } from "react";
import ChatBubble from "./ChatBubble";

export default function StoryChat({ bookType, heroData, artStyle, onDataUpdate, onReady }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef();
  const initRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  // Build context string for the assistant
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

  // Initial greeting with pre-collected context
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
    scrollToBottom();
    sendToAssistant(newMessages);
  }

  function handleSuggestionClick(suggestion) {
    handleSend(suggestion);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const suggestions = lastAssistant?.suggestions || [];
  const visibleMessages = messages.filter((m) => !m.hidden);

  return (
    <div className="sc-panel">
      <div className="sc-messages">
        {visibleMessages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}

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

      {/* Input bar */}
      <div className="sc-input-bar">
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
    </div>
  );
}
