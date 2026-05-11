import BackLink from '../components/BackLink'
import H1 from '../components/H1'
import P from '../components/P'
import Page from '../components/Page'
import Section from '../components/Section'

function NotFoundPage() {
  return (
    <Page>
      <Section flexFlow="column">
        <H1>Not found</H1>
        <P>That page does not exist.</P>
        <BackLink to="/">Home</BackLink>
      </Section>
    </Page>
  )
}

export default NotFoundPage
