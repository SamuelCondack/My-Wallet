import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './Global/reset.scss'
import './Global/global.scss'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Expenses from './pages/Expenses/Expenses.jsx'
import Income from './pages/Income/Income.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import Categories from './pages/Categories/Categories.jsx'
import Profile from './pages/Profile/Profile.jsx'
import Register from './pages/Register'
import SignIn from './pages/SignIn'
import HomeAuth from './pages/homeAuth/index.jsx'
import Modal from 'react-modal';
import { completeGoogleRedirectSignIn } from './utils/googleAuth.js'
import { bindPwaInstallEvents } from './utils/pwaInstall.js'
import ToastComponent from './components/Toast/ToastComponent.jsx'
import ThemeSync from './components/ThemeSync/ThemeSync.jsx'
import 'react-toastify/dist/ReactToastify.css'

Modal.setAppElement('#root');
bindPwaInstallEvents();

const router = createBrowserRouter([
  {
    path: '/',
    element: <App/>,
  },
  {
    path: '/signup',
    element: <Register/>
  },
  {
    path: '/signin',
    element: <SignIn />
  },
  {
    path: '/home',
    element: <HomeAuth />,
    children: [
      {
        path: 'dashboard',
        element: <Dashboard />
      },
      {
        path: 'categories',
        element: <Categories />
      },
      {
        path: 'expenses',
        element: <Expenses/>
      },
      {
        path: 'income',
        element: <Income/>
      },
      {
        path: 'profile',
        element: <Profile />
      },
    ]
  }
])

async function startApp() {
  try {
    await completeGoogleRedirectSignIn();
  } catch (error) {
    console.error('Google redirect sign-in failed:', error);
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ThemeSync />
      <ToastComponent />
      <RouterProvider router={router} />
    </React.StrictMode>,
  )
}

startApp();
