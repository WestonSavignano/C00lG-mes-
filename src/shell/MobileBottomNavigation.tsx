import { NavLink } from 'react-router-dom'
import { primaryNavigationItems } from './navigation'

function MobileBottomNavigation() {
  return (
    <nav aria-label="Mobile primary" className="mobile-bottom-navigation">
      <div className="mobile-bottom-navigation__inner">
        {primaryNavigationItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              className="mobile-bottom-navigation__link"
              end={item.end}
              key={item.to}
              to={item.to}
            >
              <Icon aria-hidden="true" className="mobile-bottom-navigation__icon" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export default MobileBottomNavigation
