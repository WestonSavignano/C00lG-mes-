import { Link } from 'react-router-dom'
import type { ContentCollections } from '../data/content'

type HomePageProps = {
  collections: ContentCollections
}

function HomePage({ collections }: HomePageProps) {
  return (
    <main className="page page--home">
      <section className="home-intro">
        <p className="eyebrow">C00lG-mes</p>
        <h1>Games and videos</h1>
      </section>
      <nav className="home-links" aria-label="Primary sections">
        <Link className="section-link" to={collections.videos.basePath}>
          <span>Videos</span>
          <span>{collections.videos.description}</span>
        </Link>
        <Link className="section-link" to={collections.games.basePath}>
          <span>Games</span>
          <span>{collections.games.description}</span>
        </Link>
      </nav>
    </main>
  )
}

export default HomePage
