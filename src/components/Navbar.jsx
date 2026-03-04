import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/clerk-react";

const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function AuthSection() {
  if (!CLERK_ENABLED) {
    return <Link to="/create" className="gn-cta">Start Free →</Link>;
  }

  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return null;

  if (isSignedIn) {
    return (
      <div className="gn-auth">
        <Link to="/create" className="gn-cta">Create Story</Link>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: { avatarBox: { width: 36, height: 36 } },
          }}
        />
      </div>
    );
  }

  return (
    <div className="gn-auth">
      <SignInButton mode="modal">
        <button className="gn-signin">Sign In</button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="gn-cta">Get Started →</button>
      </SignUpButton>
    </div>
  );
}

function MobileAuthSection() {
  if (!CLERK_ENABLED) return null;

  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded || isSignedIn) return null;

  return (
    <>
      <div className="drawer-sep" />
      <div className="drawer-auth">
        <SignInButton mode="modal">
          <button className="drawer-link">Sign In</button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="drawer-link drawer-link-cta">Get Started →</button>
        </SignUpButton>
      </div>
    </>
  );
}

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
            <AuthSection />
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
            <MobileAuthSection />
            <div className="drawer-sep" />
            <Link to="/privacy" className="drawer-link drawer-link-sm">Privacy Policy</Link>
            <Link to="/terms" className="drawer-link drawer-link-sm">Terms of Service</Link>
          </div>
        </div>
      )}
    </>
  );
}
