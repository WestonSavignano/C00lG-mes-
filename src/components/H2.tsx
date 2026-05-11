import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './Typography.css'

type H2Props = ComponentPropsWithoutRef<'h2'> & {
  children: ReactNode
}

function H2({ children, className, ...props }: H2Props) {
  return (
    <h2 className={['heading', 'heading--h2', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </h2>
  )
}

export default H2
