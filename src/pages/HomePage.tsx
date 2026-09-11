import { featuredGame, gameCatalog } from '../games/catalog/gameCatalog'
import FeaturedGame from '../games/discovery/FeaturedGame'
import GameGrid from '../games/discovery/GameGrid'
import GameRail from '../games/discovery/GameRail'
import PartyCallout from '../games/discovery/PartyCallout'
import { resolveRecentGames } from '../games/discovery/recentGames'
import './DiscoveryPages.css'

function HomePage() {
  const recentGames = resolveRecentGames()

  return (
    <main className="arcade-home">
      <div className="discovery-page">
        <div className="arcade-home__intro">
          <p className="discovery-kicker">C00lG@mes+</p>
          <h1>Pick a game. Get into it.</h1>
          <p>Instant browser games built to feel great, wherever you play.</p>
        </div>

        <FeaturedGame game={featuredGame} />

        {recentGames.length > 0 ? (
          <GameRail games={recentGames} title="Continue Playing" />
        ) : null}

        <PartyCallout />

        <section aria-labelledby="home-games-heading" className="discovery-section">
          <div className="discovery-section__header">
            <div>
              <p className="discovery-kicker">The arcade</p>
              <h2 id="home-games-heading">Play something good.</h2>
            </div>
          </div>
          <GameGrid games={gameCatalog} />
        </section>
      </div>
    </main>
  )
}

export default HomePage
