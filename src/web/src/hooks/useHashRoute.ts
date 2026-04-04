import { useEffect, useState } from "react";

export function useHashRoute(): { path: string; navigate: (to: string) => void } {
  const [path, setPath] = useState(() => window.location.hash.slice(1) || "/");

  useEffect(() => {
    function onHashChange() {
      setPath(window.location.hash.slice(1) || "/");
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function navigate(to: string) {
    window.location.hash = to;
  }

  return { path, navigate };
}
