import BackLink from '../components/BackLink'
import Card from '../components/Card'
import CardAction from '../components/CardAction'
import CardLabel from '../components/CardLabel'
import H1 from '../components/H1'
import H2 from '../components/H2'
import P from '../components/P'
import Page from '../components/Page'
import PageHeader from '../components/PageHeader'
import Section from '../components/Section'

function SoundboardPage() {
  return (
    <Page>
      <PageHeader>
        <BackLink to="/">Home</BackLink>
        <H1>Soundboard</H1>
        <P>A growing library of sound effects.</P>
      </PageHeader>
      <Section>
        <Card to="/soundboard/sound">
          <CardLabel>Sound</CardLabel>
          <H2>Sound Placeholder</H2>
          <P>A reusable card slot for the first sound.</P>
          <CardAction>Open Sound Placeholder</CardAction>
        </Card>
      </Section>
    </Page>
  )
}

export default SoundboardPage
