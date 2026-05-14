import H1 from '../../components/H1'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import WormBattles from './WormBattles'

function WormBattlesPage() {
  return (
    <Page className="game-page">
      <PageHeader>
        <H1>Worm Battles</H1>
      </PageHeader>
      <WormBattles />
    </Page>
  )
}

export default WormBattlesPage