import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './Global/reset.css'
import './Global/global.scss'
import NewRegister from './pages/NewRegister/NewRegister.jsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Expenses from './pages/Expenses/Expenses.jsx'

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
  }
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
