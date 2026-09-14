import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import DesktopHeader from './DesktopHeader'

describe('DesktopHeader brand presentation', () => {
  it('shows the stylized brand while keeping a plain accessible home name and decorative mark', () => {
    render(
      <MemoryRouter>
        <DesktopHeader />
      </MemoryRouter>,
    )

    const homeLink = screen.getByRole('link', { name: 'Cool Games Plus home' })
    const brandMark = homeLink.querySelector('img')

    expect(homeLink).toHaveTextContent('C00lG@mes+')
    expect(brandMark).toHaveAttribute('alt', '')
    expect(brandMark).toHaveAttribute('src', '/brand-mark.png')
  })
})
