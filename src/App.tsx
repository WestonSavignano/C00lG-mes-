import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import HeaderNav from './components/HeaderNav'
import BitPlanesPage from './games/bit-planes/BitPlanesPage'
import DonutRunPage from './games/donut-run/DonutRunPage'
import NeonDriftPage from './games/neon-drift/NeonDriftPage'
import WarriorPage from './games/warrior/WarriorPage'
import Warrior2Page from './games/warrior2/WarriorPage'
import WormBattlesPage from './games/worm-battles/WormBattlesPage'
import ChatPage from './pages/ChatPage'
import GamesPage from './pages/GamesPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'

const BodiIslandPage = lazy(() => import('./games/bodi-island/BodiIslandPage'))

function App() {
  return (
    <>
      <HeaderNav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/soundboard" element={<Navigate replace to="/chat" />} />
        <Route path="/soundboard/sound" element={<Navigate replace to="/chat" />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/games/plane-blaster" element={<BitPlanesPage />} />
        <Route
          path="/games/bodi-island"
          element={(
            <Suspense fallback={<div role="status">Loading Bodi Island…</div>}>
              <BodiIslandPage />
            </Suspense>
          )}
        />
        <Route path="/games/donut-run" element={<DonutRunPage />} />
        <Route path="/games/neon-drift" element={<NeonDriftPage />} />
        <Route path="/games/worm-battles" element={<WormBattlesPage />} />
        <Route path="/games/warrior" element={<WarriorPage />} />
        <Route path="/games/warrior2" element={<Warrior2Page />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}

export default App
