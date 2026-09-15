import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { gameRouteEntries } from './games/catalog/gameRoutes'
import RecentGameTracker from './games/discovery/RecentGameTracker'
import ChatPage from './pages/ChatPage'
import GamesPage from './pages/GamesPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import AppShell from './shell/AppShell'

const TrysteroPocPage = lazy(() => import('./pages/TrysteroPocPage'))
const HostAuthorityPocPage = lazy(() => import('./pages/HostAuthorityPocPage'))
const SchoolEscapePreviewPage = lazy(
  () => import('./games/school-escape/SchoolEscapePage'),
)

function App() {
  return (
    <AppShell>
      <RecentGameTracker />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/soundboard" element={<Navigate replace to="/chat" />} />
        <Route path="/soundboard/sound" element={<Navigate replace to="/chat" />} />
        <Route
          path="/networking-poc/trystero"
          element={(
            <Suspense fallback={<div>Loading networking POC…</div>}>
              <TrysteroPocPage />
            </Suspense>
          )}
        />
        <Route
          path="/networking-poc/host-authority"
          element={(
            <Suspense fallback={<div>Loading host-authority POC…</div>}>
              <HostAuthorityPocPage />
            </Suspense>
          )}
        />
        <Route path="/games" element={<GamesPage />} />
        <Route
          path="/game-preview/school-escape"
          element={(
            <Suspense fallback={<div role="status">Loading School Escape…</div>}>
              <SchoolEscapePreviewPage />
            </Suspense>
          )}
        />
        {gameRouteEntries.map((entry) => (
          <Route key={entry.game.id} path={entry.path} element={entry.element} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  )
}

export default App
