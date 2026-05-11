import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './Page.css'

type PageProps = ComponentPropsWithoutRef<'main'> & {
  children: ReactNode
}

function Page({ children, className, ...props }: PageProps) {
  return (
    <main className={['page', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </main>
  )
}

export default Page
