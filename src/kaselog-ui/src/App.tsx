import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Shell from './components/Shell'
import KaseListPage from './pages/KaseListPage'
import KaseViewPage from './pages/KaseViewPage'
import LogViewPage from './pages/LogViewPage'
import SearchPage from './pages/SearchPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<KaseListPage />} />
          <Route path="kases/:id" element={<KaseViewPage />} />
          <Route path="logs/:id" element={<LogViewPage />} />
          <Route path="search" element={<SearchPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
