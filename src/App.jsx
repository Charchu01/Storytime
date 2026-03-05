import { Routes, Route } from "react-router-dom";
import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import HomePage from "./pages/HomePage";
import CreatePage from "./pages/CreatePage";
import BookReaderPage from "./pages/BookReaderPage";
import LibraryPage from "./pages/LibraryPage";
import ProfilePage from "./pages/ProfilePage";
import AccountPage from "./pages/AccountPage";
import SharedPage from "./pages/SharedPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import NotFoundPage from "./pages/NotFoundPage";
import StatusPage from "./pages/StatusPage";
import Navbar from "./components/Navbar";
import CookieBanner from "./components/CookieBanner";
import ToastContainer from "./components/ToastContainer";
import OfflineBanner from "./components/OfflineBanner";
import InstallPrompt from "./components/InstallPrompt";
import "./styles.css";
import "./styles/homepage.css";

// ── Toast context ────────────────────────────────────────────────────────────
const ToastContext = createContext();
export function useToast() { return useContext(ToastContext); }

// ── Story storage helpers ────────────────────────────────────────────────────
function loadStories() {
  try { return JSON.parse(localStorage.getItem("sk_stories") || "[]"); }
  catch { return []; }
}
function saveStories(stories) {
  localStorage.setItem("sk_stories", JSON.stringify(stories));
}

// ── App Context for global state ─────────────────────────────────────────────
const AppContext = createContext();
export function useAppContext() { return useContext(AppContext); }

export default function App() {
  const [stories, setStories] = useState(loadStories);
  const [toasts, setToasts] = useState([]);

  useEffect(() => { saveStories(stories); }, [stories]);

  // Toast system
  const addToast = useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) setTimeout(() => removeToast(id), duration);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  function addStory(story) {
    const entry = { ...story, id: story.id || Date.now().toString(36) + Math.random().toString(36).slice(2), createdAt: new Date().toISOString() };
    // Save to localStorage BEFORE React processes the state update,
    // so /book/:id can find it immediately even if navigate() fires first
    const current = loadStories();
    saveStories([entry, ...current]);
    setStories([entry, ...current]);
    return entry.id;
  }

  function deleteStory(id) {
    setStories((prev) => prev.filter((s) => s.id !== id));
  }

  function addActivity(action, storyTitle) {
    try {
      const history = JSON.parse(localStorage.getItem("sk_activity") || "[]");
      history.unshift({ date: new Date().toISOString(), title: storyTitle, action, status: "Complete" });
      localStorage.setItem("sk_activity", JSON.stringify(history.slice(0, 50)));
    } catch {}
  }

  const appValue = { stories, addStory, deleteStory, addActivity };

  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  const inner = (
    <AppContext.Provider value={appValue}>
      <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
        <Routes>
          <Route path="/" element={<><Navbar /><HomePage /></>} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/book/:id" element={<BookReaderPage />} />
          <Route path="/library" element={<><Navbar /><LibraryPage /></>} />
          <Route path="/profile" element={<><Navbar /><ProfilePage /></>} />
          <Route path="/account" element={<><Navbar /><AccountPage /></>} />
          <Route path="/shared" element={<SharedPage />} />
          <Route path="/privacy" element={<><Navbar /><PrivacyPage /></>} />
          <Route path="/terms" element={<><Navbar /><TermsPage /></>} />
          <Route path="/status" element={<><Navbar /><StatusPage /></>} />
          <Route path="*" element={<><Navbar /><NotFoundPage /></>} />
        </Routes>
        <CookieBanner />
        <ToastContainer />
        <OfflineBanner />
        <InstallPrompt />
      </ToastContext.Provider>
    </AppContext.Provider>
  );

  // Wrap with ClerkProvider if key is available, otherwise render without auth
  if (clerkKey) {
    return <ClerkProvider publishableKey={clerkKey}>{inner}</ClerkProvider>;
  }
  return inner;
}
