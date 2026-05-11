import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './Typography.css'

type H1Props = ComponentPropsWithoutRef<'h1'> & {
  children: ReactNode
}

function H1({ children, className, ...props }: H1Props) {
  return (
    <h1 className={['heading', 'heading--h1', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </h1>
  )
}

export default H1
