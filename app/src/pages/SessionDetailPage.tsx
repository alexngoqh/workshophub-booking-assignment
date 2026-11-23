import { useEffect, useState } from 'react'
import type { RegistrationListItem, RegistrationRoster, TrainingSession } from '../types'
import { getSession, listRegistrations } from '../api'
import { Link } from '../router'
import './SessionDetailPage.css'

interface Props {
  id: number
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-SG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function RegistrationList({ items }: { items: RegistrationListItem[] }) {
  return (
    <ul className="session-detail__list">
      {items.map((item) => (
        <li key={item.id} className="session-detail__item">
          <span className="session-detail__name">{item.name}</span>
          <span className="session-detail__email">{item.email}</span>
          <span className="session-detail__date">{formatDate(item.createdAt)}</span>
        </li>
      ))}
    </ul>
  )
}

function SessionDetailPage({ id }: Props) {
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [roster, setRoster] = useState<RegistrationRoster | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setSession(null)
    setRoster(null)
    setError(null)
    Promise.all([getSession(id), listRegistrations(id)]).then(([s, r]) => {
      if (!active) return
      if (!s.ok || !r.ok) {
        const failed = !s.ok ? s : !r.ok ? r : null
        setError(failed?.status === 404 ? 'Training session not found' : (failed?.error ?? null))
        return
      }
      setSession(s.data)
      setRoster(r.data)
    })
    return () => {
      active = false
    }
  }, [id])

  const back = (
    <Link to="/" className="session-detail__back">
      ← All sessions
    </Link>
  )

  if (error) {
    return (
      <section className="session-detail">
        {back}
        <p className="page-state page-state--error">{error}</p>
      </section>
    )
  }

  if (!session || !roster) {
    return (
      <section className="session-detail">
        {back}
        <p className="page-state">Loading session...</p>
      </section>
    )
  }

  const empty = roster.confirmed.length === 0 && roster.waitlisted.length === 0

  return (
    <section className="session-detail">
      {back}
      <h2 className="session-detail__title">{session.title}</h2>
      <p className="session-detail__meta">
        {formatDate(session.date)} · {session.location}
      </p>
      <p className="session-detail__description">{session.description}</p>

      <section className="session-detail__registrations">
        <h3>Registrations</h3>
        {empty ? (
          <p className="session-detail__empty">No registrations yet</p>
        ) : (
          <>
            <h4>Confirmed ({roster.confirmed.length})</h4>
            <RegistrationList items={roster.confirmed} />
            <h4>Waitlist ({roster.waitlisted.length})</h4>
            <RegistrationList items={roster.waitlisted} />
          </>
        )}
      </section>
    </section>
  )
}

export default SessionDetailPage
