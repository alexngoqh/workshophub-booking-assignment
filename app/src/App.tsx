import TrainingSessionsPage from './pages/TrainingSessionsPage'
import SessionDetailPage from './pages/SessionDetailPage'
import Banner from './components/Banner'
import { matchSessionPath, usePath } from './router'
import './App.css'

function App() {
  const path = usePath()
  const sessionId = matchSessionPath(path)

  return (
    <div className="app">
      <header className="app-header">
        <h1>WorkshopHub</h1>
        <p className="app-tagline">Internal Training Registration System</p>
      </header>
      <main className="app-main">
        <Banner />
        {sessionId !== null ? (
          <SessionDetailPage sessionId={sessionId} />
        ) : (
          <TrainingSessionsPage />
        )}
      </main>
    </div>
  )
}

export default App
