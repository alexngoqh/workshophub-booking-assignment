import { useState, type FormEvent } from 'react'
import type { TrainingSession } from '../types'
import { registerForSession } from '../api'
import './TrainingSessionCard.css'

interface Props {
  session: TrainingSession
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

function TrainingSessionCard({ session }: Props) {
  const [registered, setRegistered] = useState(session.registered)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  const spotsLeft = session.capacity - registered
  const isFull = spotsLeft <= 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await registerForSession(session.id, { name, email })
    setSubmitting(false)

    if (result.ok) {
      setRegistered(result.data.session.registered)
      setFormOpen(false)
      setName('')
      setEmail('')
      setConfirmation(`You're registered for ${result.data.session.title}!`)
      return
    }

    setError(result.error)
    if (result.status === 409) {
      setRegistered(session.capacity)
    }
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
            {registered} / {session.capacity} registered
            {!isFull && (
              <span className="spots-left">
                {' '}
                ({spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left)
              </span>
            )}
          </span>
        </div>
      </div>

      {confirmation && (
        <p className="session-card__confirmation" role="status">
          {confirmation}
        </p>
      )}

      {formOpen ? (
        <form className="session-card__form" onSubmit={handleSubmit} noValidate>
          <label className="session-card__field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="session-card__field">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && (
            <p className="session-card__error" role="alert">
              {error}
            </p>
          )}
          <div className="session-card__actions">
            <button type="submit" className="session-card__button" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Confirm registration'}
            </button>
            <button
              type="button"
              className="session-card__button session-card__button--secondary"
              onClick={() => {
                setFormOpen(false)
                setError(null)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="session-card__button"
          disabled={isFull}
          onClick={() => {
            setFormOpen(true)
            setConfirmation(null)
          }}
        >
          {isFull ? 'Full' : 'Register'}
        </button>
      )}
    </article>
  )
}

export default TrainingSessionCard
