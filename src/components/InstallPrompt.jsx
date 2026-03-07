import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAppContext } from "../App";

export default function InstallPrompt() {
  const location = useLocation();
  const { stories } = useAppContext();
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
    let showTimer = null;
    if (stories.length > 0 && deferredPrompt.current) {
      showTimer = setTimeout(() => setShow(true), 30000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      if (showTimer) clearTimeout(showTimer);
    };
  }, [stories.length]);

  function handleInstall() {
    deferredPrompt.current?.prompt();
    dismiss();
  }

  function dismiss() {
    localStorage.setItem("sk_install_dismissed", "1");
    setShow(false);
  }

  // Never show during the creation flow
  if (location.pathname.startsWith("/create")) return null;

  if (!show) return null;

  return (
    <div className="install-prompt">
      <span className="install-prompt-text">📱 Add Storytime to your home screen</span>
      <button className="install-prompt-btn" onClick={handleInstall}>Add</button>
      <button className="install-prompt-skip" onClick={dismiss}>Not now</button>
    </div>
  );
}
