import { Link, NavLink } from 'react-router-dom'
import { primaryNavigationItems } from './navigation'

function DesktopHeader() {
  const brandIcon = `${import.meta.env.BASE_URL}brand-mark.png`

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link aria-label="Cool Games Plus home" className="app-brand" to="/">
          <img
            alt=""
            className="app-brand__icon"
            height="34"
            src={brandIcon}
            width="34"
          />
          <span className="app-brand__name">C00lG@mes+</span>
        </Link>

        <nav aria-label="Primary" className="primary-navigation">
          {primaryNavigationItems.map((item) => (
            <NavLink
              className="primary-navigation__link"
              end={item.end}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}

export default DesktopHeader
