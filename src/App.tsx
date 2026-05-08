import { Route, Routes } from 'react-router-dom'
import './App.css'
import { collections } from './data/content'
import CollectionPage from './pages/CollectionPage'
import DetailPage from './pages/DetailPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage collections={collections} />} />
      <Route
        path="/videos"
        element={<CollectionPage collection={collections.videos} />}
      />
      <Route
        path="/videos/:slug"
        element={<DetailPage collection={collections.videos} />}
      />
      <Route
        path="/games"
        element={<CollectionPage collection={collections.games} />}
      />
      <Route
        path="/games/:slug"
        element={<DetailPage collection={collections.games} />}
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
