import { useEffect, useState } from "react";
import { auth } from "../../config/firebase";

export function useAuthUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    auth.authStateReady().then(() => {
      if (!active) {
        return;
      }
      setUser(auth.currentUser);
      setLoading(false);
    });

    const unsubscribe = auth.onAuthStateChanged((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { user, loading, userId: user?.uid ?? null };
}
