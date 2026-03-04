import { useState, useEffect } from "react";
import { useToast } from "../App";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const { addToast } = useToast();

  useEffect(() => {
    function handleOffline() { setOffline(true); }
    function handleOnline() {
      setOffline(false);
      addToast("You're back online ✓", "success", 3000);
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [addToast]);

  if (!offline) return null;

  return (
    <div className="offline-banner">
      You're offline — story creation needs an internet connection
    </div>
  );
}
