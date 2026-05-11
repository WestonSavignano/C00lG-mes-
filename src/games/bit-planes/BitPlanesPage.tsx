import H1 from '../../components/H1'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import BitPlanesGame from './BitPlanesGame'

function BitPlanesPage() {
  return (
    <Page className="game-page">
      <PageHeader>
        <H1>Bit Planes</H1>
      </PageHeader>
      <BitPlanesGame />
    </Page>
  )
}

export default BitPlanesPage
