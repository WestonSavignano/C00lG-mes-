import H1 from '../../components/H1'
import P from '../../components/P'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import FartAttack from './FartAttack'

function FartAttackPage() {
  return (
    <Page className="game-page">
      <PageHeader>
        <H1>Fart Attack</H1>
        <P>
          Clear gas-happy waves, beat the boss, and spend your coins on hazmat
          gear before the next round begins.
        </P>
      </PageHeader>
      <FartAttack />
    </Page>
  )
}

export default FartAttackPage
