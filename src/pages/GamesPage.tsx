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

function GamesPage() {
  return (
    <Page>
      <PageHeader>
        <BackLink to="/">Home</BackLink>
        <H1>Games</H1>
        <P>A place for browser games, experiments, and game-engine practice.</P>
      </PageHeader>
      <Section>
        <Card to="/games/bit-planes">
          <CardLabel>Game</CardLabel>
          <H2>Bit Planes</H2>
          <P>A Phaser-powered starter dogfight with arcade plane controls.</P>
          <CardAction>Open Bit Planes</CardAction>
        </Card>
      </Section>
    </Page>
  )
}

export default GamesPage
