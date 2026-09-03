import H1 from '../../components/H1'
import Page from '../../components/Page'
import PageHeader from '../../components/PageHeader'
import Warrior from './Warrior'

function WarriorPage() {
  return (
    <Page className="game-page">
      <PageHeader>
        <H1>Warrior2</H1>
      </PageHeader>
      <Warrior />
    </Page>
  )
}

export default WarriorPage
