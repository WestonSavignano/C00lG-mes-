import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import P from '../components/P'
import Page from '../components/Page'
import Section from '../components/Section'

function PlaceholderPage() {
  return (
    <Page>
      <article className="detail">
        <Hero
          description="A reusable card slot for the first sound."
          eyebrow="Sound"
          title="Sound Placeholder"
          variant="detail"
        >
          <Link className="back-link" to="/soundboard">
            Back to soundboard
          </Link>
        </Hero>
        <Section flexFlow="column">
          <div className="detail__body">
            <P>
              This page is ready for a sound clip, notes, and related links.
            </P>
          </div>
        </Section>
      </article>
    </Page>
  )
}

export default PlaceholderPage
