import { Link } from "react-router-dom";
import { useEffect } from "react";

export default function NotFoundPage() {
  useEffect(() => { document.title = "Page Not Found — Storytime"; }, []);

  return (
    <div className="page-404">
      <div className="p404-book" role="img" aria-label="Book emoji">📖</div>
      <h1 className="p404-h">This page wandered off into the forest...</h1>
      <p className="p404-p">But every great adventure has a few wrong turns.</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Link to="/" className="p404-btn">Go home →</Link>
        <Link to="/create" className="p404-btn p404-btn-sec">Create a story →</Link>
      </div>
    </div>
  );
}
