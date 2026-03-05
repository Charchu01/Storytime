import { useState, useEffect, useRef } from "react";

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const deferredPrompt = useRef(null);

  useEffect(() => {
    // Don't show if already dismissed, already installed, or cookie banner still visible
    if (localStorage.getItem("sk_install_dismissed")) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (!localStorage.getItem("sk_cookies_accepted")) return;

    function handleBeforeInstall(e) {
      e.preventDefault();
      deferredPrompt.current = e;
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Show prompt 30s after first story is created
    function checkStories() {
      const stories = JSON.parse(localStorage.getItem("sk_stories") || "[]");
      if (stories.length > 0 && deferredPrompt.current) {
        setTimeout(() => setShow(true), 30000);
      }
    }

    const interval = setInterval(checkStories, 5000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      clearInterval(interval);
    };
  }, []);

  function handleInstall() {
    deferredPrompt.current?.prompt();
    dismiss();
  }

  function dismiss() {
    localStorage.setItem("sk_install_dismissed", "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="install-prompt">
      <span className="install-prompt-text">📱 Add Storytime to your home screen</span>
      <button className="install-prompt-btn" onClick={handleInstall}>Add</button>
      <button className="install-prompt-skip" onClick={dismiss}>Not now</button>
    </div>
  );
}
