import BackLink from '../../components/BackLink'
import H1 from '../../components/H1'
import P from '../../components/P'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import NeonDriftGame from './NeonDriftGame'

function NeonDriftPage() {
  return (
    <Page className="game-page">
      <PageHeader>
        <BackLink to="/games">Games</BackLink>
        <H1>Neon Drift</H1>
        <P>Outrun the swarm, collect energy cores, and deploy turrets to survive the neon arena.</P>
      </PageHeader>
      <NeonDriftGame />
    </Page>
  )
}

export default NeonDriftPage
