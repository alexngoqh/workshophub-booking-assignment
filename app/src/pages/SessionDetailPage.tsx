import { useEffect, useState } from 'react'
import type { TrainingSession } from '../types'
import { getSession, listRegistrations, RegistrationLookup, SessionRegistrations } from '../api'
import { deliveryModeLabel, formatDate, formatDateTime, formatTime } from '../format'
import { linkHandler } from '../router'
import './SessionDetailPage.css'

interface Props {
  sessionId: number
}

type State =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; session: TrainingSession; registrations: SessionRegistrations }

function RegistrantList({ title, entries }: { title: string; entries: RegistrationLookup[] }) {
  return (
    <section className="registrant-group" aria-label={title}>
      <h4 className="registrant-group__title">
        {title} ({entries.length})
      </h4>
      {entries.length === 0 ? (
        <p className="registrant-group__empty">None</p>
      ) : (
        <table className="registrant-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Registered on</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{formatDateTime(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function SessionDetailPage({ sessionId }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    setState({ kind: 'loading' })
    Promise.all([getSession<TrainingSession>(sessionId), listRegistrations(sessionId)]).then(
      ([session, registrations]) => {
        if (!active) return
        if (session.status === 404 || registrations.status === 404) {
          setState({ kind: 'not_found' })
        } else if (!session.ok) {
          setState({ kind: 'error', message: session.error })
        } else if (!registrations.ok) {
          setState({ kind: 'error', message: registrations.error })
        } else {
          setState({ kind: 'ready', session: session.data, registrations: registrations.data })
        }
      }
    )
    return () => {
      active = false
    }
  }, [sessionId])

  const backLink = (
    <a href="/" className="back-link" onClick={linkHandler('/')}>
      ← All sessions
    </a>
  )

  if (state.kind === 'loading') return <div className="page-state">Loading session...</div>
  if (state.kind === 'not_found') {
    return (
      <div className="page-state">
        <p>Session not found.</p>
        {backLink}
      </div>
    )
  }
  if (state.kind === 'error') {
    return (
      <div className="page-state page-state--error">
        <p>Failed to load session.</p>
        <p className="error-detail">{state.message}</p>
        {backLink}
      </div>
    )
  }

  const { session, registrations } = state
  const isEmpty = registrations.confirmed.length === 0 && registrations.waitlisted.length === 0

  return (
    <article className="session-detail">
      {backLink}
      <h2 className="session-detail__title">{session.title}</h2>
      <dl className="session-detail__meta">
        <dt>Date</dt>
        <dd>{formatDate(session.date)}</dd>
        <dt>Time</dt>
        <dd>{formatTime(session.date)}</dd>
        <dt>Location</dt>
        <dd>{session.location}</dd>
        <dt>Delivery</dt>
        <dd>{deliveryModeLabel(session.deliveryMode)}</dd>
        <dt>Capacity</dt>
        <dd>
          {session.registered} / {session.capacity} registered
        </dd>
      </dl>
      <p className="session-detail__description">{session.description}</p>

      <section className="session-detail__registrations" aria-labelledby="registrations-heading">
        <h3 id="registrations-heading">Registrations</h3>
        {isEmpty ? (
          <p className="registrant-group__empty">No registrations yet</p>
        ) : (
          <>
            <RegistrantList title="Confirmed" entries={registrations.confirmed} />
            <RegistrantList title="Waitlist" entries={registrations.waitlisted} />
          </>
        )}
      </section>
    </article>
  )
}

export default SessionDetailPage
