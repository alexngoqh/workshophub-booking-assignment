import { useState } from 'react'
import type { TrainingSession } from '../types'
import type { RegistrationResponse } from '../api'
import RegistrationForm from './RegistrationForm'
import './TrainingSessionCard.css'

interface Props {
  session: TrainingSession
  onSessionChange: (update: Partial<TrainingSession> & { id: number }) => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-SG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function deliveryModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    'in-person': 'In Person',
    online: 'Online',
    hybrid: 'Hybrid',
  }
  return labels[mode] ?? mode
}

function TrainingSessionCard({ session, onSessionChange }: Props) {
  const spotsLeft = session.capacity - session.registered
  const isFull = spotsLeft <= 0
  const [formOpen, setFormOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  function handleRegistered(registration: RegistrationResponse) {
    setFormOpen(false)
    setConfirmation(
      registration.status === 'waitlisted'
        ? `You're on the waitlist (position ${registration.position}). Your place is not confirmed yet.`
        : `Registration confirmed for ${registration.name} (${registration.email}).`
    )
    onSessionChange({
      id: session.id,
      registered: registration.session.registered,
      capacity: registration.session.capacity,
      waitlisted: registration.session.waitlisted,
    })
  }

  return (
    <article className={`session-card ${isFull ? 'session-card--full' : ''}`}>
      <div className="session-card__header">
        <span className={`session-badge session-badge--${session.deliveryMode}`}>
          {deliveryModeLabel(session.deliveryMode)}
        </span>
        {isFull && <span className="session-badge session-badge--full">Full</span>}
      </div>

      <h3 className="session-card__title">{session.title}</h3>
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

      <div className="session-card__actions">
        {confirmation && (
          <p className="session-card__confirmation" role="status">
            {confirmation}
          </p>
        )}
        {formOpen ? (
          <RegistrationForm
            sessionId={session.id}
            submitLabel={isFull ? 'Join waitlist' : 'Confirm registration'}
            onRegistered={handleRegistered}
            onCancel={() => setFormOpen(false)}
          />
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setConfirmation(null)
              setFormOpen(true)
            }}
          >
            {isFull ? 'Join Waitlist' : 'Register'}
          </button>
        )}
      </div>
    </article>
  )
}

export default TrainingSessionCard
