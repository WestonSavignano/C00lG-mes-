import { CardGrid, ContentCard, Page, PageHeader, PageSection } from '../components/Layout'

function VideosPage() {
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
            actionLabel="Open Video Placeholder"
            description="A reusable card slot for the first video."
            label="Video"
            title="Video Placeholder"
            to="/videos/video-placeholder"
          />
        </CardGrid>
      </PageSection>
    </Page>
  )
}

export default VideosPage
