import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("sk_cookies_accepted")) {
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  function accept() {
    localStorage.setItem("sk_cookies_accepted", "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner">
      <span className="cookie-text">We use essential cookies to keep you signed in.</span>
      <div className="cookie-actions">
        <Link to="/privacy" className="cookie-link">Privacy Policy</Link>
        <button className="cookie-accept" onClick={accept}>Accept</button>
      </div>
    </div>
  );
}
