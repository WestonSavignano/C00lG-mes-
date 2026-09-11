import BackLink from '../../components/BackLink'
import H1 from '../../components/H1'
import P from '../../components/P'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import BodiIslandGame from './BodiIslandGame'

function BodiIslandPage() {
  return (
    <Page className="game-page">
      <PageHeader>
        <BackLink to="/games">Games</BackLink>
        <H1>Bodi Island</H1>
        <P>
          Follow Captain into the forest, collect Dark Fuzz, and discover why every TV-Cat on
          Bodi Island is receiving the same mysterious signal.
        </P>
      </PageHeader>
      <BodiIslandGame />
    </Page>
  )
}

export default BodiIslandPage
