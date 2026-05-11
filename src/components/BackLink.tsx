import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './BackLink.css'

type BackLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  children: ReactNode
}

function BackLink({ children, className, ...props }: BackLinkProps) {
  return (
    <Link
      className={['page-back-link', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </Link>
  )
}

export default BackLink
