import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../App";
import FamilyVault from "../components/FamilyVault";

export default function ProfilePage() {
  useEffect(() => { document.title = "My Profile — Storytime"; }, []);
  const { stories } = useAppContext();

  // Deduplicate family members from all stories (Supabase format uses hero_name)
  const familyMembers = useMemo(() => {
    const seen = new Map();
    stories.forEach((s) => {
      // Handle Supabase format (hero_name field)
      const heroName = s.hero_name;
      if (heroName) {
        const key = heroName.toLowerCase();
        if (!seen.has(key)) {
          const count = stories.filter((st) => st.hero_name?.toLowerCase() === key).length;
          seen.set(key, { name: heroName, role: s.hero_type || "child", emoji: s.hero_type === "pet" ? "🐾" : "🧒", storyCount: count });
        }
      }
      // Also handle legacy cast format
      (s.cast || []).forEach((c) => {
        const key = c.name?.toLowerCase();
        if (key && !seen.has(key)) {
          const count = stories.filter((st) => (st.cast || []).some((x) => x.name?.toLowerCase() === key) || st.hero_name?.toLowerCase() === key).length;
          seen.set(key, { ...c, storyCount: count });
        }
      });
    });
    return Array.from(seen.values());
  }, [stories]);

  const [defaultLength, setDefaultLength] = useState(
    () => localStorage.getItem("sk_pref_length") || "6"
  );

  function handleLengthChange(val) {
    setDefaultLength(val);
    localStorage.setItem("sk_pref_length", val);
  }

  return (
    <div className="prof-page">
      <Link to="/" className="legal-back">← Back</Link>
      <h1 className="prof-h1">My Family & Profile</h1>

      {/* Family members */}
      <section className="prof-section">
        <div className="prof-sec-head">
          <h2 className="prof-sec-h">Your Family</h2>
        </div>

        {familyMembers.length === 0 ? (
          <div className="prof-empty">
            <p>No family members yet. Create a story to add characters!</p>
            <Link to="/create" className="prof-empty-cta">Create a Story →</Link>
          </div>
        ) : (
          <div className="prof-fam-grid">
            {familyMembers.map((m) => (
              <div key={m.name} className="prof-fam-card">
                <div className="prof-fam-av">
                  {m.photo && m.photo !== "has_photo" ? (
                    <img src={m.photo} alt={m.name} />
                  ) : (
                    <span>{m.emoji || m.name?.[0] || "?"}</span>
                  )}
                </div>
                <div className="prof-fam-info">
                  <div className="prof-fam-name">{m.name}</div>
                  <div className="prof-fam-role">{m.role}{m.age ? `, age ${m.age}` : ""}</div>
                  <div className="prof-fam-count">Appears in {m.storyCount} {m.storyCount === 1 ? "story" : "stories"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Family Vault */}
      <section className="prof-section">
        <FamilyVault />
      </section>

      {/* Preferences */}
      <section className="prof-section">
        <h2 className="prof-sec-h">Preferences</h2>

        <div className="prof-pref">
          <label className="prof-pref-lbl">Default story length</label>
          <div className="prof-len-row">
            {[{ val: "4", label: "Quick Read", desc: "4 pages" }, { val: "6", label: "Classic", desc: "6 pages" }, { val: "10", label: "Epic", desc: "10 pages" }].map((opt) => (
              <button
                key={opt.val}
                className={`prof-len-btn${defaultLength === opt.val ? " prof-len-on" : ""}`}
                onClick={() => handleLengthChange(opt.val)}
              >
                <strong>{opt.label}</strong>
                <span>{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
