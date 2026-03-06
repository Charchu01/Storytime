import { Routes, Route } from "react-router-dom";
import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import HomePage from "./pages/HomePage";
import CreatePage from "./pages/CreatePage";
import BookTypeStep from "./pages/create/BookTypeStep";
import HeroStep from "./pages/create/HeroStep";
import StyleStep from "./pages/create/StyleStep";
import StudioStep from "./pages/create/StudioStep";
import CheckoutStep from "./pages/create/CheckoutStep";
import GeneratingStep from "./pages/create/GeneratingStep";
import BookReaderPage from "./pages/BookReaderPage";
import LibraryPage from "./pages/LibraryPage";
import ProfilePage from "./pages/ProfilePage";
import AccountPage from "./pages/AccountPage";
import SharedPage from "./pages/SharedPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import NotFoundPage from "./pages/NotFoundPage";
import StatusPage from "./pages/StatusPage";
import AdminPage from "./pages/AdminPage";
import Navbar from "./components/Navbar";
import CookieBanner from "./components/CookieBanner";
import ToastContainer from "./components/ToastContainer";
import OfflineBanner from "./components/OfflineBanner";
import InstallPrompt from "./components/InstallPrompt";
import { supabase } from "./lib/supabase";
import "./styles.css";
import "./styles/homepage.css";

// ── Toast context ────────────────────────────────────────────────────────────
const ToastContext = createContext();
export function useToast() { return useContext(ToastContext); }

// ── App Context for global state ─────────────────────────────────────────────
const AppContext = createContext();
export function useAppContext() { return useContext(AppContext); }

export default function App() {
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  // Fetch books from Supabase on mount
  const fetchBooks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setStories(data || []);
    } catch (err) {
      console.warn('Failed to fetch books from Supabase:', err.message);
      setStories([]);
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

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

  const deleteStory = useCallback(async (id) => {
    // Optimistic removal from local state
    setStories((prev) => prev.filter((s) => s.id !== id));
    try {
      await supabase
        .from('books')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
    } catch (err) {
      console.warn('Failed to delete from Supabase:', err.message);
    }
  }, []);

  function addActivity(action, storyTitle) {
    try {
      const history = JSON.parse(localStorage.getItem("sk_activity") || "[]");
      history.unshift({ date: new Date().toISOString(), title: storyTitle, action, status: "Complete" });
      localStorage.setItem("sk_activity", JSON.stringify(history.slice(0, 50)));
    } catch {}
  }

  const appValue = { stories, storiesLoading, deleteStory, addActivity, refreshBooks: fetchBooks };

  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  const inner = (
    <AppContext.Provider value={appValue}>
      <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
        <Routes>
          <Route path="/" element={<><Navbar /><HomePage /></>} />
          <Route path="/create" element={<CreatePage />}>
            <Route index element={<BookTypeStep />} />
            <Route path="hero" element={<HeroStep />} />
            <Route path="style" element={<StyleStep />} />
            <Route path="studio" element={<StudioStep />} />
            <Route path="checkout" element={<CheckoutStep />} />
            <Route path="generating" element={<GeneratingStep />} />
          </Route>
          <Route path="/book/:id" element={<BookReaderPage />} />
          <Route path="/library" element={<><Navbar /><LibraryPage /></>} />
          <Route path="/profile" element={<><Navbar /><ProfilePage /></>} />
          <Route path="/account" element={<><Navbar /><AccountPage /></>} />
          <Route path="/shared" element={<SharedPage />} />
          <Route path="/privacy" element={<><Navbar /><PrivacyPage /></>} />
          <Route path="/terms" element={<><Navbar /><TermsPage /></>} />
          <Route path="/status" element={<><Navbar /><StatusPage /></>} />
          <Route path="/admin/*" element={<AdminPage />} />
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
