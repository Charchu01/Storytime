import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppContext } from "../App";
import BookReader from "../components/BookReader";
import PrintUpsell from "../components/PrintUpsell";

export default function BookReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { stories } = useAppContext();
  const [showPrint, setShowPrint] = useState(false);

  const story = stories.find((s) => s.id === id);

  useEffect(() => {
    if (story) document.title = `${story.story?.title || "Your Book"} — StoriKids`;
  }, [story]);

  // Show print upsell once after story loads (if not already dismissed for this story)
  useEffect(() => {
    if (!story) return;
    const dismissed = localStorage.getItem(`sk_print_dismissed_${id}`);
    if (!dismissed) {
      const timer = setTimeout(() => setShowPrint(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [story, id]);

  function handleDismissPrint() {
    setShowPrint(false);
    localStorage.setItem(`sk_print_dismissed_${id}`, "1");
  }

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
    <>
      <BookReader
        data={story}
        cast={story.cast || []}
        styleName={story.styleName || "Watercolor"}
        onReset={() => navigate("/create")}
      />
      {showPrint && <PrintUpsell onDismiss={handleDismissPrint} />}
    </>
  );
}
