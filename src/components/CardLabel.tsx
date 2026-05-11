import type { ComponentPropsWithoutRef, ReactNode } from 'react'

type CardLabelProps = ComponentPropsWithoutRef<'p'> & {
  children: ReactNode
}

function CardLabel({ children, className, ...props }: CardLabelProps) {
  return (
    <p className={['card__label', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </p>
  )
}

export default CardLabel
