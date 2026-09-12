import { Link, NavLink } from 'react-router-dom'
import { primaryNavigationItems } from './navigation'

function DesktopHeader() {
  const brandIcon = `${import.meta.env.BASE_URL}favicon2.png`

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link aria-label="Cool Games Plus home" className="app-brand" to="/">
          <img alt="" className="app-brand__icon" src={brandIcon} />
          <span className="app-brand__name">Cool Games Plus</span>
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
