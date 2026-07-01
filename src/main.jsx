import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./Global/reset.scss";
import "./Global/global.scss";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import PwaShell from "./components/PwaShell/PwaShell.jsx";
import LoadingComponent from "./components/LoadingComponent/LoadingComponent.jsx";
import Register from "./pages/Register";
import SignIn from "./pages/SignIn";
import HomeAuth from "./pages/homeAuth/index.jsx";

const NewRegister = lazy(() => import("./pages/NewRegister/NewRegister.jsx"));
const Expenses = lazy(() => import("./pages/Expenses/Expenses.jsx"));

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
        path: "newregister",
        element: <NewRegister />,
      },
      {
        path: "expenses",
        element: <Expenses />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PwaShell>
      <Suspense fallback={<LoadingComponent />}>
        <RouterProvider router={router} />
      </Suspense>
    </PwaShell>
  </React.StrictMode>
);
