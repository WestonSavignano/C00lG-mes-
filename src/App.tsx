import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import HeaderNav from './components/HeaderNav'
import { gameRouteEntries } from './games/catalog/gameRoutes'
import ChatPage from './pages/ChatPage'
import GamesPage from './pages/GamesPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'

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
        {gameRouteEntries.map((entry) => (
          <Route key={entry.game.id} path={entry.path} element={entry.element} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}

export default App
