import { CardGrid, ContentCard, Page, PageHeader, PageSection } from '../components/Layout'

function SoundboardPage() {
  return (
    <Page>
      <PageHeader
        backLabel="Home"
        backTo="/"
        description="A growing library of video placeholders."
        title="Soundboard"
      />
      <PageSection>
        <CardGrid>
          <ContentCard
            actionLabel="Open Sound Placeholder"
            description="A reusable card slot for the first sound."
            label="Sound"
            title="Sound Placeholder"
            to="/soundboard/sound"
          />
        </CardGrid>
      </PageSection>
    </Page>
  )
}

export default SoundboardPage
