import { useId, type ReactNode } from 'react'
import OceanAnimation from './OceanAnimation'

type HeroProps = {
  children?: ReactNode
  description?: string
  eyebrow?: string
  title: string
  variant?: 'home' | 'detail'
}

function Hero({
  children,
  description,
  eyebrow,
  title,
  variant = 'home',
}: HeroProps) {
  const headingId = useId()

  return (
    <section
      aria-labelledby={headingId}
      className={`hero hero--${variant}`}
      role="region"
    >
      
      <div className="hero__surface" />
      <div className="hero__content">
        {eyebrow ? <p className="hero__eyebrow">{eyebrow}</p> : null}
        <h1 id={headingId}>{title}</h1>
        {description ? <p className="hero__description">{description}</p> : null}
        {children ? <div className="hero__actions">{children}</div> : null}
      </div>
    </section>
  )
}

export default Hero
