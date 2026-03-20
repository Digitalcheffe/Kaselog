import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Shell from './components/Shell'
import KaseListPage from './pages/KaseListPage'
import KaseViewPage from './pages/KaseViewPage'
import LogViewPage from './pages/LogViewPage'
import SearchPage from './pages/SearchPage'

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { index: true, element: <KaseListPage /> },
      { path: '/kases/:id', element: <KaseViewPage /> },
      { path: '/logs/:id', element: <LogViewPage /> },
      { path: '/search', element: <SearchPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
