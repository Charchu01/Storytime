export default function ChatBubble({ message }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="cb-system">
        <span className="cb-system-text">{message.content}</span>
      </div>
    );
  }

  return (
    <div className={`cb-wrap ${isUser ? "cb-user" : "cb-assistant"}`}>
      {!isUser && <div className="cb-avatar">{"\uD83D\uDCD6"}</div>}
      <div className={`cb-bubble ${isUser ? "cb-bubble-user" : "cb-bubble-ai"}`}>
        <p className="cb-text">{message.displayText || message.content}</p>
        {message.imageDataUrl && (
          <div className="cb-image">
            <img src={message.imageDataUrl} alt="Uploaded photo" />
          </div>
        )}
      </div>
    </div>
  );
}
