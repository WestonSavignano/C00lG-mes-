import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './PageHeader.css'

type PageHeaderProps = ComponentPropsWithoutRef<'header'> & {
  children: ReactNode
}

function PageHeader({ children, className, ...props }: PageHeaderProps) {
  return (
    <header
      className={['page-header', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </header>
  )
}

export default PageHeader
