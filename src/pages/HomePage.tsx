import { Link } from 'react-router-dom'
import Hero from '../components/Hero'

function HomePage() {
  return (
    <main className="home-page">
      <Hero
        description="A site for real gamers."
        title="C00lG@mes+"
      >
        <nav className="home-links" aria-label="Home sections">
          <Link className="section-link" to="/soundboard">
            <span>Soundboard</span>
            <span>A growing library of sound effects.</span>
          </Link>
          <Link className="section-link" to="/games">
            <span>Games</span>
            <span>Browser games, experiments, and game-engine practice.</span>
          </Link>
        </nav>
      </Hero>
    </main>
  )
}

export default HomePage
