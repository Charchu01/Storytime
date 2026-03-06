import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Overview from "../components/admin/Overview";
import Books from "../components/admin/Books";
import Revenue from "../components/admin/Revenue";
import APIs from "../components/admin/APIs";
import Users from "../components/admin/Users";
import Quality from "../components/admin/Quality";
import System from "../components/admin/System";

const TABS = [
  { id: "overview", label: "Overview", icon: "\u{1F4CA}" },
  { id: "books", label: "Books", icon: "\u{1F4DA}" },
  { id: "revenue", label: "Revenue", icon: "\u{1F4B0}" },
  { id: "apis", label: "APIs", icon: "\u{1F517}" },
  { id: "users", label: "Users", icon: "\u{1F465}" },
  { id: "quality", label: "Quality", icon: "\u{1F3AF}" },
  { id: "system", label: "System", icon: "\u{2699}\uFE0F" },
];

function getTabFromPath(pathname) {
  const segment = pathname.replace(/^\/admin\/?/, "").split("/")[0];
  if (segment && TABS.some((t) => t.id === segment)) return segment;
  return "overview";
}

export default function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = getTabFromPath(location.pathname);
  const [authorized, setAuthorized] = useState(null);
  const [loginMode, setLoginMode] = useState(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    document.title = "Admin Dashboard \u2014 Storytime";
  }, []);

  // Check auth
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = useCallback(async () => {
    // Check Clerk email first
    try {
      const clerkUser = window.__clerk_user;
      const email = clerkUser?.primaryEmailAddress?.emailAddress;
      if (email) {
        const res = await fetch("/api/admin-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.authorized) {
          setAuthorized(true);
          return;
        }
      }
    } catch {}

    // Check if no auth is configured (dev mode)
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.authorized && data.method === "none") {
        setAuthorized(true);
        return;
      }
    } catch {}

    // Need password login
    setLoginMode("password");
    setAuthorized(false);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.authorized) {
        setAuthorized(true);
        sessionStorage.setItem("admin_auth", "true");
      } else {
        setLoginError("Invalid password");
      }
    } catch {
      setLoginError("Connection error");
    }
  };

  // Check sessionStorage for prior auth
  useEffect(() => {
    if (sessionStorage.getItem("admin_auth") === "true") {
      setAuthorized(true);
    }
  }, []);

  if (authorized === null) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={{ color: "#64748b" }}>Checking authorization...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#x1F4D6;</div>
          <h1 style={styles.loginTitle}>Storytime Admin</h1>
          <p style={{ color: "#64748b", marginBottom: 24, fontSize: 14 }}>
            Enter admin password to continue
          </p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              style={styles.loginInput}
              autoFocus
            />
            {loginError && <p style={styles.loginError}>{loginError}</p>}
            <button type="submit" style={styles.loginButton}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderTab = () => {
    switch (tab) {
      case "overview": return <Overview />;
      case "books": return <Books />;
      case "revenue": return <Revenue />;
      case "apis": return <APIs />;
      case "users": return <Users />;
      case "quality": return <Quality />;
      case "system": return <System />;
      default: return <Overview />;
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerLeft}>
            <span style={{ fontSize: 24 }}>&#x1F4D6;</span>
            <h1 style={styles.headerTitle}>Storytime Admin</h1>
          </div>
          <div style={styles.headerRight}>
            <span style={styles.liveIndicator}>
              <span style={styles.liveDot} /> Live
            </span>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(t.id === "overview" ? "/admin" : `/admin/${t.id}`)}
              style={{
                ...styles.navButton,
                ...(tab === t.id ? styles.navButtonActive : {}),
              }}
            >
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main style={styles.main}>
        {renderTab()}
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "'Inter', 'Nunito', -apple-system, sans-serif",
  },
  header: {
    background: "#0f172a",
    borderBottom: "1px solid #1e293b",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  headerInner: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "12px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  liveIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#4ade80",
    fontSize: 13,
    fontWeight: 600,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#4ade80",
    display: "inline-block",
    animation: "pulse 2s infinite",
  },
  nav: {
    background: "#fff",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 49,
    zIndex: 40,
  },
  navInner: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "0 24px",
    display: "flex",
    gap: 2,
    overflowX: "auto",
  },
  navButton: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "12px 16px",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#64748b",
    whiteSpace: "nowrap",
    transition: "all 0.15s",
  },
  navButtonActive: {
    color: "#0f172a",
    borderBottomColor: "#3b82f6",
  },
  main: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "24px",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    gap: 16,
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #e2e8f0",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loginContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#f8fafc",
  },
  loginCard: {
    background: "#fff",
    borderRadius: 16,
    padding: "40px 32px",
    textAlign: "center",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
    width: 360,
    maxWidth: "90vw",
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 4px",
  },
  loginInput: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 12,
  },
  loginError: {
    color: "#ef4444",
    fontSize: 13,
    margin: "0 0 8px",
  },
  loginButton: {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: "none",
    background: "#3b82f6",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
};
