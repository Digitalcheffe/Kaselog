import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Shell from './components/Shell'
import KaseListPage from './pages/KaseListPage'
import KaseViewPage from './pages/KaseViewPage'
import LogViewPage from './pages/LogViewPage'
import SearchPage from './pages/SearchPage'
import ProfilePage from './pages/ProfilePage'
import CollectionsIndexPage from './pages/CollectionsIndexPage'
import CollectionListPage from './pages/CollectionListPage'
import CollectionDesignerPage from './pages/CollectionDesignerPage'
import NewCollectionPage from './pages/NewCollectionPage'
import CollectionItemPage from './pages/CollectionItemPage'

// Registered routes (all paths the frontend handles):
//   /                          → KaseListPage   (index)
//   /kases                     → KaseListPage
//   /kases/:id                 → KaseViewPage
//   /logs/:id                  → LogViewPage
//   /search                    → SearchPage
//   /profile                   → ProfilePage
//   /collections               → CollectionsIndexPage
//   /collections/new           → NewCollectionPage
//   /collections/:id           → CollectionListPage
//   /collections/:id/design    → CollectionDesignerPage
//   /items/new                 → CollectionItemPage
//   /items/:id                 → CollectionItemPage

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { index: true, element: <KaseListPage /> },
      { path: '/kases', element: <KaseListPage /> },
      { path: '/kases/:id', element: <KaseViewPage /> },
      { path: '/logs/:id', element: <LogViewPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/collections', element: <CollectionsIndexPage /> },
      { path: '/collections/new', element: <NewCollectionPage /> },
      { path: '/collections/:id', element: <CollectionListPage /> },
      { path: '/collections/:id/design', element: <CollectionDesignerPage /> },
      { path: '/items/new', element: <CollectionItemPage /> },
      { path: '/items/:id', element: <CollectionItemPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
