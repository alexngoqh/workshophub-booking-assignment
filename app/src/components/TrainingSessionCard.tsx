import { useEffect, useState, type FormEvent } from 'react'
import type { RegistrationStatus, TrainingSession } from '../types'
import { cancelRegistration, getRegistration, registerForSession } from '../api'
import { Link } from '../router'
import './TrainingSessionCard.css'

// The browser's own registration id per session, so status survives a refresh (no auth).
// Storage can be unavailable (private mode), so every access is best-effort.
const storageKey = (sessionId: number) => 'workshophub.registration.' + sessionId

function loadMyRegistrationId(sessionId: number): number | null {
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId))
    const id = raw === null ? NaN : Number(raw)
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

function saveMyRegistrationId(sessionId: number, registrationId: number): void {
  try {
    window.localStorage.setItem(storageKey(sessionId), String(registrationId))
  } catch {
    // ignore
  }
}

function clearMyRegistrationId(sessionId: number): void {
  try {
    window.localStorage.removeItem(storageKey(sessionId))
  } catch {
    // ignore
  }
}

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
  const [waitlisted, setWaitlisted] = useState<number | null>(null)
  const [myPosition, setMyPosition] = useState<number | null>(null)
  const [myRegistrationId, setMyRegistrationId] = useState<number | null>(null)
  const [myStatus, setMyStatus] = useState<RegistrationStatus | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const spotsLeft = session.capacity - registered
  const isFull = spotsLeft <= 0

  useEffect(() => {
    const id = loadMyRegistrationId(session.id)
    if (id === null) {
      return
    }
    getRegistration(session.id, id).then((result) => {
      if (result.ok) {
        setMyRegistrationId(id)
        setMyStatus(result.data.status)
        setMyPosition(result.data.position)
      } else if (result.status === 404) {
        clearMyRegistrationId(session.id)
      }
    })
  }, [session.id])

  async function handleCancel() {
    if (myRegistrationId === null) {
      return
    }
    if (
      !window.confirm(`Are you sure you want to cancel your registration for ${session.title}?`)
    ) {
      return
    }

    setCancelling(true)
    setError(null)
    const result = await cancelRegistration(session.id, myRegistrationId)
    setCancelling(false)

    if (result.ok) {
      // promotedRegistrationId is deliberately not shown: promotion is invisible to the canceller.
      setRegistered(result.data.session.registered)
      setWaitlisted(result.data.session.waitlisted)
      setMyStatus('cancelled')
      setMyPosition(null)
      setConfirmation('Your registration has been cancelled')
      return
    }

    if (result.status === 409) {
      setMyStatus('cancelled')
    } else {
      setError(result.error)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await registerForSession(session.id, { name, email })
    setSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    const { data } = result
    saveMyRegistrationId(session.id, data.id)
    setMyRegistrationId(data.id)
    setMyStatus(data.status)
    setRegistered(data.session.registered)
    setWaitlisted(data.session.waitlisted)
    if (data.status === 'waitlisted') {
      const position = data.position ?? null
      setMyPosition(position)
      setConfirmation(
        `You're on the waitlist for ${data.session.title} (position ${position}). You are not confirmed yet.`
      )
    } else {
      setConfirmation(`You're registered for ${data.session.title}!`)
    }
    setFormOpen(false)
    setName('')
    setEmail('')
  }

  return (
    <article className={`session-card ${isFull ? 'session-card--full' : ''}`}>
      <div className="session-card__header">
        <span className={`session-badge session-badge--${session.deliveryMode}`}>
          {deliveryModeLabel(session.deliveryMode)}
        </span>
        {isFull && <span className="session-badge session-badge--full">Full</span>}
      </div>

      <h3 className="session-card__title">
        <Link to={`/sessions/${session.id}`} className="session-card__title-link">
          {session.title}
        </Link>
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
            {registered} / {session.capacity} registered
            {!isFull && (
              <span className="spots-left">
                {' '}
                ({spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left)
              </span>
            )}
            {waitlisted !== null && waitlisted > 0 && (
              <span className="session-card__waitlist-count"> · {waitlisted} on waitlist</span>
            )}
          </span>
        </div>
      </div>

      {myStatus === 'confirmed' && (
        <p className="session-card__my-status session-card__status--confirmed">
          Your status: Confirmed
        </p>
      )}
      {myStatus === 'waitlisted' && myPosition !== null && (
        <p className="session-card__my-status">Your status: Waitlisted (position {myPosition})</p>
      )}

      {(myStatus === 'confirmed' || myStatus === 'waitlisted') && (
        <button
          type="button"
          className="session-card__button session-card__cancel"
          disabled={cancelling}
          onClick={handleCancel}
        >
          Cancel Registration
        </button>
      )}
      {myStatus === 'cancelled' && (
        <span className="session-card__cancelled" aria-disabled="true">
          Cancelled
        </span>
      )}

      {confirmation && (
        <p className="session-card__confirmation" role="status">
          {confirmation}
        </p>
      )}

      {error && !formOpen && (
        <p className="session-card__error" role="alert">
          {error}
        </p>
      )}

      {myStatus === 'confirmed' || myStatus === 'waitlisted' ? null : formOpen ? (
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
              {submitting ? 'Submitting…' : isFull ? 'Join waitlist' : 'Confirm registration'}
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
          className={`session-card__button ${isFull ? 'session-card__button--waitlist' : ''}`}
          disabled={submitting}
          onClick={() => {
            setFormOpen(true)
            setConfirmation(null)
          }}
        >
          {isFull ? 'Join Waitlist' : 'Register'}
        </button>
      )}
    </article>
  )
}

export default TrainingSessionCard
