import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import BookReader from "../components/BookReader";

export default function BookReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { stories } = useAppContext();

  const story = stories.find((s) => s.id === id);

  useEffect(() => {
    if (story) document.title = `${story.story?.title || "Your Book"} — StoriKids`;
  }, [story]);

  if (!story) {
    return (
      <div className="page-404">
        <div className="p404-book">📖</div>
        <h1 className="p404-h">Story not found</h1>
        <p className="p404-p">This story may have been deleted or the link is invalid.</p>
        <button className="p404-btn" onClick={() => navigate("/library")}>Go to Library →</button>
      </div>
    );
  }

  return (
    <BookReader
      data={story}
      cast={story.cast || []}
      styleName={story.styleName || "Watercolor"}
      onReset={() => navigate("/create")}
    />
  );
}
