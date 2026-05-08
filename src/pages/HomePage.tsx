import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import type { ContentCollections } from '../data/content'

type HomePageProps = {
  collections: ContentCollections
}

function HomePage({ collections }: HomePageProps) {
  return (
    <main className="home-page">
      <Hero
        description="A tidepool for playful videos, experiments, and games."
        eyebrow="C00lG-mes"
        title="Games and videos"
      >
        <nav className="home-links" aria-label="Home sections">
          <Link className="section-link" to={collections.videos.basePath}>
            <span>Videos</span>
            <span>{collections.videos.description}</span>
          </Link>
          <Link className="section-link" to={collections.games.basePath}>
            <span>Games</span>
            <span>{collections.games.description}</span>
          </Link>
        </nav>
      </Hero>
    </main>
  )
}

export default HomePage
