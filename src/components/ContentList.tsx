import { Link } from 'react-router-dom'
import type { ContentCollection } from '../data/content'

type ContentListProps = {
  collection: ContentCollection
}

function ContentList({ collection }: ContentListProps) {
  return (
    <div className="content-grid">
      {collection.items.map((item) => (
        <article className="content-card" data-testid="content-card" key={item.slug}>
          <div className="content-card__label">{collection.singularLabel}</div>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
          <Link to={`${collection.basePath}/${item.slug}`}>
            Open {item.title}
          </Link>
        </article>
      ))}
    </div>
  )
}

export default ContentList
