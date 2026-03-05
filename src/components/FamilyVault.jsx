import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getVaultCharacters, deleteFromVault } from "../api/client";

export default function FamilyVault({ userId = "anonymous" }) {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getVaultCharacters(userId)
      .then((chars) => {
        setCharacters(chars);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load vault:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [userId]);

  async function handleDelete(charId, name) {
    if (!confirm(`Remove ${name} from the Family Vault?`)) return;
    try {
      await deleteFromVault(charId, userId);
      setCharacters((prev) => prev.filter((c) => c.id !== charId));
    } catch (err) {
      console.error("Failed to delete from vault:", err);
    }
  }

  function handleUseCharacter(character) {
    // Store in sessionStorage for CreatePage to pick up
    sessionStorage.setItem("sk_vault_char", JSON.stringify(character));
    navigate("/create?vaultChar=1");
  }

  if (loading) {
    return (
      <div className="vault-section">
        <h2 className="vault-h2">✨ Family Vault</h2>
        <div className="vault-loading">Loading saved characters...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vault-section">
        <h2 className="vault-h2">✨ Family Vault</h2>
        <div className="vault-empty">
          <p>Could not load Family Vault. Create a Premium story to save characters here!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vault-section">
      <h2 className="vault-h2">✨ Family Vault</h2>
      <p className="vault-desc">
        Premium characters are saved here. Reuse them instantly in new stories — no re-uploading or re-training needed!
      </p>

      {characters.length === 0 ? (
        <div className="vault-empty">
          <div className="vault-empty-icon">🏰</div>
          <p>No saved characters yet.</p>
          <p className="vault-empty-sub">Create a Premium story to train and save a character to your vault!</p>
        </div>
      ) : (
        <div className="vault-grid">
          {characters.map((c) => (
            <div key={c.id} className="vault-card">
              <div className="vault-card-thumb">
                {c.thumbnailUrl ? (
                  <img src={c.thumbnailUrl} alt={c.name} />
                ) : (
                  <div className="vault-card-placeholder">✨</div>
                )}
              </div>
              <div className="vault-card-info">
                <div className="vault-card-name">{c.name}</div>
                <div className="vault-card-date">
                  Saved {new Date(c.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
              <div className="vault-card-actions">
                <button
                  className="vault-use-btn"
                  onClick={() => handleUseCharacter(c)}
                >
                  Use in new story
                </button>
                <button
                  className="vault-del-btn"
                  onClick={() => handleDelete(c.id, c.name)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
