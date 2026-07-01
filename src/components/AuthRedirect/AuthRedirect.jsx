import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AuthRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) {
      return;
    }

    const path = location.pathname;
    const isProtectedRoute = path.startsWith("/home");
    const isAuthPage = path === "/signin" || path === "/signup";

    if (user && isAuthPage) {
      navigate("/home/expenses", { replace: true });
      return;
    }

    if (!user && isProtectedRoute) {
      navigate("/signin", { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  return null;
}
