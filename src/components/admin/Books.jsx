import { useState, useEffect, useCallback } from "react";
import adminFetch from "../../lib/adminFetch";

export default function Books() {
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({ status: "all", tier: "all", style: "all" });

  const fetchBooks = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin?action=books&page=${page}&limit=20`);
      const data = await res.json();
      if (!res.ok) {
        console.error("Books API error:", data.error || res.status);
      } else {
        setBooks(data.books || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch books:", err);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  const openDetail = async (bookId) => {
    setSelectedBook(bookId);
    try {
      const res = await adminFetch(`/api/admin?action=book&bookId=${bookId}`);
      const data = await res.json();
      setDetail(data);
    } catch {
      setDetail(null);
    }
  };

  const filtered = books.filter(b => {
    if (filters.status !== "all" && b.status !== filters.status) return false;
    if (filters.tier !== "all" && b.tier !== filters.tier) return false;
    if (filters.style !== "all" && b.style !== filters.style) return false;
    return true;
  });

  const statusIcon = (s) => s === "healthy" ? "\u{1F7E2}" : s === "warnings" ? "\u{1F7E1}" : "\u{1F534}";

  if (loading) return <Loading />;

  return (
    <div>
      {/* Filters */}
      <div style={{ ...card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", padding: "14px 20px" }}>
        <FilterSelect label="Status" value={filters.status} onChange={v => setFilters(p => ({ ...p, status: v }))}
          options={[["all","All"],["healthy","Healthy"],["warnings","Warnings"],["failed","Failed"]]} />
        <FilterSelect label="Tier" value={filters.tier} onChange={v => setFilters(p => ({ ...p, tier: v }))}
          options={[["all","All"],["standard","Standard"],["premium","Premium"]]} />
        <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: "auto" }}>{total} books total</span>
      </div>

      {/* Book Table */}
      <div style={card}>
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>Title</th>
                <th style={th}>Tier</th>
                <th style={th}>Style</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "right" }}>Duration</th>
                <th style={{ ...th, textAlign: "right" }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((book, i) => (
                <tr key={book.bookId || i} style={{ ...tr, cursor: "pointer" }}
                  onClick={() => openDetail(book.bookId)}>
                  <td style={td}>{total - (page * 20) - i}</td>
                  <td style={{ ...td, fontWeight: 600, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {book.title || "Untitled"}
                  </td>
                  <td style={td}>
                    <span style={{ ...badge, background: book.tier === "premium" ? "#ede9fe" : "#f0f9ff", color: book.tier === "premium" ? "#7c3aed" : "#0369a1" }}>
                      {book.tier || "standard"}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "#64748b" }}>{(book.style || "").substring(0, 15)}</td>
                  <td style={td}>{statusIcon(book.status)} {book.status || "unknown"}</td>
                  <td style={{ ...td, textAlign: "right", fontSize: 12 }}>
                    {book.totalDurationMs ? `${(book.totalDurationMs / 60000).toFixed(1)}m` : "-"}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>${(book.totalCost || 0).toFixed(2)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 40 }}>
                  No books found. Books will appear after generation.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
            <button style={pageBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span style={{ fontSize: 13, color: "#64748b", padding: "6px 12px" }}>
              Page {page + 1} of {Math.ceil(total / 20)}
            </span>
            <button style={pageBtn} disabled={(page + 1) * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>

      {/* Book Detail Modal */}
      {selectedBook && detail && (
        <BookDetailModal detail={detail} onClose={() => { setSelectedBook(null); setDetail(null); }} />
      )}
    </div>
  );
}

function BookDetailModal({ detail, onClose }) {
  const book = detail.book;
  const postgame = detail.postgame;
  const feedback = detail.feedback;
  const apiCalls = detail.apiCalls || [];

  if (!book) return null;

  const statusIcon = (s) => s === "healthy" ? "\u{1F7E2}" : s === "warnings" ? "\u{1F7E1}" : "\u{1F534}";

  // Compute generation stats
  const imageGenCalls = apiCalls.filter(c => c.type === 'cover' || c.type === 'spread' || c.type === 'back_cover' || c.service === 'replicate');
  const validationCalls = apiCalls.filter(c => c.type === 'validation' || c.service === 'anthropic');
  const totalApiCost = apiCalls.reduce((sum, c) => sum + (parseFloat(c.cost) || 0), 0);
  const totalImageGens = imageGenCalls.length;
  const finalImageCount = book.images ? Object.values(book.images).filter(Boolean).length : 0;
  const retryCount = totalImageGens > finalImageCount ? totalImageGens - finalImageCount : 0;
  const failedValidations = (book.validations || []).filter(v => !v.pass);

  // Build per-page generation timeline from validations
  const pageTimeline = {};
  (book.validations || []).forEach(v => {
    const key = v.page || 'unknown';
    if (!pageTimeline[key]) pageTimeline[key] = [];
    pageTimeline[key].push(v);
  });

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              {statusIcon(book.status)} {book.title || "Untitled"}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
              Book ID: {book.bookId} | {new Date(book.createdAt).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} style={closeBtn}>&times;</button>
        </div>

        {/* Metadata */}
        <Section title="Metadata">
          <Grid>
            <KV label="Tier" value={book.tier} />
            <KV label="Style" value={book.style} />
            <KV label="Book Type" value={book.bookType} />
            <KV label="Tone" value={book.tone} />
            <KV label="Hero" value={`${book.heroName} (${book.heroType}, age ${book.heroAge || "?"})`} />
            <KV label="Characters" value={book.characterCount} />
            <KV label="Pages" value={book.pageCount} />
            <KV label="Has Photo" value={book.hasPhoto ? "Yes" : "No"} />
            <KV label="Duration" value={book.totalDurationMs ? `${(book.totalDurationMs / 1000).toFixed(1)}s` : "-"} />
          </Grid>
        </Section>

        {/* Cost Breakdown — always visible */}
        <Section title="Cost Breakdown">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <div style={{ ...costCard, borderColor: "#e2e8f0" }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Reported Cost</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#334155" }}>${(book.totalCost || 0).toFixed(2)}</span>
            </div>
            {totalApiCost > 0 && (
              <div style={{ ...costCard, borderColor: totalApiCost > (book.totalCost || 0) ? "#fecaca" : "#e2e8f0" }}>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Actual API Cost</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: totalApiCost > (book.totalCost || 0) ? "#dc2626" : "#334155" }}>${totalApiCost.toFixed(3)}</span>
              </div>
            )}
          </div>
          <Grid>
            <KV label="Final Images" value={finalImageCount} />
            <KV label="Total Generations" value={totalImageGens || finalImageCount} />
            <KV label="Retries" value={retryCount > 0 ? `${retryCount} (extra $${(retryCount * 0.045).toFixed(3)})` : "0"} />
            <KV label="Validation Checks" value={validationCalls.length || (book.validations || []).length} />
            <KV label="Validation Failures" value={failedValidations.length} />
            <KV label="Story Writing" value="$0.050" />
          </Grid>
          {book.costs && (
            <div style={{ marginTop: 8 }}>
              <Grid>
                {Object.entries(book.costs).map(([k, v]) => (
                  <KV key={k} label={k} value={`$${(v || 0).toFixed(3)}`} />
                ))}
              </Grid>
            </div>
          )}
        </Section>

        {/* Images */}
        {book.images && Object.keys(book.images).length > 0 && (
          <Section title="Images">
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 0" }}>
              {Object.entries(book.images).filter(([, url]) => url).map(([key, url]) => (
                <div key={key} style={{ textAlign: "center", flexShrink: 0 }}>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={key} style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 8 }} />
                  </a>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{key}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Image Generation Timeline — the key new section */}
        {(book.validations?.length > 0 || apiCalls.length > 0) && (
          <Section title="Image Generation Timeline">
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 10px" }}>
              Each page's generation attempts, validation scores, failures, and retries.
            </p>

            {Object.keys(pageTimeline).length > 0 ? (
              Object.entries(pageTimeline).map(([pageName, attempts]) => (
                <div key={pageName} style={{ marginBottom: 14, padding: 12, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#334155" }}>{pageName}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{attempts.length} attempt{attempts.length > 1 ? "s" : ""}</span>
                    {attempts.some(a => !a.pass) && attempts.some(a => a.pass) && (
                      <span style={{ ...badge, background: "#fef3c7", color: "#92400e", fontSize: 10 }}>Failed then Regenerated</span>
                    )}
                    {attempts.every(a => a.pass) && (
                      <span style={{ ...badge, background: "#dcfce7", color: "#16a34a", fontSize: 10 }}>Passed</span>
                    )}
                    {attempts.every(a => !a.pass) && (
                      <span style={{ ...badge, background: "#fef2f2", color: "#dc2626", fontSize: 10 }}>All Failed</span>
                    )}
                  </div>
                  {attempts.map((v, ai) => (
                    <div key={ai} style={{
                      display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px",
                      background: v.pass ? "#f0fdf4" : "#fef2f2",
                      borderRadius: 8, marginBottom: 4, fontSize: 12, flexWrap: "wrap",
                      border: `1px solid ${v.pass ? "#bbf7d0" : "#fecaca"}`,
                    }}>
                      <span style={{ fontWeight: 700, minWidth: 65, color: v.pass ? "#16a34a" : "#dc2626" }}>
                        {v.pass ? "\u2705 Pass" : "\u274C Fail"} #{v.attempt}
                      </span>
                      <span style={scoreChip}>Text: {v.textScore}/10</span>
                      <span style={scoreChip}>Face: {v.faceScore}/10</span>
                      {v.textBoxScore != null && <span style={scoreChip}>TextBox: {v.textBoxScore}/10</span>}
                      {v.sceneAccuracy != null && <span style={scoreChip}>Scene: {v.sceneAccuracy}/10</span>}
                      {v.likenessScore != null && <span style={{ ...scoreChip, background: "#ede9fe" }}>Likeness: {v.likenessScore}/10</span>}
                      {v.compositeScore != null && (
                        <span style={{ ...scoreChip, background: v.compositeScore >= 7 ? "#dcfce7" : v.compositeScore >= 5 ? "#fef3c7" : "#fecaca", fontWeight: 700 }}>
                          Composite: {v.compositeScore.toFixed(1)}
                        </span>
                      )}
                      {v.qualityTier && (
                        <span style={{
                          ...badge,
                          fontSize: 10,
                          background: v.qualityTier === "excellent" ? "#dcfce7" : v.qualityTier === "good" ? "#dbeafe" : v.qualityTier === "acceptable" ? "#fef3c7" : "#fecaca",
                          color: v.qualityTier === "excellent" ? "#16a34a" : v.qualityTier === "good" ? "#1d4ed8" : v.qualityTier === "acceptable" ? "#92400e" : "#dc2626",
                        }}>
                          {v.qualityTier}
                        </span>
                      )}
                      {v.formatOk === false && <span style={{ ...scoreChip, background: "#fecaca" }}>Format: Bad</span>}
                      {v.fingersOk === false && <span style={{ ...scoreChip, background: "#fecaca" }}>Fingers: Bad</span>}
                      {v.characterCount != null && v.characterCount > 1 && <span style={scoreChip}>{v.characterCount} chars</span>}
                      {(v.issues || []).length > 0 && (
                        <div style={{ width: "100%", marginTop: 4, fontSize: 11, color: "#dc2626" }}>
                          Issues: {v.issues.join("; ")}
                        </div>
                      )}
                      {v.fixNotes && (
                        <div style={{ width: "100%", marginTop: 2, fontSize: 11, color: "#92400e", fontStyle: "italic" }}>
                          Fix notes: {v.fixNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            ) : apiCalls.length > 0 ? (
              <p style={{ fontSize: 12, color: "#94a3b8" }}>No validation records found, but {apiCalls.length} API calls were made.</p>
            ) : null}
          </Section>
        )}

        {/* API Calls Log */}
        {apiCalls.length > 0 && (
          <Section title={`API Calls (${apiCalls.length})`}>
            <div style={{ maxHeight: 250, overflowY: "auto" }}>
              <table style={{ ...table, fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={th}>Time</th>
                    <th style={th}>Service</th>
                    <th style={th}>Type</th>
                    <th style={th}>Model</th>
                    <th style={th}>Status</th>
                    <th style={th}>Duration</th>
                    <th style={{ ...th, textAlign: "right" }}>Cost</th>
                    <th style={th}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {apiCalls.map((c, i) => (
                    <tr key={i} style={{ ...tr, background: c.error ? "#fef2f2" : "transparent" }}>
                      <td style={{ ...td, fontSize: 10, whiteSpace: "nowrap" }}>{c.createdAt ? new Date(c.createdAt).toLocaleTimeString() : "-"}</td>
                      <td style={td}>{c.service}</td>
                      <td style={td}>{c.type || "-"}</td>
                      <td style={{ ...td, fontSize: 10 }}>{c.model || "-"}</td>
                      <td style={td}>
                        <span style={{ color: c.status >= 400 ? "#dc2626" : "#16a34a" }}>{c.status}</span>
                      </td>
                      <td style={td}>{c.durationMs ? `${(c.durationMs / 1000).toFixed(1)}s` : "-"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{c.cost ? `$${parseFloat(c.cost).toFixed(4)}` : "-"}</td>
                      <td style={{ ...td, fontSize: 10, color: "#dc2626", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={c.error || ""}>
                        {c.error || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Post-Game Analysis */}
        {postgame && (
          <Section title="Post-Game Analysis">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ ...badge, background: "#dbeafe", color: "#1d4ed8", fontSize: 16, padding: "4px 12px" }}>
                Overall: {postgame.overallScore}/10
              </span>
              {postgame.wouldRecommend !== undefined && (
                <span style={{ ...badge, background: postgame.wouldRecommend ? "#dcfce7" : "#fef2f2", color: postgame.wouldRecommend ? "#16a34a" : "#dc2626" }}>
                  {postgame.wouldRecommend ? "Would Recommend" : "Needs Improvement"}
                </span>
              )}
            </div>
            {postgame.scores && (
              <Grid>
                {Object.entries(postgame.scores).map(([k, v]) => (
                  <KV key={k} label={k.replace(/([A-Z])/g, " $1").trim()} value={`${v.score}/10`} />
                ))}
              </Grid>
            )}
            {postgame.topIssue && (
              <p style={{ fontSize: 13, color: "#dc2626", marginTop: 12 }}>
                <strong>Top Issue:</strong> {postgame.topIssue}
              </p>
            )}
          </Section>
        )}

        {/* User Feedback */}
        {feedback && (
          <Section title="User Feedback">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 20 }}>{"&#x2B50;".repeat(feedback.stars || 0)}</span>
              {feedback.reaction && <span style={{ ...badge, background: "#fef3c7" }}>{feedback.reaction}</span>}
            </div>
            {feedback.comment && <p style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>{feedback.comment}</p>}
          </Section>
        )}

        {/* Story Text */}
        {book.storyTexts?.length > 0 && (
          <Section title="Story Text">
            {book.storyTexts.map((t, i) => (
              <p key={i} style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>
                <strong>Page {i + 1}:</strong> {typeof t === "string" ? t : `"${t.left}" | "${t.right}"`}
              </p>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</h4>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>{children}</div>;
}

function KV({ label, value }) {
  return (
    <div style={{ fontSize: 12 }}>
      <span style={{ color: "#94a3b8" }}>{label}: </span>
      <span style={{ color: "#334155", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{label}:</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={select}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

const card = { background: "#fff", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", marginBottom: 20 };
const table = { width: "100%", fontSize: 13, borderCollapse: "collapse" };
const th = { padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #e2e8f0" };
const td = { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #f1f5f9" };
const tr = { transition: "background 0.1s" };
const badge = { display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: "capitalize" };
const pageBtn = { padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 };
const select = { padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, background: "#fff" };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" };
const modal = { background: "#fff", borderRadius: 16, padding: "28px 32px", width: 720, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" };
const closeBtn = { background: "none", border: "none", fontSize: 28, cursor: "pointer", color: "#94a3b8", lineHeight: 1 };
const costCard = { display: "flex", flexDirection: "column", gap: 2, padding: "10px 16px", borderRadius: 10, border: "2px solid", background: "#fff" };
const scoreChip = { display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "#f1f5f9", fontSize: 11, fontWeight: 600, color: "#475569" };
