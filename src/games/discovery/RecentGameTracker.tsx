import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getGameByRoute } from '../catalog/gameCatalog'
import { recordRecentGame } from './recentGames'

function RecentGameTracker() {
  const location = useLocation()

  useEffect(() => {
    const game = getGameByRoute(location.pathname)

    if (game) {
      recordRecentGame(game.id)
    }
  }, [location.pathname])

  return null
}

export default RecentGameTracker
