import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import HomeNoAuth from "./pages/homeNoAuth/";
import LoadingComponent from "./components/LoadingComponent/LoadingComponent";

export default function App() {
  const navigate = useNavigate();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/home/expenses", { replace: true });
        return;
      }

      setShowLanding(true);
    });

    return unsubscribe;
  }, [navigate]);

  if (!showLanding) {
    return <LoadingComponent variant="landing" />;
  }

  return <HomeNoAuth />;
}
