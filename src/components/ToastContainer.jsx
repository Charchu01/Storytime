import { useToast } from "../App";

const ICONS = {
  success: "✓",
  error: "✗",
  info: "ℹ",
  magic: "✨",
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">{ICONS[t.type] || "ℹ"}</span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-x" onClick={() => removeToast(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
