import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './Card.css'

type CardProps = ComponentPropsWithoutRef<'article'> & {
  children: ReactNode
  to?: string
}

function Card({ children, className, to, ...props }: CardProps) {
  const content = to ? (
    <Link className="card__link" to={to}>
      {children}
    </Link>
  ) : (
    <div className="card__content">{children}</div>
  )

  return (
    <article
      className={['card', className].filter(Boolean).join(' ')}
      data-testid="card"
      {...props}
    >
      {content}
    </article>
  )
}

export default Card
