import { useEffect, useState } from 'react'
import type { TrainingSession } from '../types'
import TrainingSessionCard from '../components/TrainingSessionCard'
import './TrainingSessionsPage.css'

import { API_BASE } from '../api'

function TrainingSessionsPage() {
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function handleSessionChange(update: Partial<TrainingSession> & { id: number }) {
    setSessions((current) => current.map((s) => (s.id === update.id ? { ...s, ...update } : s)))
  }

  useEffect(() => {
    fetch(`${API_BASE}/api/training-sessions`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`)
        return res.json()
      })
      .then((data: TrainingSession[]) => {
        setSessions(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="page-state">Loading training sessions...</div>
  }

  if (error) {
    return (
      <div className="page-state page-state--error">
        <p>Failed to load training sessions.</p>
        <p className="error-detail">{error}</p>
      </div>
    )
  }

  if (sessions.length === 0) {
    return <div className="page-state">No training sessions available.</div>
  }

  return (
    <section className="sessions-page">
      <h2 className="sessions-heading">Available Training Sessions</h2>
      <p className="sessions-count">
        {sessions.length} session{sessions.length !== 1 ? 's' : ''} available
      </p>
      <div className="sessions-grid">
        {sessions.map((session) => (
          <TrainingSessionCard
            key={session.id}
            session={session}
            onSessionChange={handleSessionChange}
          />
        ))}
      </div>
    </section>
  )
}

export default TrainingSessionsPage
