import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Shell from './components/Shell'
import KaseListPage from './pages/KaseListPage'
import KaseViewPage from './pages/KaseViewPage'
import LogViewPage from './pages/LogViewPage'
import SearchPage from './pages/SearchPage'
import ProfilePage from './pages/ProfilePage'

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { index: true, element: <KaseListPage /> },
      { path: '/kases/:id', element: <KaseViewPage /> },
      { path: '/logs/:id', element: <LogViewPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
