import { Link } from 'react-router-dom'
import type { ContentCollection, ContentItem } from '../data/content'

type ContentDetailProps = {
  collection: ContentCollection
  item: ContentItem
}

function ContentDetail({ collection, item }: ContentDetailProps) {
  return (
    <article className="detail">
      <Link className="back-link" to={collection.basePath}>
        Back to {collection.title.toLowerCase()}
      </Link>
      <div className="detail__label">{collection.singularLabel}</div>
      <h1>{item.title}</h1>
      <p className="detail__description">{item.description}</p>
      <div className="detail__body">
        <p>{item.detail}</p>
      </div>
    </article>
  )
}

export default ContentDetail
