import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const drawerRef = useRef();

  // Close drawer on navigation
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Close drawer on outside click
  useEffect(() => {
    if (!drawerOpen) return;
    function handleClick(e) {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) setDrawerOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [drawerOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <>
      <nav className="gn">
        <div className="gn-inner">
          <Link to="/" className="gn-logo">📖 StoriKids</Link>

          <div className="gn-center">
            <NavLink to="/create" className={({ isActive }) => `gn-link${isActive ? " gn-active" : ""}`}>
              Create Story
            </NavLink>
            <NavLink to="/library" className={({ isActive }) => `gn-link${isActive ? " gn-active" : ""}`}>
              My Library
            </NavLink>
          </div>

          <div className="gn-right">
            <Link to="/create" className="gn-cta">Start Free →</Link>
          </div>

          <button className="gn-burger" onClick={() => setDrawerOpen(true)} aria-label="Menu">
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="drawer-overlay">
          <div className="drawer" ref={drawerRef}>
            <div className="drawer-head">
              <Link to="/" className="gn-logo">📖 StoriKids</Link>
              <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>
            <div className="drawer-sep" />
            <Link to="/create" className="drawer-link">Create Story</Link>
            <Link to="/library" className="drawer-link">My Library</Link>
            <Link to="/profile" className="drawer-link">My Profile</Link>
            <Link to="/account" className="drawer-link">Account & Billing</Link>
            <div className="drawer-sep" />
            <Link to="/privacy" className="drawer-link drawer-link-sm">Privacy Policy</Link>
            <Link to="/terms" className="drawer-link drawer-link-sm">Terms of Service</Link>
          </div>
        </div>
      )}
    </>
  );
}
