import { gameCatalog } from '../games/catalog/gameCatalog'
import GameGrid from '../games/discovery/GameGrid'
import './DiscoveryPages.css'

function GamesPage() {
  return (
    <main className="games-library">
      <div className="discovery-page">
        <div className="games-library__header">
          <p className="discovery-kicker">C00lG@mes+ arcade</p>
          <h1>Games</h1>
          <p>Six worlds. No installs. Pick one and play.</p>
        </div>

        <GameGrid games={gameCatalog} />
      </div>
    </main>
  )
}

export default GamesPage
