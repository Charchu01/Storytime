import { Link } from "react-router-dom";
import { useEffect } from "react";

export default function NotFoundPage() {
  useEffect(() => { document.title = "Page Not Found — StoriKids"; }, []);

  return (
    <div className="page-404">
      <div className="p404-book">📖</div>
      <h1 className="p404-h">This page got lost in the story...</h1>
      <p className="p404-p">But every great adventure has a few wrong turns.</p>
      <Link to="/" className="p404-btn">Take me home →</Link>
    </div>
  );
}
