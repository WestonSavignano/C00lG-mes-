import { Gamepad2, House, UsersRound, type LucideIcon } from 'lucide-react'

type PrimaryNavigationItem = {
  label: string
  to: string
  end?: boolean
  icon: LucideIcon
}

export const primaryNavigationItems: readonly PrimaryNavigationItem[] = [
  { label: 'Home', to: '/', end: true, icon: House },
  { label: 'Games', to: '/games', icon: Gamepad2 },
  { label: 'Party', to: '/chat', icon: UsersRound },
]
