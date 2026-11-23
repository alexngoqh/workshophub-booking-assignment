import TrainingSessionsPage from './pages/TrainingSessionsPage'
import SessionDetailPage from './pages/SessionDetailPage'
import { usePath } from './router'
import './App.css'

function App() {
  const path = usePath()
  const detail = /^\/sessions\/(\d+)$/.exec(path)

  return (
    <div className="app">
      <header className="app-header">
        <h1>WorkshopHub</h1>
        <p className="app-tagline">Internal Training Registration System</p>
      </header>
      <main className="app-main">
        {detail ? <SessionDetailPage id={Number(detail[1])} /> : <TrainingSessionsPage />}
      </main>
    </div>
  )
}

export default App
