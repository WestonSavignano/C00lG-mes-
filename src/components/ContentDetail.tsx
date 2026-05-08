import { Link } from 'react-router-dom'
import type { ContentCollection, ContentItem } from '../data/content'
import Hero from './Hero'

type ContentDetailProps = {
  collection: ContentCollection
  item: ContentItem
}

function ContentDetail({ collection, item }: ContentDetailProps) {
  return (
    <article className="detail">
      <Hero
        description={item.description}
        eyebrow={collection.singularLabel}
        title={item.title}
        variant="detail"
      >
        <Link className="back-link" to={collection.basePath}>
          Back to {collection.title.toLowerCase()}
        </Link>
      </Hero>
      <div className="detail__body">
        <p>{item.detail}</p>
      </div>
    </article>
  )
}

export default ContentDetail
