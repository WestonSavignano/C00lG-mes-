import H1 from '../../components/H1'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import DonutRun from './DonutRun'

function DonutRunPage() {
  return (
    <Page className="game-page">
      <PageHeader>
        <H1>Donut Run</H1>
      </PageHeader>
      <DonutRun />
    </Page>
  )
}

export default DonutRunPage
