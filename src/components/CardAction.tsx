import type { ComponentPropsWithoutRef, ReactNode } from 'react'

type CardActionProps = ComponentPropsWithoutRef<'span'> & {
  children: ReactNode
}

function CardAction({ children, className, ...props }: CardActionProps) {
  return (
    <span className={['card__action', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </span>
  )
}

export default CardAction
