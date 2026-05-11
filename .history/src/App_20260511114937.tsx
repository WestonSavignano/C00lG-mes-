import { Route, Routes } from 'react-router-dom'
import './App.css'
import HeaderNav from './components/HeaderNav'
import BitPlanesPage from './games/bit-planes/BitPlanesPage'
import GamesPage from './pages/GamesPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import PlaceholderPage from './pages/PlaceholderPage'
import VideosPage from './pages/SoundboardPage'

function App() {
  return (
    <>
      <HeaderNav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/videos" element={<VideosPage />} />
        <Route path="/videos/video-placeholder" element={<PlaceholderPage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/games/bit-planes" element={<BitPlanesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}

export default App
