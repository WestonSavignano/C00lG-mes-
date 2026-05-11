import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'
import './Section.css'

type SectionProps = ComponentPropsWithoutRef<'section'> & {
  children: ReactNode
  flexFlow?: CSSProperties['flexFlow']
  gap?: CSSProperties['gap']
  padding?: CSSProperties['padding']
}

function Section({
  children,
  className,
  flexFlow = 'row wrap',
  gap = '16px',
  padding = '20px',
  style,
  ...props
}: SectionProps) {
  const sectionStyle = {
    '--section-flex-flow': flexFlow,
    '--section-gap': gap,
    '--section-padding': padding,
    ...style,
  } as CSSProperties

  return (
    <section
      className={['section', className].filter(Boolean).join(' ')}
      style={sectionStyle}
      {...props}
    >
      {children}
    </section>
  )
}

export default Section
