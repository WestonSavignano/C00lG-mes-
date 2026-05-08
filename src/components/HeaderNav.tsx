import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

const navItems = [
  { label: 'Videos', to: '/videos' },
  { label: 'Games', to: '/games' },
]

function HeaderNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const brandIcon = `${import.meta.env.BASE_URL}favicon.svg`

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link
          aria-label="C00lG-mes home"
          className="brand-link"
          onClick={closeMenu}
          to="/"
        >
          <img alt="" className="brand-link__icon" src={brandIcon} />
          <span>C00lG-mes</span>
        </Link>

        <nav aria-label="Primary" className="desktop-nav">
          {navItems.map((item) => (
            <NavLink className="nav-link" key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="menu-button"
          onClick={() => setIsMenuOpen((current) => !current)}
          type="button"
        >
          {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      <nav
        aria-label="Mobile"
        className="mobile-nav"
        hidden={!isMenuOpen}
        id="mobile-navigation"
      >
        {navItems.map((item) => (
          <NavLink
            className="mobile-nav__link"
            key={item.to}
            onClick={closeMenu}
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

export default HeaderNav
