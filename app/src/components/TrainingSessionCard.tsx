import type { TrainingSession } from '../types'
import type { SessionCounts } from '../api'
import RegistrationPanel from './RegistrationPanel'
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

  function handleCountsChange(counts: SessionCounts) {
    onSessionChange({
      id: session.id,
      registered: counts.registered,
      capacity: counts.capacity,
      waitlisted: counts.waitlisted,
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

      <RegistrationPanel session={session} onCountsChange={handleCountsChange} />
    </article>
  )
}

export default TrainingSessionCard
