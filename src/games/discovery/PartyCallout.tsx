import { ArrowRight, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'

function PartyCallout() {
  return (
    <section className="party-callout">
      <div className="party-callout__copy">
        <p className="discovery-kicker">Play together</p>
        <h2>Bring your crew.</h2>
        <p>
          Start a private browser room now, with multiplayer game lobbies growing from the same foundation.
        </p>
      </div>
      <Link aria-label="Start a party" className="party-callout__link" to="/chat">
        <UsersRound aria-hidden="true" size={18} />
        <span>Start a party</span>
        <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </section>
  )
}

export default PartyCallout
