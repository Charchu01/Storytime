import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import BookReader from "../components/BookReader";
import ErrorBoundary from "../components/ErrorBoundary";

export default function SharedPage() {
  const [searchParams] = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const sharedData = useMemo(() => {
    try {
      let encoded = searchParams.get("d");
      // Support localStorage-based sharing for large stories
      if (!encoded) {
        const key = searchParams.get("key");
        if (key) {
          try { encoded = localStorage.getItem(key); } catch { /* private browsing */ }
        }
      }
      if (!encoded) return null;
      const binStr = atob(encoded);
      // Try TextEncoder-compatible decoding first (handles non-ASCII characters)
      try {
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        return JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        // Fallback: legacy format used encodeURIComponent before btoa
        return JSON.parse(decodeURIComponent(binStr));
      }
    } catch { return null; }
  }, [searchParams]);

  useEffect(() => {
    if (sharedData) {
      const name = sharedData.heroName || "a child";
      document.title = `${name}'s Story — Made with Storytime`;
      // Update meta tags for social sharing
      const desc = `A personalized AI storybook created just for ${name}. Create yours free.`;
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
      meta.content = desc;
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) { ogTitle = document.createElement("meta"); ogTitle.setAttribute("property", "og:title"); document.head.appendChild(ogTitle); }
      ogTitle.content = `${name}'s Story — Made with Storytime`;
      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) { ogDesc = document.createElement("meta"); ogDesc.setAttribute("property", "og:description"); document.head.appendChild(ogDesc); }
      ogDesc.content = desc;
    }
  }, [sharedData]);

  if (!sharedData) {
    return (
      <div className="page-404">
        <div className="p404-book">📖</div>
        <h1 className="p404-h">This shared link seems broken</h1>
        <p className="p404-p">The story data couldn't be decoded. Ask the sender for a new link.</p>
        <Link to="/" className="p404-btn">Go to Storytime →</Link>
      </div>
    );
  }

  const name = sharedData.heroName || "someone special";

  return (
    <div className="shared-page">
      {/* Shared banner */}
      {!dismissed && (
        <div className="shared-banner">
          <span className="shared-banner-text">✨ {name}'s story — made with Storytime</span>
          <Link to="/create" className="shared-banner-cta">Create your own story free →</Link>
          <button className="shared-banner-x" onClick={() => setDismissed(true)}>✕</button>
        </div>
      )}
      <ErrorBoundary message="Something went wrong displaying this story. Try reloading the page.">
        <BookReader
          data={sharedData}
          cast={[]}
          styleName={sharedData.styleName || "Watercolor"}
          onReset={() => window.location.href = "/create"}
        />
      </ErrorBoundary>
    </div>
  );
}
