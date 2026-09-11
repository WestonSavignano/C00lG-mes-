import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { getGameByRoute } from '../games/catalog/gameCatalog'
import DesktopHeader from './DesktopHeader'
import MobileBottomNavigation from './MobileBottomNavigation'
import './shell.css'

type AppShellProps = {
  children: ReactNode
}

function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const isGameRoute = Boolean(getGameByRoute(location.pathname))

  return (
    <div className="app-shell" data-game-route={isGameRoute ? 'true' : 'false'}>
      <DesktopHeader />
      <div className="app-shell__content">{children}</div>
      <MobileBottomNavigation />
    </div>
  )
}

export default AppShell
