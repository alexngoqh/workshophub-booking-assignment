import type { MouseEvent } from 'react'
import type { TrainingSession } from '../types'
import type { SessionCounts } from '../api'
import RegistrationPanel from './RegistrationPanel'
import { deliveryModeLabel, formatDate, formatTime } from '../format'
import { linkHandler, navigate, sessionPath } from '../router'
import './TrainingSessionCard.css'

interface Props {
  session: TrainingSession
  onSessionChange: (update: Partial<TrainingSession> & { id: number }) => void
}

function TrainingSessionCard({ session, onSessionChange }: Props) {
  const spotsLeft = session.capacity - session.registered
  const isFull = spotsLeft <= 0

  function handleCountsChange(counts: SessionCounts) {
    onSessionChange({
      id: session.id,
      registered: counts.registered,
      capacity: counts.capacity,
      waitlisted: counts.waitlisted,
    })
  }

  // Clicking anywhere on the card opens the detail page, except on interactive elements.
  function handleCardClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement
    if (target.closest('button, a, input, label, form, textarea, select')) return
    navigate(sessionPath(session.id))
  }

  return (
    <article
      className={`session-card ${isFull ? 'session-card--full' : ''}`}
      onClick={handleCardClick}
    >
      <div className="session-card__header">
        <span className={`session-badge session-badge--${session.deliveryMode}`}>
          {deliveryModeLabel(session.deliveryMode)}
        </span>
        {isFull && <span className="session-badge session-badge--full">Full</span>}
      </div>

      <h3 className="session-card__title">
        <a href={sessionPath(session.id)} onClick={linkHandler(sessionPath(session.id))}>
          {session.title}
        </a>
      </h3>
      <p className="session-card__description">{session.description}</p>

      <div className="session-card__meta">
        <div className="meta-item">
          <span className="meta-label">Date</span>
          <span className="meta-value">{formatDate(session.date)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Time</span>
          <span className="meta-value">{formatTime(session.date)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Location</span>
          <span className="meta-value">{session.location}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Capacity</span>
          <span className="meta-value">
            {session.registered} / {session.capacity} registered
            {!isFull && (
              <span className="spots-left">
                {' '}
                ({spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left)
              </span>
            )}
          </span>
        </div>
        {session.waitlisted > 0 && (
          <div className="meta-item">
            <span className="meta-label">Waitlist</span>
            <span className="meta-value">{session.waitlisted} on waitlist</span>
          </div>
        )}
      </div>

      <RegistrationPanel session={session} onCountsChange={handleCountsChange} />
    </article>
  )
}

export default TrainingSessionCard
