import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './Typography.css'

type PProps = ComponentPropsWithoutRef<'p'> & {
  children: ReactNode
}

function P({ children, className, ...props }: PProps) {
  return (
    <p className={['text', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </p>
  )
}

export default P
