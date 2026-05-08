import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <main className="page">
      <section className="empty-state">
        <h1>Not found</h1>
        <p>That page does not exist.</p>
        <Link to="/">Home</Link>
      </section>
    </main>
  )
}

export default NotFoundPage
