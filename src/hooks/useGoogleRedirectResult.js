import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { resolveGoogleRedirectResult } from "../utils/googleAuth";

export function useGoogleRedirectResult() {
  const navigate = useNavigate();

  useEffect(() => {
    resolveGoogleRedirectResult().then((result) => {
      if (result?.user) {
        navigate("/home/expenses");
      }
    });
  }, [navigate]);
}
