import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./Global/reset.scss";
import "./Global/global.scss";
import NewRegister from "./pages/NewRegister/NewRegister.jsx";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import Expenses from "./pages/Expenses/Expenses.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import Categories from "./pages/Categories/Categories.jsx";
import Goals from "./pages/Goals/Goals.jsx";
import Register from "./pages/Register";
import SignIn from "./pages/SignIn";
import HomeAuth from "./pages/homeAuth/index.jsx";
import Modal from "react-modal";
import PwaShell from "./components/PwaShell/PwaShell.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { resolveGoogleRedirect } from "./utils/googleAuth.js";

Modal.setAppElement("#root");

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/signup",
    element: <Register />,
  },
  {
    path: "/signin",
    element: <SignIn />,
  },
  {
    path: "/home",
    element: <HomeAuth />,
    children: [
      {
        index: true,
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "expenses",
        element: <Expenses />,
      },
      {
        path: "newregister",
        element: <NewRegister />,
      },
      {
        path: "categories",
        element: <Categories />,
      },
      {
        path: "goals",
        element: <Goals />,
      },
    ],
  },
]);

async function startApp() {
  try {
    await resolveGoogleRedirect();
  } catch (error) {
    console.error("Google redirect sign-in failed:", error);
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ThemeProvider>
        <PwaShell>
          <RouterProvider router={router} />
        </PwaShell>
      </ThemeProvider>
    </React.StrictMode>
  );
}

startApp();
