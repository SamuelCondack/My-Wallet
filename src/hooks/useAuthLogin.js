import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../config/firebase";
import { resolveGoogleRedirectResult } from "../utils/googleAuth";

export function useAuthLogin() {
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribe = () => {};

    const initAuth = async () => {
      await resolveGoogleRedirectResult();

      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          navigate("/home/expenses", { replace: true });
        }
      });
    };

    initAuth();

    return () => unsubscribe();
  }, [navigate]);
}
