import { Link, useParams } from 'react-router-dom'
import ContentDetail from '../components/ContentDetail'
import type { ContentCollection } from '../data/content'

type DetailPageProps = {
  collection: ContentCollection
}

function DetailPage({ collection }: DetailPageProps) {
  const { slug } = useParams()
  const item = collection.items.find((candidate) => candidate.slug === slug)

  if (!item) {
    return (
      <main className="page">
        <section className="empty-state">
          <h1>Not found</h1>
          <p>This item is not in the {collection.title.toLowerCase()} list.</p>
          <Link to={collection.basePath}>Back to {collection.title.toLowerCase()}</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <ContentDetail collection={collection} item={item} />
    </main>
  )
}

export default DetailPage
