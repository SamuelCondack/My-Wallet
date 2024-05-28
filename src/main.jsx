import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './Global/reset.scss'
import './Global/global.scss'
import NewRegister from './pages/NewRegister/NewRegister.jsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Expenses from './pages/Expenses/Expenses.jsx'
import Register from './pages/Register'
import SignIn from './pages/SignIn'
import HomeAuth from './pages/homeAuth/index.jsx'
import Modal from 'react-modal';

Modal.setAppElement('#root');

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
        path: 'newregister',
        element: <NewRegister/>
      },
      {
      path: 'expenses',
      element: <Expenses/>
      },
    ]
  }
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
