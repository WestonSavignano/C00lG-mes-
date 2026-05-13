import { Route, Routes } from 'react-router-dom'
import './App.css'
import HeaderNav from './components/HeaderNav'
import BitPlanesPage from './games/bit-planes/BitPlanesPage'
import GamesPage from './pages/GamesPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import PlaceholderPage from './pages/PlaceholderPage'
import SoundboardPage from './pages/SoundboardPage'
import DonutRunPage from './games/donut-run/DonutRunPage'

function App() {
  return (
    <>
      <HeaderNav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/soundboard" element={<SoundboardPage />} />
        <Route path="/soundboard/sound" element={<PlaceholderPage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/games/plane-blaster" element={<BitPlanesPage />} />
        <Route path="/games/donut-run" element={<DonutRunPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}

export default App
