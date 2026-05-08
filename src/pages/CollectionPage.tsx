import { Link } from 'react-router-dom'
import ContentList from '../components/ContentList'
import type { ContentCollection } from '../data/content'

type CollectionPageProps = {
  collection: ContentCollection
}

function CollectionPage({ collection }: CollectionPageProps) {
  return (
    <main className="page">
      <header className="page-header">
        <Link className="back-link" to="/">
          Home
        </Link>
        <h1>{collection.title}</h1>
        <p>{collection.description}</p>
      </header>
      <ContentList collection={collection} />
    </main>
  )
}

export default CollectionPage
