import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './Global/reset.scss'
import './Global/global.scss'
import NewRegister from './pages/NewRegister/NewRegister.jsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Expenses from './pages/Expenses/Expenses.jsx'
import HomeNoAuth from './pages/homeNoAuth'
import Register from './pages/Register'
import SignIn from './pages/SignIn'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App/>,
    children: [
      {
        path: '/',
        element: ""
      },
      {
        path: '/novoregistro',
        element: <NewRegister/>
      },
      {
      path: '/expenses',
      element: <Expenses/>
      }
    ]
  },
  {
    path: '/signup',
    element: <Register/>
  },
  {
    path: '/signin',
    element: <SignIn />
  },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
